import { z } from "zod";

const dateLike = z.union([z.string(), z.date()]).transform((v) => (v instanceof Date ? v : new Date(v)));

export const absenceCreateSchema = z
  .object({
    userId: z.string().uuid({ message: "Selecione um colaborador" }),
    startDate: dateLike,
    endDate: dateLike,
    justificativaId: z.number().int().positive({ message: "Selecione uma justificativa" }),
    motivo: z.string().max(500, "Máximo 500 caracteres").optional().default(""),
  })
  .refine((d) => d.endDate >= d.startDate, {
    message: "A data final deve ser posterior ou igual à data inicial",
    path: ["endDate"],
  });

export const absenceUpdateSchema = absenceCreateSchema;

export const collectiveAbsenceSchema = z
  .object({
    userIds: z.array(z.string().uuid()).min(1, "Selecione pelo menos um colaborador"),
    startDate: dateLike,
    endDate: dateLike,
    justificativaId: z.number().int().positive({ message: "Selecione uma justificativa" }),
    motivo: z.string().max(500, "Máximo 500 caracteres").optional().default(""),
  })
  .refine((d) => d.endDate >= d.startDate, {
    message: "A data final deve ser posterior ou igual à data inicial",
    path: ["endDate"],
  });

export type AbsenceCreateFormData = z.infer<typeof absenceCreateSchema>;
export type AbsenceUpdateFormData = z.infer<typeof absenceUpdateSchema>;
export type CollectiveAbsenceFormData = z.infer<typeof collectiveAbsenceSchema>;
