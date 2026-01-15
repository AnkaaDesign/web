import { z } from 'zod';
import { moneySchema } from './common';

/**
 * Preprocess money values that might come as formatted strings (e.g., "R$ 6.230,00")
 * or as numbers. Converts them to a numeric value.
 */
const preprocessMoney = (val: unknown): number | null | undefined => {
  if (val === null || val === undefined || val === '') {
    return null;
  }
  if (typeof val === 'number') {
    return val;
  }
  if (typeof val === 'string') {
    // Remove currency symbol and whitespace
    let cleaned = val.replace(/R\$\s*/g, '').trim();
    // Handle Brazilian format: "6.230,00" -> "6230.00"
    // First remove thousands separators (dots), then convert decimal comma to dot
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  }
  return null;
};

export const taskPricingStatusSchema = z.enum([
  'DRAFT',
  'APPROVED',
  'REJECTED',
  'CANCELLED',
]);

export const discountTypeSchema = z.enum([
  'NONE',
  'PERCENTAGE',
  'FIXED_VALUE',
]);

export const paymentConditionSchema = z.enum([
  'CASH',
  'INSTALLMENTS_2',
  'INSTALLMENTS_3',
  'INSTALLMENTS_4',
  'INSTALLMENTS_5',
  'INSTALLMENTS_6',
  'INSTALLMENTS_7',
  'CUSTOM',
]);

// Guarantee years options
export const GUARANTEE_YEARS_OPTIONS = [5, 10, 15] as const;

export const taskPricingItemSchema = z.object({
  id: z.string().uuid().optional(),
  description: z.string().min(1, 'Descrição é obrigatória').max(400),
  amount: moneySchema,
});

// Lenient item schema for nested creation (allows incomplete items during editing)
const taskPricingItemCreateSchema = z.object({
  id: z.string().uuid().optional(),
  description: z.string().optional().default(''),
  // Amount might come as formatted currency string (e.g., "R$ 520,00")
  amount: z.preprocess(preprocessMoney, z.number().optional().nullable()),
});

// Preprocess items array to filter out empty placeholder items
const taskPricingItemsArraySchema = z.preprocess(
  (val) => {
    // Filter out empty pricing items (those without descriptions)
    if (Array.isArray(val)) {
      return val.filter((item: any) => item && item.description && item.description.trim() !== '');
    }
    return val;
  },
  z.array(taskPricingItemCreateSchema).optional().default([])
);

/**
 * Preprocess discountType to handle null/undefined values gracefully.
 * Converts null/undefined to 'NONE' to avoid validation errors.
 */
const preprocessDiscountType = (val: unknown): string => {
  if (val === null || val === undefined || val === '') {
    return 'NONE';
  }
  return String(val);
};

// Preprocess payment condition
const preprocessPaymentCondition = (val: unknown): string | null => {
  if (val === null || val === undefined || val === '') {
    return null;
  }
  return String(val);
};

// Schema that allows optional pricing or validates pricing when items exist
export const taskPricingCreateNestedSchema = z
  .object({
    expiresAt: z.coerce.date().optional().nullable(),
    status: taskPricingStatusSchema.optional().default('DRAFT'),
    items: taskPricingItemsArraySchema, // Uses preprocessing to filter empty items
    // These fields might come as formatted currency strings (e.g., "R$ 6.230,00")
    // from the form, so we preprocess them to convert to numbers
    subtotal: z.preprocess(preprocessMoney, z.number().optional().nullable()),
    // discountType: preprocess null/undefined to 'NONE' to avoid validation errors
    discountType: z.preprocess(preprocessDiscountType, discountTypeSchema.default('NONE')),
    discountValue: z.preprocess(preprocessMoney, z.number().optional().nullable()),
    total: z.preprocess(preprocessMoney, z.number().optional().nullable()),

    // Payment Terms (simplified)
    paymentCondition: z.preprocess(
      preprocessPaymentCondition,
      paymentConditionSchema.optional().nullable()
    ),
    // Preprocess to handle null/empty before coercing to date
    downPaymentDate: z.preprocess(
      (val) => (val === null || val === undefined || val === '' ? null : val),
      z.coerce.date().nullable()
    ).optional(),
    customPaymentText: z.string().max(2000).optional().nullable(),

    // Guarantee Terms
    guaranteeYears: z.preprocess(
      (val) => val === '' || val === null || val === undefined ? null : Number(val),
      z.number().optional().nullable()
    ),
    customGuaranteeText: z.string().max(2000).optional().nullable(),

    // Layout File
    layoutFileId: z.string().uuid().optional().nullable(),
  })
  .optional()
  .superRefine((data, ctx) => {
    // If no data or no items, it's valid (optional pricing)
    if (!data || !data.items || data.items.length === 0) {
      return;
    }

    // If there are items, validate them strictly
    if (data.items.length > 0) {
      // Require expiry date
      if (!data.expiresAt) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Data de validade é obrigatória",
          path: ['expiresAt'],
        });
      }

      // Validate each item
      data.items.forEach((item, index) => {
        if (!item.description || item.description.trim().length === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Descrição é obrigatória",
            path: ['items', index, 'description'],
          });
        }

        // Amount can be empty (defaults to 0 for courtesy), only reject negative values
        if (typeof item.amount === 'number' && item.amount < 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Valor não pode ser negativo",
            path: ['items', index, 'amount'],
          });
        }
      });

      // Validate discount fields
      if (data.discountType && data.discountType !== 'NONE') {
        // Check if discount value is missing or not a valid number
        // The value might come as string from the form, so check more robustly
        const discountVal = data.discountValue;
        const numericValue = typeof discountVal === 'number' ? discountVal :
                            (typeof discountVal === 'string' && discountVal.trim() !== '') ? Number(discountVal) : null;
        const hasValidValue = numericValue !== null && !isNaN(numericValue);

        if (!hasValidValue) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Valor do desconto é obrigatório quando o tipo não é 'Nenhum'",
            path: ['discountValue'],
          });
        } else if (data.discountType === 'PERCENTAGE' && (numericValue < 0 || numericValue > 100)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Porcentagem de desconto deve estar entre 0 e 100",
            path: ['discountValue'],
          });
        } else if (data.discountType === 'FIXED_VALUE' && numericValue < 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Valor do desconto deve ser maior ou igual a zero",
            path: ['discountValue'],
          });
        }
      }
    }
  })
  .transform((data) => {
    // Transform empty pricing to undefined
    if (!data || !data.items || data.items.length === 0) {
      return undefined;
    }
    return data;
  });

export const taskPricingSchema = z.object({
  id: z.string().uuid().optional(),
  subtotal: moneySchema,
  discountType: discountTypeSchema.default('NONE'),
  discountValue: z.number().optional().nullable(),
  total: moneySchema,
  expiresAt: z.coerce.date(),
  status: taskPricingStatusSchema,
  taskId: z.string().uuid(),
  items: z.array(taskPricingItemSchema).min(1, 'Pelo menos um item é obrigatório'),
}).superRefine((data, ctx) => {
  // Validate discount fields
  if (data.discountType !== 'NONE') {
    if (data.discountValue === null || data.discountValue === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Valor do desconto é obrigatório quando o tipo não é 'Nenhum'",
        path: ['discountValue'],
      });
    } else if (data.discountType === 'PERCENTAGE' && (data.discountValue < 0 || data.discountValue > 100)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Porcentagem de desconto deve estar entre 0 e 100",
        path: ['discountValue'],
      });
    } else if (data.discountType === 'FIXED_VALUE' && data.discountValue < 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Valor do desconto deve ser maior ou igual a zero",
        path: ['discountValue'],
      });
    }
  }
});

export type TaskPricingFormData = z.infer<typeof taskPricingSchema>;
export type TaskPricingItemFormData = z.infer<typeof taskPricingItemSchema>;
export type TaskPricingCreateNestedFormData = z.infer<typeof taskPricingCreateNestedSchema>;
