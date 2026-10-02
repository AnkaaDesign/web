/**
 * O ORÇAMENTO PELO CONTRATO GERADO DA API.
 *
 * Rótulos, ordem e transições do eixo do VALOR (e os rótulos dos eixos da
 * assinatura e da arte) vêm de `generated/contracts/*.json`, que a API exporta
 * (`npm run contracts:export`). Escrever estes mapas à mão foi o que deixou o web
 * com `PRE_APPROVED` depois que a API o apagou — e a lista de orçamentos em 400.
 *
 * Importação NOMEADA dos JSON de propósito (como em `document-labels.ts`): o Vite
 * faz tree-shaking por chave de topo.
 */
import { orcamento } from "@/generated/contracts/enums.json";
import { tela } from "@/generated/contracts/labels.json";
import {
  BUDGET_SIGNATURE_STATUS,
  BUDGET_VALUE_APPROVAL_SOURCE,
  LAYOUT_STATUS,
  TASK_QUOTE_STATUS,
} from "./enums";

/** Os valores do eixo do valor, na ordem do contrato. */
export const BUDGET_STATUS_VALUES = orcamento.status as readonly TASK_QUOTE_STATUS[];

/**
 * Os estados que uma lista de orçamentos "vivos" mostra: todos os do contrato
 * menos o legado `SIGNED`, que nenhuma linha usa desde a M3o-b.
 */
export const BUDGET_LIST_STATUSES: readonly TASK_QUOTE_STATUS[] = BUDGET_STATUS_VALUES.filter(
  (status) => status !== TASK_QUOTE_STATUS.SIGNED,
);

/** A ordem de fila (`Budget.statusOrder` na API). */
export const BUDGET_STATUS_ORDER = orcamento.ordem as Record<TASK_QUOTE_STATUS, number>;

/**
 * As arestas que uma PESSOA pode pedir (`PUT /budgets/:id/status`). A API delega
 * cada uma ao ato correspondente: `→ APPROVED` exige nota, `APPROVED → PENDING`
 * exige motivo, `→ IN_NEGOTIATION` exige valor.
 */
export const BUDGET_MANUAL_TRANSITIONS = orcamento.transicoesManuais as Record<
  TASK_QUOTE_STATUS,
  readonly TASK_QUOTE_STATUS[]
>;

export const BUDGET_STATUS_LABELS = tela.TASK_QUOTE_STATUS_LABELS.labels as Record<
  TASK_QUOTE_STATUS,
  string
>;

export const BUDGET_SIGNATURE_STATUS_LABELS = tela.BUDGET_SIGNATURE_STATUS_LABELS.labels as Record<
  BUDGET_SIGNATURE_STATUS,
  string
>;

export const BUDGET_VALUE_APPROVAL_SOURCE_LABELS = tela.BUDGET_VALUE_APPROVAL_SOURCE_LABELS
  .labels as Record<BUDGET_VALUE_APPROVAL_SOURCE, string>;

export const LAYOUT_STATUS_LABELS_FROM_CONTRACT = tela.LAYOUT_STATUS_LABELS.labels as Record<
  LAYOUT_STATUS,
  string
>;

/** O eixo da assinatura que libera a cobrança (`isBillableSignatureStatus` da API). */
export const BILLABLE_SIGNATURE_STATUSES: readonly BUDGET_SIGNATURE_STATUS[] = [
  BUDGET_SIGNATURE_STATUS.SIGNED,
  BUDGET_SIGNATURE_STATUS.SIGNED_OFFLINE,
  BUDGET_SIGNATURE_STATUS.WAIVED,
];

/**
 * "Já se pode cobrar?" — valor aprovado E assinatura resolvida. É o `billable`
 * que a API devolve na leitura; esta função existe para quem só tem os dois
 * campos (listas que não pedem `billable`).
 */
export function isBudgetBillable(budget: {
  status?: string | null;
  signatureStatus?: string | null;
  billable?: boolean;
}): boolean {
  if (typeof budget.billable === "boolean") return budget.billable;
  return (
    budget.status === TASK_QUOTE_STATUS.APPROVED &&
    !!budget.signatureStatus &&
    (BILLABLE_SIGNATURE_STATUSES as readonly string[]).includes(budget.signatureStatus)
  );
}
