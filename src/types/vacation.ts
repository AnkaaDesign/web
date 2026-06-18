// packages/interfaces/src/vacation.ts
// Férias (Departamento Pessoal) — Part C. Mirrors api vacation module.

import type {
  BaseEntity,
  BaseGetUniqueResponse,
  BaseGetManyResponse,
  BaseCreateResponse,
  BaseUpdateResponse,
  BaseDeleteResponse,
  BaseBatchResponse,
} from "./common";
import type { VACATION_STATUS } from "../constants";
import type { User } from "./user";

// =====================
// Entities
// =====================

export interface Vacation extends BaseEntity {
  userId: string;
  contractId: string | null;
  /** When set, this individual vacation was generated from a collective (férias coletivas) group. */
  groupId?: string | null;
  acquisitiveStart: Date;
  acquisitiveEnd: Date;
  concessiveEnd: Date | null;
  unjustifiedAbsencesInPeriod: number;
  entitledDays: number;
  /** Gozo start of THIS taking (null while not scheduled). */
  startDate: Date | string | null;
  /** Gozo days of THIS taking. */
  days: number;
  status: VACATION_STATUS;
  abonoPecuniarioDays: number;
  soldThird: boolean;
  baseRemuneration: number | null;
  oneThird: number | null;
  abonoAmount: number | null;
  inss: number | null;
  irrf: number | null;
  isDouble: boolean;
  paymentDueDate: Date | null;
  paymentDate: Date | null;
  notes: string | null;

  // Relations
  user?: User;
}

// =====================
// Period balance (remaining-days history) — GET /vacations/period-balance
// =====================

export interface VacationPeriodBalanceTaking {
  id: string;
  startDate: Date | string | null;
  days: number;
  status: VACATION_STATUS;
}

export interface VacationPeriodBalanceData {
  entitledDays: number;
  abonoDays: number;
  gozoEntitled: number;
  scheduledDays: number;
  remainingDays: number;
  takings: VacationPeriodBalanceTaking[];
}

export interface VacationPeriodBalanceResponse {
  success: boolean;
  message: string;
  data: VacationPeriodBalanceData;
}

// =====================
// Recibo (payable férias receipt) — NOT embedded in the monthly folha
// =====================

export interface VacationReciboLine {
  /** Provento (>0) ou desconto (<0). */
  label: string;
  amount: number;
}

export interface VacationRecibo {
  vacationId: string;
  userId: string;
  /** Dias gozados (entitled - abono). */
  vacationDays: number;
  abonoPecuniarioDays: number;
  /** Base de cálculo das férias (remuneração + média de variáveis). */
  baseRemuneration: number;
  oneThird: number;
  abonoAmount: number;
  /** Terço sobre o abono (verba indenizatória, isenta). */
  abonoOneThird: number;
  isDouble: boolean;
  taxableBase: number;
  inss: number;
  irrf: number;
  earnings: number;
  discounts: number;
  /** Líquido a receber no recibo de férias. */
  net: number;
  lines: VacationReciboLine[];
}

// =====================
// Responses
// =====================

export type VacationGetUniqueResponse = BaseGetUniqueResponse<Vacation>;
export type VacationGetManyResponse = BaseGetManyResponse<Vacation>;
export type VacationCreateResponse = BaseCreateResponse<Vacation>;
export type VacationUpdateResponse = BaseUpdateResponse<Vacation>;
export type VacationDeleteResponse = BaseDeleteResponse;
export type VacationBatchCreateResponse<T> = BaseBatchResponse<Vacation, T>;
export type VacationBatchUpdateResponse<T> = BaseBatchResponse<Vacation, T>;
export type VacationBatchDeleteResponse = BaseBatchResponse<{ id: string; deleted: boolean }, { id: string }>;
export type VacationCalculateResponse = BaseGetUniqueResponse<{ vacation: Vacation; recibo: VacationRecibo }>;
