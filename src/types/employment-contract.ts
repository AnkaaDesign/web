// packages/interfaces/src/employment-contract.ts
// Vínculos empregatícios (EmploymentContract) — mirrors api/src/types/employment-contract.ts

import type {
  BaseEntity,
  BaseGetUniqueResponse,
  BaseGetManyResponse,
  BaseCreateResponse,
  BaseUpdateResponse,
  BaseDeleteResponse,
  BaseBatchResponse,
} from "./common";
import type { CONTRACT_TYPE, CONTRACT_STATUS, EMPLOYEE_TYPE, TERMINATION_TYPE, INSALUBRITY_DEGREE, STABILITY_TYPE, ORDER_BY_DIRECTION, CHANGE_TRIGGERED_BY } from "../constants";
import type { User, UserIncludes } from "./user";
import type { Position } from "./position";
import type { Sector } from "./sector";
import type { Admission } from "./admission";
import type { Termination } from "./termination";

// =====================
// Main Entity Interface
// =====================

export interface EmploymentContract extends BaseEntity {
  userId: string;
  sequence: number;
  matricula: number | null;
  payrollNumber: number | null;
  employeeType: EMPLOYEE_TYPE;
  contractType: CONTRACT_TYPE | null;
  status: CONTRACT_STATUS;
  statusOrder: number;
  positionId: string | null;
  sectorId: string | null;
  /** Per-vínculo override do grau de insalubridade do cargo. NULL = herda do Position. */
  insalubrityDegreeOverride: INSALUBRITY_DEGREE | null;
  /** Per-vínculo override da periculosidade do cargo. NULL = herda do Position. */
  hazardPayOverride: boolean | null;
  admissionDate: Date | null;
  exp1StartAt: Date | null;
  exp1EndAt: Date | null;
  exp2StartAt: Date | null;
  exp2EndAt: Date | null;
  effectedAt: Date | null;
  /** Art. 481 CLT — cláusula assecuratória do direito recíproco de rescisão. */
  hasArt481Clause: boolean;
  terminationDate: Date | null;
  terminationType: TERMINATION_TYPE | null;
  /** Tipo de estabilidade (estabilidade) que bloqueia o desligamento. NULL = sem estabilidade. */
  stabilityType: STABILITY_TYPE | null;
  stabilityStart: Date | null;
  stabilityEnd: Date | null;
  providerName: string | null;
  providerCnpj: string | null;
  notes: string | null;
  isCurrent: boolean;

  // Relations (optional, populated based on query)
  user?: User;
  position?: Position;
  sector?: Sector;
  admission?: Admission;
  terminations?: Termination[];
  payrolls?: any[];
  /** Audit trail of each MODALITY (contractType) this vínculo held over time. */
  phaseHistory?: ContractPhaseHistory[];
}

// =====================
// Contract Phase History
// =====================

/**
 * Audit record of a single MODALITY (contractType) a continuous vínculo held over
 * time. The single contract advances EXPERIENCE_PERIOD_1 → EXPERIENCE_PERIOD_2 →
 * INDETERMINATE; each phase is one row. `endDate === null` ⇒ current/open phase.
 */
export interface ContractPhaseHistory extends BaseEntity {
  contractId: string;
  userId: string;
  contractType: CONTRACT_TYPE;
  startDate: Date;
  endDate: Date | null;
  triggeredBy: CHANGE_TRIGGERED_BY | null;
  reason: string | null;
}

// =====================
// Include Types
// =====================

export interface EmploymentContractIncludes {
  user?: boolean | { include?: UserIncludes };
  position?: boolean | { include?: any };
  sector?: boolean | { include?: any };
  admission?: boolean | { include?: any };
  terminations?: boolean | { include?: any };
  payrolls?: boolean | { include?: any };
  phaseHistory?: boolean | { include?: any; where?: any; orderBy?: any };
}

// =====================
// Order By Types
// =====================

export interface EmploymentContractOrderBy {
  id?: ORDER_BY_DIRECTION;
  userId?: ORDER_BY_DIRECTION;
  sequence?: ORDER_BY_DIRECTION;
  matricula?: ORDER_BY_DIRECTION;
  payrollNumber?: ORDER_BY_DIRECTION;
  employeeType?: ORDER_BY_DIRECTION;
  contractType?: ORDER_BY_DIRECTION;
  status?: ORDER_BY_DIRECTION;
  statusOrder?: ORDER_BY_DIRECTION;
  admissionDate?: ORDER_BY_DIRECTION;
  effectedAt?: ORDER_BY_DIRECTION;
  terminationDate?: ORDER_BY_DIRECTION;
  isCurrent?: ORDER_BY_DIRECTION;
  createdAt?: ORDER_BY_DIRECTION;
  updatedAt?: ORDER_BY_DIRECTION;
}

// =====================
// Response Interfaces
// =====================

export interface EmploymentContractGetUniqueResponse extends BaseGetUniqueResponse<EmploymentContract> {}
export interface EmploymentContractGetManyResponse extends BaseGetManyResponse<EmploymentContract> {}
export interface EmploymentContractCreateResponse extends BaseCreateResponse<EmploymentContract> {}
export interface EmploymentContractUpdateResponse extends BaseUpdateResponse<EmploymentContract> {}
export interface EmploymentContractDeleteResponse extends BaseDeleteResponse {}

// =====================
// Batch Operation Responses
// =====================

export interface EmploymentContractBatchCreateResponse<T> extends BaseBatchResponse<EmploymentContract, T> {}
export interface EmploymentContractBatchUpdateResponse<T> extends BaseBatchResponse<EmploymentContract, T & { id: string }> {}
export interface EmploymentContractBatchDeleteResponse extends BaseBatchResponse<{ id: string; deleted: boolean }, { id: string }> {}
