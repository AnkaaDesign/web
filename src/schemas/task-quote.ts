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

export const taskQuoteStatusSchema = z.enum([
  'PENDING',
  'BUDGET_APPROVED',
  'COMMERCIAL_APPROVED',
  'BILLING_APPROVED',
  'UPCOMING',
  'DUE',
  'PARTIAL',
  'SETTLED',
]);

export const discountTypeSchema = z.enum([
  'NONE',
  'PERCENTAGE',
  'FIXED_VALUE',
]);

export const paymentConditionSchema = z.enum([
  'CASH_5',
  'CASH_40',
  'INSTALLMENTS_2',
  'INSTALLMENTS_3',
  'INSTALLMENTS_4',
  'INSTALLMENTS_5',
  'INSTALLMENTS_6',
  'INSTALLMENTS_7',
  'CUSTOM',
]);

// New structured payment config (replaces paymentCondition going forward)
export const paymentConfigSchema = z.object({
  type: z.enum(['CASH', 'INSTALLMENTS']),
  cashDays: z.union([z.literal(5), z.literal(10), z.literal(20), z.literal(40)]).optional(),
  installmentCount: z.number().int().min(2).max(6).optional(),
  installmentStep: z.number().int().min(1).max(365).optional(),
  entryDays: z.number().int().min(1).max(365).optional(),
  specificDate: z.string().optional(),
});

export type PaymentConfig = z.infer<typeof paymentConfigSchema>;

// Guarantee years options
export const GUARANTEE_YEARS_OPTIONS = [5, 10, 15] as const;

export const taskQuoteServiceSchema = z.object({
  id: z.string().uuid().optional(),
  description: z.string().min(1, 'Descrição é obrigatória').max(400),
  observation: z.string().max(2000).optional().nullable(),
  amount: moneySchema,
  invoiceToCustomerId: z.string().uuid('Cliente inválido').optional().nullable(),
});

// Lenient service schema for nested creation (allows incomplete services during editing)
const taskQuoteServiceCreateSchema = z.object({
  id: z.string().uuid().optional(),
  description: z.string().optional().default(''),
  observation: z.string().max(2000).optional().nullable(),
  // Amount might come as formatted currency string (e.g., "R$ 520,00")
  amount: z.preprocess(preprocessMoney, z.number().optional().nullable()),
  invoiceToCustomerId: z.string().uuid('Cliente inválido').optional().nullable(),
});

// Preprocess services array to filter out empty placeholder services
const taskQuoteServicesArraySchema = z.preprocess(
  (val) => {
    // Filter out empty quote services (those without descriptions)
    if (Array.isArray(val)) {
      return val.filter((service: any) => service && service.description && service.description.trim() !== '');
    }
    return val;
  },
  z.array(taskQuoteServiceCreateSchema).optional().default([])
);

// Customer config schema for per-customer billing
export const taskQuoteCustomerConfigSchema = z.object({
  customerId: z.string().uuid('Cliente inválido'),
  subtotal: z.preprocess(preprocessMoney, z.number().optional().nullable().default(0)),
  total: z.preprocess(preprocessMoney, z.number().optional().nullable().default(0)),
  // Global customer discount
  discountType: z.preprocess(
    (val) => (val === null || val === undefined || val === '' ? 'NONE' : String(val)),
    discountTypeSchema.default('NONE')
  ),
  discountValue: z.preprocess(preprocessMoney, z.number().optional().nullable()),
  discountReference: z.string().max(500).optional().nullable(),
  paymentCondition: z.preprocess(
    (val) => (val === null || val === undefined || val === '' ? null : String(val)),
    paymentConditionSchema.optional().nullable()
  ),
  paymentConfig: paymentConfigSchema.optional().nullable(),
  customPaymentText: z.string().max(2000).optional().nullable(),
  generateInvoice: z.boolean().optional().default(true),
  orderNumber: z.string().max(100).optional().nullable(),
  responsibleId: z.string().uuid().optional().nullable(),
  installments: z.array(z.object({
    id: z.string().uuid().optional(),
    number: z.number().int(),
    dueDate: z.coerce.date(),
    amount: z.number(),
  })).optional(),
});

// Schema that allows optional quote or validates quote when services exist
export const taskQuoteCreateNestedSchema = z
  .object({
    expiresAt: z.coerce.date().optional().nullable(),
    status: taskQuoteStatusSchema.optional().default('PENDING'),
    services: taskQuoteServicesArraySchema, // Uses preprocessing to filter empty services
    // Aggregate totals (computed from customerConfigs)
    subtotal: z.preprocess(preprocessMoney, z.number().optional().nullable()),
    total: z.preprocess(preprocessMoney, z.number().optional().nullable()),

    // Guarantee Terms
    guaranteeYears: z.preprocess(
      (val) => val === '' || val === null || val === undefined ? null : Number(val),
      z.number().optional().nullable()
    ),
    customGuaranteeText: z.string().max(2000).optional().nullable(),

    // Custom Forecast - manual override for production days displayed in budget (1-30 days)
    customForecastDays: z.preprocess(
      (val) => val === '' || val === null || val === undefined ? null : Number(val),
      z.number().int().min(1).max(30).optional().nullable()
    ),

    // Layout File
    layoutFileId: z.string().uuid().optional().nullable(),

    simultaneousTasks: z.preprocess(
      (val) => val === '' || val === null || val === undefined ? null : Number(val),
      z.number().int().min(1).max(100).optional().nullable()
    ),
    customerConfigs: z.array(taskQuoteCustomerConfigSchema).optional(),
  })
  .optional()
  .superRefine((data, ctx) => {
    // If no data or no services, it's valid (optional quote)
    if (!data || !data.services || data.services.length === 0) {
      return;
    }

    // If there are services, validate them strictly
    if (data.services.length > 0) {
      // Require expiry date
      if (!data.expiresAt) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Data de validade é obrigatória",
          path: ['expiresAt'],
        });
      }

      // Validate each service
      data.services.forEach((service, index) => {
        if (!service.description || service.description.trim().length === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Descrição é obrigatória",
            path: ['services', index, 'description'],
          });
        }

        // Amount can be empty (defaults to 0 for courtesy), only reject negative values
        if (typeof service.amount === 'number' && service.amount < 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Valor não pode ser negativo",
            path: ['services', index, 'amount'],
          });
        }
      });
    }
  });

export const taskQuoteSchema = z.object({
  id: z.string().uuid().optional(),
  subtotal: moneySchema,
  total: moneySchema,
  expiresAt: z.coerce.date(),
  status: taskQuoteStatusSchema,
  taskId: z.string().uuid(),
  services: z.array(taskQuoteServiceSchema).min(1, 'Pelo menos um serviço é obrigatório'),
  customerConfigs: z.array(taskQuoteCustomerConfigSchema).min(1, 'Pelo menos uma configuração de cliente é obrigatória'),
});

export type TaskQuoteFormData = z.infer<typeof taskQuoteSchema>;
export type TaskQuoteServiceFormData = z.infer<typeof taskQuoteServiceSchema>;
export type TaskQuoteCustomerConfigFormData = z.infer<typeof taskQuoteCustomerConfigSchema>;
export type TaskQuoteCreateNestedFormData = z.infer<typeof taskQuoteCreateNestedSchema>;
