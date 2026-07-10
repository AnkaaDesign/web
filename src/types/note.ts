// note.ts
// Notas — feature unificada (antigo "Post-it" + rascunho "Anotações"). Cada nota
// pertence a um owner e pode ser compartilhada (NoteShare) com outros usuários.

import type {
  BaseEntity,
  BaseGetUniqueResponse,
  BaseGetManyResponse,
  BaseCreateResponse,
  BaseUpdateResponse,
  BaseDeleteResponse,
} from "./common";
import type { ORDER_BY_DIRECTION } from "../constants";
import type { User } from './user';

// =====================
// Share (join com usuário)
// =====================
export interface NoteShare {
  noteId: string;
  userId: string;
  // false = visualizador; true = editor.
  canEdit: boolean;
  sharedAt: Date | string;

  // Relations (optional, populated based on query)
  note?: Note;
  user?: User;
}

// =====================
// Main Entity Interface
// =====================
export interface Note extends BaseEntity {
  ownerId: string;
  // Título curto e opcional, exibido em destaque no quadro de cards.
  title: string | null;
  content: string;
  color: string;
  position: number;
  isArchived: boolean;
  // Definido ao arquivar; limpo ao restaurar.
  archivedAt: Date | string | null;

  // Canvas livre: coordenadas e tamanho (px / unidades do board). Nuláveis
  // (notas legadas/sem posição caem num grid de fallback no front).
  positionX: number | null;
  positionY: number | null;
  width: number | null;
  height: number | null;

  // Relations (optional, populated based on query)
  owner?: User;
  shares?: NoteShare[];
}

// =====================
// Include Types
// =====================
export interface NoteIncludes {
  owner?: boolean;
  shares?: boolean;
}

// =====================
// Order By Types
// =====================
export interface NoteOrderBy {
  id?: ORDER_BY_DIRECTION;
  title?: ORDER_BY_DIRECTION;
  position?: ORDER_BY_DIRECTION;
  color?: ORDER_BY_DIRECTION;
  isArchived?: ORDER_BY_DIRECTION;
  createdAt?: ORDER_BY_DIRECTION;
  updatedAt?: ORDER_BY_DIRECTION;
}

// =====================
// Response Interfaces
// =====================
export interface NoteGetUniqueResponse extends BaseGetUniqueResponse<Note> {}
export interface NoteGetManyResponse extends BaseGetManyResponse<Note> {}
export interface NoteCreateResponse extends BaseCreateResponse<Note> {}
export interface NoteUpdateResponse extends BaseUpdateResponse<Note> {}
export interface NoteDeleteResponse extends BaseDeleteResponse {}
export interface NoteReorderResponse extends BaseGetManyResponse<Note> {}
export interface NoteShareResponse extends BaseGetUniqueResponse<Note> {}
