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
  {
    id: "airbrushing.waiting-production",
    name: "Aerografia aguardando produção",
    entityType: "AIRBRUSHING",
    enabled: true,
    priority: 15,
    targetSectors: [SECTOR_PRIVILEGES.PRODUCTION],
    predicate: { op: "eq", field: "status", value: AIRBRUSHING_STATUS.WAITING_PRODUCTION },
    target: { level: "row" },
    ack: "onView",
    cadence: cadence({ tone: "soft" }),
  },

  // ── Comercial / Financeiro ──────────────────────────────────────────────────
  // Deliberately NOT "budget still pending": every budget is legitimately pending
  // for a while, so that would be permanent noise. Past its OWN expiry date it is
  // a real backlog item — renew it or cancel it.
  {
    id: "task-quote.expired-pending",
    name: "Orçamento vencido sem aprovação",
    entityType: "TASK_QUOTE",
    enabled: true,
    priority: 30,
    targetSectors: [SECTOR_PRIVILEGES.COMMERCIAL, SECTOR_PRIVILEGES.FINANCIAL],
    predicate: {
      op: "and",
      nodes: [
        { op: "eq", field: "status", value: TASK_QUOTE_STATUS.PENDING },
        { op: "lt", field: "expiresAt", value: NOW_SENTINEL },
      ],
    },
    target: { level: "row" },
    ack: "onExitCooldown",
    cadence: cadence({ tone: "harsh" }),
  },
  {
    id: "task-quote.due",
    name: "Parcela vencendo",
    entityType: "TASK_QUOTE",
    enabled: true,
    priority: 25,
    targetSectors: [SECTOR_PRIVILEGES.COMMERCIAL, SECTOR_PRIVILEGES.FINANCIAL],
    predicate: { op: "eq", field: "status", value: TASK_QUOTE_STATUS.DUE },
    target: { level: "row" },
    ack: "onExitCooldown",
    cadence: cadence({ tone: "soft" }),
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
