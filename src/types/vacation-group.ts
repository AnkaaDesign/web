// packages/interfaces/src/vacation-group.ts
// Férias Coletivas (Departamento Pessoal). Mirrors api vacation-group module.

import type {
  BaseEntity,
  BaseGetUniqueResponse,
  BaseGetManyResponse,
  BaseCreateResponse,
  BaseUpdateResponse,
  BaseDeleteResponse,
} from "./common";
import type { VACATION_STATUS, VACATION_GROUP_TYPE } from "../constants";
import type { Vacation } from "./vacation";

// =====================
// Entities
// =====================

export interface VacationGroupPeriod extends BaseEntity {
  groupId: string;
  startDate: Date;
  days: number;
}

export interface VacationGroup extends BaseEntity {
  name: string;
  type: VACATION_GROUP_TYPE;
  acquisitiveStart: Date;
  acquisitiveEnd: Date;
  concessiveEnd: Date | null;
  status: VACATION_STATUS;
  statusOrder: number;
  sectorIds: string[];
  positionIds: string[];
  notes: string | null;

  // Relations
  periods?: VacationGroupPeriod[];
  vacations?: Vacation[];
}

// =====================
// Members preview (target colaboradores)
// =====================

export interface VacationGroupMember {
  userId: string;
  name: string;
  sectorId: string | null;
  sectorName: string | null;
  positionId: string | null;
  positionName: string | null;
  secullumEmployeeId: number | null;
  eligible: boolean;
  reason?: string;
  alreadyExpanded: boolean;
}

export interface VacationGroupMembersData {
  total: number;
  eligible: number;
  members: VacationGroupMember[];
}

// =====================
// Expand result
// =====================

export interface VacationGroupExpandDetail {
  userId: string;
  name: string;
  status: "created" | "skipped" | "failed";
  reason?: string;
}

export interface VacationGroupExpandData {
  created: number;
  skipped: number;
  failed: number;
  details: VacationGroupExpandDetail[];
}

// =====================
// Responses
// =====================

export type VacationGroupGetUniqueResponse = BaseGetUniqueResponse<VacationGroup>;
export type VacationGroupGetManyResponse = BaseGetManyResponse<VacationGroup>;
export type VacationGroupCreateResponse = BaseCreateResponse<VacationGroup>;
export type VacationGroupUpdateResponse = BaseUpdateResponse<VacationGroup>;
export type VacationGroupDeleteResponse = BaseDeleteResponse;

export interface VacationGroupMembersResponse {
  success: boolean;
  message: string;
  data: VacationGroupMembersData;
}

export interface VacationGroupExpandResponse {
  success: boolean;
  message: string;
  data: VacationGroupExpandData;
}

export interface VacationGroupSyncResponse {
  success: boolean;
  message: string;
  data?: unknown;
}
