// packages/interfaces/src/task.ts

import type { BaseEntity, BaseGetUniqueResponse, BaseGetManyResponse, BaseCreateResponse, BaseUpdateResponse, BaseDeleteResponse, BaseBatchResponse } from "./common";
import type { ORDER_BY_DIRECTION, TASK_STATUS, COMMISSION_STATUS } from "../constants";
import type { Sector, SectorIncludes, SectorOrderBy } from "./sector";
import type { Customer, CustomerIncludes, CustomerOrderBy } from "./customer";
import type { File, FileIncludes } from "./file";
import type { Observation, ObservationIncludes } from "./observation";
import type { Paint, PaintIncludes, PaintOrderBy } from "./paint";
import type { User, UserIncludes, UserOrderBy } from "./user";

// Re-export Commission as alias for COMMISSION_STATUS for compatibility
export type { COMMISSION_STATUS as Commission } from "../constants";
import type { ServiceOrder, ServiceOrderIncludes } from "./serviceOrder";
import type { Airbrushing, AirbrushingIncludes } from "./airbrushing";
import type { Cut, CutIncludes } from "./cut";
import type { Truck, TruckIncludes } from "./truck";
import type { Bonus } from "./bonus";
import type { BonusDiscount } from "./bonusDiscount";
import type { TaskQuote } from "./task-quote";
import type { Responsible } from "./responsible";

// =====================
// Task Interface
// =====================

export interface Task extends BaseEntity {
  name: string;
  status: TASK_STATUS;
  statusOrder: number;
  commission: COMMISSION_STATUS | null;
  commissionOrder: number;
  serialNumber: string | null;
  details: string | null;
  entryDate: Date | null;
  term: Date | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  forecastDate: Date | null;
  cleared: boolean;
  paintId: string | null;
  customerId: string | null;
  sectorId: string | null;
  responsibles?: Responsible[];
  responsibleIds?: string[];
  budgetIds?: string[];
  invoiceIds?: string[];
  receiptIds?: string[];
  bankSlipIds?: string[];
  reimbursementIds?: string[];
  reimbursementInvoiceIds?: string[];
  baseFileIds?: string[];
  projectFileIds?: string[];
  checkinFileIds?: string[];
  checkoutFileIds?: string[];
  createdById: string | null;
  bonusDiscountId?: string | null;

  // Relations
  sector?: Sector;
  customer?: Customer;
  quoteId?: string | null; // Foreign key to TaskQuote
  quote?: TaskQuote; // Task quote (one-to-one: each task has its own unique quote)
  budgets?: File[];
  invoices?: File[];
  receipts?: File[];
  bankSlips?: File[];
  reimbursements?: File[]; // Many-to-many relation
  reimbursementInvoices?: File[]; // Many-to-many relation
  baseFiles?: File[]; // Files used as base for artwork design
  projectFiles?: File[]; // Project files
  checkinFiles?: File[]; // Check-in files
  checkoutFiles?: File[]; // Check-out files
  observation?: Observation;
  generalPainting?: Paint;
  createdBy?: User;
  artworks?: File[];
  logoPaints?: Paint[];
  serviceOrders?: ServiceOrder[];
  airbrushings?: Airbrushing[];
  cuts?: Cut[];
  truck?: Truck;
  relatedTasks?: Task[];
  relatedTo?: Task[];
  forecastHistory?: TaskForecastHistory[];

  // Bonus relations
  bonuses?: Bonus[];
  bonusDiscount?: BonusDiscount;
}

// =====================
// Task Forecast History
// =====================

export type TaskForecastHistorySource = 'MANUAL' | 'AUTO_ENTRY_DATE' | 'AUTO_STARTED_AT' | 'COPY' | 'INITIAL';

export interface TaskForecastHistory {
  id: string;
  taskId: string;
  previousDate: Date | null;
  newDate: Date | null;
  reason: string | null;
  notes: string | null;
  source: TaskForecastHistorySource;
  changedById: string;
  createdAt: Date;
  changedBy?: { id: string; name: string };
}

// =====================
// Include Types
// =====================

export interface TaskIncludes {
  sector?:
    | boolean
    | {
        include?: SectorIncludes;
      };
  customer?:
    | boolean
    | {
        include?: CustomerIncludes;
      };
  quote?: boolean | { include?: { services?: boolean; layoutFile?: boolean; customerSignature?: boolean; customerConfigs?: boolean; responsible?: boolean } }; // Task quote (one-to-one: each task has its own unique quote)
  reimbursements?: boolean; // Many-to-many relation
  reimbursementInvoices?: boolean; // Many-to-many relation
  observation?:
    | boolean
    | {
        include?: ObservationIncludes;
      };
  generalPainting?:
    | boolean
    | {
        include?: PaintIncludes;
      };
  createdBy?:
    | boolean
    | {
        include?: UserIncludes;
      };
  artworks?:
    | boolean
    | {
        include?: FileIncludes;
      };
  baseFiles?:
    | boolean
    | {
        include?: FileIncludes;
      };
  projectFiles?:
    | boolean
    | {
        include?: FileIncludes;
      };
  checkinFiles?:
    | boolean
    | {
        include?: FileIncludes;
      };
  checkoutFiles?:
    | boolean
    | {
        include?: FileIncludes;
      };
  logoPaints?:
    | boolean
    | {
        include?: PaintIncludes;
      };
  serviceOrders?:
    | boolean
    | {
        include?: ServiceOrderIncludes;
      };
  airbrushings?:
    | boolean
    | {
        include?: AirbrushingIncludes;
        orderBy?: {
          createdAt?: "asc" | "desc";
          updatedAt?: "asc" | "desc";
        };
      };
  cuts?:
    | boolean
    | {
        include?: CutIncludes;
      };
  truck?:
    | boolean
    | {
        include?: TruckIncludes;
      };
  relatedTasks?:
    | boolean
    | {
        include?: TaskIncludes;
      };
  relatedTo?:
    | boolean
    | {
        include?: TaskIncludes;
      };
}

// =====================
// OrderBy Types
// =====================

export interface TaskOrderBy {
  id?: ORDER_BY_DIRECTION;
  name?: ORDER_BY_DIRECTION;
  status?: ORDER_BY_DIRECTION;
  statusOrder?: ORDER_BY_DIRECTION;
  commission?: ORDER_BY_DIRECTION;
  commissionOrder?: ORDER_BY_DIRECTION;
  serialNumber?: ORDER_BY_DIRECTION;
  details?: ORDER_BY_DIRECTION;
  // Note: chassisNumber and plate are now on Truck, use truck.chassisNumber / truck.plate
  entryDate?: ORDER_BY_DIRECTION;
  term?: ORDER_BY_DIRECTION;
  startedAt?: ORDER_BY_DIRECTION;
  finishedAt?: ORDER_BY_DIRECTION;
  paintId?: ORDER_BY_DIRECTION;
  customerId?: ORDER_BY_DIRECTION;
  sectorId?: ORDER_BY_DIRECTION;
  createdAt?: ORDER_BY_DIRECTION;
  updatedAt?: ORDER_BY_DIRECTION;
  sector?: SectorOrderBy;
  customer?: CustomerOrderBy;
  generalPainting?: PaintOrderBy;
  createdBy?: UserOrderBy;
}

// =====================
// Response Interfaces
// =====================

export interface TaskGetUniqueResponse extends BaseGetUniqueResponse<Task> {}
export interface TaskGetManyResponse extends BaseGetManyResponse<Task> {}
export interface TaskCreateResponse extends BaseCreateResponse<Task> {}
export interface TaskUpdateResponse extends BaseUpdateResponse<Task> {}
export interface TaskDeleteResponse extends BaseDeleteResponse {}

// =====================
// Batch Operation Responses
// =====================

export interface TaskBatchCreateResponse<T> extends BaseBatchResponse<Task, T> {}
export interface TaskBatchUpdateResponse<T> extends BaseBatchResponse<Task, T & { id: string }> {}
export interface TaskBatchDeleteResponse extends BaseBatchResponse<{ id: string; deleted: boolean }, { id: string }> {}
