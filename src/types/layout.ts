// packages/interfaces/src/layout.ts

import type {
  BaseEntity,
  BaseGetUniqueResponse,
  BaseGetManyResponse,
  BaseCreateResponse,
  BaseUpdateResponse,
  BaseDeleteResponse,
  BaseBatchResponse,
} from './common';
import type { File, FileIncludes } from './file';
import type { Task, TaskIncludes } from './task';
import type { Airbrushing, AirbrushingIncludes } from './airbrushing';
import type { ORDER_BY_DIRECTION } from '@constants';

// =====================
// Main Entity Interface
// =====================

export interface Layout extends BaseEntity {
  fileId: string;
  status: 'DRAFT' | 'APPROVED' | 'REPROVED';
  airbrushingId?: string | null;

  // Relations (Many-to-Many: Layout can be shared across multiple Tasks)
  file?: File;
  tasks?: Task[]; // Layout is SHARED across tasks - status changes affect all
  airbrushing?: Airbrushing | null;

  // Index signature for compatibility
  [key: string]: unknown;
}

// =====================
// Include Types
// =====================

export interface LayoutIncludes {
  file?: boolean | { include?: FileIncludes };
  tasks?: boolean | { include?: TaskIncludes }; // Many-to-many with Task
  airbrushing?: boolean | { include?: AirbrushingIncludes };
}

export type LayoutInclude = LayoutIncludes;

// =====================
// Order By Types
// =====================

export interface LayoutOrderBy {
  id?: ORDER_BY_DIRECTION;
  fileId?: ORDER_BY_DIRECTION;
  status?: ORDER_BY_DIRECTION;
  airbrushingId?: ORDER_BY_DIRECTION;
  createdAt?: ORDER_BY_DIRECTION;
  updatedAt?: ORDER_BY_DIRECTION;
}

// =====================
// Where Types
// =====================

export interface LayoutWhere {
  id?: string;
  fileId?: string;
  status?: 'DRAFT' | 'APPROVED' | 'REPROVED';
  airbrushingId?: string | null;
  // For many-to-many, use tasks: { some: { id: taskId } } to filter by task
  tasks?: { some?: { id?: string }; every?: { id?: string }; none?: { id?: string } };
  AND?: LayoutWhere[];
  OR?: LayoutWhere[];
  NOT?: LayoutWhere[];
}

// =====================
// Form Data Types
// =====================

export interface LayoutCreateFormData {
  fileId: string;
  status?: 'DRAFT' | 'APPROVED' | 'REPROVED';
  airbrushingId?: string | null;
  // Tasks are connected via the many-to-many junction table, not directly here
  taskIds?: string[]; // Optional: IDs of tasks to connect this artwork to
}

export interface LayoutUpdateFormData {
  fileId?: string;
  status?: 'DRAFT' | 'APPROVED' | 'REPROVED';
  airbrushingId?: string | null;
  // For updating task connections, use connect/disconnect operations
  taskIds?: string[]; // Optional: IDs of tasks to set for this artwork
}

export interface LayoutQueryFormData {
  include?: LayoutInclude;
}

export interface LayoutGetManyFormData {
  page?: number;
  limit?: number;
  where?: LayoutWhere;
  orderBy?: LayoutOrderBy | LayoutOrderBy[];
  include?: LayoutInclude;
}

export interface LayoutBatchCreateFormData {
  layouts: LayoutCreateFormData[];
}

export interface LayoutBatchUpdateFormData {
  layouts: { id: string; data: LayoutUpdateFormData }[];
}

export interface LayoutBatchDeleteFormData {
  layoutIds: string[];
}

// =====================
// Response Types
// =====================

export type LayoutGetUniqueResponse = BaseGetUniqueResponse<Layout>;
export type LayoutGetManyResponse = BaseGetManyResponse<Layout>;
export type LayoutCreateResponse = BaseCreateResponse<Layout>;
export type LayoutUpdateResponse = BaseUpdateResponse<Layout>;
export type LayoutDeleteResponse = BaseDeleteResponse;
export type LayoutBatchCreateResponse<T> = BaseBatchResponse<T>;
export type LayoutBatchUpdateResponse<T> = BaseBatchResponse<T>;
export type LayoutBatchDeleteResponse = BaseBatchResponse<string>;
