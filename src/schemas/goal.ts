import { z } from "zod";
import { GOAL_METRIC, SECTOR_SCOPED_GOAL_METRICS } from "../constants";

const goalMetricEnum = z.nativeEnum(GOAL_METRIC, {
  errorMap: () => ({ message: "Métrica inválida" }),
});

const yearSchema = z.coerce.number().int().min(2000, "Ano inválido").max(2100, "Ano inválido");

const monthValueSchema = z.object({
  month: z.number().int().min(1).max(12),
  targetValue: z
    .union([
      z.coerce.number().nonnegative("Valor não pode ser negativo"),
      z.null(),
    ])
    .nullable(),
});

/**
 * Form schema for the "create/edit a metric row for a year" modal — the user
 * picks a metric, optionally a sector, and supplies up to 12 monthly target
 * values (each may be null to clear that month).
 */
export const goalRowFormSchema = z
  .object({
    metric: goalMetricEnum,
    year: yearSchema,
    sectorId: z.string().uuid().nullable().optional(),
    values: z.array(monthValueSchema).length(12, "Forneça os 12 meses"),
  })
  .superRefine((data, ctx) => {
    const requiresSector = (SECTOR_SCOPED_GOAL_METRICS as readonly string[]).includes(data.metric);
    if (requiresSector && !data.sectorId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sectorId"],
        message: "Selecione um setor",
      });
    }
    const allEmpty = data.values.every(v => v.targetValue === null || v.targetValue === undefined);
    if (allEmpty) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["values"],
        message: "Informe ao menos um valor de meta",
      });
    }
  });

export type GoalRowFormData = z.infer<typeof goalRowFormSchema>;
