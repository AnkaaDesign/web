// =====================
// Unified receivables (Contas a Receber) — the ENTRADA analog of payables.
// Mirrors api/src/types/receivable.ts.
// =====================

import type { ClearanceState } from "./order";

export type ReceivableSource = "TASK_QUOTE" | "EXTERNAL_OPERATION" | "INVOICE";

export type ReceivableState =
  | "AWAITING_RECEIPT"
  | "PARTIALLY_RECEIVED"
  | "OVERDUE"
  // Received in the period — surfaced so finance can review what came in.
  | "RECEIVED";

/** One normalized receivable row: an open (or recently received) installment. */
export interface ReceivableRow {
  source: ReceivableSource;
  /** Installment id (the settle/conciliation target). */
  id: string;
  invoiceId: string | null;
  /** Task-quote (faturamento) this receivable belongs to — row navigation target. */
  taskId: string | null;
  customerId: string | null;
  customerName: string;
  /** The task (faturamento) name — falls back to customer/parcela for non-task rows. */
  description: string;
  amount: number;
  paidAmount: number;
  state: ReceivableState;
  /** ISO date string (or null). */
  dueDate: string | null;
  /** ISO date string (or null). */
  paidAt: string | null;
  /** This installment's position (1-based). */
  number: number;
  /** How many installments the parent has, so the UI can show "2/3". */
  totalInstallments: number;
  /** Free-form payment method (BANK_SLIP / PIX / CASH / ...). Null until paid. */
  paymentMethod: string | null;
  /** A Sicredi boleto exists — receipt reconciles via the boleto bridge. */
  hasBankSlip: boolean;
  /** Already conciliated against a bank credit. */
  reconciled: boolean;
  /** Bank transaction this receipt was conciliated against (for row linking). */
  transactionId: string | null;
  /**
   * Axis B — bank-confirmation state, the receivables analog of the payables
   * `clearanceState`. Derived from the non-reversed ReconciliationMatch + amount
   * comparison (UNCLEARED until a credit confirms it; DISPUTED on amount drift).
   * `reconciled` stays as the simple boolean for back-compat; this is the
   * three-valued field web/mobile should prefer.
   */
  clearanceState: ClearanceState;
  /** When the confirming bank credit cleared this row. */
  clearedAt: string | null;
  /** Conciliação DECLARADA à mão, sem linha de extrato — recebimento que caiu na
   *  conta de um sócio, onde a transação bancária correspondente nunca vai
   *  existir. Separado de `reconciled` para a lista poder distinguir "bate com o
   *  extrato" de "alguém afirmou que entrou por fora". */
  externallyCleared?: boolean;
  externalClearedNote?: string | null;
}

export interface ReceivablesSummaryBucket {
  count: number;
  total: number;
}

export interface ReceivablesSummary {
  AWAITING_RECEIPT: ReceivablesSummaryBucket;
  PARTIALLY_RECEIVED: ReceivablesSummaryBucket;
  OVERDUE: ReceivablesSummaryBucket;
  RECEIVED: ReceivablesSummaryBucket;
}

export interface ReceivablesResponse {
  success: boolean;
  message: string;
  data: {
    rows: ReceivableRow[];
    summary: ReceivablesSummary;
  };
}

/** One open installment a bank CREDIT can be conciliated against. */
export interface ReceivableCandidate {
  installmentId: string;
  number: number;
  amount: number;
  /** Already-received amount (prior partial allocations). */
  paidAmount: number;
  /** Outstanding balance = amount − paidAmount; what a credit can still settle. */
  remaining: number;
  dueDate: string;
  /** Installment status (PENDING / OVERDUE / PARTIAL …). */
  status: string;
  customerName: string | null;
  invoiceId: string | null;
  confidence: number;
  /** Task-quote (faturamento) context — null for non-task receivables. */
  taskId: string | null;
  taskName: string | null;
  taskSerialNumber: string | null;
  /** Invoice total + how many parcelas it has, for the candidate card. */
  invoiceTotal: number | null;
  totalInstallments: number | null;
  /** Set when this candidate is an already-PAID boleto awaiting its bank line:
   *  matching it bridges the credit to the boleto (full link only, no partial). */
  bankSlipId: string | null;
  viaBankSlip: boolean;
  /** The parcela is already stamped PAID (baixa manual) and is offered only so the
   *  operator can attach the confirming bank line to it. It is a LINK, not a
   *  receipt: the money was already recorded, `remaining` is 0, and POST
   *  /receivables/allocate rejects it outright ("já está totalmente conciliada").
   *  The only endpoint that accepts it is POST /receivables/match.
   *
   *  Optional because the API only sets it on installment candidates —
   *  findBoletoCandidates omits the key, and those are already handled by
   *  `viaBankSlip`, which every check below tests first. */
  linkOnly?: boolean;
}

export interface ReceivableCandidatesResponse {
  success: boolean;
  message: string;
  data: ReceivableCandidate[];
}

export interface ReceivableMatchPayload {
  transactionId: string;
  installmentId: string;
}

export interface ReceivableUnmatchPayload {
  transactionId: string;
}

/** Partial / multi allocation: settle one credit across N installments. */
export interface ReceivableAllocatePayload {
  transactionId: string;
  allocations: { installmentId: string; amount: number }[];
}

export interface ReceivableMatchResponse {
  success: boolean;
  message: string;
}

// =====================
// Task-anchored conciliation (credit ↔ Tarefa, orçamento optional)
// =====================

/**
 * Billing shape of a Task from the point of view of an incoming credit.
 *
 * `NO_QUOTE` is the whole reason this flow exists: the migration left many
 * tasks with no orçamento, and with no orçamento there is no fatura and no
 * parcela — so nothing the ordinary candidate list can anchor a match to.
 */
export type TaskBillingState =
  | "NO_QUOTE"
  | "QUOTE_UNBILLED"
  | "QUOTE_OPEN"
  | "QUOTE_SETTLED";

/** An open parcela already billed on a candidate task. */
export interface TaskCandidateInstallment {
  installmentId: string;
  number: number;
  dueDate: string;
  amount: number;
  paidAmount: number;
  remaining: number;
  status: string;
  hasBankSlip: boolean;
}

/** A Task offered as a conciliation target for a bank credit. */
export interface TaskMatchCandidate {
  taskId: string;
  taskName: string | null;
  taskSerialNumber: string | null;
  taskStatus: string;
  plate: string | null;
  customerId: string | null;
  customerName: string | null;
  customerCnpjCpf: string | null;
  quoteId: string | null;
  budgetNumber: number | null;
  quoteStatus: string | null;
  quoteTotal: number | null;
  billingState: TaskBillingState;
  /** Balance allocatable without creating new billing capacity. */
  openCapacity: number;
  openInstallments: TaskCandidateInstallment[];
  /** Already conciliated against this task, from any credit. */
  reconciledAmount: number;
  /** Server's proposal for this task's share of the credit. */
  suggestedAmount: number;
  confidence: number;
  reason: string;
  referenceDate: string | null;
}

export interface TaskCandidatesResponse {
  success: boolean;
  message: string;
  data: TaskMatchCandidate[];
}

/** One task's share of a credit. */
export interface TaskMatchAllocation {
  taskId: string;
  amount: number;
  /** Billing customer — required when the task has neither quote nor customer. */
  customerId?: string;
  dueDate?: string;
  description?: string;
}

export interface TaskMatchPayload {
  transactionId: string;
  allocations: TaskMatchAllocation[];
  notes?: string;
}

/** What the server did, per task. */
export interface TaskMatchOutcome {
  taskId: string;
  quoteId: string;
  budgetNumber: number;
  quoteCreated: boolean;
  quoteExtended: boolean;
  invoiceCreated: boolean;
  allocated: number;
  installmentIds: string[];
}

export interface TaskMatchResponse {
  success: boolean;
  message: string;
  data: {
    transactionId: string;
    totalAllocated: number;
    reconciliationStatus: string;
    outcomes: TaskMatchOutcome[];
  };
}

/**
 * The server's identity-resolved allocation plan for a credit: who paid (matched
 * by CNPJ, CNPJ raiz or name) and which parcelas the value reconciles against.
 *
 * This is the only path that can express a lump payment covering SEVERAL
 * parcelas, and the only one that can settle already-PAID parcelas as link-only
 * clearance — POST /receivables/allocate rejects those outright. `auto: false`
 * means identity resolved below the automatic bar, so the plan is offered for
 * confirmation instead of being applied on its own.
 */
export interface ReceivableSuggestion {
  customerId: string;
  customerName: string | null;
  via: string;
  auto: boolean;
  confidence: number;
  /** How the value was reconciled: "single", "batch:10d", "subset", … */
  kind: string;
  totalAmount: number;
  allocations: Array<{
    installmentId: string;
    amount: number;
    linkOnly: boolean;
    number: number;
    dueDate: string;
  }>;
}

export interface ReceivableSuggestionResponse {
  success: boolean;
  message: string;
  data: { suggestion: ReceivableSuggestion | null };
}
