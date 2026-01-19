// packages/interfaces/src/artwork.ts

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

export interface Artwork extends BaseEntity {
  fileId: string;
  status: 'DRAFT' | 'APPROVED' | 'REPROVED';
  airbrushingId?: string | null;

  // Relations (Many-to-Many: Artwork can be shared across multiple Tasks)
  file?: File;
  tasks?: Task[]; // Artwork is SHARED across tasks - status changes affect all
  airbrushing?: Airbrushing | null;

  // Index signature for compatibility
  [key: string]: unknown;
}

// =====================
// Include Types
// =====================

export interface ArtworkIncludes {
  file?: boolean | { include?: FileIncludes };
  tasks?: boolean | { include?: TaskIncludes }; // Many-to-many with Task
  airbrushing?: boolean | { include?: AirbrushingIncludes };
}

export type ArtworkInclude = ArtworkIncludes;

// =====================
// Order By Types
// =====================

export interface ArtworkOrderBy {
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

export interface ArtworkWhere {
  id?: string;
  fileId?: string;
  status?: 'DRAFT' | 'APPROVED' | 'REPROVED';
  airbrushingId?: string | null;
  // For many-to-many, use tasks: { some: { id: taskId } } to filter by task
  tasks?: { some?: { id?: string }; every?: { id?: string }; none?: { id?: string } };
  AND?: ArtworkWhere[];
  OR?: ArtworkWhere[];
  NOT?: ArtworkWhere[];
}

// =====================
// Form Data Types
// =====================

export interface ArtworkCreateFormData {
  fileId: string;
  status?: 'DRAFT' | 'APPROVED' | 'REPROVED';
  airbrushingId?: string | null;
  // Tasks are connected via the many-to-many junction table, not directly here
  taskIds?: string[]; // Optional: IDs of tasks to connect this artwork to
}

export interface ArtworkUpdateFormData {
  fileId?: string;
  status?: 'DRAFT' | 'APPROVED' | 'REPROVED';
  airbrushingId?: string | null;
  // For updating task connections, use connect/disconnect operations
  taskIds?: string[]; // Optional: IDs of tasks to set for this artwork
}

export interface ArtworkQueryFormData {
  include?: ArtworkInclude;
}

export interface ArtworkGetManyFormData {
  page?: number;
  limit?: number;
  where?: ArtworkWhere;
  orderBy?: ArtworkOrderBy | ArtworkOrderBy[];
  include?: ArtworkInclude;
}

export interface ArtworkBatchCreateFormData {
  artworks: ArtworkCreateFormData[];
}

export interface ArtworkBatchUpdateFormData {
  artworks: { id: string; data: ArtworkUpdateFormData }[];
}

export interface ArtworkBatchDeleteFormData {
  artworkIds: string[];
}

// =====================
// Response Types
// =====================

export type ArtworkGetUniqueResponse = BaseGetUniqueResponse<Artwork>;
export type ArtworkGetManyResponse = BaseGetManyResponse<Artwork>;
export type ArtworkCreateResponse = BaseCreateResponse<Artwork>;
export type ArtworkUpdateResponse = BaseUpdateResponse<Artwork>;
export type ArtworkDeleteResponse = BaseDeleteResponse;
export type ArtworkBatchCreateResponse<T> = BaseBatchResponse<T>;
export type ArtworkBatchUpdateResponse<T> = BaseBatchResponse<T>;
export type ArtworkBatchDeleteResponse = BaseBatchResponse<string>;
