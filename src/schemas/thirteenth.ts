// packages/schemas/src/thirteenth.ts
// 13º salário (gratificação natalina) — Part D. Mirrors api thirteenth dto.

import { z } from "zod";
import { THIRTEENTH_STATUS } from "../constants";

// ============================================================================
// Status (mirrors prisma enum ThirteenthStatus / THIRTEENTH_STATUS)
// ============================================================================

export const thirteenthStatusSchema = z.nativeEnum(THIRTEENTH_STATUS);

// ============================================================================
// Query (include / orderBy / where) — kept permissive (passthrough to prisma)
// ============================================================================

const orderByDirection = z.enum(["asc", "desc"]);

export const thirteenthIncludeSchema = z
  .object({
    user: z.union([z.boolean(), z.any()]).optional(),
    contract: z.union([z.boolean(), z.any()]).optional(),
  })
  .partial()
  .passthrough();

export const thirteenthWhereSchema = z
  .object({
    id: z.union([z.string(), z.any()]).optional(),
    userId: z.union([z.string(), z.any()]).optional(),
    contractId: z.union([z.string(), z.any()]).optional(),
    year: z.union([z.number().int(), z.any()]).optional(),
    status: z.union([thirteenthStatusSchema, z.any()]).optional(),
  })
  .partial()
  .passthrough();

export const thirteenthOrderBySchema = z
  .union([
    z
      .object({
        year: orderByDirection.optional(),
        avos: orderByDirection.optional(),
        statusOrder: orderByDirection.optional(),
        createdAt: orderByDirection.optional(),
        updatedAt: orderByDirection.optional(),
      })
      .partial()
      .passthrough(),
    z.array(z.any()),
  ])
  .optional();

export const thirteenthQuerySchema = z.object({
  include: thirteenthIncludeSchema.optional(),
});

export const thirteenthGetManySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  include: thirteenthIncludeSchema.optional(),
  where: thirteenthWhereSchema.optional(),
  orderBy: thirteenthOrderBySchema,
  // Convenience filters (folded into `where` by the service if `where` absent)
  year: z.coerce.number().int().optional(),
  userId: z.string().uuid().optional(),
  status: thirteenthStatusSchema.optional(),
});

// ============================================================================
// Create / Update
// ============================================================================

export const thirteenthCreateSchema = z.object({
  userId: z.string().uuid({ message: "Colaborador inválido." }),
  contractId: z.string().uuid().nullish(),
  year: z.coerce.number().int().min(2000).max(2100),
  // When omitted, the service auto-computes avos + baseRemuneration + parcelas.
  avos: z.coerce.number().int().min(0).max(12).optional(),
  baseRemuneration: z.coerce.number().nonnegative().nullish(),
  notes: z.string().max(1000).nullish(),
});

export const thirteenthUpdateSchema = z
  .object({
    avos: z.coerce.number().int().min(0).max(12).optional(),
    baseRemuneration: z.coerce.number().nonnegative().nullish(),
    notes: z.string().max(1000).nullish(),
    status: thirteenthStatusSchema.optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, {
    message: "Informe ao menos um campo para atualizar.",
  });

// Marcar 1ª/2ª parcela como paga.
export const thirteenthPayInstallmentSchema = z.object({
  paidAt: z.coerce.date().optional(),
});

// Geração em lote do ano para todos os CLT ativos elegíveis.
export const thirteenthGenerateSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  // Data de referência para o corte dos avos (default: 31/Dez do ano).
  referenceDate: z.coerce.date().optional(),
  // Se true, recalcula registros já existentes (mantém status/datas de pagamento).
  recompute: z.coerce.boolean().optional(),
});

// ============================================================================
// Inferred form-data types
// ============================================================================

export type ThirteenthQueryFormData = z.infer<typeof thirteenthQuerySchema>;
export type ThirteenthGetManyFormData = z.infer<typeof thirteenthGetManySchema>;
export type ThirteenthCreateFormData = z.infer<typeof thirteenthCreateSchema>;
export type ThirteenthUpdateFormData = z.infer<typeof thirteenthUpdateSchema>;
export type ThirteenthPayInstallmentFormData = z.infer<typeof thirteenthPayInstallmentSchema>;
export type ThirteenthGenerateFormData = z.infer<typeof thirteenthGenerateSchema>;
export type ThirteenthInclude = z.infer<typeof thirteenthIncludeSchema>;
