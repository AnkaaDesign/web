import { z } from 'zod';
import { ResponsibleRole, normalizeResponsibleRoles } from '@/types/responsible';

// Phone validation regex (Brazilian format)
const phoneRegex = /^(\+55\s?)?(\(?\d{2}\)?\s?)?(\d{4,5}[-.\s]?\d{4})$/;

// A contact can hold several roles at once (owner AND financial, say), so the
// API stores `roles` as an array. A bare scalar is accepted and wrapped: older
// callers and persisted form state still send `role`.
const rolesSchema = z.preprocess(
  value => (value === undefined || Array.isArray(value) ? value : [value]),
  z
    .array(
      z.nativeEnum(ResponsibleRole, {
        errorMap: () => ({ message: 'Função inválida' }),
      }),
    )
    .min(1, 'Selecione ao menos uma função')
    .transform(normalizeResponsibleRoles),
);

// Email validation.
//
// Obrigatório no cadastro: o e-mail é o canal da assinatura eletrônica de
// orçamento (convite + código de uso único). Um contato sem e-mail não
// consegue assinar, e o erro só apareceria no envio do orçamento.
const emailRequiredSchema = z
  .string()
  .min(1, 'E-mail é obrigatório')
  .email('E-mail inválido')
  .transform(value => value.trim().toLowerCase());

// Na atualização continua opcional: um PATCH parcial que não mexe no contato
// não deve ser obrigado a reenviar o e-mail. A obrigatoriedade de existir um
// e-mail é garantida na criação e pela API.
const emailSchema = z
  .string()
  .email('E-mail inválido')
  .optional()
  .or(z.literal(''));

// Password validation (min 6 chars when provided)
const passwordSchema = z
  .string()
  .min(6, 'Senha deve ter no mínimo 6 caracteres')
  .optional()
  .or(z.literal(''));

// Responsible create schema
export const responsibleCreateSchema = z.object({
  email: emailRequiredSchema,
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
  roles: rolesSchema,
  isActive: z
    .boolean()
    .optional()
    .default(true),
});

// Responsible inline create schema (companyId is optional for inline context).
// A senha continua opcional (o acesso ao sistema pode ser configurado depois),
// mas o e-mail não: sem ele o contato criado pela linha inline entra no
// cadastro já impedido de assinar orçamento.
export const responsibleCreateInlineSchema = z.object({
  email: emailRequiredSchema,
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
  roles: rolesSchema,
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
  roles: rolesSchema.optional(),
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
  // Any-of: the API maps this to Prisma `hasSome`. A bare scalar is wrapped so
  // `?roles=OWNER` and saved single-value filters both keep working.
  roles: z
    .preprocess(
      value => (value === undefined || Array.isArray(value) ? value : [value]),
      z.array(z.nativeEnum(ResponsibleRole)),
    )
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
