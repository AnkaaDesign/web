// packages/interfaces/src/thirteenth.ts
// 13º salário (gratificação natalina) — Part D. Mirrors api thirteenth module.

import type {
  BaseEntity,
  BaseGetUniqueResponse,
  BaseGetManyResponse,
  BaseCreateResponse,
  BaseUpdateResponse,
  BaseDeleteResponse,
} from "./common";
import type { THIRTEENTH_STATUS } from "../constants";
import type { User } from "./user";

// =====================
// Entity
// =====================

export interface Thirteenth extends BaseEntity {
  userId: string;
  contractId: string | null;
  year: number;
  avos: number;
  baseRemuneration: number | null;
  firstInstallment: number | null;
  firstInstallmentDate: Date | null;
  secondInstallment: number | null;
  secondInstallmentDate: Date | null;
  inss: number | null;
  irrf: number | null;
  status: THIRTEENTH_STATUS;
  statusOrder: number;
  notes: string | null;

  // Relations
  user?: User;
}

// =====================
// Recibo pagável (documento de cada parcela)
// =====================

export interface ThirteenthInstallmentDocument {
  installment: 1 | 2;
  year: number;
  userId: string;
  userName?: string;
  avos: number;
  baseRemuneration: number;
  /** Valor cheio devido no ano = baseRemuneration / 12 × avos. */
  fullEntitlement: number;
  grossInstallment: number;
  inss: number;
  irrf: number;
  netInstallment: number;
  dueDate: Date;
  notes: string | null;
}

export interface ThirteenthGenerateResult {
  year: number;
  created: number;
  updated: number;
  skipped: Array<{ userId: string; userName?: string; reason: string }>;
  records: Thirteenth[];
}

// =====================
// Responses
// =====================

export type ThirteenthGetUniqueResponse = BaseGetUniqueResponse<Thirteenth>;
export type ThirteenthGetManyResponse = BaseGetManyResponse<Thirteenth>;
export type ThirteenthCreateResponse = BaseCreateResponse<Thirteenth>;
export type ThirteenthUpdateResponse = BaseUpdateResponse<Thirteenth>;
export type ThirteenthMutationResponse = BaseUpdateResponse<Thirteenth>;
export type ThirteenthDeleteResponse = BaseDeleteResponse;
export type ThirteenthDocumentResponse = BaseGetUniqueResponse<ThirteenthInstallmentDocument>;
export type ThirteenthGenerateResponse = BaseGetUniqueResponse<ThirteenthGenerateResult>;
