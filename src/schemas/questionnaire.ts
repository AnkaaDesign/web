// schemas/questionnaire.ts
//
// Zod schemas for the self-fill Questionnaire campaign domain. Mirrors the
// skill-assessment create/update schema conventions (api/src/schemas/skill.ts).
//
// Only the campaign create/update shapes are modelled here — the catalogue
// (group / question / options) and entry flows validate inline at their call
// sites. The `isAnonymous` flag toggles whether respondent identities are
// associated with the answers (default false).

import { z } from "zod";

export const questionnaireStatusSchema = z.enum(["DRAFT", "OPEN", "CLOSED", "CANCELLED"]);

export const questionnaireCreateSchema = z
  .object({
    name: z.string().min(1, "Nome é obrigatório").max(200),
    description: z.string().max(2000).nullable().optional(),
    periodStart: z.coerce.date(),
    periodEnd: z.coerce.date(),
    targetAllUsers: z.boolean().optional(),
    // When true, answers are NOT associated with any respondent — not even
    // administrators can see who answered what.
    isAnonymous: z.boolean().default(false),
    userIds: z.array(z.string().uuid()).optional(),
    questionIds: z.array(z.string().uuid()).optional(),
    groupIds: z.array(z.string().uuid()).optional(),
  })
  .refine((d) => d.periodEnd >= d.periodStart, {
    message: "Período final deve ser maior ou igual ao inicial",
    path: ["periodEnd"],
  });

export const questionnaireUpdateSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).nullable().optional(),
    periodStart: z.coerce.date().optional(),
    periodEnd: z.coerce.date().optional(),
    targetAllUsers: z.boolean().optional(),
    isAnonymous: z.boolean().optional(),
    userIds: z.array(z.string().uuid()).optional(),
    questionIds: z.array(z.string().uuid()).optional(),
    groupIds: z.array(z.string().uuid()).optional(),
  })
  .refine(
    (d) =>
      d.periodStart === undefined || d.periodEnd === undefined || d.periodEnd >= d.periodStart,
    { message: "Período final deve ser maior ou igual ao inicial", path: ["periodEnd"] },
  );

export type QuestionnaireCreateFormDataInferred = z.infer<typeof questionnaireCreateSchema>;
export type QuestionnaireUpdateFormDataInferred = z.infer<typeof questionnaireUpdateSchema>;
