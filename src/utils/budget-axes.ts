/**
 * OS QUATRO EIXOS DO ORÇAMENTO (Modelo C) numa leitura só, para a faixa do topo.
 *
 * O orçamento anda em quatro eixos independentes — VALOR (`Budget.status`),
 * ARTE de cada veículo (`Implement.layouts`), ASSINATURA (`signatureStatus`) e
 * COBRANÇA (`billable`). Cada eixo responde a duas perguntas: "em que pé está?"
 * e "qual o próximo passo, e de quem é?". Esta função responde as duas sem saber
 * de tela; a faixa (`BudgetAxesStrip`) só desenha.
 *
 * "Para emitir falta…" vem da API (`emission.blockers`, portões E1–E6); aqui
 * cada impedimento ganha o lugar da tela que o resolve.
 */
import {
  BILLABLE_SIGNATURE_STATUSES,
  BUDGET_SIGNATURE_STATUS_LABELS,
  BUDGET_STATUS_LABELS,
} from "@/constants/budget-contract";
import { BUDGET_SIGNATURE_STATUS, TASK_QUOTE_STATUS } from "@/constants/enums";
import type { BudgetEmission, BudgetEmissionGateCode } from "@/types/budget";
import type { ImplementArtState } from "./implement-art";

export type BudgetAxisKey = "value" | "art" | "signature" | "billing";

/** Onde a tela resolve cada coisa; quem hospeda a faixa decide como chegar lá. */
export type BudgetAxisTarget =
  | "value"
  | "art"
  | "signature"
  | "billing"
  | "validity"
  | "responsibles";

/**
 * `done` — o eixo está resolvido; `waiting` — a bola está com o cliente (ou com
 * outra pessoa); `todo` — a bola está com a Ankaa; `blocked` — não anda enquanto
 * outro eixo não andar; `off` — não se aplica (cancelado).
 */
export type BudgetAxisTone = "done" | "waiting" | "todo" | "blocked" | "off";

export interface BudgetAxisNext {
  label: string;
  target: BudgetAxisTarget;
}

export interface BudgetAxis {
  key: BudgetAxisKey;
  title: string;
  state: string;
  tone: BudgetAxisTone;
  /** O próximo passo, quando é da Ankaa; ausente quando está resolvido ou com o cliente. */
  next?: BudgetAxisNext;
  /** Uma linha de contexto ("Com o cliente desde…", "falta a assinatura"). */
  hint?: string;
}

export interface BudgetAxesInput {
  status?: string | null;
  signatureStatus?: string | null;
  billable?: boolean | null;
  emission?: BudgetEmission | null;
  /** O estado da arte de cada veículo vivo do orçamento. */
  artStates: readonly ImplementArtState[];
}

/** "1 de 3 veículos com arte aprovada" — a contagem que a faixa e o checklist usam. */
export function countApprovedArt(states: readonly ImplementArtState[]): { approved: number; total: number } {
  return { approved: states.filter((state) => state === "APPROVED").length, total: states.length };
}

function valueAxis(status: string | null | undefined): BudgetAxis {
  const label = status ? BUDGET_STATUS_LABELS[status as TASK_QUOTE_STATUS] ?? status : "Sem orçamento";
  const base = { key: "value" as const, title: "Valor", state: label };
  switch (status) {
    case TASK_QUOTE_STATUS.APPROVED:
      return { ...base, tone: "done" };
    case TASK_QUOTE_STATUS.IN_NEGOTIATION:
      return { ...base, tone: "waiting", hint: "Com o cliente para aprovar no portal." };
    case TASK_QUOTE_STATUS.CANCELLED:
      return { ...base, tone: "off" };
    case TASK_QUOTE_STATUS.REQUESTED:
    case TASK_QUOTE_STATUS.PENDING:
    case TASK_QUOTE_STATUS.EXPIRED:
      return { ...base, tone: "todo", next: { label: "Enviar ao cliente", target: "value" } };
    default:
      return { ...base, tone: "todo" };
  }
}

function artAxis(states: readonly ImplementArtState[]): BudgetAxis {
  const { approved, total } = countApprovedArt(states);
  const base = { key: "art" as const, title: "Arte" };
  if (total === 0) return { ...base, state: "Sem veículos", tone: "off" };
  const state = `${approved} de ${total} aprovada${total === 1 ? "" : "s"}`;
  if (approved === total) return { ...base, state, tone: "done" };

  const has = (wanted: ImplementArtState) => states.includes(wanted);
  // A ordem é a do trabalho: primeiro existir, depois ir ao cliente, depois refazer.
  if (has("NONE")) return { ...base, state, tone: "todo", next: { label: "Subir arte", target: "art" } };
  if (has("DRAFT")) return { ...base, state, tone: "todo", next: { label: "Enviar arte ao cliente", target: "art" } };
  if (has("REPROVED")) return { ...base, state, tone: "todo", next: { label: "Subir versão nova", target: "art" } };
  return { ...base, state, tone: "waiting", hint: "Com o cliente para aprovar no portal." };
}

function signatureAxis(
  signatureStatus: string | null | undefined,
  valueApproved: boolean,
  emission: BudgetEmission | null | undefined,
): BudgetAxis {
  const status = (signatureStatus || BUDGET_SIGNATURE_STATUS.NOT_ISSUED) as BUDGET_SIGNATURE_STATUS;
  const base = { key: "signature" as const, title: "Assinatura", state: BUDGET_SIGNATURE_STATUS_LABELS[status] ?? status };
  if ((BILLABLE_SIGNATURE_STATUSES as readonly string[]).includes(status)) return { ...base, tone: "done" };
  switch (status) {
    case BUDGET_SIGNATURE_STATUS.AWAITING_CUSTOMER:
      return { ...base, tone: "waiting", hint: "O documento está com os signatários do cliente." };
    case BUDGET_SIGNATURE_STATUS.AWAITING_ANKAA:
      return { ...base, tone: "todo", next: { label: "Assinar pela Ankaa", target: "signature" } };
    default: {
      // NOT_ISSUED, REFUSED, EXPIRED, INVALIDATED: a coleta (re)sai quando o portão abre.
      if (!valueApproved) return { ...base, tone: "blocked", hint: "Sai depois que o valor for aprovado." };
      if (emission && !emission.ready) {
        return { ...base, tone: "blocked", hint: "Há pendências para emitir (veja abaixo)." };
      }
      const label = status === BUDGET_SIGNATURE_STATUS.NOT_ISSUED ? "Emitir para assinatura" : "Emitir de novo";
      return { ...base, tone: "todo", next: { label, target: "signature" } };
    }
  }
}

function billingAxis(input: BudgetAxesInput, valueApproved: boolean, signatureResolved: boolean): BudgetAxis {
  const base = { key: "billing" as const, title: "Cobrança" };
  if (input.status === TASK_QUOTE_STATUS.CANCELLED) return { ...base, state: "—", tone: "off" };
  const billable =
    typeof input.billable === "boolean" ? input.billable : valueApproved && signatureResolved;
  if (billable) {
    return { ...base, state: "Liberada", tone: "todo", next: { label: "Ir para o faturamento", target: "billing" } };
  }
  return {
    ...base,
    state: "Bloqueada",
    tone: "blocked",
    hint: !valueApproved ? "Falta aprovar o valor." : "Falta a assinatura (ou o registro da assinatura fora do sistema).",
  };
}

/** Os quatro eixos, na ordem da faixa: Valor · Arte · Assinatura · Cobrança. */
export function budgetAxes(input: BudgetAxesInput): BudgetAxis[] {
  const valueApproved = input.status === TASK_QUOTE_STATUS.APPROVED;
  const signatureResolved =
    !!input.signatureStatus && (BILLABLE_SIGNATURE_STATUSES as readonly string[]).includes(input.signatureStatus);
  return [
    valueAxis(input.status),
    artAxis(input.artStates),
    signatureAxis(input.signatureStatus, valueApproved, input.emission),
    billingAxis(input, valueApproved, signatureResolved),
  ];
}

/** Onde cada impedimento do portão de emissão se resolve, e o texto do botão. */
const BLOCKER_ACTION: Record<BudgetEmissionGateCode, BudgetAxisNext> = {
  VALUE_NOT_APPROVED: { label: "Ir para o valor", target: "value" },
  ARTWORK_PENDING: { label: "Ver a arte dos veículos", target: "art" },
  ENVELOPE_LIVE: { label: "Ir para a assinatura", target: "signature" },
  TWO_PAYERS: { label: "Ver o faturamento", target: "billing" },
  VALIDITY_EXPIRED: { label: "Prorrogar a validade", target: "validity" },
  RESPONSIBLES: { label: "Ver os responsáveis", target: "responsibles" },
};

export interface EmissionBlockerItem {
  code: string;
  message: string;
  /** Ausente para um código que a web ainda não conhece: mostra a frase da API sem botão. */
  action?: BudgetAxisNext;
}

/** "Para emitir falta…": cada impedimento da API com a ação que o resolve. */
export function emissionBlockerItems(emission: BudgetEmission | null | undefined): EmissionBlockerItem[] {
  if (!emission || emission.ready) return [];
  return emission.blockers.map((blocker) => ({
    code: blocker.code,
    message: blocker.message,
    action: BLOCKER_ACTION[blocker.code as BudgetEmissionGateCode],
  }));
}
