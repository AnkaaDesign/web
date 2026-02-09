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
import type { TaskPricing } from "./task-pricing";
import type { Representative } from "./representative";

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
  paintId: string | null;
  customerId: string | null;
  invoiceToId: string | null;
  sectorId: string | null;
  representatives?: Representative[];
  representativeIds?: string[];
  budgetIds?: string[];
  invoiceIds?: string[];
  receiptIds?: string[];
  reimbursementIds?: string[];
  reimbursementInvoiceIds?: string[];
  baseFileIds?: string[];
  createdById: string | null;

  // Relations
  sector?: Sector;
  customer?: Customer;
  invoiceTo?: Customer;
  budgets?: File[]; // Many-to-many relation (budget files)
  pricingId?: string | null; // Foreign key to TaskPricing
  pricing?: TaskPricing; // Task pricing (one-to-many: one pricing can be shared across multiple tasks)
  invoices?: File[]; // Many-to-many relation
  receipts?: File[]; // Many-to-many relation
  reimbursements?: File[]; // Many-to-many relation
  reimbursementInvoices?: File[]; // Many-to-many relation
  baseFiles?: File[]; // Files used as base for artwork design
  observation?: Observation;
  generalPainting?: Paint;
  createdBy?: User;
  artworks?: File[];
  logoPaints?: Paint[];
  serviceOrders?: ServiceOrder[];
  airbrushing?: Airbrushing[]; // Note: Field name is singular but value is array
  cuts?: Cut[];
  truck?: Truck;
  relatedTasks?: Task[];
  relatedTo?: Task[];
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
  budgets?: boolean; // Many-to-many relation (budget files)
  pricing?: boolean | { include?: { items?: boolean; layoutFile?: boolean; customerSignature?: boolean } }; // Task pricing (one-to-many: one pricing can be shared across multiple tasks)
  invoices?: boolean; // Many-to-many relation
  receipts?: boolean; // Many-to-many relation
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
  airbrushing?:
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
