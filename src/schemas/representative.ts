import { z } from 'zod';
import { RepresentativeRole } from '@/types/representative';

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

// Representative create schema
export const representativeCreateSchema = z.object({
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
  customerId: z
    .string()
    .uuid('ID do cliente inválido'),
  role: z.nativeEnum(RepresentativeRole, {
    errorMap: () => ({ message: 'Função inválida' }),
  }),
  isActive: z
    .boolean()
    .optional()
    .default(true),
});

// Representative inline create schema (without customerId for inline context)
// Email and password are optional for inline creation as they can be set later
export const representativeCreateInlineSchema = z.object({
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
  role: z.nativeEnum(RepresentativeRole, {
    errorMap: () => ({ message: 'Função inválida' }),
  }),
  isActive: z
    .boolean()
    .optional()
    .default(true),
});

// Representative update schema
export const representativeUpdateSchema = z.object({
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
  role: z
    .nativeEnum(RepresentativeRole, {
      errorMap: () => ({ message: 'Função inválida' }),
    })
    .optional(),
  isActive: z
    .boolean()
    .optional(),
});

// Representative search/filter schema
export const representativeGetManySchema = z.object({
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
  customerId: z
    .string()
    .uuid('ID do cliente inválido')
    .optional(),
  role: z
    .nativeEnum(RepresentativeRole)
    .optional(),
  isActive: z
    .boolean()
    .optional(),
  include: z
    .array(z.string())
    .optional(),
});

// Representative login schema
export const representativeLoginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email é obrigatório')
    .email('Email inválido'),
  password: z
    .string()
    .min(1, 'Senha é obrigatória'),
});

// Password update schema
export const representativePasswordUpdateSchema = z.object({
  password: z
    .string()
    .min(6, 'Senha deve ter no mínimo 6 caracteres'),
});

// Batch operations schemas
export const representativeBatchCreateSchema = z.object({
  representatives: z
    .array(representativeCreateSchema)
    .min(1, 'Pelo menos um representante deve ser fornecido')
    .max(50, 'Máximo de 50 representantes por operação'),
});

export const representativeBatchUpdateSchema = z.object({
  updates: z
    .array(
      z.object({
        id: z.string().uuid('ID inválido'),
        data: representativeUpdateSchema,
      })
    )
    .min(1, 'Pelo menos uma atualização deve ser fornecida')
    .max(50, 'Máximo de 50 atualizações por operação'),
});

export const representativeBatchDeleteSchema = z.object({
  ids: z
    .array(z.string().uuid('ID inválido'))
    .min(1, 'Pelo menos um ID deve ser fornecido')
    .max(50, 'Máximo de 50 exclusões por operação'),
});

// Representative row data schema (for inline editing/creation state management)
export const representativeRowDataSchema = z.object({
  id: z.string(),
  email: z.string().nullable().optional(),
  phone: z.string(),
  name: z.string(),
  role: z.nativeEnum(RepresentativeRole),
  isActive: z.boolean(),
  isEditing: z.boolean().optional(),
  isNew: z.boolean().optional(),
  isSaving: z.boolean().optional(),
  error: z.string().nullable().optional(),
});

// Type exports
export type RepresentativeCreateFormData = z.infer<typeof representativeCreateSchema>;
export type RepresentativeCreateInlineFormData = z.infer<typeof representativeCreateInlineSchema>;
export type RepresentativeUpdateFormData = z.infer<typeof representativeUpdateSchema>;
export type RepresentativeGetManyFormData = z.infer<typeof representativeGetManySchema>;
export type RepresentativeLoginFormData = z.infer<typeof representativeLoginSchema>;
export type RepresentativePasswordUpdateFormData = z.infer<typeof representativePasswordUpdateSchema>;
export type RepresentativeBatchCreateFormData = z.infer<typeof representativeBatchCreateSchema>;
export type RepresentativeBatchUpdateFormData = z.infer<typeof representativeBatchUpdateSchema>;
export type RepresentativeBatchDeleteFormData = z.infer<typeof representativeBatchDeleteSchema>;
export type RepresentativeRowDataFormData = z.infer<typeof representativeRowDataSchema>;