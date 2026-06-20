// =====================
// Unified receivables (Contas a Receber) — the ENTRADA analog of payables.
// Mirrors api/src/types/receivable.ts.
// =====================

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
  customerId: string | null;
  customerName: string;
  description: string;
  amount: number;
  paidAmount: number;
  state: ReceivableState;
  /** ISO date string (or null). */
  dueDate: string | null;
  /** ISO date string (or null). */
  paidAt: string | null;
  number: number;
  /** A Sicredi boleto exists — receipt reconciles via the boleto bridge. */
  hasBankSlip: boolean;
  /** Already conciliated against a bank credit. */
  reconciled: boolean;
  /** Bank transaction this receipt was conciliated against (for row linking). */
  transactionId: string | null;
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
  customerName: string | null;
  invoiceId: string | null;
  confidence: number;
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
