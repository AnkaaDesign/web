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
import type { Airbrushing, AirbrushingIncludes } from './airbrushing';
import type { LAYOUT_APPROVAL_SOURCE, LAYOUT_STATUS, ORDER_BY_DIRECTION } from '@constants';

// =====================
// Main Entity Interface
// =====================

/**
 * A ARTE DO IMPLEMENTO (Modelo C, P12). A arte é do IMPLEMENTO, não da tarefa
 * nem do orçamento: o orçamento e o documento levam a aprovada de cada veículo.
 * Reprovada só volta por VERSÃO NOVA (`supersedesId`); a anterior vira
 * `SUPERSEDED`.
 */
export interface Layout extends BaseEntity {
  fileId: string;
  status: LAYOUT_STATUS;
  implementId?: string | null;
  airbrushingId?: string | null;
  version?: number;
  supersedesId?: string | null;
  sentAt?: Date | string | null;
  decidedAt?: Date | string | null;
  approvalSource?: LAYOUT_APPROVAL_SOURCE | null;
  decidedByResponsibleId?: string | null;
  decidedByUserId?: string | null;
  /** A nota da decisão interna ("aprovado por WhatsApp em 23/09, contato Fulano"). */
  decisionNote?: string | null;

  // Relations
  file?: File;
  airbrushing?: Airbrushing | null;
  decisions?: LayoutDecision[];

  // Index signature for compatibility
  [key: string]: unknown;
}

/** Uma decisão registrada sobre a arte (a mais recente vem na leitura). */
export interface LayoutDecision {
  id: string;
  layoutId: string;
  [key: string]: unknown;
}

// =====================
// Include Types
// =====================

export interface LayoutIncludes {
  file?: boolean | { include?: FileIncludes };
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
