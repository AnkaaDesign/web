// =====================================================
// Attention system — rule registry (code-defined, Phase 1)
// =====================================================
//
// Rules are DATA. In Phase 1 they live here as typed constants (fast to ship,
// proves the engine); Phase 3 moves them behind an `AttentionRule` table + admin
// editor and this module becomes the seed / fallback. The engine and the config
// UI both consume the same `AttentionRule` shape, so nothing downstream changes
// when the source flips from code to DB.
//
// Field names are the REAL task fields (verified): Task.cleared:boolean,
// Task.entryDate, Task.forecastDate, Task.serialNumber; chassis/plate/plaqueta live
// on the related truck (truck.chassisNumber / truck.plate / truck.vinPlateId). Field
// targets name the DetailFieldDef id / DataTable column id so the exact field blinks.
//
// A plaqueta voltou a ter regra (R3c) porque deixou de ser TEXTO e virou FOTO: o
// motivo de a regra antiga ter caído era ser irresolvível na prática — ninguém
// digitava o número. Fotografar a plaqueta é uma ação concreta, então o alerta
// agora aponta para algo que dá para resolver. O teste é sobre `truck.vinPlateId`
// (o escalar), não sobre a relação `truck.vinPlate`, que só vem quando incluída.

import {
  SECTOR_PRIVILEGES,
  CUT_STATUS,
  TASK_STATUS,
  ORDER_STATUS,
  PPE_DELIVERY_STATUS,
  AIRBRUSHING_STATUS,
  TASK_QUOTE_STATUS,
} from "@/constants";

import { PINNED_CUSTOMERS } from "@/config/company";
import { NFSE_DOCUMENT_FIELDS, NFSE_REQUIRED_CUSTOMER_FIELDS } from "@/lib/billing-customer-data";

import type { AttentionCadence, AttentionRule, PredicateNode } from "./types";
import { NOW_SENTINEL } from "./types";

/**
 * Every TASK rule below implicitly means "...and this is still in flight" — a
 * COMPLETED or CANCELLED task's missing chassis/plate or overdue forecast is
 * history, not something to act on. Wrap each rule's real predicate with this so
 * a finished task can never light up (verified against prod data: without this
 * guard R2/R3a/R3b matched ~1900 already-COMPLETED tasks each).
 */
function whileInFlight(node: PredicateNode): PredicateNode {
  return {
    op: "and",
    nodes: [{ op: "ne", field: "status", value: TASK_STATUS.COMPLETED }, { op: "ne", field: "status", value: TASK_STATUS.CANCELLED }, node],
  };
}

/**
 * The quote has not been billed yet — the only window in which a missing invoicing field is
 * still BLOCKING anything.
 *
 * Written as the two statuses that precede billing rather than as "not CANCELLED / not SETTLED",
 * because the negative form let every post-invoice status through: eleven Ibiporã quotes whose
 * nota had been issued and whose money had been in the bank for months kept blinking, which is
 * half of why the Faturamento list looked like it was on fire. A new TaskQuoteStatus added later
 * defaults to "already past this point", which is the safe direction for an alert.
 */
function notYetInvoiced(): PredicateNode {
  return {
    op: "or",
    nodes: [
      { op: "eq", field: "status", value: TASK_QUOTE_STATUS.PENDING },
      { op: "eq", field: "status", value: TASK_QUOTE_STATUS.BUDGET_APPROVED },
    ],
  };
}

/**
 * "This customer cannot receive an NFS-e yet", as a predicate over the customer at `prefix`.
 *
 * BUILT from `NFSE_REQUIRED_CUSTOMER_FIELDS` rather than transcribed, so the rule and the save
 * gate that rejects the very same record (`validateCustomerData`) can never disagree about which
 * fields matter. `isNull` counts "" as missing, matching the `= ''` in the server mirror.
 *
 * The `notNull` on the primary key is not a formality — it is what stops the rule from being a
 * catastrophe. `isNull` cannot tell "this column is empty" from "this path is not in the object",
 * so a quote registered by a query that forgot `customerConfigs.customer` reads as EVERY field
 * missing, and the rule fires on every row in the list. That is the exact failure this whole
 * change set exists to remove, so an unloaded relation must mean NO EVIDENCE, never evidence of
 * absence. (A caught regression: the Ibiporã tests, whose fixtures carry no customer, all started
 * matching this rule too.) The id is in every include that feeds the engine.
 */
function customerMissingBillingData(prefix: string): PredicateNode {
  return {
    op: "and",
    nodes: [
      { op: "notNull", field: `${prefix}.id` },
      {
        op: "or",
        nodes: [
          // The document is satisfied by EITHER — only missing when both are.
          { op: "and", nodes: NFSE_DOCUMENT_FIELDS.map((key) => ({ op: "isNull", field: `${prefix}.${key}` }) as PredicateNode) },
          ...NFSE_REQUIRED_CUSTOMER_FIELDS.map((field) => ({ op: "isNull", field: `${prefix}.${field.key}` }) as PredicateNode),
        ],
      },
    ],
  };
}

/** Sensible cadence defaults; individual rules override what they need. */
function cadence(overrides: Partial<AttentionCadence> = {}): AttentionCadence {
  return {
    blinkCount: 5, // "blink/bip the 5x it will do"
    intervalMs: 750, // bip spacing; ~= pulseMs so blink and bip stay in step
    pulseMs: 750,
    soundEnabled: true,
    tone: "soft",
    cooldownMs: 30 * 60 * 1000, // the hardcoded-30min, now per rule
    ...overrides,
  };
}

/**
 * The Phase-1 rule set. Order is irrelevant (matches are keyed by rule id);
 * `priority` breaks ties when several rules hit the same address.
 */
export const ATTENTION_RULES: AttentionRule[] = [
  // R1 — cleared but no entry date yet → nudge logistics/prod-manager on the forecast.
  {
    id: "task.cleared-without-entry",
    name: "Liberado sem data de entrada",
    entityType: "TASK",
    enabled: true,
    priority: 10,
    targetSectors: [SECTOR_PRIVILEGES.LOGISTIC, SECTOR_PRIVILEGES.PRODUCTION_MANAGER],
    predicate: whileInFlight({
      op: "and",
      nodes: [
        { op: "isTrue", field: "cleared" },
        { op: "isNull", field: "entryDate" },
      ],
    }),
    target: { level: "field", field: "forecastDate" },
    ack: "onExitCooldown",
    cadence: cadence({ tone: "soft" }),
  },

  // R2 — forecast date passed and it is NOT cleared → higher urgency, harsh tone.
  {
    id: "task.forecast-overdue-not-cleared",
    name: "Previsão vencida sem liberação",
    entityType: "TASK",
    enabled: true,
    priority: 30,
    targetSectors: [SECTOR_PRIVILEGES.LOGISTIC, SECTOR_PRIVILEGES.PRODUCTION_MANAGER],
    predicate: whileInFlight({
      op: "and",
      nodes: [
        { op: "lt", field: "forecastDate", value: NOW_SENTINEL },
        { op: "isFalse", field: "cleared" },
      ],
    }),
    target: { level: "field", field: "forecastDate" },
    ack: "onExitCooldown",
    cadence: cadence({ tone: "harsh" }),
  },

  // R3a — truck is here (entry given) but the CHASSIS is missing → blink the chassis field.
  // Split from the plate rule so each blinks the field that is ACTUALLY empty (blinking a
  // filled chassis just because the plate is missing is misleading).
  {
    id: "task.entry-without-chassis",
    name: "Entrada sem chassi",
    entityType: "TASK",
    enabled: true,
    priority: 20,
    targetSectors: [SECTOR_PRIVILEGES.LOGISTIC, SECTOR_PRIVILEGES.PRODUCTION_MANAGER],
    predicate: whileInFlight({
      op: "and",
      nodes: [
        { op: "notNull", field: "entryDate" },
        { op: "isNull", field: "truck.chassisNumber" },
      ],
    }),
    target: { level: "field", field: "chassisNumber" },
    ack: "onExitCooldown",
    cadence: cadence({ tone: "soft" }),
  },

  // R3b — truck is here but the PLATE (truck.plate) is missing → blink the plate field.
  //
  // Gated on the task having NO serial number: the serial and the plate are two ways of
  // identifying the same vehicle, and a task that already carries a serial is identified.
  // Nagging for a plate it will never have is the kind of permanently-unresolvable alert
  // that teaches people to ignore the whole system.
  {
    id: "task.entry-without-plate",
    name: "Entrada sem placa",
    entityType: "TASK",
    enabled: true,
    priority: 20,
    targetSectors: [SECTOR_PRIVILEGES.LOGISTIC, SECTOR_PRIVILEGES.PRODUCTION_MANAGER],
    predicate: whileInFlight({
      op: "and",
      nodes: [
        { op: "notNull", field: "entryDate" },
        { op: "isNull", field: "serialNumber" },
        { op: "isNull", field: "truck.plate" },
      ],
    }),
    target: { level: "field", field: "plate" },
    ack: "onExitCooldown",
    cadence: cadence({ tone: "soft" }),
  },

  // R3c — truck is here but nobody fotografou a PLAQUETA (truck.vinPlateId) → blink the
  // plaqueta field.
  //
  // Diferente de R3b, esta NÃO é condicionada a série/placa: a plaqueta é a identificação
  // física rebitada no veículo e a foto é o registro de que ela foi conferida. Vale para
  // toda tarefa que já entrou, tenha série ou não.
  {
    id: "task.entry-without-vin-plate-photo",
    name: "Entrada sem foto da plaqueta",
    entityType: "TASK",
    enabled: true,
    priority: 20,
    targetSectors: [SECTOR_PRIVILEGES.LOGISTIC, SECTOR_PRIVILEGES.PRODUCTION_MANAGER],
    predicate: whileInFlight({
      op: "and",
      nodes: [
        { op: "notNull", field: "entryDate" },
        { op: "isNull", field: "truck.vinPlateId" },
      ],
    }),
    target: { level: "field", field: "vinPlate" },
    ack: "onExitCooldown",
    cadence: cadence({ tone: "soft" }),
  },

  // R0 — the (previously hardcoded) cut signal, now expressible as a rule for
  // ROW-level blink on the cut table. The nav-menu aggregate alert still runs via
  // its existing path (use-nav-activity) untouched; this is additive.
  {
    id: "cut.pending",
    name: "Recorte pendente",
    entityType: "CUT",
    enabled: true,
    priority: 15,
    // PLOTTING joined WAREHOUSE: plotagem operates the cutter and already
    // reaches /producao/recorte, so it was being kept from the one signal that
    // names its own queue.
    targetSectors: [SECTOR_PRIVILEGES.WAREHOUSE, SECTOR_PRIVILEGES.PLOTTING],
    predicate: { op: "eq", field: "status", value: CUT_STATUS.PENDING },
    target: { level: "row" },
    ack: "onView",
    cadence: cadence({ tone: "harsh", cooldownMs: 30 * 60 * 1000 }),
  },

  // ── Almoxarifado ────────────────────────────────────────────────────────────
  // The forecast passed and the order still is not in. RECEIVED/CANCELLED are
  // excluded rather than the open statuses being listed, so a new ORDER_STATUS
  // member defaults to "still open" instead of silently muting the rule.
  {
    id: "order.forecast-overdue",
    name: "Pedido com previsão vencida",
    entityType: "ORDER",
    enabled: true,
    priority: 25,
    targetSectors: [SECTOR_PRIVILEGES.WAREHOUSE],
    predicate: {
      op: "and",
      nodes: [
        { op: "lt", field: "forecast", value: NOW_SENTINEL },
        { op: "ne", field: "status", value: ORDER_STATUS.RECEIVED },
        { op: "ne", field: "status", value: ORDER_STATUS.CANCELLED },
      ],
    },
    target: { level: "row" },
    ack: "onExitCooldown",
    cadence: cadence({ tone: "harsh" }),
  },
  // Approved but never handed over — the almoxarifado owns `mark-delivered`.
  {
    id: "ppe-delivery.approved-not-delivered",
    name: "EPI aprovado sem entrega",
    entityType: "PPE_DELIVERY",
    enabled: true,
    priority: 15,
    targetSectors: [SECTOR_PRIVILEGES.WAREHOUSE],
    predicate: { op: "eq", field: "status", value: PPE_DELIVERY_STATUS.APPROVED },
    target: { level: "row" },
    ack: "onView",
    cadence: cadence({ tone: "soft" }),
  },

  // ── Contabilidade ───────────────────────────────────────────────────────────
  // Awaiting approve/reject. ACCOUNTING only, even though HUMAN_RESOURCES shares
  // the approval permission: DP has no menu entry for PPE deliveries, and a rule
  // whose nav home its audience cannot open bips with nowhere to go. Give DP the
  // route first, then widen this.
  {
    id: "ppe-delivery.pending-review",
    name: "EPI aguardando análise",
    entityType: "PPE_DELIVERY",
    enabled: true,
    priority: 20,
    targetSectors: [SECTOR_PRIVILEGES.ACCOUNTING],
    predicate: { op: "eq", field: "status", value: PPE_DELIVERY_STATUS.PENDING },
    target: { level: "row" },
    ack: "onView",
    cadence: cadence({ tone: "soft" }),
  },

  // ── Produção ────────────────────────────────────────────────────────────────
  //
  // VAZIA DE PROPÓSITO: PRODUCTION não tem regra de atenção. `attention-audience.test.ts`
  // trava isso — se um dia uma regra voltar a mirar o setor, o teste quebra antes do deploy.
  //
  // Havia `airbrushing.waiting-production` (`targetSectors: [PRODUCTION]`, aerografia em
  // WAITING_PRODUCTION). Duas coisas a condenaram:
  //
  //   1. A audiência não conseguia abrir o que a regra apontava. No APP o gate da Aerografia
  //      é `production && isTeamLeader`, e o chão de fábrica perdeu a página em 29/07/2026,
  //      um dia depois de a regra nascer. O filtro de audiência (aqui, na API e no Flutter)
  //      conhece UM privilégio; TEAM_LEADER é virtual (`sector.leaderId`), então "só o líder"
  //      não é exprimível — ou a fábrica inteira recebe, ou ninguém.
  //   2. Ninguém em PRODUCTION podia resolvê-la. Quem move WAITING_PRODUCTION -> IN_PRODUCTION
  //      é o AEROGRAFISTA (`kPainterStatusTransitions`), e AIRBRUSHING é outro setor. Alerta
  //      que o público não pode encerrar é o "permanently unresolvable alert" que a regra de
  //      seleção deste arquivo proíbe.
  //
  // Zerar `targetSectors` não seria conserto: lista vazia = TODO setor (ver `ruleApplies`).
  // Se a fila voltar a avisar, é o pintor — e escopada ao próprio (`painterId`), como
  // `ppe-delivery.awaiting-my-signature` faz com `userId`.

  // ── Comercial / Financeiro ──────────────────────────────────────────────────
  //
  // There were two more rules here — `task-quote.expired-pending` (orçamento PENDING past its
  // own `expiresAt`) and `task-quote.due` (status DUE) — and they are GONE on purpose. Between
  // them they matched 171 of the ~250 rows in Faturamento/Orçamento, which is how the list came
  // to look like everything was on fire while nothing on it was actionable:
  //
  //   • DUE is a STATUS the table already prints in red, and it is resolved by the CUSTOMER
  //     paying. Nobody here can clear it, so it re-armed every 30 minutes forever — the exact
  //     "permanently unresolvable alert" this file's own rule-selection principle forbids.
  //     Worse, half of them were already invoiced and settled downstream.
  //   • expired-pending matched 147 budgets, 74 of them expired MORE THAN 90 DAYS ago. A backlog
  //     that large is a report, not an alert; blinking all of it teaches people to ignore the
  //     colour everywhere else.
  //
  // What replaces them is below: the two things that genuinely BLOCK an invoice from going out,
  // both targeted at the exact field that unblocks it.

  // R6 — Faturamento da Ibiporã sem N° do Pedido.
  //
  // A Ibiporã fatura contra pedido de compra: sem o número dela a nota não sai. Enquanto a tarefa
  // está em andamento isso é só um cadastro incompleto; quando a tarefa TERMINA vira faturamento
  // travado, e alguém precisa ligar e pedir o número. Por isso o gatilho é `task.status`
  // COMPLETED — e por isso esta é a ÚNICA regra de tarefa que NÃO passa por `whileInFlight`, que
  // existe exatamente para excluir COMPLETED/CANCELLED. Envolvê-la ali a tornaria estruturalmente
  // incapaz de disparar, e silenciosamente.
  //
  // A entidade é o TASK_QUOTE, não a TASK: o descritor de TASK_QUOTE já aponta para
  // Orçamento/Faturamento (`entities.ts`), que são as duas telas onde o campo existe, enquanto o
  // de TASK aponta para Agenda/Cronograma, onde ninguém preenche pedido. Registrar como TASK
  // também deixaria a página de detalhe da tarefa dar ack (e calar) um alerta financeiro que o
  // usuário de produção nem viu.
  //
  // `task.status` vem do objeto que as listas de Orçamento/Faturamento registram (o quote acrescido
  // de `task: { id, status }`), e não de um include invertido quote → task: assim o caminho fica
  // idêntico ao `where: { task: { status } }` do espelho no servidor.
  //
  // `isNull` trata "" como vazio, então "sem número" cobre tanto null quanto string vazia.
  {
    id: "task-quote.ibipora-missing-order-number",
    name: "Faturamento Ibiporã sem N° do Pedido",
    entityType: "TASK_QUOTE",
    enabled: true,
    // Abaixo de billing-customer-incomplete (22): sem os dados do cliente a nota não sai para
    // NINGUÉM, enquanto o pedido trava só a Ibiporã. A falta do número continua piscando no
    // próprio campo, que é onde ela se resolve.
    priority: 20,
    // Quem pode resolver: FINANCIAL e COMMERCIAL editam o orçamento (canEditQuote). ACCOUNTING
    // abre a página em modo somente-leitura, e alerta para quem não pode agir é o que ensina o
    // time a ignorar o sistema. ADMIN herda automaticamente.
    targetSectors: [SECTOR_PRIVILEGES.FINANCIAL, SECTOR_PRIVILEGES.COMMERCIAL],
    predicate: {
      op: "and",
      nodes: [
        { op: "eq", field: "task.status", value: TASK_STATUS.COMPLETED },
        notYetInvoiced(),
        {
          op: "some",
          field: "customerConfigs",
          node: {
            op: "and",
            nodes: [
              // Mesmo papel do `notNull customer.id` da R7 e pela mesma razão: `isNull` não
              // distingue "coluna vazia" de "caminho ausente no objeto", então um config trazido
              // por um select sem `orderNumber` leria como SEM número e a regra acenderia a lista
              // inteira. O id do config está em todos os includes que alimentam o engine.
              { op: "notNull", field: "id" },
              { op: "eq", field: "customerId", value: PINNED_CUSTOMERS.IBIPORA },
              // Sem nota não há onde imprimir o pedido de compra. Um config com
              // `generateInvoice: false` é justamente o caso "essa parte não vai ter NF".
              { op: "isTrue", field: "generateInvoice" },
              { op: "isNull", field: "orderNumber" },
            ],
          },
        },
      ],
    },
    target: { level: "field", field: "orderNumber" },
    ack: "onExitCooldown",
    // Soft: é pendência de dado, não emergência. Cooldown de 4h em vez dos 30min padrão — o número
    // depende de o cliente responder, então re-armar a cada meia hora cobra algo que ninguém
    // consegue resolver naquele intervalo.
    cadence: cadence({ tone: "soft", cooldownMs: 4 * 60 * 60 * 1000 }),
  },

  // R7 — Tarefa entregue, orçamento aprovado, e o CADASTRO do cliente não permite emitir a nota.
  //
  // O par da R6, e pela mesma razão: é dinheiro parado por causa de um campo. `validateCustomerData`
  // (nas duas páginas de detalhe) já RECUSA salvar como BILLING_APPROVED enquanto faltar qualquer
  // um destes campos — a regra só antecipa essa recusa para a lista, em vez de deixar o usuário
  // descobrir no fim do wizard. Por isso a lista de campos vem de `lib/billing-customer-data.ts`,
  // a mesma que o gate de salvamento e os selos "Dados completos/incompletos" consomem: se um dia
  // a NFS-e exigir outro campo, muda-se num lugar só e as quatro superfícies concordam.
  //
  // O recorte é BUDGET_APPROVED, não "qualquer status": antes disso o orçamento ainda pode nem ser
  // aprovado, e depois disso a nota JÁ SAIU — logo o cadastro já estava bom. É o que torna a regra
  // finita: ela existe exatamente na janela em que o dado bloqueia alguém.
  //
  // Resolve-se por CLIENTE, não por orçamento: preencher o CNPJ de um cliente apaga o alerta de
  // todos os orçamentos dele de uma vez.
  {
    id: "task-quote.billing-customer-incomplete",
    name: "Faturamento sem cadastro completo do cliente",
    entityType: "TASK_QUOTE",
    enabled: true,
    priority: 22,
    targetSectors: [SECTOR_PRIVILEGES.FINANCIAL, SECTOR_PRIVILEGES.COMMERCIAL],
    predicate: {
      op: "and",
      nodes: [
        { op: "eq", field: "task.status", value: TASK_STATUS.COMPLETED },
        { op: "eq", field: "status", value: TASK_QUOTE_STATUS.BUDGET_APPROVED },
        {
          op: "some",
          field: "customerConfigs",
          node: {
            op: "and",
            nodes: [
              // Só quem vai receber NFS-e precisa do cadastro completo.
              { op: "isTrue", field: "generateInvoice" },
              customerMissingBillingData("customer"),
            ],
          },
        },
      ],
    },
    // Endereço de GRUPO: o alvo é o bloco "Dados do cliente" do passo do cliente, e o passo pinta
    // individualmente cada input que está vazio (ver `billing-step-customer.tsx`). Um alvo único
    // por campo exigiria nove regras que sobem e descem juntas.
    target: { level: "field", field: "customerData" },
    ack: "onExitCooldown",
    cadence: cadence({ tone: "soft", cooldownMs: 4 * 60 * 60 * 1000 }),
  },

  // ── Every sector ────────────────────────────────────────────────────────────
  // The one rule with an EMPTY audience, and the reason attention now reaches
  // every sector rather than three.
  //
  // MANUTENÇÃO, AEROGRAFIA, DESIGNER, BÁSICO and EXTERNO have no shared-entity
  // screens at all — only the "Pessoal" block — so no rule over tasks, cuts or
  // orders could ever have reached them. This one lives on /pessoal/meus-epis and
  // names something only that person can do: sign for the PPE they received.
  //
  // The SERVER scopes the match to the caller's own rows (`userId` in the rule's
  // `where`). The predicate here has no such clause because it never needs one:
  // the only page that registers these records locally already lists just the
  // user's own deliveries.
  {
    id: "ppe-delivery.awaiting-my-signature",
    name: "EPI aguardando sua assinatura",
    entityType: "PPE_DELIVERY",
    enabled: true,
    priority: 35,
    targetSectors: [],
    predicate: { op: "eq", field: "status", value: PPE_DELIVERY_STATUS.WAITING_SIGNATURE },
    target: { level: "row" },
    ack: "onView",
    cadence: cadence({ tone: "harsh" }),
  },
];

/** Fast lookup by id (config UI / server sync will keep this in step later). */
export const ATTENTION_RULES_BY_ID: ReadonlyMap<string, AttentionRule> = new Map(ATTENTION_RULES.map((r) => [r.id, r]));
