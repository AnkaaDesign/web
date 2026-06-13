// packages/interfaces/src/user.ts

import type { BaseEntity, BaseGetUniqueResponse, BaseGetManyResponse, BaseCreateResponse, BaseUpdateResponse, BaseDeleteResponse, BaseBatchResponse, BaseMergeResponse } from "./common";
import type { ORDER_BY_DIRECTION, CONTRACT_TYPE, CONTRACT_STATUS, EMPLOYEE_TYPE } from '@constants';
import type { PpeSize, PpeDelivery, PpeDeliverySchedule, PpeSizeIncludes, PpeDeliveryIncludes, PpeDeliveryScheduleIncludes } from "./ppe";
import type { SeenNotification, Notification, SeenNotificationIncludes, NotificationIncludes } from "./notification";
import type { Position, PositionIncludes, PositionOrderBy } from "./position";
import type { Preferences, PreferencesIncludes } from "./preferences";
import type { Warning, WarningIncludes } from "./warning";
import type { Sector, SectorIncludes, SectorOrderBy } from "./sector";
import type { Task, TaskIncludes } from "./task";
import type { Activity, ActivityIncludes } from "./activity";
import type { Borrow, BorrowIncludes } from "./borrow";
import type { ChangeLog, ChangeLogIncludes } from "./changelog";
import type { Bonus, BonusIncludes } from "./bonus";
import type { File } from "./file";
import type { EmploymentContract } from "./employment-contract";
import type { Admission } from "./admission";

// =====================
// Main Entity Interface
// =====================

export interface User extends BaseEntity {
  email: string | null;
  name: string;
  avatarId: string | null;
  // DERIVED cache of the user's CURRENT EmploymentContract (vínculo). Never the
  // source of truth — kept in sync by the server. The contract is authoritative.
  currentContractId: string | null;
  currentContractType: CONTRACT_TYPE | null;
  currentContractStatus: CONTRACT_STATUS | null;
  currentEmployeeType: EMPLOYEE_TYPE | null;
  isActive: boolean;
  phone: string | null;
  password?: string | null;
  positionId: string | null;
  preferenceId: string | null;
  pis: string | null;
  cpf: string | null;
  verified: boolean;
  birth: Date; // Date of birth
  performanceLevel: number;
  sectorId: string | null;
  address: string | null;
  addressNumber: string | null;
  addressComplement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  site: string | null;
  zipCode: string | null;
  verificationCode?: string | null;
  verificationExpiresAt?: Date | null;
  verificationType?: string | null | undefined;
  requirePasswordChange?: boolean;
  lastLoginAt?: Date | null;
  sessionToken: string | null;
  secullumId: string | null;
  payrollNumber: number | null;

  // Payroll-related fields (available when fetched directly)
  unionMember?: boolean;
  unionAuthorizationDate?: Date | null;
  dependentsCount?: number;
  hasSimplifiedDeduction?: boolean;

  // Relations
  avatar?: File;
  // Employment contracts (vínculos). `currentContract` mirrors the current one
  // (isCurrent=true); `contracts` is the full history; `admissions` the onboardings.
  currentContract?: EmploymentContract;
  contracts?: EmploymentContract[];
  admissions?: Admission[];
  ppeSize?: PpeSize;
  preference?: Preferences;
  position?: Position;
  sector?: Sector;
  ledSector?: Sector;
  activities?: Activity[];
  borrows?: Borrow[];
  notifications?: Notification[];
  tasks?: Task[];
  bonuses?: Bonus[];
  warningsCollaborator?: Warning[];
  warningsSupervisor?: Warning[];
  warningsWitness?: Warning[];
  ppeDeliveries?: PpeDelivery[];
  ppeDeliveriesApproved?: PpeDelivery[];
  ppeSchedules?: PpeDeliverySchedule[];
  changeLogs?: ChangeLog[];
  seenNotification?: SeenNotification[];
  createdTasks?: Task[];

  // Count fields (when included)
  _count?: {
    activities?: number;
    bonuses?: number;
    tasks?: number;
    createdTasks?: number; // Used in employee tables
    workOrders?: number;
    orders?: number;
    suppliers?: number;
    items?: number;
    maintenances?: number;
    productionBatches?: number;
    parkingRecords?: number;
    files?: number;
    changeLogs?: number;
    seenNotification?: number;
  };
}

// =====================
// Include Types
// =====================

export interface UserIncludes {
  avatar?: boolean;
  currentContract?: boolean | { include?: any; select?: any };
  contracts?: boolean | { include?: any; where?: any; orderBy?: any };
  admissions?: boolean | { include?: any; where?: any; orderBy?: any };
  ppeSize?:
    | boolean
    | {
        include?: PpeSizeIncludes;
      };
  preference?:
    | boolean
    | {
        include?: PreferencesIncludes;
      };
  position?:
    | boolean
    | {
        include?: PositionIncludes;
      };
  sector?:
    | boolean
    | {
        include?: SectorIncludes;
      };
  ledSector?:
    | boolean
    | {
        include?: SectorIncludes;
      };
  activities?:
    | boolean
    | {
        include?: ActivityIncludes;
      };
  borrows?:
    | boolean
    | {
        include?: BorrowIncludes;
      };
  notifications?:
    | boolean
    | {
        include?: NotificationIncludes;
      };
  tasks?:
    | boolean
    | {
        include?: TaskIncludes;
      };
  bonuses?:
    | boolean
    | {
        include?: BonusIncludes;
      };
  warningsCollaborator?:
    | boolean
    | {
        include?: WarningIncludes;
      };
  warningsSupervisor?:
    | boolean
    | {
        include?: WarningIncludes;
      };
  warningsWitness?:
    | boolean
    | {
        include?: WarningIncludes;
      };
  ppeDeliveries?:
    | boolean
    | {
        include?: PpeDeliveryIncludes;
      };
  ppeDeliveriesApproved?:
    | boolean
    | {
        include?: PpeDeliveryIncludes;
      };
  ppeSchedules?:
    | boolean
    | {
        include?: PpeDeliveryScheduleIncludes;
      };
  changeLogs?:
    | boolean
    | {
        include?: ChangeLogIncludes;
      };
  seenNotification?:
    | boolean
    | {
        include?: SeenNotificationIncludes;
      };
  createdTasks?:
    | boolean
    | {
        include?: TaskIncludes;
      };
}

// =====================
// Order By Types
// =====================

export interface UserOrderBy {
  id?: ORDER_BY_DIRECTION;
  email?: ORDER_BY_DIRECTION;
  name?: ORDER_BY_DIRECTION;
  avatarId?: ORDER_BY_DIRECTION;
  token?: ORDER_BY_DIRECTION;
  currentContractId?: ORDER_BY_DIRECTION;
  currentContractType?: ORDER_BY_DIRECTION;
  currentContractStatus?: ORDER_BY_DIRECTION;
  currentEmployeeType?: ORDER_BY_DIRECTION;
  isActive?: ORDER_BY_DIRECTION;
  phone?: ORDER_BY_DIRECTION;
  password?: ORDER_BY_DIRECTION;
  pis?: ORDER_BY_DIRECTION;
  cpf?: ORDER_BY_DIRECTION;
  verified?: ORDER_BY_DIRECTION;
  payrollNumber?: ORDER_BY_DIRECTION;
  birth?: ORDER_BY_DIRECTION;
  performanceLevel?: ORDER_BY_DIRECTION;
  address?: ORDER_BY_DIRECTION;
  addressNumber?: ORDER_BY_DIRECTION;
  addressComplement?: ORDER_BY_DIRECTION;
  neighborhood?: ORDER_BY_DIRECTION;
  city?: ORDER_BY_DIRECTION;
  state?: ORDER_BY_DIRECTION;
  zipCode?: ORDER_BY_DIRECTION;
  createdAt?: ORDER_BY_DIRECTION;
  updatedAt?: ORDER_BY_DIRECTION;
  position?: PositionOrderBy;
  sector?: SectorOrderBy;
  ledSector?: SectorOrderBy;
}

// =====================
// Response Interfaces
// =====================

export interface UserGetUniqueResponse extends BaseGetUniqueResponse<User> {}
export interface UserGetManyResponse extends BaseGetManyResponse<User> {}
export interface UserCreateResponse extends BaseCreateResponse<User> {
  /**
   * Result of the Secullum sync attempt. Only present when the user was
   * created with `secullumSyncEnabled=true`. Used by the create-user page to
   * toast the outcome immediately after save.
   */
  secullumSync?: {
    status: "synced" | "skipped" | "error";
    reason?: string;
    funcionarioId?: number;
  };
}
export interface UserUpdateResponse extends BaseUpdateResponse<User> {
  /**
   * Result of the Secullum sync attempt. Present whenever the user being
   * updated has `secullumSyncEnabled=true`. Used to toast dismissal /
   * profile-edit propagation outcomes.
   */
  secullumSync?: {
    status: "synced" | "skipped" | "error";
    reason?: string;
    funcionarioId?: number;
  };
}
export interface UserDeleteResponse extends BaseDeleteResponse {}
export interface UserMergeResponse extends BaseMergeResponse<User> {}

// =====================
// Batch Operation Responses
// =====================

export interface UserBatchCreateResponse<T> extends BaseBatchResponse<User, T> {}
export interface UserBatchUpdateResponse<T> extends BaseBatchResponse<User, T & { id: string }> {}
export interface UserBatchDeleteResponse extends BaseBatchResponse<{ id: string; deleted: boolean }, { id: string }> {}
