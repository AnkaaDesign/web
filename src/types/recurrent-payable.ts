// Recurrent payables (Contas Recorrentes) — first-class rent/internet/energy/water
// bills that materialize a monthly occurrence into Contas a Pagar.
// Mirrors api/src/types/recurrent-payable.ts.

import type { Supplier } from "./supplier";
import type { TransactionCategory } from "./reconciliation";

// FIXED bills carry a known value (fixedAmount); VARIABLE bills only carry an
// estimate until the real paid amount is informed on settlement.
export type AmountKind = "FIXED" | "VARIABLE";

// Lifecycle of a single materialized monthly bill.
export type RecurrentPayableStatus = "PENDING" | "PAID" | "OVERDUE" | "CANCELLED";

export interface RecurrentPayable {
  id: string;
  name: string;
  description: string | null;
  supplierId: string | null;
  // Free-text payee when no cadastrado supplier applies.
  payeeName: string | null;
  categoryId: string;
  amountKind: AmountKind;
  // Decimal columns arrive as string|number depending on the serializer.
  fixedAmount: string | number | null;
  estimatedAmount: string | number | null;
  // Recurrence cadence — defaults to "MONTHLY" server-side.
  frequency: string;
  frequencyCount: number;
  // Day of month the bill is due (1-31).
  dueDayOfMonth: number;
  paymentMethod: "PIX" | "BANK_SLIP" | "CREDIT_CARD" | null;
  // When true, the matching NF is synced and reconciled automatically.
  expectsNf: boolean;
  isActive: boolean;
  nextRun: string | null;
  lastRun: string | null;
  lastRunStatus: string | null;
  createdAt: string;
  updatedAt: string;

  // Relations (optional, populated based on query)
  supplier?: Pick<Supplier, "id" | "fantasyName" | "cnpj"> | null;
  category?: TransactionCategory | null;
  // Last 12 occurrences (detail endpoint only).
  occurrences?: RecurrentPayableOccurrence[];
}

export interface RecurrentPayableOccurrence {
  id: string;
  recurrentPayableId: string;
  // Competence month (YYYY-MM).
  competence: string;
  dueDate: string;
  estimatedAmount: string | number | null;
  paidAmount: string | number | null;
  status: RecurrentPayableStatus;
  paidAt: string | null;
  paidById: string | null;
  paymentMethod: "PIX" | "BANK_SLIP" | "CREDIT_CARD" | null;
  expectsNf: boolean;
  fiscalDocumentId: string | null;
  bankTransactionId: string | null;
  nfLinkedAt: string | null;
  reconciledAt: string | null;
}

// =====================
// Payloads
// =====================

export interface CreateRecurrentPayablePayload {
  name: string;
  description?: string | null;
  supplierId?: string | null;
  payeeName?: string | null;
  categoryId: string;
  amountKind: AmountKind;
  // Required (> 0) when amountKind is FIXED.
  fixedAmount?: number | null;
  estimatedAmount?: number | null;
  frequency?: string;
  frequencyCount?: number;
  dueDayOfMonth: number;
  paymentMethod?: "PIX" | "BANK_SLIP" | "CREDIT_CARD" | null;
  expectsNf: boolean;
  isActive: boolean;
}

export type UpdateRecurrentPayablePayload = Partial<CreateRecurrentPayablePayload>;

export interface RecurrentPayableListParams {
  isActive?: boolean;
}

export interface PayRecurrentOccurrencePayload {
  // Required for VARIABLE bills (the real paid amount).
  paidAmount?: number;
  paymentMethod?: "PIX" | "BANK_SLIP" | "CREDIT_CARD";
}

// =====================
// Responses (envelope: { success, message, data })
// =====================

export interface RecurrentPayableListResponse {
  success: boolean;
  message: string;
  data: RecurrentPayable[];
}

export interface RecurrentPayableDetailResponse {
  success: boolean;
  message: string;
  data: RecurrentPayable;
}

export interface RecurrentPayableMutationResponse {
  success: boolean;
  message: string;
  data: RecurrentPayable;
}

export interface PayRecurrentOccurrenceResponse {
  success: boolean;
  message: string;
  data: RecurrentPayableOccurrence;
}
