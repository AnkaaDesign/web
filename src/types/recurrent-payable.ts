// Recurrent payables (Contas Recorrentes) — first-class rent/internet/energy/water
// bills that materialize a monthly occurrence into Contas a Pagar.
// Mirrors the api recurrent-payable module (Prisma model + service include +
// dto at api/src/modules/financial/recurrent-payable/).

import type { Supplier } from "./supplier";
import type { TransactionCategory } from "./reconciliation";

// FIXED bills carry a known value (fixedAmount); VARIABLE bills only carry an
// estimate until the real paid amount is informed on settlement.
export type AmountKind = "FIXED" | "VARIABLE";

// Recurrence cadence accepted by the api dto. WEEKLY/BIWEEKLY are sub-monthly
// (use daysOfWeek); the rest are monthly-family (use dueDayOfMonth).
export type RecurrentFrequency =
  | "WEEKLY"
  | "BIWEEKLY"
  | "MONTHLY"
  | "BIMONTHLY"
  | "QUARTERLY"
  | "TRIANNUAL"
  | "QUADRIMESTRAL"
  | "SEMI_ANNUAL"
  | "ANNUAL";

// Weekly-family frequencies use daysOfWeek instead of dueDayOfMonth.
export const WEEKLY_RECURRENT_FREQUENCIES: RecurrentFrequency[] = ["WEEKLY", "BIWEEKLY"];
export const isWeeklyRecurrentFrequency = (f: RecurrentFrequency): boolean =>
  WEEKLY_RECURRENT_FREQUENCIES.includes(f);

// Lifecycle of a single materialized monthly bill.
export type RecurrentPayableStatus = "PENDING" | "PAID" | "OVERDUE" | "CANCELLED";

export interface RecurrentPayable {
  id: string;
  name: string;
  description: string | null;
  supplierId: string | null;
  // Free-text payee (imobiliária, concessionária…).
  payeeName: string | null;
  // Optional CNPJ of the payee — enables NF auto-linking by emitter CNPJ.
  payeeCnpj: string | null;
  // Optional CPF of the payee (individuals). Tomador is a CPF OR a CNPJ.
  payeeCpf: string | null;
  categoryId: string;
  amountKind: AmountKind;
  // Decimal columns arrive as string|number depending on the serializer.
  fixedAmount: string | number | null;
  estimatedAmount: string | number | null;
  // Recurrence cadence — defaults to "MONTHLY" server-side.
  frequency: RecurrentFrequency;
  frequencyCount: number;
  // Day of month the bill is due (1-31). Null for weekly bills.
  dueDayOfMonth: number | null;
  // Weekdays a weekly bill is due (0=Sun … 6=Sat). Empty for monthly bills.
  daysOfWeek: number[];
  paymentMethod: "PIX" | "BANK_SLIP" | "CREDIT_CARD" | null;
  // PIX key to pay this bill — only set when paymentMethod = PIX.
  pixKey: string | null;
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
  payeeCnpj?: string | null;
  payeeCpf?: string | null;
  categoryId: string;
  amountKind: AmountKind;
  // Required (> 0) when amountKind is FIXED.
  fixedAmount?: number | null;
  estimatedAmount?: number | null;
  frequency?: RecurrentFrequency;
  frequencyCount?: number;
  // Required for monthly-family cadences; omit/null for weekly.
  dueDayOfMonth?: number | null;
  // Required (≥1 weekday) for weekly cadences; omit for monthly.
  daysOfWeek?: number[];
  paymentMethod?: "PIX" | "BANK_SLIP" | "CREDIT_CARD" | null;
  // PIX key to pay this bill — only sent when paymentMethod = PIX.
  pixKey?: string | null;
  expectsNf: boolean;
  isActive: boolean;
}

export type UpdateRecurrentPayablePayload = Partial<CreateRecurrentPayablePayload>;

export interface RecurrentPayableListParams {
  isActive?: boolean;
}

// One occurrence within a month's breakdown (a single charge/visit).
export interface RecurrentPayableMonthlyOccurrence {
  // Null for synthesized forecast entries on a non-current month (not yet materialized).
  occurrenceId: string | null;
  dueDate: string;
  status: RecurrentPayableStatus;
  forecastAmount: number;
  paidAmount: number | null;
  paidAt: string | null;
  transactionCount: number;
  nfLinked: boolean;
}

// One row of the monthly Recorrentes dashboard — a bill aggregated over ALL its
// occurrences in the selected competence (one for a monthly bill, several for a
// weekly one), plus a per-occurrence breakdown for individual settlement.
export interface RecurrentPayableMonthlyItem {
  id: string;
  // The lone occurrence id for a single-occurrence (monthly) bill, else null —
  // multi-occurrence bills settle per occurrence via `occurrences`.
  occurrenceId: string | null;
  name: string;
  category: { id: string; name: string; color: string | null } | null;
  payeeName: string | null;
  amountKind: AmountKind;
  isVariable: boolean;
  frequency: RecurrentFrequency;
  daysOfWeek: number[];
  dueDayOfMonth: number | null;
  paymentMethod: "PIX" | "BANK_SLIP" | "CREDIT_CARD" | null;
  // Earliest unpaid due date in the month (or the first occurrence's).
  dueDate: string;
  // Summary across the month: PAID only when every occurrence is paid.
  status: RecurrentPayableStatus;
  occurrenceCount: number;
  paidCount: number;
  pendingCount: number;
  overdueCount: number;
  // Month aggregates. paidAmount is null when nothing was paid (renders "—").
  paidAmount: number | null;
  paidAt: string | null;
  forecastAmount: number;
  nfLinked: boolean;
  transactionCount: number;
  occurrences: RecurrentPayableMonthlyOccurrence[];
}

export interface RecurrentPayableMonthly {
  competence: string;
  items: RecurrentPayableMonthlyItem[];
  totalPaid: number;
  totalForecast: number;
  paidCount: number;
  pendingCount: number;
}

export interface RecurrentPayableMonthlyResponse {
  success: boolean;
  message: string;
  data: RecurrentPayableMonthly;
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
