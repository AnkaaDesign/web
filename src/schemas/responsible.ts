import { z } from 'zod';
import { ResponsibleRole } from '@/types/responsible';

// Phone validation regex (Brazilian format)
const phoneRegex = /^(\+55\s?)?(\(?\d{2}\)?\s?)?(\d{4,5}[-.\s]?\d{4})$/;

// Email validation
const emailSchema = z
  .string()
  .email('Email inválido')
  .optional()
  .or(z.literal(''));

// Password validation (min 6 chars when provided)
const passwordSchema = z
  .string()
  .min(6, 'Senha deve ter no mínimo 6 caracteres')
  .optional()
  .or(z.literal(''));

/**
 * A contact's roles: at least one, de-duplicated, in enum declaration order.
 *
 * The canonical ordering matters beyond cosmetics -- the API records changelog
 * diffs by comparing serialized values, so an unordered array would log a
 * change every time the user toggles the same set in a different sequence.
 */
export const responsibleRolesSchema = z
  .array(z.nativeEnum(ResponsibleRole, { errorMap: () => ({ message: 'Função inválida' }) }))
  .min(1, 'Selecione ao menos uma função')
  .transform(roles => {
    const order = Object.values(ResponsibleRole);
    return [...new Set(roles)].sort((a, b) => order.indexOf(a) - order.indexOf(b));
  });

// Responsible create schema
export const responsibleCreateSchema = z.object({
  email: emailSchema,
  phone: z
    .string()
    .min(1, 'Telefone é obrigatório')
    .regex(phoneRegex, 'Formato de telefone inválido'),
  name: z
    .string()
    .min(1, 'Nome é obrigatório')
    .min(3, 'Nome deve ter no mínimo 3 caracteres')
    .max(100, 'Nome deve ter no máximo 100 caracteres'),
  password: passwordSchema,
  companyId: z
    .string()
    .uuid('ID da empresa inválido')
    .optional()
    .nullable(),
  roles: responsibleRolesSchema,
  isActive: z
    .boolean()
    .optional()
    .default(true),
});

// Responsible inline create schema (companyId is optional for inline context)
// Email and password are optional for inline creation as they can be set later
export const responsibleCreateInlineSchema = z.object({
  email: z
    .string()
    .email('Email inválido')
    .optional()
    .or(z.literal(''))
    .transform(val => val === '' ? undefined : val),
  phone: z
    .string()
    .min(1, 'Telefone é obrigatório')
    .regex(phoneRegex, 'Formato de telefone inválido'),
  name: z
    .string()
    .min(1, 'Nome é obrigatório')
    .min(3, 'Nome deve ter no mínimo 3 caracteres')
    .max(100, 'Nome deve ter no máximo 100 caracteres'),
  password: z
    .string()
    .min(6, 'Senha deve ter no mínimo 6 caracteres')
    .optional()
    .or(z.literal(''))
    .transform(val => val === '' ? undefined : val),
  companyId: z
    .string()
    .uuid('ID da empresa inválido')
    .optional()
    .nullable(),
  roles: responsibleRolesSchema,
  isActive: z
    .boolean()
    .optional()
    .default(true),
});

// Responsible update schema
export const responsibleUpdateSchema = z.object({
  email: emailSchema,
  phone: z
    .string()
    .regex(phoneRegex, 'Formato de telefone inválido')
    .optional(),
  name: z
    .string()
    .min(3, 'Nome deve ter no mínimo 3 caracteres')
    .max(100, 'Nome deve ter no máximo 100 caracteres')
    .optional(),
  password: passwordSchema,
  roles: responsibleRolesSchema.optional(),
  isActive: z
    .boolean()
    .optional(),
});

// Responsible search/filter schema
export const responsibleGetManySchema = z.object({
  page: z
    .number()
    .min(1)
    .optional()
    .default(1),
  pageSize: z
    .number()
    .min(1)
    .max(100)
    .optional()
    .default(20),
  search: z
    .string()
    .optional(),
  companyId: z
    .string()
    .uuid('ID da empresa inválido')
    .optional(),
  // Any-of filter: selecting FINANCIAL + FLEET_MANAGER lists every contact
  // holding either (Prisma `hasSome` on the server).
  roles: z
    .array(z.nativeEnum(ResponsibleRole))
    .optional(),
  isActive: z
    .boolean()
    .optional(),
  include: z
    .array(z.string())
    .optional(),
});

// Responsible login schema
export const responsibleLoginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email é obrigatório')
    .email('Email inválido'),
  password: z
    .string()
    .min(1, 'Senha é obrigatória'),
});

// Password update schema
export const responsiblePasswordUpdateSchema = z.object({
  password: z
    .string()
    .min(6, 'Senha deve ter no mínimo 6 caracteres'),
});

// Batch operations schemas
export const responsibleBatchCreateSchema = z.object({
  responsibles: z
    .array(responsibleCreateSchema)
    .min(1, 'Pelo menos um responsável deve ser fornecido')
    .max(50, 'Máximo de 50 responsáveis por operação'),
});

export const responsibleBatchUpdateSchema = z.object({
  updates: z
    .array(
      z.object({
        id: z.string().uuid('ID inválido'),
        data: responsibleUpdateSchema,
      })
    )
    .min(1, 'Pelo menos uma atualização deve ser fornecida')
    .max(50, 'Máximo de 50 atualizações por operação'),
});

export const responsibleBatchDeleteSchema = z.object({
  ids: z
    .array(z.string().uuid('ID inválido'))
    .min(1, 'Pelo menos um ID deve ser fornecido')
    .max(50, 'Máximo de 50 exclusões por operação'),
});

// Responsible row data schema (for inline editing/creation state management)
export const responsibleRowDataSchema = z.object({
  id: z.string(),
  email: z.string().nullable().optional(),
  phone: z.string(),
  name: z.string(),
  roles: z.array(z.nativeEnum(ResponsibleRole)),
  isActive: z.boolean(),
  isEditing: z.boolean().optional(),
  isNew: z.boolean().optional(),
  isSaving: z.boolean().optional(),
  error: z.string().nullable().optional(),
});

// Type exports
export type ResponsibleCreateFormData = z.infer<typeof responsibleCreateSchema>;
export type ResponsibleCreateInlineFormData = z.infer<typeof responsibleCreateInlineSchema>;
export type ResponsibleUpdateFormData = z.infer<typeof responsibleUpdateSchema>;
export type ResponsibleGetManyFormData = z.infer<typeof responsibleGetManySchema>;
export type ResponsibleLoginFormData = z.infer<typeof responsibleLoginSchema>;
export type ResponsiblePasswordUpdateFormData = z.infer<typeof responsiblePasswordUpdateSchema>;
export type ResponsibleBatchCreateFormData = z.infer<typeof responsibleBatchCreateSchema>;
export type ResponsibleBatchUpdateFormData = z.infer<typeof responsibleBatchUpdateSchema>;
export type ResponsibleBatchDeleteFormData = z.infer<typeof responsibleBatchDeleteSchema>;
export type ResponsibleRowDataFormData = z.infer<typeof responsibleRowDataSchema>;
