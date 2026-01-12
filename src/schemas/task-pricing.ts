import { z } from 'zod';
import { moneySchema } from './common';

export const taskPricingStatusSchema = z.enum([
  'DRAFT',
  'APPROVED',
  'REJECTED',
  'CANCELLED',
]);

export const taskPricingItemSchema = z.object({
  id: z.string().uuid().optional(),
  description: z.string().min(1, 'Descrição é obrigatória').max(400),
  amount: moneySchema,
});

// Lenient item schema for nested creation (allows incomplete items during editing)
const taskPricingItemCreateSchema = z.object({
  id: z.string().uuid().optional(),
  description: z.string().optional().default(''),
  amount: z.number().optional().nullable(),
});

// Schema that allows optional pricing or validates pricing when items exist
export const pricingCreateNestedSchema = z
  .object({
    expiresAt: z.coerce.date().optional().nullable(),
    status: taskPricingStatusSchema.optional().default('DRAFT'),
    items: z.array(taskPricingItemCreateSchema).optional().default([]),
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

        if (!item.amount || item.amount <= 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Valor deve ser maior que zero",
            path: ['items', index, 'amount'],
          });
        }
      });
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
  total: moneySchema,
  expiresAt: z.coerce.date(),
  status: taskPricingStatusSchema,
  taskId: z.string().uuid(),
  items: z.array(taskPricingItemSchema).min(1, 'Pelo menos um item é obrigatório'),
});

export type TaskPricingFormData = z.infer<typeof taskPricingSchema>;
export type TaskPricingItemFormData = z.infer<typeof taskPricingItemSchema>;
export type PricingCreateNestedFormData = z.infer<typeof pricingCreateNestedSchema>;
