// packages/interfaces/src/implement.ts

import type { BaseEntity, BaseGetUniqueResponse, BaseGetManyResponse, BaseCreateResponse, BaseUpdateResponse, BaseDeleteResponse } from "./common";
import type { Task, TaskIncludes, TaskOrderBy } from "./task";
import type { ImplementMeasure, ImplementMeasureIncludes } from "./implementMeasure";
import type { File } from "./file";
import type { ORDER_BY_DIRECTION, IMPLEMENT_CATEGORY, IMPLEMENT_TYPE, IMPLEMENT_SPOT } from "../constants";

// =====================
// Main Entity Interface
// =====================

export interface Implement extends BaseEntity {
  // Identification
  plate: string | null;
  chassisNumber: string | null;
  /** Foto da plaqueta de identificação (VIN). Imagem, não texto — a relação é `vinPlate`. */
  vinPlateId: string | null;

  // Implement specifications
  category: IMPLEMENT_CATEGORY | null;
  type: IMPLEMENT_TYPE | null;

  // Spot (garage location)
  spot: IMPLEMENT_SPOT | null;

  // Relations
  taskId: string;
  leftSideMeasureId: string | null;
  rightSideMeasureId: string | null;
  backSideMeasureId: string | null;
  task?: Task;
  /** Foto da plaqueta de identificação (VIN). */
  vinPlate?: File | null;
  leftSideMeasure?: ImplementMeasure;
  rightSideMeasure?: ImplementMeasure;
  backSideMeasure?: ImplementMeasure;
}

// =====================
// Include Types
// =====================

export interface ImplementIncludes {
  task?:
    | boolean
    | {
        include?: TaskIncludes;
      };
  leftSideMeasure?:
    | boolean
    | {
        include?: ImplementMeasureIncludes;
      };
  rightSideMeasure?:
    | boolean
    | {
        include?: ImplementMeasureIncludes;
      };
  /** Foto da plaqueta de identificação (VIN). */
  vinPlate?: boolean;
  backSideMeasure?:
    | boolean
    | {
        include?: ImplementMeasureIncludes;
      };
}

// =====================
// Order By Types
// =====================

export interface ImplementOrderBy {
  id?: ORDER_BY_DIRECTION;
  plate?: ORDER_BY_DIRECTION;
  chassisNumber?: ORDER_BY_DIRECTION;
  vinPlateId?: ORDER_BY_DIRECTION;
  category?: ORDER_BY_DIRECTION;
  type?: ORDER_BY_DIRECTION;
  spot?: ORDER_BY_DIRECTION;
  taskId?: ORDER_BY_DIRECTION;
  createdAt?: ORDER_BY_DIRECTION;
  updatedAt?: ORDER_BY_DIRECTION;
  task?: TaskOrderBy;
}

// =====================
// Response Interfaces
// =====================

export interface ImplementGetUniqueResponse extends BaseGetUniqueResponse<Implement> {}
export interface ImplementGetManyResponse extends BaseGetManyResponse<Implement> {}
export interface ImplementCreateResponse extends BaseCreateResponse<Implement> {}
export interface ImplementUpdateResponse extends BaseUpdateResponse<Implement> {}
export interface ImplementDeleteResponse extends BaseDeleteResponse {}

// =====================
// Form Data Types
// =====================

export interface ImplementGetManyFormData {
  page?: number;
  limit?: number;
  take?: number;
  skip?: number;
  where?: any;
  orderBy?: ImplementOrderBy;
  include?: ImplementIncludes;
  searchingFor?: string;
  plate?: string;
  category?: IMPLEMENT_CATEGORY;
  spot?: IMPLEMENT_SPOT;
}

export interface ImplementGetByIdFormData {
  id: string;
  include?: ImplementIncludes;
}

export interface ImplementCreateFormData {
  plate?: string | null;
  chassisNumber?: string | null;
  vinPlateId?: string | null;
  category?: IMPLEMENT_CATEGORY | null;
  type?: IMPLEMENT_TYPE | null;
  spot?: IMPLEMENT_SPOT | null;
  taskId?: string;
  leftSideMeasureId?: string | null;
  rightSideMeasureId?: string | null;
  backSideMeasureId?: string | null;
}

export interface ImplementUpdateFormData {
  plate?: string | null;
  chassisNumber?: string | null;
  vinPlateId?: string | null;
  category?: IMPLEMENT_CATEGORY | null;
  type?: IMPLEMENT_TYPE | null;
  spot?: IMPLEMENT_SPOT | null;
  taskId?: string;
  leftSideMeasureId?: string | null;
  rightSideMeasureId?: string | null;
  backSideMeasureId?: string | null;
}

export interface ImplementQueryFormData {
  include?: ImplementIncludes;
}
