// packages/schemas/src/vacation-group.ts
// Férias Coletivas (Departamento Pessoal). Mirrors api vacation-group schema.

import { z } from "zod";
import { VACATION_STATUS, VACATION_GROUP_TYPE } from "../constants";

// =====================
// Generic relation include (Prisma passthrough)
// =====================

const relationIncludeSchema = z.union([
  z.boolean(),
  z.object({
    include: z.any().optional(),
    select: z.any().optional(),
    where: z.any().optional(),
    orderBy: z.any().optional(),
  }),
]);

export const vacationGroupIncludeSchema = z
  .object({
    periods: relationIncludeSchema.optional(),
    vacations: relationIncludeSchema.optional(),
  })
  .partial();

// =====================
// Order By
// =====================

const orderByDirection = z.enum(["asc", "desc"]);

const vacationGroupOrderByFields = z.object({
  id: orderByDirection.optional(),
  name: orderByDirection.optional(),
  type: orderByDirection.optional(),
  status: orderByDirection.optional(),
  statusOrder: orderByDirection.optional(),
  acquisitiveStart: orderByDirection.optional(),
  acquisitiveEnd: orderByDirection.optional(),
  concessiveEnd: orderByDirection.optional(),
  createdAt: orderByDirection.optional(),
  updatedAt: orderByDirection.optional(),
});

export const vacationGroupOrderBySchema = z.union([vacationGroupOrderByFields, z.array(vacationGroupOrderByFields)]).optional();

// =====================
// Where
// =====================

const stringWhere = z.union([
  z.string(),
  z.object({
    equals: z.string().optional(),
    in: z.array(z.string()).optional(),
    notIn: z.array(z.string()).optional(),
    contains: z.string().optional(),
    mode: z.enum(["default", "insensitive"]).optional(),
    not: z.string().optional(),
  }),
]);

const numberWhere = z.union([
  z.number(),
  z.object({
    equals: z.number().optional(),
    in: z.array(z.number()).optional(),
    lt: z.number().optional(),
    lte: z.number().optional(),
    gt: z.number().optional(),
    gte: z.number().optional(),
    not: z.number().optional(),
  }),
]);

const dateWhere = z.union([
  z.coerce.date(),
  z.object({
    equals: z.coerce.date().optional(),
    lt: z.coerce.date().optional(),
    lte: z.coerce.date().optional(),
    gt: z.coerce.date().optional(),
    gte: z.coerce.date().optional(),
  }),
]);

export const vacationGroupWhereSchema: z.ZodSchema = z.lazy(() =>
  z
    .object({
      AND: z.array(vacationGroupWhereSchema).optional(),
      OR: z.array(vacationGroupWhereSchema).optional(),
      NOT: vacationGroupWhereSchema.optional(),

      id: stringWhere.optional(),
      name: stringWhere.optional(),
      type: stringWhere.optional(),
      status: stringWhere.optional(),
      statusOrder: numberWhere.optional(),

      acquisitiveStart: dateWhere.optional(),
      acquisitiveEnd: dateWhere.optional(),
      concessiveEnd: z.union([dateWhere, z.null()]).optional(),
      createdAt: dateWhere.optional(),
      updatedAt: dateWhere.optional(),
    })
    .partial(),
);

// =====================
// Filters + transform
// =====================

const vacationGroupFilters = {
  searchingFor: z.string().optional(),
  statuses: z.array(z.enum(Object.values(VACATION_STATUS) as [string, ...string[]])).optional(),
};

const paginationShape = {
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  take: z.coerce.number().int().positive().max(100).optional(),
};

const vacationGroupTransform = (data: any) => {
  if (data.take && !data.limit) data.limit = data.take;
  delete data.take;

  const and: any[] = Array.isArray(data.AND) ? [...data.AND] : data.AND ? [data.AND] : [];

  if (data.searchingFor) {
    and.push({
      OR: [
        { name: { contains: data.searchingFor.trim(), mode: "insensitive" } },
        { notes: { contains: data.searchingFor.trim(), mode: "insensitive" } },
      ],
    });
    delete data.searchingFor;
  }
  if (Array.isArray(data.statuses) && data.statuses.length > 0) {
    and.push({ status: { in: data.statuses } });
    delete data.statuses;
  }

  if (and.length > 0) {
    const where = data.where ?? {};
    where.AND = [...(where.AND ?? []), ...and];
    data.where = where;
  }
  return data;
};

// =====================
// Query schemas
// =====================

export const vacationGroupGetManySchema = z
  .object({
    ...paginationShape,
    where: vacationGroupWhereSchema.optional(),
    orderBy: vacationGroupOrderBySchema.optional(),
    include: vacationGroupIncludeSchema.optional(),
    ...vacationGroupFilters,
  })
  .transform(vacationGroupTransform);

export const vacationGroupQuerySchema = z.object({
  include: vacationGroupIncludeSchema.optional(),
});

// =====================
// Period child schema (fracionamento)
// =====================

const vacationGroupPeriodInputSchema = z.object({
  startDate: z.coerce.date({ invalid_type_error: "data de início inválida" }),
  days: z.coerce
    .number({ invalid_type_error: "dias inválidos" })
    .int({ message: "Dias deve ser inteiro" })
    .min(1, { message: "O período deve ter ao menos 1 dia" })
    .max(30, { message: "Um período não pode exceder 30 dias" }),
});

// =====================
// CRUD schemas
// =====================

export const vacationGroupCreateSchema = z
  .object({
    name: z.string().min(1, { message: "Nome é obrigatório" }).max(200),
    type: z.enum(Object.values(VACATION_GROUP_TYPE) as [string, ...string[]], { required_error: "Tipo é obrigatório" }),
    acquisitiveStart: z.coerce.date({ required_error: "Início do período aquisitivo é obrigatório" }),
    acquisitiveEnd: z.coerce.date({ required_error: "Fim do período aquisitivo é obrigatório" }),
    sectorIds: z.array(z.string().uuid({ message: "Setor inválido" })).optional(),
    positionIds: z.array(z.string().uuid({ message: "Cargo inválido" })).optional(),
    notes: z.string().max(2000).nullable().optional(),
    periods: z.array(vacationGroupPeriodInputSchema).min(1, { message: "Defina ao menos um período" }).max(3),
  })
  .refine((data) => data.type !== VACATION_GROUP_TYPE.SECTOR || (Array.isArray(data.sectorIds) && data.sectorIds.length > 0), {
    message: "Selecione ao menos um setor",
    path: ["sectorIds"],
  })
  .refine((data) => data.type !== VACATION_GROUP_TYPE.POSITION || (Array.isArray(data.positionIds) && data.positionIds.length > 0), {
    message: "Selecione ao menos um cargo",
    path: ["positionIds"],
  });

export const vacationGroupUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  sectorIds: z.array(z.string().uuid()).optional(),
  positionIds: z.array(z.string().uuid()).optional(),
  notes: z.string().max(2000).nullable().optional(),
  periods: z.array(vacationGroupPeriodInputSchema).min(1).max(3).optional(),
});

// =====================
// Status machine
// =====================

export const vacationGroupAdvanceSchema = z.object({
  status: z.enum(Object.values(VACATION_STATUS) as [string, ...string[]]).optional(),
});

// =====================
// Inferred types
// =====================

export type VacationGroupGetManyFormData = z.infer<typeof vacationGroupGetManySchema>;
export type VacationGroupQueryFormData = z.infer<typeof vacationGroupQuerySchema>;
export type VacationGroupCreateFormData = z.infer<typeof vacationGroupCreateSchema>;
export type VacationGroupUpdateFormData = z.infer<typeof vacationGroupUpdateSchema>;
export type VacationGroupAdvanceFormData = z.infer<typeof vacationGroupAdvanceSchema>;
export type VacationGroupPeriodInput = z.infer<typeof vacationGroupPeriodInputSchema>;
export type VacationGroupInclude = z.infer<typeof vacationGroupIncludeSchema>;
