// packages/interfaces/src/serviceOrder.ts

import type { BaseEntity, BaseGetUniqueResponse, BaseGetManyResponse, BaseCreateResponse, BaseUpdateResponse, BaseDeleteResponse, BaseBatchResponse } from "./common";
import type { ORDER_BY_DIRECTION, SERVICE_ORDER_STATUS, SERVICE_ORDER_TYPE } from "../constants";
import type { Task, TaskIncludes, TaskOrderBy } from "./task";
import type { User, UserIncludes, UserOrderBy } from "./user";

// =====================
// ServiceOrder Interface
// =====================

export interface ServiceOrder extends BaseEntity {
  status: SERVICE_ORDER_STATUS | null;
  statusOrder: number; // 1=Pendente, 2=Em Andamento, 3=Aguardando Aprovação, 4=Concluído, 5=Cancelado
  type: SERVICE_ORDER_TYPE;
  description: string;
  observation: string | null;
  taskId: string;
  assignedToId: string | null;
  startedById: string | null;
  approvedById: string | null;
  completedById: string | null;
  startedAt: Date | null;
  approvedAt: Date | null;
  finishedAt: Date | null;

  // Relations
  task?: Task;
  assignedTo?: User;
  createdBy?: User;
  startedBy?: User;
  approvedBy?: User;
  completedBy?: User;
  service?: {
    name: string;
  };
}

// =====================
// Include Types
// =====================

export interface ServiceOrderIncludes {
  task?:
    | boolean
    | {
        include?: TaskIncludes;
      };
  assignedTo?:
    | boolean
    | {
        include?: UserIncludes;
      };
  createdBy?:
    | boolean
    | {
        include?: UserIncludes;
      };
  startedBy?:
    | boolean
    | {
        include?: UserIncludes;
      };
  approvedBy?:
    | boolean
    | {
        include?: UserIncludes;
      };
  completedBy?:
    | boolean
    | {
        include?: UserIncludes;
      };
}

// =====================
// OrderBy Types
// =====================

export interface ServiceOrderOrderBy {
  id?: ORDER_BY_DIRECTION;
  status?: ORDER_BY_DIRECTION;
  statusOrder?: ORDER_BY_DIRECTION;
  type?: ORDER_BY_DIRECTION;
  description?: ORDER_BY_DIRECTION;
  observation?: ORDER_BY_DIRECTION;
  taskId?: ORDER_BY_DIRECTION;
  assignedToId?: ORDER_BY_DIRECTION;
  startedById?: ORDER_BY_DIRECTION;
  approvedById?: ORDER_BY_DIRECTION;
  completedById?: ORDER_BY_DIRECTION;
  startedAt?: ORDER_BY_DIRECTION;
  approvedAt?: ORDER_BY_DIRECTION;
  finishedAt?: ORDER_BY_DIRECTION;
  createdAt?: ORDER_BY_DIRECTION;
  updatedAt?: ORDER_BY_DIRECTION;
  task?: TaskOrderBy;
  assignedTo?: UserOrderBy;
}

// =====================
// Response Interfaces - ServiceOrder
// =====================

export interface ServiceOrderGetUniqueResponse extends BaseGetUniqueResponse<ServiceOrder> {}
export interface ServiceOrderGetManyResponse extends BaseGetManyResponse<ServiceOrder> {}
export interface ServiceOrderCreateResponse extends BaseCreateResponse<ServiceOrder> {}
export interface ServiceOrderUpdateResponse extends BaseUpdateResponse<ServiceOrder> {}
export interface ServiceOrderDeleteResponse extends BaseDeleteResponse {}

// =====================
// Batch Operation Responses - ServiceOrder
// =====================

export interface ServiceOrderBatchCreateResponse<T> extends BaseBatchResponse<ServiceOrder, T> {}
export interface ServiceOrderBatchUpdateResponse<T> extends BaseBatchResponse<ServiceOrder, T & { id: string }> {}
export interface ServiceOrderBatchDeleteResponse extends BaseBatchResponse<{ id: string; deleted: boolean }, { id: string }> {}
