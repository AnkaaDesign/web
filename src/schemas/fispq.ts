// packages/schemas/src/fispq.ts
// FISPQ / FDS — Ficha de Informações de Segurança de Produtos Químicos / Safety Data Sheet
// Mirrors api/src/schemas/fispq.ts. One record per chemical Item (1:1).

import { z } from "zod";
import { orderByDirectionSchema, normalizeOrderBy, paginationSchema, createStringWhereSchema, createUuidWhereSchema, createDateWhereSchema, mergeAndConditions } from "./common";
import { GHS_PICTOGRAM, GHS_SIGNAL_WORD, FISPQ_STATUS } from "../constants";

// =====================
// Enum value schemas
// =====================

export const ghsPictogramSchema = z.enum(Object.values(GHS_PICTOGRAM) as [string, ...string[]], {
  errorMap: () => ({ message: "pictograma GHS inválido" }),
});

export const ghsSignalWordSchema = z.enum(Object.values(GHS_SIGNAL_WORD) as [string, ...string[]], {
  errorMap: () => ({ message: "palavra de advertência inválida" }),
});

export const fispqStatusSchema = z.enum(Object.values(FISPQ_STATUS) as [string, ...string[]], {
  errorMap: () => ({ message: "status da FISPQ inválido" }),
});

// =====================
// Include Schema
// =====================

export const fispqIncludeSchema = z
  .object({
    item: z
      .union([
        z.boolean(),
        z.object({
          include: z
            .object({
              category: z.boolean().optional(),
              brands: z.boolean().optional(),
            })
            .optional(),
        }),
      ])
      .optional(),
    pdfFile: z.boolean().optional(),
    requiredPpeItems: z.boolean().optional(),
  })
  .partial();

// =====================
// OrderBy Schema
// =====================

const fispqOrderByFields = {
  id: orderByDirectionSchema.optional(),
  itemId: orderByDirectionSchema.optional(),
  productName: orderByDirectionSchema.optional(),
  manufacturer: orderByDirectionSchema.optional(),
  casNumber: orderByDirectionSchema.optional(),
  onuNumber: orderByDirectionSchema.optional(),
  signalWord: orderByDirectionSchema.optional(),
  status: orderByDirectionSchema.optional(),
  issueDate: orderByDirectionSchema.optional(),
  validUntil: orderByDirectionSchema.optional(),
  revisionDate: orderByDirectionSchema.optional(),
  createdAt: orderByDirectionSchema.optional(),
  updatedAt: orderByDirectionSchema.optional(),
};

export const fispqOrderBySchema = z.union([z.object(fispqOrderByFields).partial(), z.array(z.object(fispqOrderByFields).partial())]).optional();

// =====================
// Where Schema
// =====================

export const fispqWhereSchema: z.ZodSchema = z.lazy(() =>
  z
    .object({
      AND: z.array(fispqWhereSchema).optional(),
      OR: z.array(fispqWhereSchema).optional(),
      NOT: fispqWhereSchema.optional(),

      id: createUuidWhereSchema().optional(),
      itemId: createUuidWhereSchema().optional(),
      pdfFileId: z.union([createUuidWhereSchema(), z.null()]).optional(),

      productName: z.union([createStringWhereSchema(), z.null()]).optional(),
      manufacturer: z.union([createStringWhereSchema(), z.null()]).optional(),
      supplierName: z.union([createStringWhereSchema(), z.null()]).optional(),
      casNumber: z.union([createStringWhereSchema(), z.null()]).optional(),
      onuNumber: z.union([createStringWhereSchema(), z.null()]).optional(),
      signalWord: z.union([createStringWhereSchema(), z.null()]).optional(),
      status: createStringWhereSchema().optional(),
      notes: z.union([createStringWhereSchema(), z.null()]).optional(),
      isActive: z.boolean().optional(),

      item: z
        .object({
          is: z.lazy(() => z.any()).optional(),
          isNot: z.lazy(() => z.any()).optional(),
        })
        .optional(),

      issueDate: z.union([createDateWhereSchema(), z.null()]).optional(),
      revisionDate: z.union([createDateWhereSchema(), z.null()]).optional(),
      validUntil: z.union([createDateWhereSchema(), z.null()]).optional(),
      createdAt: createDateWhereSchema().optional(),
      updatedAt: createDateWhereSchema().optional(),
    })
    .partial(),
);

// =====================
// Convenience Filters + Transform
// =====================

const fispqFilters = {
  searchingFor: z.string().optional(),
  statuses: z.array(fispqStatusSchema).optional(),
  signalWords: z.array(ghsSignalWordSchema).optional(),
  pictograms: z.array(ghsPictogramSchema).optional(),
  itemIds: z.array(z.string()).optional(),
  // Surface only records expiring within N days (or already overdue).
  expiringInDays: z.coerce.number().int().min(0).max(730).optional(),
};

const fispqTransform = (data: any) => {
  if (data.orderBy) {
    data.orderBy = normalizeOrderBy(data.orderBy);
  }

  if (data.take && !data.limit) {
    data.limit = data.take;
  }
  delete data.take;

  const andConditions: any[] = [];

  if (data.searchingFor && typeof data.searchingFor === "string" && data.searchingFor.trim()) {
    const searchTerm = data.searchingFor.trim();
    andConditions.push({
      OR: [
        { item: { name: { contains: searchTerm, mode: "insensitive" } } },
        { productName: { contains: searchTerm, mode: "insensitive" } },
        { manufacturer: { contains: searchTerm, mode: "insensitive" } },
        { casNumber: { contains: searchTerm, mode: "insensitive" } },
        { onuNumber: { contains: searchTerm, mode: "insensitive" } },
      ],
    });
    delete data.searchingFor;
  }

  if (data.statuses && Array.isArray(data.statuses) && data.statuses.length > 0) {
    andConditions.push({ status: { in: data.statuses } });
    delete data.statuses;
  }

  if (data.signalWords && Array.isArray(data.signalWords) && data.signalWords.length > 0) {
    andConditions.push({ signalWord: { in: data.signalWords } });
    delete data.signalWords;
  }

  if (data.pictograms && Array.isArray(data.pictograms) && data.pictograms.length > 0) {
    andConditions.push({ ghsPictograms: { hasSome: data.pictograms } });
    delete data.pictograms;
  }

  if (data.itemIds && Array.isArray(data.itemIds) && data.itemIds.length > 0) {
    andConditions.push({ itemId: { in: data.itemIds } });
    delete data.itemIds;
  }

  if (typeof data.expiringInDays === "number") {
    const limit = new Date();
    limit.setDate(limit.getDate() + data.expiringInDays);
    andConditions.push({ validUntil: { lte: limit } });
    delete data.expiringInDays;
  }

  return mergeAndConditions(data, andConditions);
};

// =====================
// Query Schemas
// =====================

export const fispqGetManySchema = z
  .object({
    ...paginationSchema.shape,
    where: fispqWhereSchema.optional(),
    orderBy: fispqOrderBySchema.optional(),
    include: fispqIncludeSchema.optional(),
    ...fispqFilters,
  })
  .transform(fispqTransform);

export const fispqGetByIdSchema = z.object({
  include: fispqIncludeSchema.optional(),
  id: z.string().uuid({ message: "FISPQ inválida" }),
});

// =====================
// CRUD Schemas
// =====================

const fispqCoreShape = {
  itemId: z.string().uuid({ message: "Item inválido" }),

  // Section 1
  productName: z.string().max(300).nullable().optional(),
  manufacturer: z.string().max(300).nullable().optional(),
  supplierName: z.string().max(300).nullable().optional(),
  recommendedUse: z.string().max(1000).nullable().optional(),
  emergencyPhone: z.string().max(100).nullable().optional(),

  // Section 2 — GHS hazards
  ghsPictograms: z.array(ghsPictogramSchema).optional().default([]),
  signalWord: ghsSignalWordSchema.nullable().optional(),
  hazardStatements: z.array(z.string().max(500)).optional().default([]),
  precautionStatements: z.array(z.string().max(500)).optional().default([]),

  // Section 3 + 14
  casNumber: z.string().max(100).nullable().optional(),
  onuNumber: z.string().max(50).nullable().optional(),
  unRiskClass: z.string().max(100).nullable().optional(),
  packingGroup: z.string().max(50).nullable().optional(),

  // Section 9
  physicalState: z.string().max(200).nullable().optional(),
  color: z.string().max(200).nullable().optional(),
  odor: z.string().max(200).nullable().optional(),
  flashPoint: z.string().max(200).nullable().optional(),
  phValue: z.string().max(100).nullable().optional(),

  // Sections 4–7
  firstAidMeasures: z.string().max(5000).nullable().optional(),
  fireFightingMeasures: z.string().max(5000).nullable().optional(),
  accidentalRelease: z.string().max(5000).nullable().optional(),
  handlingStorage: z.string().max(5000).nullable().optional(),

  // Section 8 — PPE
  requiredPpeText: z.string().max(2000).nullable().optional(),
  requiredPpeItemIds: z.array(z.string().uuid()).optional(),

  // Document + lifecycle
  pdfFileId: z.string().uuid({ message: "Arquivo inválido" }).nullable().optional(),
  revisionNumber: z.string().max(100).nullable().optional(),
  issueDate: z.coerce.date().nullable().optional(),
  revisionDate: z.coerce.date().nullable().optional(),
  validUntil: z.coerce.date().nullable().optional(),
  status: fispqStatusSchema.optional(),
  notes: z.string().max(2000).nullable().optional(),
  isActive: z.boolean().optional(),
};

export const fispqCreateSchema = z.object(fispqCoreShape);

// Update: same shape but itemId optional (keyed by route id) and all optional.
export const fispqUpdateSchema = z.object({
  ...fispqCoreShape,
  itemId: z.string().uuid({ message: "Item inválido" }).optional(),
});

export const fispqBatchCreateSchema = z.object({
  fispqs: z.array(fispqCreateSchema).min(1, "Pelo menos uma FISPQ deve ser fornecida"),
});

export const fispqBatchUpdateSchema = z.object({
  fispqs: z
    .array(
      z.object({
        id: z.string().uuid({ message: "FISPQ inválida" }),
        data: fispqUpdateSchema,
      }),
    )
    .min(1, "Pelo menos uma FISPQ deve ser fornecida"),
});

export const fispqBatchDeleteSchema = z.object({
  fispqIds: z.array(z.string().uuid({ message: "FISPQ inválida" })).min(1, "Pelo menos um ID deve ser fornecido"),
});

export const fispqQuerySchema = z.object({
  include: fispqIncludeSchema.optional(),
});

export const fispqBatchQuerySchema = z.object({
  include: fispqIncludeSchema.optional(),
});

// Export query (chemical-products inventory PDF/xlsx via API)
export const fispqExportSchema = z.object({
  format: z.enum(["pdf", "xlsx"]).default("pdf"),
});

// =====================
// Inferred Types
// =====================

export type FispqGetManyFormData = z.infer<typeof fispqGetManySchema>;
export type FispqGetByIdFormData = z.infer<typeof fispqGetByIdSchema>;
export type FispqQueryFormData = z.infer<typeof fispqQuerySchema>;
export type FispqBatchQueryFormData = z.infer<typeof fispqBatchQuerySchema>;
export type FispqCreateFormData = z.infer<typeof fispqCreateSchema>;
export type FispqUpdateFormData = z.infer<typeof fispqUpdateSchema>;
export type FispqBatchCreateFormData = z.infer<typeof fispqBatchCreateSchema>;
export type FispqBatchUpdateFormData = z.infer<typeof fispqBatchUpdateSchema>;
export type FispqBatchDeleteFormData = z.infer<typeof fispqBatchDeleteSchema>;
export type FispqExportFormData = z.infer<typeof fispqExportSchema>;
export type FispqInclude = z.infer<typeof fispqIncludeSchema>;
export type FispqOrderBy = z.infer<typeof fispqOrderBySchema>;
export type FispqWhere = z.infer<typeof fispqWhereSchema>;
