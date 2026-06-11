// packages/schemas/src/externalOperation.ts

import { z } from "zod";
import { createMapToFormDataHelper, orderByDirectionSchema, normalizeOrderBy, createNameSchema } from "./common";
import type { ExternalOperation, ExternalOperationItem } from "../types";
import { EXTERNAL_OPERATION_STATUS, EXTERNAL_OPERATION_TYPE } from "../constants";

// =====================
// EXTERNAL WITHDRAWAL SCHEMAS
// =====================

// Service item schema (CHARGEABLE billing services)
export const externalOperationServiceItemSchema = z.object({
  id: z.string().uuid("Serviço inválido").optional(),
  description: z.string().min(1, "Descrição é obrigatória").max(500, "Descrição deve ter no máximo 500 caracteres"),
  amount: z.number().positive("Valor deve ser maior que zero").max(999999.99, "Valor máximo é R$ 999.999,99"),
  position: z.number().int().min(0).optional(),
});

// Payment config schema (same shape as TaskQuoteCustomerConfig.paymentConfig)
export const externalOperationPaymentConfigSchema = z.object({
  type: z.enum(["CASH", "INSTALLMENTS"]),
  cashDays: z.number().int().optional(),
  installmentCount: z.number().int().optional(),
  installmentStep: z.number().int().optional(),
  entryDays: z.number().int().optional(),
  specificDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

// Include Schema
export const externalOperationIncludeSchema = z
  .object({
    customer: z
      .union([
        z.boolean(),
        z.object({
          include: z.object({}).passthrough().optional(),
        }),
      ])
      .optional(),
    services: z
      .union([
        z.boolean(),
        z.object({
          include: z.object({}).passthrough().optional(),
          orderBy: z.object({}).passthrough().optional(),
        }),
      ])
      .optional(),
    billingInvoice: z
      .union([
        z.boolean(),
        z.object({
          include: z
            .object({
              installments: z
                .union([
                  z.boolean(),
                  z.object({
                    include: z
                      .object({
                        bankSlip: z
                          .union([z.boolean(), z.object({ include: z.object({}).passthrough().optional() })])
                          .optional(),
                      })
                      .optional(),
                    orderBy: z.object({}).passthrough().optional(),
                  }),
                ])
                .optional(),
              nfseDocuments: z.boolean().optional(),
              customer: z.boolean().optional(),
            })
            .optional(),
        }),
      ])
      .optional(),
    installments: z
      .union([
        z.boolean(),
        z.object({
          include: z
            .object({
              bankSlip: z.boolean().optional(),
            })
            .optional(),
        }),
      ])
      .optional(),
    invoices: z
      .union([
        z.boolean(),
        z.object({
          include: z.object({}).passthrough().optional(),
          orderBy: z.object({}).passthrough().optional(),
        }),
      ])
      .optional(),
    receipts: z
      .union([
        z.boolean(),
        z.object({
          include: z.object({}).passthrough().optional(),
          orderBy: z.object({}).passthrough().optional(),
        }),
      ])
      .optional(),
    budgets: z
      .union([
        z.boolean(),
        z.object({
          include: z.object({}).passthrough().optional(),
          orderBy: z.object({}).passthrough().optional(),
        }),
      ])
      .optional(),
    items: z
      .union([
        z.boolean(),
        z.object({
          include: z
            .object({
              item: z
                .union([
                  z.boolean(),
                  z.object({
                    include: z
                      .object({
                        brands: z.boolean().optional(),
                        category: z.boolean().optional(),
                        supplier: z.boolean().optional(),
                        prices: z
                          .union([
                            z.boolean(),
                            z.object({
                              include: z.object({}).optional(),
                              where: z.object({}).optional(),
                              orderBy: z
                                .union([
                                  z.object({
                                    id: orderByDirectionSchema.optional(),
                                    value: orderByDirectionSchema.optional(),
                                    createdAt: orderByDirectionSchema.optional(),
                                    updatedAt: orderByDirectionSchema.optional(),
                                  }),
                                  z.array(
                                    z.object({
                                      id: orderByDirectionSchema.optional(),
                                      value: orderByDirectionSchema.optional(),
                                      createdAt: orderByDirectionSchema.optional(),
                                      updatedAt: orderByDirectionSchema.optional(),
                                    }),
                                  ),
                                ])
                                .optional(),
                              take: z.coerce.number().optional(),
                              skip: z.coerce.number().optional(),
                            }),
                          ])
                          .optional(),
                      })
                      .optional(),
                  }),
                ])
                .optional(),
              externalOperation: z.boolean().optional(),
            })
            .optional(),
        }),
      ])
      .optional(),
  })
  .partial();

// OrderBy Schema
export const externalOperationOrderBySchema = z
  .union([
    z
      .object({
        id: orderByDirectionSchema.optional(),
        withdrawerName: orderByDirectionSchema.optional(),
        type: orderByDirectionSchema.optional(),
        status: orderByDirectionSchema.optional(),
        statusOrder: orderByDirectionSchema.optional(),
        notes: orderByDirectionSchema.optional(),
        customerId: orderByDirectionSchema.optional(),
        billedAt: orderByDirectionSchema.optional(),
        createdAt: orderByDirectionSchema.optional(),
        updatedAt: orderByDirectionSchema.optional(),
      })
      .partial(),
    z.array(
      z
        .object({
          id: orderByDirectionSchema.optional(),
          withdrawerName: orderByDirectionSchema.optional(),
          type: orderByDirectionSchema.optional(),
          status: orderByDirectionSchema.optional(),
          statusOrder: orderByDirectionSchema.optional(),
          createdAt: orderByDirectionSchema.optional(),
        })
        .partial(),
    ),
  ])
  .optional();

// Where Schema
export const externalOperationWhereSchema: z.ZodType<any> = z
  .object({
    AND: z.array(z.lazy(() => externalOperationWhereSchema)).optional(),
    OR: z.array(z.lazy(() => externalOperationWhereSchema)).optional(),
    NOT: z.lazy(() => externalOperationWhereSchema).optional(),

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

    withdrawerName: z
      .union([
        z.string(),
        z.object({
          equals: z.string().optional(),
          not: z.string().optional(),
          in: z.array(z.string()).optional(),
          notIn: z.array(z.string()).optional(),
          contains: z.string().optional(),
          startsWith: z.string().optional(),
          endsWith: z.string().optional(),
          mode: z.enum(["default", "insensitive"]).optional(),
        }),
      ])
      .optional(),

    status: z
      .union([
        z.nativeEnum(EXTERNAL_OPERATION_STATUS),
        z.object({
          equals: z.nativeEnum(EXTERNAL_OPERATION_STATUS).optional(),
          not: z.nativeEnum(EXTERNAL_OPERATION_STATUS).optional(),
          in: z.array(z.nativeEnum(EXTERNAL_OPERATION_STATUS)).optional(),
          notIn: z.array(z.nativeEnum(EXTERNAL_OPERATION_STATUS)).optional(),
        }),
      ])
      .optional(),

    statusOrder: z
      .union([
        z.number(),
        z.object({
          equals: z.number().optional(),
          not: z.number().optional(),
          lt: z.number().optional(),
          lte: z.number().optional(),
          gt: z.number().optional(),
          gte: z.number().optional(),
        }),
      ])
      .optional(),

    type: z
      .union([
        z.nativeEnum(EXTERNAL_OPERATION_TYPE),
        z.object({
          equals: z.nativeEnum(EXTERNAL_OPERATION_TYPE).optional(),
          not: z.nativeEnum(EXTERNAL_OPERATION_TYPE).optional(),
          in: z.array(z.nativeEnum(EXTERNAL_OPERATION_TYPE)).optional(),
          notIn: z.array(z.nativeEnum(EXTERNAL_OPERATION_TYPE)).optional(),
        }),
      ])
      .optional(),

    customerId: z
      .union([
        z.string().nullable(),
        z.object({
          equals: z.string().nullable().optional(),
          not: z.string().nullable().optional(),
          in: z.array(z.string()).optional(),
          notIn: z.array(z.string()).optional(),
        }),
      ])
      .optional(),

    notes: z
      .union([
        z.string().nullable(),
        z.object({
          equals: z.string().nullable().optional(),
          not: z.string().nullable().optional(),
          in: z.array(z.string()).optional(),
          notIn: z.array(z.string()).optional(),
          contains: z.string().optional(),
          startsWith: z.string().optional(),
          endsWith: z.string().optional(),
          mode: z.enum(["default", "insensitive"]).optional(),
        }),
      ])
      .optional(),

    createdAt: z
      .union([
        z.date(),
        z.object({
          equals: z.date().optional(),
          not: z.date().optional(),
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
          lt: z.coerce.date().optional(),
          lte: z.coerce.date().optional(),
          gt: z.coerce.date().optional(),
          gte: z.coerce.date().optional(),
        }),
      ])
      .optional(),
  })
  .partial();

// Convenience filters
const externalOperationFilters = {
  withdrawerNames: z.array(z.string()).optional(),
  statuses: z.array(z.nativeEnum(EXTERNAL_OPERATION_STATUS)).optional(),
  types: z.array(z.nativeEnum(EXTERNAL_OPERATION_TYPE)).optional(),
  hasInvoice: z.boolean().optional(),
  hasReceipt: z.boolean().optional(),
  hasItems: z.boolean().optional(),
  searchingFor: z.string().optional(),
};

// Transform function
const externalOperationTransform = (data: any) => {
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

  if (data.withdrawerNames?.length) {
    andConditions.push({ withdrawerName: { in: data.withdrawerNames } });
    delete data.withdrawerNames;
  }

  if (data.statuses?.length) {
    andConditions.push({ status: { in: data.statuses } });
    delete data.statuses;
  }

  if (data.types?.length) {
    andConditions.push({ type: { in: data.types } });
    delete data.types;
  }

  if (data.hasInvoice !== undefined) {
    andConditions.push({ invoices: data.hasInvoice ? { some: {} } : { none: {} } });
    delete data.hasInvoice;
  }

  if (data.hasReceipt !== undefined) {
    andConditions.push({ receipts: data.hasReceipt ? { some: {} } : { none: {} } });
    delete data.hasReceipt;
  }

  if (data.hasItems !== undefined) {
    andConditions.push({
      items: data.hasItems ? { some: {} } : { none: {} },
    });
    delete data.hasItems;
  }

  if (data.searchingFor) {
    andConditions.push({
      OR: [{ withdrawerName: { contains: data.searchingFor, mode: "insensitive" } }, { notes: { contains: data.searchingFor, mode: "insensitive" } }],
    });
    delete data.searchingFor;
  }

  if (data.createdAt) {
    andConditions.push({ createdAt: data.createdAt });
    delete data.createdAt;
  }

  if (data.updatedAt) {
    andConditions.push({ updatedAt: data.updatedAt });
    delete data.updatedAt;
  }

  if (andConditions.length > 0) {
    if (data.where) {
      data.where = { ...data.where, AND: [...(data.where.AND || []), ...andConditions] };
    } else {
      data.where = andConditions.length === 1 ? andConditions[0] : { AND: andConditions };
    }
  }

  return data;
};

// Query Schema
export const externalOperationGetManySchema = z
  .object({
    page: z.coerce.number().int().min(0).default(1).optional(),
    limit: z.coerce.number().int().positive().max(100).default(20).optional(),
    where: externalOperationWhereSchema.optional(),
    orderBy: externalOperationOrderBySchema.optional(),
    include: externalOperationIncludeSchema.optional(),
    ...externalOperationFilters,
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
  })
  .transform(externalOperationTransform);

// =====================
// MULTI-STAGE FORM SCHEMAS
// =====================

// Stage 1: Basic Information Schema (withdrawer, type, observations)
export const externalOperationStage1Schema = z.object({
  withdrawerName: createNameSchema(2, 200, "Nome do retirador"),
  type: z.nativeEnum(EXTERNAL_OPERATION_TYPE).default(EXTERNAL_OPERATION_TYPE.RETURNABLE),
  notes: z.string().max(500, "Observações devem ter no máximo 500 caracteres").nullable().optional(),
});

// Stage 2: Item Selection Schema (selected items with quantities and conditional prices)
export const externalOperationItemSelectionSchema = z.object({
  itemId: z.string().uuid("Item inválido"),
  withdrawedQuantity: z.number().positive("Quantidade deve ser positiva"),
  // Price is required only for CHARGEABLE type - validated at form level
  price: z.number().min(0, "Preço não pode ser negativo").nullable().optional(),
});

export const externalOperationStage2Schema = z.object({
  items: z.array(externalOperationItemSelectionSchema).min(1, "Selecione pelo menos um item").max(100, "Limite máximo de 100 itens por operação"),
});

// Complete Form Schema with conditional price validation
export const externalOperationCompleteFormSchema = z
  .object({
    // Stage 1 data
    withdrawerName: createNameSchema(2, 200, "Nome do retirador"),
    type: z.nativeEnum(EXTERNAL_OPERATION_TYPE).default(EXTERNAL_OPERATION_TYPE.RETURNABLE),
    notes: z.string().max(500, "Observações devem ter no máximo 500 caracteres").nullable().optional(),

    // Stage 2 data (CHARGEABLE allows zero items when there are services)
    items: z.array(externalOperationItemSelectionSchema).max(100, "Limite máximo de 100 itens por operação"),

    // Billing fields (CHARGEABLE only)
    customerId: z.string().uuid("Cliente inválido").nullable().optional(),
    generateInvoice: z.boolean().optional(),
    generateBankSlip: z.boolean().optional(),
    paymentCondition: z.string().nullable().optional(),
    paymentConfig: externalOperationPaymentConfigSchema.nullable().optional(),
    services: z.array(externalOperationServiceItemSchema).optional(),

    // Optional fields for complete form
    status: z.nativeEnum(EXTERNAL_OPERATION_STATUS).default(EXTERNAL_OPERATION_STATUS.PENDING).optional(),
  })
  // Conditional validation: if type is CHARGEABLE, all items must have price
  .refine(
    (data) => {
      if (data.type !== EXTERNAL_OPERATION_TYPE.CHARGEABLE) return true;
      return data.items.every((item) => item.price !== null && item.price !== undefined && item.price >= 0);
    },
    {
      message: "Todos os itens selecionados devem ter preço definido para operações cobráveis",
      path: ["items"],
    },
  )
  // CHARGEABLE: at least 1 item OR service; other types: at least 1 item
  .refine(
    (data) => {
      if (data.type === EXTERNAL_OPERATION_TYPE.CHARGEABLE) {
        return data.items.length + (data.services?.length || 0) >= 1;
      }
      return data.items.length >= 1;
    },
    {
      message: "Selecione pelo menos um item ou serviço",
      path: ["items"],
    },
  );

// Form step validation schemas
export const externalOperationFormStepSchema = z.object({
  step: z.number().int().min(1).max(3).default(1),
  mode: z.enum(["create", "edit"]).default("create"),
});

// =====================
// CRUD SCHEMAS
// =====================

// Create schema
export const externalOperationCreateSchema = z
  .object({
    // Optional: the API requires customerId OR withdrawerName (see refinement below)
    withdrawerName: z
      .string()
      .max(200, "Nome de quem retirou deve ter no máximo 200 caracteres")
      .refine((val) => val.trim().length === 0 || val.trim().length >= 2, { message: "Nome de quem retirou deve ter pelo menos 2 caracteres" })
      .optional(),
    type: z.nativeEnum(EXTERNAL_OPERATION_TYPE).default(EXTERNAL_OPERATION_TYPE.RETURNABLE),
    status: z.nativeEnum(EXTERNAL_OPERATION_STATUS).default(EXTERNAL_OPERATION_STATUS.PENDING).optional(),
    notes: z.string().max(500, "Observações devem ter no máximo 500 caracteres").nullable().optional(),
    // Billing fields (CHARGEABLE only)
    customerId: z.string().uuid("Cliente inválido").nullable().optional(),
    generateInvoice: z.boolean().optional(),
    generateBankSlip: z.boolean().optional(),
    paymentCondition: z.string().nullable().optional(),
    paymentConfig: externalOperationPaymentConfigSchema.nullable().optional(),
    services: z.array(externalOperationServiceItemSchema).optional(),
    items: z
      .array(
        z.object({
          itemId: z.string().uuid("Item inválido"),
          withdrawedQuantity: z.number().positive("Quantidade retirada deve ser positiva"),
          price: z.number().min(0, "Preço unitário não pode ser negativo").nullable().optional(),
        }),
      )
      .optional(),
  })
  // CHARGEABLE: at least 1 item OR service; all items must be priced
  .refine(
    (data) => {
      if (data.type !== EXTERNAL_OPERATION_TYPE.CHARGEABLE) return true;
      return (data.items?.length || 0) + (data.services?.length || 0) >= 1;
    },
    {
      message: "Operações cobráveis devem ter pelo menos um item ou serviço",
      path: ["items"],
    },
  )
  .refine(
    (data) => {
      if (data.type !== EXTERNAL_OPERATION_TYPE.CHARGEABLE || !data.items) return true;
      return data.items.every((item) => item.price !== null && item.price !== undefined && item.price > 0);
    },
    {
      message: "Operações cobráveis exigem preço unitário maior que zero.",
      path: ["items"],
    },
  )
  // CHARGEABLE requires a billing customer
  .refine(
    (data) => {
      if (data.type !== EXTERNAL_OPERATION_TYPE.CHARGEABLE) return true;
      return !!data.customerId;
    },
    {
      message: "Cliente é obrigatório para operações cobráveis",
      path: ["customerId"],
    },
  )
  // API requires a customer OR the name of who withdrew
  .refine((data) => !!data.customerId || !!data.withdrawerName?.trim(), {
    message: "Informe um cliente ou quem retirou.",
    path: ["withdrawerName"],
  })
  // Non-CHARGEABLE: items required, services forbidden
  .refine(
    (data) => {
      if (data.type === EXTERNAL_OPERATION_TYPE.CHARGEABLE) return true;
      return (data.items?.length || 0) >= 1;
    },
    {
      message: "Selecione pelo menos um item",
      path: ["items"],
    },
  )
  .refine(
    (data) => {
      if (data.type === EXTERNAL_OPERATION_TYPE.CHARGEABLE) return true;
      return (data.services?.length || 0) === 0;
    },
    {
      message: "Serviços são permitidos apenas em operações cobráveis",
      path: ["services"],
    },
  );

export const externalOperationUpdateSchema = z
  .object({
    // Optional: the API requires customerId OR withdrawerName
    withdrawerName: z
      .string()
      .max(200, "Nome de quem retirou deve ter no máximo 200 caracteres")
      .refine((val) => val.trim().length === 0 || val.trim().length >= 2, { message: "Nome de quem retirou deve ter pelo menos 2 caracteres" })
      .nullable()
      .optional(),
    type: z.nativeEnum(EXTERNAL_OPERATION_TYPE).optional(),
    status: z.nativeEnum(EXTERNAL_OPERATION_STATUS).optional(),
    notes: z.string().max(500, "Observações devem ter no máximo 500 caracteres").nullable().optional(),
    // Billing fields (CHARGEABLE only)
    customerId: z.string().uuid("Cliente inválido").nullable().optional(),
    generateInvoice: z.boolean().optional(),
    generateBankSlip: z.boolean().optional(),
    paymentCondition: z.string().nullable().optional(),
    paymentConfig: externalOperationPaymentConfigSchema.nullable().optional(),
    services: z.array(externalOperationServiceItemSchema).optional(),
    // Nested items (delete-recreate on the API, same pattern as services)
    items: z
      .array(
        z.object({
          id: z.string().uuid("Item de operação externa inválido").optional(),
          itemId: z.string().uuid("Item inválido"),
          withdrawedQuantity: z.number().positive("Quantidade retirada deve ser positiva"),
          price: z.number().min(0, "Preço unitário não pode ser negativo").nullable().optional(),
        }),
      )
      .optional(),
  })
  .refine(
    (data) => {
      if (data.type !== EXTERNAL_OPERATION_TYPE.CHARGEABLE || !data.items) return true;
      return data.items.every((item) => item.price !== null && item.price !== undefined && item.price > 0);
    },
    {
      message: "Operações cobráveis exigem preço unitário maior que zero.",
      path: ["items"],
    },
  );

// Batch Schemas
export const externalOperationBatchCreateSchema = z.object({
  externalOperations: z.array(externalOperationCreateSchema),
});

export const externalOperationBatchUpdateSchema = z.object({
  externalOperations: z
    .array(
      z.object({
        id: z.string().uuid("Operação externa inválida"),
        data: externalOperationUpdateSchema,
      }),
    )
    .min(1, "Pelo menos uma operação deve ser fornecida"),
});

export const externalOperationBatchDeleteSchema = z.object({
  externalOperationIds: z.array(z.string().uuid("Operação externa inválida")).min(1, "Pelo menos um ID deve ser fornecido"),
});

// Query schema for include parameter
export const externalOperationQuerySchema = z.object({
  include: externalOperationIncludeSchema.optional(),
});

// GetById Schema
export const externalOperationGetByIdSchema = z.object({
  include: externalOperationIncludeSchema.optional(),
});

// =====================
// EXTERNAL WITHDRAWAL ITEM SCHEMAS
// =====================

// Include Schema
export const externalOperationItemIncludeSchema = z
  .object({
    externalOperation: z
      .union([
        z.boolean(),
        z.object({
          include: z
            .object({
              invoices: z.boolean().optional(),
              receipts: z.boolean().optional(),
              budgets: z.boolean().optional(),
              items: z.boolean().optional(),
            })
            .optional(),
        }),
      ])
      .optional(),
    item: z
      .union([
        z.boolean(),
        z.object({
          include: z
            .object({
              brands: z.boolean().optional(),
              category: z.boolean().optional(),
              supplier: z.boolean().optional(),
              prices: z
                .union([
                  z.boolean(),
                  z.object({
                    include: z.object({}).optional(),
                    where: z.object({}).optional(),
                    orderBy: z
                      .union([
                        z.object({
                          id: orderByDirectionSchema.optional(),
                          value: orderByDirectionSchema.optional(),
                          createdAt: orderByDirectionSchema.optional(),
                          updatedAt: orderByDirectionSchema.optional(),
                        }),
                        z.array(
                          z.object({
                            id: orderByDirectionSchema.optional(),
                            value: orderByDirectionSchema.optional(),
                            createdAt: orderByDirectionSchema.optional(),
                            updatedAt: orderByDirectionSchema.optional(),
                          }),
                        ),
                      ])
                      .optional(),
                    take: z.coerce.number().optional(),
                    skip: z.coerce.number().optional(),
                  }),
                ])
                .optional(),
              activities: z.boolean().optional(),
              borrows: z.boolean().optional(),
              orderItems: z.boolean().optional(),
              ppeDeliveries: z.boolean().optional(),
              orderRules: z.boolean().optional(),
            })
            .optional(),
        }),
      ])
      .optional(),
  })
  .partial();

// OrderBy Schema
export const externalOperationItemOrderBySchema = z
  .union([
    z
      .object({
        id: orderByDirectionSchema.optional(),
        externalOperationId: orderByDirectionSchema.optional(),
        itemId: orderByDirectionSchema.optional(),
        withdrawedQuantity: orderByDirectionSchema.optional(),
        returnedQuantity: orderByDirectionSchema.optional(),
        price: orderByDirectionSchema.optional(),
        createdAt: orderByDirectionSchema.optional(),
        updatedAt: orderByDirectionSchema.optional(),
      })
      .partial(),
    z.array(
      z
        .object({
          id: orderByDirectionSchema.optional(),
          name: orderByDirectionSchema.optional(),
          quantity: orderByDirectionSchema.optional(),
          price: orderByDirectionSchema.optional(),
          createdAt: orderByDirectionSchema.optional(),
        })
        .partial(),
    ),
  ])
  .optional();

// Where Schema
export const externalOperationItemWhereSchema: z.ZodType<any> = z
  .object({
    AND: z.array(z.lazy(() => externalOperationItemWhereSchema)).optional(),
    OR: z.array(z.lazy(() => externalOperationItemWhereSchema)).optional(),
    NOT: z.lazy(() => externalOperationItemWhereSchema).optional(),

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

    externalOperationId: z
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

    itemId: z
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

    withdrawedQuantity: z
      .union([
        z.number(),
        z.object({
          equals: z.number().optional(),
          not: z.number().optional(),
          lt: z.number().optional(),
          lte: z.number().optional(),
          gt: z.number().optional(),
          gte: z.number().optional(),
        }),
      ])
      .optional(),

    returnedQuantity: z
      .union([
        z.number(),
        z.object({
          equals: z.number().optional(),
          not: z.number().optional(),
          lt: z.number().optional(),
          lte: z.number().optional(),
          gt: z.number().optional(),
          gte: z.number().optional(),
        }),
      ])
      .optional(),

    price: z
      .union([
        z.number(),
        z.object({
          equals: z.number().optional(),
          not: z.number().optional(),
          lt: z.number().optional(),
          lte: z.number().optional(),
          gt: z.number().optional(),
          gte: z.number().optional(),
        }),
      ])
      .optional(),
  })
  .partial();

// Convenience filters
const externalOperationItemFilters = {
  externalOperationIds: z.array(z.string()).optional(),
  itemIds: z.array(z.string()).optional(),
  withdrawedQuantityRange: z
    .object({
      min: z.number().min(0).optional(),
      max: z.number().min(0).optional(),
    })
    .optional(),
  returnedQuantityRange: z
    .object({
      min: z.number().min(0).optional(),
      max: z.number().min(0).optional(),
    })
    .optional(),
  priceRange: z
    .object({
      min: z.number().min(0).optional(),
      max: z.number().min(0).optional(),
    })
    .optional(),
  searchingFor: z.string().optional(),
};

// Transform function
const externalOperationItemTransform = (data: any) => {
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

  if (data.externalOperationIds?.length) {
    andConditions.push({ externalOperationId: { in: data.externalOperationIds } });
    delete data.externalOperationIds;
  }

  if (data.itemIds?.length) {
    andConditions.push({ itemId: { in: data.itemIds } });
    delete data.itemIds;
  }

  if (data.withdrawedQuantityRange) {
    const withdrawedQuantityCondition: any = {};
    if (data.withdrawedQuantityRange.min !== undefined) withdrawedQuantityCondition.gte = data.withdrawedQuantityRange.min;
    if (data.withdrawedQuantityRange.max !== undefined) withdrawedQuantityCondition.lte = data.withdrawedQuantityRange.max;
    if (Object.keys(withdrawedQuantityCondition).length > 0) {
      andConditions.push({ withdrawedQuantity: withdrawedQuantityCondition });
    }
    delete data.withdrawedQuantityRange;
  }

  if (data.returnedQuantityRange) {
    const returnedQuantityCondition: any = {};
    if (data.returnedQuantityRange.min !== undefined) returnedQuantityCondition.gte = data.returnedQuantityRange.min;
    if (data.returnedQuantityRange.max !== undefined) returnedQuantityCondition.lte = data.returnedQuantityRange.max;
    if (Object.keys(returnedQuantityCondition).length > 0) {
      andConditions.push({ returnedQuantity: returnedQuantityCondition });
    }
    delete data.returnedQuantityRange;
  }

  if (data.priceRange) {
    const priceCondition: any = {};
    if (data.priceRange.min !== undefined) priceCondition.gte = data.priceRange.min;
    if (data.priceRange.max !== undefined) priceCondition.lte = data.priceRange.max;
    if (Object.keys(priceCondition).length > 0) {
      andConditions.push({ price: priceCondition });
    }
    delete data.priceRange;
  }

  if (data.searchingFor) {
    andConditions.push({
      item: { name: { contains: data.searchingFor, mode: "insensitive" } },
    });
    delete data.searchingFor;
  }

  if (data.createdAt) {
    andConditions.push({ createdAt: data.createdAt });
    delete data.createdAt;
  }

  if (data.updatedAt) {
    andConditions.push({ updatedAt: data.updatedAt });
    delete data.updatedAt;
  }

  if (andConditions.length > 0) {
    if (data.where) {
      data.where = { ...data.where, AND: [...(data.where.AND || []), ...andConditions] };
    } else {
      data.where = andConditions.length === 1 ? andConditions[0] : { AND: andConditions };
    }
  }

  return data;
};

// Query Schema
export const externalOperationItemGetManySchema = z
  .object({
    page: z.coerce.number().int().min(0).default(1).optional(),
    limit: z.coerce.number().int().positive().max(100).default(20).optional(),
    where: externalOperationItemWhereSchema.optional(),
    orderBy: externalOperationItemOrderBySchema.optional(),
    include: externalOperationItemIncludeSchema.optional(),
    ...externalOperationItemFilters,
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
  })
  .transform(externalOperationItemTransform);

// CRUD Schemas
export const externalOperationItemCreateSchema = z.object({
  externalOperationId: z.string().uuid("Operação externa inválida"),
  itemId: z.string().uuid("Item inválido"),
  withdrawedQuantity: z.number().positive("Quantidade retirada deve ser positiva"),
  price: z.number().min(0, "Preço não pode ser negativo").nullable().optional(),
});

export const externalOperationItemUpdateSchema = z.object({
  withdrawedQuantity: z.number().positive("Quantidade retirada deve ser positiva").optional(),
  returnedQuantity: z.number().min(0, "Quantidade devolvida não pode ser negativa").optional(),
  price: z.number().min(0, "Preço não pode ser negativo").nullable().optional(),
});

// Batch Schemas
export const externalOperationItemBatchCreateSchema = z.object({
  externalOperationItems: z.array(externalOperationItemCreateSchema),
});

export const externalOperationItemBatchUpdateSchema = z.object({
  externalOperationItems: z
    .array(
      z.object({
        id: z.string().uuid("Item de operação externa inválido"),
        data: externalOperationItemUpdateSchema,
      }),
    )
    .min(1, "Pelo menos um item deve ser fornecido"),
});

export const externalOperationItemBatchDeleteSchema = z.object({
  externalOperationItemIds: z.array(z.string().uuid("Item de operação externa inválido")).min(1, "Pelo menos um ID deve ser fornecido"),
});

// Query schema for include parameter
export const externalOperationItemQuerySchema = z.object({
  include: externalOperationItemIncludeSchema.optional(),
});

// GetById Schema
export const externalOperationItemGetByIdSchema = z.object({
  include: externalOperationItemIncludeSchema.optional(),
});

// =====================
// INFERRED TYPES
// =====================

// Multi-stage form types
export type ExternalOperationStage1FormData = z.infer<typeof externalOperationStage1Schema>;
export type ExternalOperationStage2FormData = z.infer<typeof externalOperationStage2Schema>;
export type ExternalOperationCompleteFormData = z.infer<typeof externalOperationCompleteFormSchema>;
export type ExternalOperationItemSelectionFormData = z.infer<typeof externalOperationItemSelectionSchema>;
export type ExternalOperationFormStepFormData = z.infer<typeof externalOperationFormStepSchema>;

// ExternalOperation types (existing)
export type ExternalOperationGetManyFormData = z.infer<typeof externalOperationGetManySchema>;
export type ExternalOperationGetByIdFormData = z.infer<typeof externalOperationGetByIdSchema>;
export type ExternalOperationQueryFormData = z.infer<typeof externalOperationQuerySchema>;

export type ExternalOperationCreateFormData = z.infer<typeof externalOperationCreateSchema>;
export type ExternalOperationUpdateFormData = z.infer<typeof externalOperationUpdateSchema>;
export type ExternalOperationServiceItemFormData = z.infer<typeof externalOperationServiceItemSchema>;
export type ExternalOperationPaymentConfig = z.infer<typeof externalOperationPaymentConfigSchema>;

export type ExternalOperationBatchCreateFormData = z.infer<typeof externalOperationBatchCreateSchema>;
export type ExternalOperationBatchUpdateFormData = z.infer<typeof externalOperationBatchUpdateSchema>;
export type ExternalOperationBatchDeleteFormData = z.infer<typeof externalOperationBatchDeleteSchema>;

export type ExternalOperationInclude = z.infer<typeof externalOperationIncludeSchema>;
export type ExternalOperationWhere = z.infer<typeof externalOperationWhereSchema>;
export type ExternalOperationOrderBy = z.infer<typeof externalOperationOrderBySchema>;

// ExternalOperationItem types
export type ExternalOperationItemGetManyFormData = z.infer<typeof externalOperationItemGetManySchema>;
export type ExternalOperationItemGetByIdFormData = z.infer<typeof externalOperationItemGetByIdSchema>;
export type ExternalOperationItemQueryFormData = z.infer<typeof externalOperationItemQuerySchema>;

export type ExternalOperationItemCreateFormData = z.infer<typeof externalOperationItemCreateSchema>;
export type ExternalOperationItemUpdateFormData = z.infer<typeof externalOperationItemUpdateSchema>;

export type ExternalOperationItemBatchCreateFormData = z.infer<typeof externalOperationItemBatchCreateSchema>;
export type ExternalOperationItemBatchUpdateFormData = z.infer<typeof externalOperationItemBatchUpdateSchema>;
export type ExternalOperationItemBatchDeleteFormData = z.infer<typeof externalOperationItemBatchDeleteSchema>;

export type ExternalOperationItemInclude = z.infer<typeof externalOperationItemIncludeSchema>;
export type ExternalOperationItemWhere = z.infer<typeof externalOperationItemWhereSchema>;
export type ExternalOperationItemOrderBy = z.infer<typeof externalOperationItemOrderBySchema>;

// =====================
// HELPER FUNCTIONS
// =====================

// Multi-stage form helpers
export const mapExternalOperationToStage1FormData = createMapToFormDataHelper<ExternalOperation, ExternalOperationStage1FormData>((externalOperation) => ({
  withdrawerName: externalOperation.withdrawerName,
  type: externalOperation.type,
  notes: externalOperation.notes,
}));

export const mapExternalOperationToCompleteFormData = createMapToFormDataHelper<ExternalOperation & { items?: ExternalOperationItem[] }, ExternalOperationCompleteFormData>(
  (externalOperation) => ({
    withdrawerName: externalOperation.withdrawerName,
    type: externalOperation.type,
    notes: externalOperation.notes,
    items:
      externalOperation.items?.map((item) => ({
        itemId: item.itemId,
        withdrawedQuantity: item.withdrawedQuantity,
        price: item.price,
      })) || [],
    customerId: externalOperation.customerId ?? null,
    generateInvoice: externalOperation.generateInvoice ?? true,
    generateBankSlip: externalOperation.generateBankSlip ?? true,
    paymentCondition: externalOperation.paymentCondition ?? null,
    paymentConfig: (externalOperation.paymentConfig as any) ?? null,
    services:
      externalOperation.services?.map((service) => ({
        id: service.id,
        description: service.description,
        amount: service.amount,
        position: service.position,
      })) || [],
    status: externalOperation.status,
  }),
);

// Existing helpers
export const mapExternalOperationToFormData = createMapToFormDataHelper<ExternalOperation, ExternalOperationUpdateFormData>((externalOperation) => ({
  withdrawerName: externalOperation.withdrawerName,
  type: externalOperation.type,
  status: externalOperation.status,
  notes: externalOperation.notes,
  customerId: externalOperation.customerId ?? null,
  generateInvoice: externalOperation.generateInvoice,
  generateBankSlip: externalOperation.generateBankSlip,
  paymentCondition: externalOperation.paymentCondition ?? null,
  paymentConfig: (externalOperation.paymentConfig as any) ?? null,
  services:
    externalOperation.services?.map((service) => ({
      id: service.id,
      description: service.description,
      amount: service.amount,
      position: service.position,
    })) ?? undefined,
}));

export const mapExternalOperationItemToFormData = createMapToFormDataHelper<ExternalOperationItem, ExternalOperationItemUpdateFormData>((item) => ({
  withdrawedQuantity: item.withdrawedQuantity,
  returnedQuantity: item.returnedQuantity,
  price: item.price,
}));

// Validation helpers for multi-stage forms
export const validateStage1FormData = (data: unknown): data is ExternalOperationStage1FormData => {
  return externalOperationStage1Schema.safeParse(data).success;
};

export const validateStage2FormData = (data: unknown): data is ExternalOperationStage2FormData => {
  return externalOperationStage2Schema.safeParse(data).success;
};

export const validateCompleteFormData = (data: unknown): data is ExternalOperationCompleteFormData => {
  return externalOperationCompleteFormSchema.safeParse(data).success;
};

// Form data combination helper
export const combineFormStages = (
  stage1Data: ExternalOperationStage1FormData,
  stage2Data: ExternalOperationStage2FormData,
  additionalData?: {
    status?: EXTERNAL_OPERATION_STATUS;
  },
): ExternalOperationCompleteFormData => {
  return {
    ...stage1Data,
    ...stage2Data,
    status: additionalData?.status || EXTERNAL_OPERATION_STATUS.PENDING,
  };
};

// Convert complete form data to create schema format
export const convertCompleteFormToCreateData = (completeData: ExternalOperationCompleteFormData): ExternalOperationCreateFormData => {
  return {
    withdrawerName: completeData.withdrawerName,
    type: completeData.type,
    notes: completeData.notes,
    items: completeData.items.map((item) => ({
      itemId: item.itemId,
      withdrawedQuantity: item.withdrawedQuantity,
      price: item.price,
    })),
    customerId: completeData.customerId,
    generateInvoice: completeData.generateInvoice,
    generateBankSlip: completeData.generateBankSlip,
    paymentCondition: completeData.paymentCondition,
    paymentConfig: completeData.paymentConfig,
    services: completeData.services,
    status: completeData.status,
  };
};
