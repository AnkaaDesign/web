// packages/interfaces/src/truck.ts

import type { BaseEntity, BaseGetUniqueResponse, BaseGetManyResponse, BaseCreateResponse, BaseUpdateResponse, BaseDeleteResponse, BaseBatchResponse } from "./common";
import type { Task, TaskIncludes, TaskOrderBy } from "./task";
import type { Layout, LayoutIncludes } from "./layout";
import type { ORDER_BY_DIRECTION, TRUCK_CATEGORY, IMPLEMENT_TYPE, TRUCK_SPOT } from "../constants";

// =====================
// Main Entity Interface
// =====================

export interface Truck extends BaseEntity {
  // Identification
  plate: string | null;
  chassisNumber: string | null;

  // Truck specifications
  category: TRUCK_CATEGORY | null;
  implementType: IMPLEMENT_TYPE | null;

  // Spot (garage location)
  spot: TRUCK_SPOT | null;

  // Relations
  taskId: string;
  leftSideLayoutId: string | null;
  rightSideLayoutId: string | null;
  backSideLayoutId: string | null;
  task?: Task;
  leftSideLayout?: Layout;
  rightSideLayout?: Layout;
  backSideLayout?: Layout;
}

// =====================
// Include Types
// =====================

export interface TruckIncludes {
  task?:
    | boolean
    | {
        include?: TaskIncludes;
      };
  leftSideLayout?:
    | boolean
    | {
        include?: LayoutIncludes;
      };
  rightSideLayout?:
    | boolean
    | {
        include?: LayoutIncludes;
      };
  backSideLayout?:
    | boolean
    | {
        include?: LayoutIncludes;
      };
}

// =====================
// Order By Types
// =====================

export interface TruckOrderBy {
  id?: ORDER_BY_DIRECTION;
  plate?: ORDER_BY_DIRECTION;
  chassisNumber?: ORDER_BY_DIRECTION;
  category?: ORDER_BY_DIRECTION;
  implementType?: ORDER_BY_DIRECTION;
  spot?: ORDER_BY_DIRECTION;
  taskId?: ORDER_BY_DIRECTION;
  createdAt?: ORDER_BY_DIRECTION;
  updatedAt?: ORDER_BY_DIRECTION;
  task?: TaskOrderBy;
}

// =====================
// Response Interfaces
// =====================

export interface TruckGetUniqueResponse extends BaseGetUniqueResponse<Truck> {}
export interface TruckGetManyResponse extends BaseGetManyResponse<Truck> {}
export interface TruckCreateResponse extends BaseCreateResponse<Truck> {}
export interface TruckUpdateResponse extends BaseUpdateResponse<Truck> {}
export interface TruckDeleteResponse extends BaseDeleteResponse {}

// =====================
// Batch Operation Responses
// =====================

export interface TruckBatchCreateResponse<T> extends BaseBatchResponse<Truck, T> {}
export interface TruckBatchUpdateResponse<T> extends BaseBatchResponse<Truck, T & { id: string }> {}
export interface TruckBatchDeleteResponse extends BaseBatchResponse<{ id: string; deleted: boolean }, { id: string }> {}

// =====================
// Form Data Types
// =====================

export interface TruckGetManyFormData {
  page?: number;
  limit?: number;
  take?: number;
  skip?: number;
  where?: any;
  orderBy?: TruckOrderBy;
  include?: TruckIncludes;
  searchingFor?: string;
  plate?: string;
  category?: TRUCK_CATEGORY;
  spot?: TRUCK_SPOT;
}

export interface TruckGetByIdFormData {
  id: string;
  include?: TruckIncludes;
}

export interface TruckCreateFormData {
  plate?: string | null;
  chassisNumber?: string | null;
  category?: TRUCK_CATEGORY | null;
  implementType?: IMPLEMENT_TYPE | null;
  spot?: TRUCK_SPOT | null;
  taskId?: string;
  leftSideLayoutId?: string | null;
  rightSideLayoutId?: string | null;
  backSideLayoutId?: string | null;
}

export interface TruckUpdateFormData {
  plate?: string | null;
  chassisNumber?: string | null;
  category?: TRUCK_CATEGORY | null;
  implementType?: IMPLEMENT_TYPE | null;
  spot?: TRUCK_SPOT | null;
  taskId?: string;
  leftSideLayoutId?: string | null;
  rightSideLayoutId?: string | null;
  backSideLayoutId?: string | null;
}

export interface TruckQueryFormData {
  include?: TruckIncludes;
}

export interface TruckBatchCreateFormData {
  trucks: TruckCreateFormData[];
}

export interface TruckBatchUpdateFormData {
  trucks: {
    id: string;
    data: TruckUpdateFormData;
  }[];
}

export interface TruckBatchDeleteFormData {
  truckIds: string[];
}
