// packages/schemas/src/implement.ts

import { z } from "zod";
import { createMapToFormDataHelper, orderByDirectionSchema, normalizeOrderBy } from "./common";
import type { Implement } from "../types";
import { IMPLEMENT_CATEGORY, IMPLEMENT_TYPE, IMPLEMENT_SPOT } from "../constants";
import {
  cleanPlate,
  cleanChassis,
  PLATE_REGEX,
  CHASSIS_LENGTH_REGEX,
  CHASSIS_FORBIDDEN_LETTERS,
  PLATE_INVALID_MESSAGE,
  CHASSIS_INVALID_MESSAGE,
  CHASSIS_FORBIDDEN_LETTERS_MESSAGE,
} from "../utils";

// =====================================================================
// Placa e chassi — regra canônica (ver utils/implement.ts e utils/cleaners.ts)
// =====================================================================
// Ordem obrigatória, sempre nesta sequência:
//   1. normaliza com cleanPlate/cleanChassis (maiúsculas, só [A-Z0-9]) — ANTES
//      de qualquer refine, senão "ABC-1D23" reprova por causa do hífen;
//   2. string vazia vira null;
//   3. só então valida contra PLATE_REGEX/CHASSIS_REGEX.
// `undefined` é preservado de propósito: em um update, campo ausente significa
// "não mexe" e campo `null` significa "limpa" — colapsar os dois apagaria dado.

export const optionalPlateSchema = z
  .string()
  .nullable()
  .optional()
  .transform((val) => {
    if (val === undefined) return undefined;
    if (val === null) return null;
    const cleaned = cleanPlate(val);
    return cleaned === "" ? null : cleaned;
  })
  .refine((val) => val === null || val === undefined || PLATE_REGEX.test(val), {
    message: PLATE_INVALID_MESSAGE,
  });

export const optionalChassisSchema = z
  .string()
  .nullable()
  .optional()
  .transform((val) => {
    if (val === undefined) return undefined;
    if (val === null) return null;
    const cleaned = cleanChassis(val);
    return cleaned === "" ? null : cleaned;
  })
  // Duas mensagens distintas de propósito: "17 caracteres" não ajuda em nada
  // quem digitou um O no lugar do 0 num chassi que já tem 17.
  .superRefine((val, ctx) => {
    if (val === null || val === undefined) return;
    if (!CHASSIS_LENGTH_REGEX.test(val)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: CHASSIS_INVALID_MESSAGE });
      return;
    }
    if (CHASSIS_FORBIDDEN_LETTERS.test(val)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: CHASSIS_FORBIDDEN_LETTERS_MESSAGE });
    }
  });

/**
 * Normaliza o termo de um filtro de placa. O banco guarda "ABC1234" (sem
 * separador), então filtrar por "ABC-1234" cru não acha nada.
 */
type PlateFilterObject = {
  equals?: string | null;
  not?: string | null;
  in?: string[];
  notIn?: string[];
  contains?: string;
  startsWith?: string;
  endsWith?: string;
  mode?: "default" | "insensitive";
};

type PlateFilterValue = string | null | PlateFilterObject | undefined;

const normalizePlateTerm = (value: string): string => {
  const cleaned = cleanPlate(value);
  // Termo sem nenhum caractere aproveitável (ex: "-") volta cru: filtrar por ""
  // casaria com o banco inteiro.
  return cleaned === "" ? value : cleaned;
};

const normalizePlateFilter = (value: PlateFilterValue): PlateFilterValue => {
  if (typeof value === "string") return normalizePlateTerm(value);
  if (!value || typeof value !== "object") return value;

  const next: PlateFilterObject = { ...value };
  if (typeof next.equals === "string") next.equals = normalizePlateTerm(next.equals);
  if (typeof next.not === "string") next.not = normalizePlateTerm(next.not);
  if (typeof next.contains === "string") next.contains = normalizePlateTerm(next.contains);
  if (typeof next.startsWith === "string") next.startsWith = normalizePlateTerm(next.startsWith);
  if (typeof next.endsWith === "string") next.endsWith = normalizePlateTerm(next.endsWith);
  if (Array.isArray(next.in)) next.in = next.in.map(normalizePlateTerm);
  if (Array.isArray(next.notIn)) next.notIn = next.notIn.map(normalizePlateTerm);
  return next;
};

// =====================
// Include Schema Based on Prisma Schema (Second Level Only)
// =====================

export const implementIncludeSchema = z
  .object({
    // Direct Implement relations
    task: z
      .union([
        z.boolean(),
        z.object({
          include: z
            .object({
              sector: z.boolean().optional(),
              customer: z.boolean().optional(),
              budget: z.boolean().optional(),
              nfe: z.boolean().optional(),
              receipt: z.boolean().optional(),
              observation: z.boolean().optional(),
              generalPainting: z.boolean().optional(),
              createdBy: z.boolean().optional(),
              files: z.boolean().optional(),
              logoPaints: z.boolean().optional(),
              bonifications: z.boolean().optional(),
              services: z.boolean().optional(),
              implement: z.boolean().optional(),
              airbrushings: z.boolean().optional(),
            })
            .optional(),
        }),
      ])
      .optional(),
    leftSideMeasure: z
      .union([
        z.boolean(),
        z.object({
          include: z
            .object({
              photo: z.boolean().optional(),
            })
            .optional(),
        }),
      ])
      .optional(),
    rightSideMeasure: z
      .union([
        z.boolean(),
        z.object({
          include: z
            .object({
              photo: z.boolean().optional(),
            })
            .optional(),
        }),
      ])
      .optional(),
    backSideMeasure: z
      .union([
        z.boolean(),
        z.object({
          include: z
            .object({
              photo: z.boolean().optional(),
            })
            .optional(),
        }),
      ])
      .optional(),
    _count: z.union([z.boolean(), z.object({ select: z.record(z.boolean()).optional() })]).optional(),
  })
  .partial();

// =====================
// OrderBy Schema Based on Prisma Schema Fields
// =====================

export const implementOrderBySchema = z.union([
  // Single ordering object
  z
    .object({
      // Implement direct fields
      id: orderByDirectionSchema.optional(),
      plate: orderByDirectionSchema.optional(),
      chassisNumber: orderByDirectionSchema.optional(),
      vinPlateId: orderByDirectionSchema.optional(),
      category: orderByDirectionSchema.optional(),
      type: orderByDirectionSchema.optional(),
      spot: orderByDirectionSchema.optional(),
      taskId: orderByDirectionSchema.optional(),
      createdAt: orderByDirectionSchema.optional(),
      updatedAt: orderByDirectionSchema.optional(),

      // Nested relation ordering - Task
      task: z
        .object({
          id: orderByDirectionSchema.optional(),
          name: orderByDirectionSchema.optional(),
          status: orderByDirectionSchema.optional(),
          serialNumber: orderByDirectionSchema.optional(),
          entryDate: orderByDirectionSchema.optional(),
          term: orderByDirectionSchema.optional(),
          startedAt: orderByDirectionSchema.optional(),
          finishedAt: orderByDirectionSchema.optional(),
          bonification: orderByDirectionSchema.optional(),
          createdAt: orderByDirectionSchema.optional(),
          updatedAt: orderByDirectionSchema.optional(),
        })
        .optional(),
    })
    .partial(),

  // Array of ordering objects
  z.array(
    z
      .object({
        id: orderByDirectionSchema.optional(),
        plate: orderByDirectionSchema.optional(),
        chassisNumber: orderByDirectionSchema.optional(),
        vinPlateId: orderByDirectionSchema.optional(),
        category: orderByDirectionSchema.optional(),
        type: orderByDirectionSchema.optional(),
        spot: orderByDirectionSchema.optional(),
        taskId: orderByDirectionSchema.optional(),
        createdAt: orderByDirectionSchema.optional(),
        updatedAt: orderByDirectionSchema.optional(),
      })
      .partial(),
  ),
]);

// =====================
// Where Schema Based on Prisma Schema
// =====================

export const implementWhereSchema: z.ZodSchema = z.lazy(() =>
  z
    .object({
      // Boolean operators
      AND: z.union([implementWhereSchema, z.array(implementWhereSchema)]).optional(),
      OR: z.array(implementWhereSchema).optional(),
      NOT: z.union([implementWhereSchema, z.array(implementWhereSchema)]).optional(),

      // UUID fields
      id: z
        .union([
          z.string(),
          z.object({
            equals: z.string().optional(),
            not: z.string().optional(),
            in: z.array(z.string()).optional(),
            notIn: z.array(z.string()).optional(),
          }),
        ])
        .optional(),

      taskId: z
        .union([
          z.string(),
          z.object({
            equals: z.string().optional(),
            not: z.string().optional(),
            in: z.array(z.string()).optional(),
            notIn: z.array(z.string()).optional(),
          }),
        ])
        .optional(),

      // String fields
      plate: z
        .union([
          z.string(),
          z.null(),
          z.object({
            equals: z.union([z.string(), z.null()]).optional(),
            not: z.union([z.string(), z.null()]).optional(),
            in: z.array(z.string()).optional(),
            notIn: z.array(z.string()).optional(),
            contains: z.string().optional(),
            startsWith: z.string().optional(),
            endsWith: z.string().optional(),
            mode: z.enum(["default", "insensitive"]).optional(),
          }),
        ])
        .optional()
        // A coluna guarda a placa limpa; normaliza o termo antes de ir ao banco.
        .transform(normalizePlateFilter),

      chassisNumber: z
        .union([
          z.string(),
          z.null(),
          z.object({
            equals: z.union([z.string(), z.null()]).optional(),
            not: z.union([z.string(), z.null()]).optional(),
            in: z.array(z.string()).optional(),
            notIn: z.array(z.string()).optional(),
            contains: z.string().optional(),
            startsWith: z.string().optional(),
            endsWith: z.string().optional(),
            mode: z.enum(["default", "insensitive"]).optional(),
          }),
        ])
        .optional(),

      vinPlateId: z
        .union([
          z.string(),
          z.null(),
          z.object({
            equals: z.union([z.string(), z.null()]).optional(),
            not: z.union([z.string(), z.null()]).optional(),
            in: z.array(z.string()).optional(),
            notIn: z.array(z.string()).optional(),
            contains: z.string().optional(),
            startsWith: z.string().optional(),
            endsWith: z.string().optional(),
            mode: z.enum(["default", "insensitive"]).optional(),
          }),
        ])
        .optional(),

      // Spot enum field
      spot: z
        .union([
          z.nativeEnum(IMPLEMENT_SPOT),
          z.null(),
          z.object({
            equals: z.union([z.nativeEnum(IMPLEMENT_SPOT), z.null()]).optional(),
            not: z.union([z.nativeEnum(IMPLEMENT_SPOT), z.null()]).optional(),
            in: z.array(z.nativeEnum(IMPLEMENT_SPOT)).optional(),
            notIn: z.array(z.nativeEnum(IMPLEMENT_SPOT)).optional(),
          }),
        ])
        .optional(),

      // Implement specification enum fields
      category: z
        .union([
          z.nativeEnum(IMPLEMENT_CATEGORY),
          z.null(),
          z.object({
            equals: z.union([z.nativeEnum(IMPLEMENT_CATEGORY), z.null()]).optional(),
            not: z.union([z.nativeEnum(IMPLEMENT_CATEGORY), z.null()]).optional(),
            in: z.array(z.nativeEnum(IMPLEMENT_CATEGORY)).optional(),
            notIn: z.array(z.nativeEnum(IMPLEMENT_CATEGORY)).optional(),
          }),
        ])
        .optional(),

      type: z
        .union([
          z.nativeEnum(IMPLEMENT_TYPE),
          z.null(),
          z.object({
            equals: z.union([z.nativeEnum(IMPLEMENT_TYPE), z.null()]).optional(),
            not: z.union([z.nativeEnum(IMPLEMENT_TYPE), z.null()]).optional(),
            in: z.array(z.nativeEnum(IMPLEMENT_TYPE)).optional(),
            notIn: z.array(z.nativeEnum(IMPLEMENT_TYPE)).optional(),
          }),
        ])
        .optional(),

      // Date timestamp fields
      createdAt: z
        .union([
          z.date(),
          z.object({
            equals: z.date().optional(),
            not: z.date().optional(),
            in: z.array(z.date()).optional(),
            notIn: z.array(z.date()).optional(),
            lt: z.coerce.date().optional(),
            lte: z.coerce.date().optional(),
            gt: z.coerce.date().optional(),
            gte: z.coerce.date().optional(),
          }),
        ])
        .optional(),

      updatedAt: z
        .union([
          z.date(),
          z.object({
            equals: z.date().optional(),
            not: z.date().optional(),
            in: z.array(z.date()).optional(),
            notIn: z.array(z.date()).optional(),
            lt: z.coerce.date().optional(),
            lte: z.coerce.date().optional(),
            gt: z.coerce.date().optional(),
            gte: z.coerce.date().optional(),
          }),
        ])
        .optional(),

      // Relations
      task: z
        .object({
          is: z.any().optional(),
          isNot: z.any().optional(),
        })
        .optional(),
    })
    .partial(),
);

// =====================
// Convenience Filters
// =====================

const implementFilters = {
  // Search and filtering
  searchingFor: z.string().optional(),
  taskIds: z.array(z.string()).optional(),
  plates: z
    .array(z.string())
    .optional()
    // Idem: "ABC-1234" digitado precisa virar "ABC1234" para casar com a coluna.
    .transform((val) => (val ? val.map((plate) => cleanPlate(plate)).filter((plate) => plate !== "") : val)),
  spots: z.array(z.nativeEnum(IMPLEMENT_SPOT)).optional(),
  categories: z.array(z.nativeEnum(IMPLEMENT_CATEGORY)).optional(),
  implementTypes: z.array(z.nativeEnum(IMPLEMENT_TYPE)).optional(),
  hasSpot: z.boolean().optional(),
};

// =====================
// Transform Function
// =====================

const implementTransform = (data: any) => {
  // Normalize orderBy to Prisma format
  if (data.orderBy) {
    data.orderBy = normalizeOrderBy(data.orderBy);
  }

  // Handle take/limit alias
  if (data.take && !data.limit) {
    data.limit = data.take;
  }
  delete data.take;

  const andConditions: any[] = [];

  // Handle searchingFor
  if (data.searchingFor && typeof data.searchingFor === "string" && data.searchingFor.trim()) {
    // A coluna `plate` guarda a placa limpa ("ABC1234"), então buscar por
    // "ABC-1234" cru não acha nada — vai a versão normalizada junto.
    const searchPlate = cleanPlate(data.searchingFor.trim());
    andConditions.push({
      OR: [
        { plate: { contains: data.searchingFor.trim(), mode: "insensitive" } },
        ...(searchPlate && searchPlate !== data.searchingFor.trim().toUpperCase() ? [{ plate: { contains: searchPlate, mode: "insensitive" } }] : []),
        { task: { name: { contains: data.searchingFor.trim(), mode: "insensitive" } } },
        { task: { serialNumber: { contains: data.searchingFor.trim(), mode: "insensitive" } } },
        { task: { customer: { fantasyName: { contains: data.searchingFor.trim(), mode: "insensitive" } } } },
        { task: { customer: { corporateName: { contains: data.searchingFor.trim(), mode: "insensitive" } } } },
      ],
    });
    delete data.searchingFor;
  }

  // Handle taskIds filter
  if (data.taskIds && Array.isArray(data.taskIds) && data.taskIds.length > 0) {
    andConditions.push({ taskId: { in: data.taskIds } });
    delete data.taskIds;
  }

  // Handle plates filter
  if (data.plates && Array.isArray(data.plates) && data.plates.length > 0) {
    andConditions.push({ plate: { in: data.plates } });
    delete data.plates;
  }

  // Handle spots filter
  if (data.spots && Array.isArray(data.spots) && data.spots.length > 0) {
    andConditions.push({ spot: { in: data.spots } });
    delete data.spots;
  }

  // Handle categories filter
  if (data.categories && Array.isArray(data.categories) && data.categories.length > 0) {
    andConditions.push({ category: { in: data.categories } });
    delete data.categories;
  }

  // Handle implementTypes filter
  if (data.implementTypes && Array.isArray(data.implementTypes) && data.implementTypes.length > 0) {
    andConditions.push({ implementType: { in: data.implementTypes } });
    delete data.implementTypes;
  }

  // Handle hasSpot filter
  if (typeof data.hasSpot === "boolean") {
    if (data.hasSpot) {
      andConditions.push({ spot: { not: null } });
    } else {
      andConditions.push({ spot: null });
    }
    delete data.hasSpot;
  }

  // Handle date filters
  if (data.createdAt) {
    andConditions.push({ createdAt: data.createdAt });
    delete data.createdAt;
  }

  if (data.updatedAt) {
    andConditions.push({ updatedAt: data.updatedAt });
    delete data.updatedAt;
  }

  // Merge with existing where conditions
  if (andConditions.length > 0) {
    if (data.where) {
      if (data.where.AND && Array.isArray(data.where.AND)) {
        data.where.AND = [...data.where.AND, ...andConditions];
      } else {
        data.where = { AND: [data.where, ...andConditions] };
      }
    } else {
      data.where = andConditions.length === 1 ? andConditions[0] : { AND: andConditions };
    }
  }

  return data;
};

// =====================
// Query Schema
// =====================

export const implementGetManySchema = z
  .object({
    // Pagination
    page: z.coerce.number().int().min(0).default(1).optional(),
    limit: z.coerce.number().int().positive().max(100).default(20).optional(),
    take: z.coerce.number().int().positive().max(100).optional(),
    skip: z.coerce.number().int().min(0).optional(),

    // Direct Prisma clauses with proper validation
    where: implementWhereSchema.optional(),
    orderBy: implementOrderBySchema.optional(),
    include: implementIncludeSchema.optional(),

    // Date filters (handled by where schema)
    createdAt: z
      .object({
        gte: z.coerce.date().optional(),
        lte: z.coerce.date().optional(),
      })
      .optional(),
    updatedAt: z
      .object({
        gte: z.coerce.date().optional(),
        lte: z.coerce.date().optional(),
      })
      .optional(),

    // Convenience filters (will be transformed to where)
    ...implementFilters,
  })
  .transform(implementTransform);

// =====================
// CRUD Schemas
// =====================

export const implementCreateSchema = z.object({
  // Optional identification fields
  plate: optionalPlateSchema,
  chassisNumber: optionalChassisSchema,
  vinPlateId: z.string().uuid("Foto da plaqueta inválida").nullable().optional(),

  // Implement specifications
  category: z.nativeEnum(IMPLEMENT_CATEGORY).nullable().optional(),
  type: z.nativeEnum(IMPLEMENT_TYPE).nullable().optional(),

  // Spot/position field
  spot: z.nativeEnum(IMPLEMENT_SPOT).nullable().optional(),

  // Required relation
  taskId: z.string().uuid("Tarefa inválida"),

  // Optional relations
  leftSideMeasureId: z.string().uuid("Medida inválida").nullable().optional(),
  rightSideMeasureId: z.string().uuid("Medida inválida").nullable().optional(),
  backSideMeasureId: z.string().uuid("Medida inválida").nullable().optional(),
});

export const implementUpdateSchema = z.object({
  // Optional identification fields
  plate: optionalPlateSchema,
  chassisNumber: optionalChassisSchema,
  vinPlateId: z.string().uuid("Foto da plaqueta inválida").nullable().optional(),

  // Implement specifications
  category: z.nativeEnum(IMPLEMENT_CATEGORY).nullable().optional(),
  type: z.nativeEnum(IMPLEMENT_TYPE).nullable().optional(),

  // Spot/position field
  spot: z.nativeEnum(IMPLEMENT_SPOT).nullable().optional(),

  // Optional relations
  taskId: z.string().uuid("Tarefa inválida").optional(),
  leftSideMeasureId: z.string().uuid("Medida inválida").nullable().optional(),
  rightSideMeasureId: z.string().uuid("Medida inválida").nullable().optional(),
  backSideMeasureId: z.string().uuid("Medida inválida").nullable().optional(),
});

// Query schema for include parameter
export const implementQuerySchema = z.object({
  include: implementIncludeSchema.optional(),
});

// =====================
// Additional Query Schemas
// =====================

export const implementGetByIdSchema = z.object({
  include: implementIncludeSchema.optional(),
  id: z.string().uuid("Implemento inválido"),
});

// =====================
// Type Inference
// =====================

export type ImplementGetManyFormData = z.infer<typeof implementGetManySchema>;
export type ImplementGetByIdFormData = z.infer<typeof implementGetByIdSchema>;
export type ImplementCreateFormData = z.infer<typeof implementCreateSchema>;
export type ImplementUpdateFormData = z.infer<typeof implementUpdateSchema>;

export type ImplementInclude = z.infer<typeof implementIncludeSchema>;
export type ImplementOrderBy = z.infer<typeof implementOrderBySchema>;
export type ImplementWhere = z.infer<typeof implementWhereSchema>;

export type ImplementQueryFormData = z.infer<typeof implementQuerySchema>;

// =====================
// Helper Functions
// =====================

export const mapImplementToFormData = createMapToFormDataHelper<Implement, ImplementUpdateFormData>((implement) => ({
  plate: implement.plate || undefined,
  chassisNumber: implement.chassisNumber || undefined,
  vinPlateId: implement.vinPlateId || undefined,
  category: implement.category || undefined,
  type: implement.type || undefined,
  spot: implement.spot || undefined,
  taskId: implement.taskId,
  leftSideMeasureId: implement.leftSideMeasureId || undefined,
  rightSideMeasureId: implement.rightSideMeasureId || undefined,
  backSideMeasureId: implement.backSideMeasureId || undefined,
}));
