// note.ts
// Notas — feature unificada (antigo "Post-it" + rascunho "Anotações"). Cada nota
// pertence a um usuário (owner) e pode ser compartilhada com outros usuários
// (NoteShare), como visualizador ou editor. O escopo de visibilidade é aplicado
// no servidor (owner OU compartilhado).

import { z } from 'zod';
import {
  orderByDirectionSchema,
  normalizeOrderBy,
  paginationSchema,
  createStringWhereSchema,
  createUuidWhereSchema,
  createBooleanWhereSchema,
  createDateWhereSchema,
  mergeAndConditions,
} from "./common";

// Paleta fixa de cores das notas (cores nomeadas, render no front).
export const NOTE_COLORS = ['yellow', 'pink', 'blue', 'green', 'orange', 'purple'] as const;

// Escopo de listagem: 'owned' = só minhas, 'shared' = compartilhadas comigo
// (que não sou dono), 'all' = ambas (padrão).
export const NOTE_SCOPES = ['owned', 'shared', 'all'] as const;

// =====================
// Include Schema
// =====================
export const noteIncludeSchema = z
  .object({
    owner: z.boolean().optional(),
    // A inclusão de `shares` implica o usuário aninhado no serviço.
    shares: z.boolean().optional(),
  })
  .partial();

// =====================
// OrderBy Schema
// =====================
const noteOrderByFields = {
  id: orderByDirectionSchema.optional(),
  title: orderByDirectionSchema.optional(),
  position: orderByDirectionSchema.optional(),
  color: orderByDirectionSchema.optional(),
  isArchived: orderByDirectionSchema.optional(),
  createdAt: orderByDirectionSchema.optional(),
  updatedAt: orderByDirectionSchema.optional(),
};

export const noteOrderBySchema = z
  .union([
    z.object(noteOrderByFields).partial(),
    z.array(z.object(noteOrderByFields).partial()),
  ])
  .optional();

// =====================
// Where Schema
// =====================
export const noteWhereSchema: z.ZodSchema = z.lazy(() =>
  z
    .object({
      AND: z.array(noteWhereSchema).optional(),
      OR: z.array(noteWhereSchema).optional(),
      NOT: noteWhereSchema.optional(),
      id: createUuidWhereSchema().optional(),
      ownerId: createUuidWhereSchema().optional(),
      title: createStringWhereSchema().optional(),
      content: createStringWhereSchema().optional(),
      color: createStringWhereSchema().optional(),
      isArchived: createBooleanWhereSchema().optional(),
      createdAt: createDateWhereSchema().optional(),
      updatedAt: createDateWhereSchema().optional(),
    })
    .partial(),
);

// =====================
// Share Input
// =====================
export const noteShareInputSchema = z.object({
  userId: z.string().uuid({ message: 'Usuário inválido' }),
  canEdit: z.boolean().default(false),
});

// =====================
// Filters & Transform
// =====================
const noteFilters = {
  searchingFor: z.string().optional(),
  isArchived: z.boolean().optional(),
  // Escopo de visibilidade, resolvido no servidor (@UserId). Passa direto.
  scope: z.enum(NOTE_SCOPES as unknown as [string, ...string[]]).optional(),
};

const noteTransform = (data: any) => {
  if (data.orderBy) data.orderBy = normalizeOrderBy(data.orderBy);
  if (data.take && !data.limit) data.limit = data.take;
  delete data.take;

  const andConditions: any[] = [];
  if (data.searchingFor && typeof data.searchingFor === 'string' && data.searchingFor.trim()) {
    const term = data.searchingFor.trim();
    andConditions.push({
      OR: [
        { content: { contains: term, mode: 'insensitive' } },
        { title: { contains: term, mode: 'insensitive' } },
      ],
    });
    delete data.searchingFor;
  }
  if (typeof data.isArchived === 'boolean') {
    andConditions.push({ isArchived: data.isArchived });
    delete data.isArchived;
  }
  // `scope` é intencionalmente preservado — o servidor o interpreta contra o
  // usuário autenticado; não vira condição de where no cliente.
  return mergeAndConditions(data, andConditions);
};

// =====================
// Query Schemas
// =====================
export const noteGetManySchema = z
  .object({
    ...paginationSchema.shape,
    where: noteWhereSchema.optional(),
    orderBy: noteOrderBySchema.optional(),
    include: noteIncludeSchema.optional(),
    ...noteFilters,
  })
  .transform(noteTransform);

export const noteQuerySchema = z.object({
  include: noteIncludeSchema.optional(),
});

// =====================
// CRUD Schemas
// =====================
export const noteCreateSchema = z.object({
  // Título curto e opcional, exibido em destaque no quadro de cards.
  title: z.string().max(200, 'Máximo de 200 caracteres').nullable().optional(),
  content: z.string().max(2000, 'Máximo de 2000 caracteres').default(''),
  color: z.enum(NOTE_COLORS as unknown as [string, ...string[]]).optional(),
  // No canvas livre, `position` funciona como z-index (ordem de empilhamento) e
  // pode ser negativo (enviar para trás). Sem piso em 0.
  position: z.number().int().optional(),
  // Canvas livre: coordenadas e tamanho (px / unidades do board). Nuláveis.
  positionX: z.number().nullable().optional(),
  positionY: z.number().nullable().optional(),
  width: z.number().positive().nullable().optional(),
  height: z.number().positive().nullable().optional(),
  // Compartilhamento inicial opcional.
  shareWith: z.array(noteShareInputSchema).optional(),
});

export const noteUpdateSchema = z.object({
  title: z.string().max(200, 'Máximo de 200 caracteres').nullable().optional(),
  content: z.string().max(2000, 'Máximo de 2000 caracteres').optional(),
  color: z.enum(NOTE_COLORS as unknown as [string, ...string[]]).optional(),
  // z-index do canvas — pode ser negativo (enviar para trás).
  position: z.number().int().optional(),
  isArchived: z.boolean().optional(),
  // Canvas livre: coordenadas e tamanho (px / unidades do board). Nuláveis.
  positionX: z.number().nullable().optional(),
  positionY: z.number().nullable().optional(),
  width: z.number().positive().nullable().optional(),
  height: z.number().positive().nullable().optional(),
});

// Substitui o conjunto completo de compartilhamentos (owner only).
export const noteShareSchema = z.object({
  shares: z.array(noteShareInputSchema),
});

// Reordenação por arrastar-e-soltar: lista completa de IDs na nova ordem.
export const noteReorderSchema = z.object({
  noteIds: z
    .array(z.string().uuid({ message: 'Nota inválida' }))
    .min(1, 'Pelo menos um ID deve ser fornecido'),
});

// =====================
// Inferred Types
// =====================
export type NoteGetManyFormData = z.infer<typeof noteGetManySchema>;
export type NoteQueryFormData = z.infer<typeof noteQuerySchema>;
export type NoteCreateFormData = z.infer<typeof noteCreateSchema>;
export type NoteUpdateFormData = z.infer<typeof noteUpdateSchema>;
export type NoteShareFormData = z.infer<typeof noteShareSchema>;
export type NoteReorderFormData = z.infer<typeof noteReorderSchema>;
export type NoteShareInput = z.infer<typeof noteShareInputSchema>;
export type NoteInclude = z.infer<typeof noteIncludeSchema>;
export type NoteOrderBy = z.infer<typeof noteOrderBySchema>;
export type NoteWhere = z.infer<typeof noteWhereSchema>;
