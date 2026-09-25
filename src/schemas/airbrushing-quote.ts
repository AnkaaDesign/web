// Corpos das ações da cotação da aerografia — espelha a API (src/schemas/airbrushing-quote.ts).

import { z } from "zod";
import { EXECUTION_TIME_UNIT } from "../constants";

/** Maior lance aceito: um teto de sanidade contra dígito a mais, não uma regra de negócio. */
export const MAX_AIRBRUSHING_QUOTE_AMOUNT = 1_000_000;

const quoteAmountSchema = z
  .number({
    required_error: "Informe o valor",
    invalid_type_error: "Informe o valor",
  })
  .finite("Valor inválido")
  .positive("O valor deve ser maior que zero")
  .max(MAX_AIRBRUSHING_QUOTE_AMOUNT, "Valor acima do permitido");

const quoteNoteSchema = z
  .string()
  .max(1000, "A observação deve ter no máximo 1000 caracteres")
  .nullable()
  .optional()
  .transform((value) => (typeof value === "string" ? value.trim() || null : null));

/** Contraproposta do comercial. */
export const airbrushingQuoteCounterSchema = z.object({
  amount: quoteAmountSchema,
  note: quoteNoteSchema,
});

/**
 * Contraproposta PARA TODOS (POST /airbrushing-quotes/airbrushing/:id/counter): novo valor,
 * novo tempo ou os dois. O que ficar vazio continua o de cada negociação.
 */
export const airbrushingQuoteCounterAllSchema = z
  .object({
    amount: quoteAmountSchema.nullable().optional(),
    executionTime: z
      .number({ invalid_type_error: "Tempo de execução inválido" })
      .int("Use um número inteiro")
      .min(1, "O tempo deve ser maior que zero")
      .max(999, "Tempo acima do permitido")
      .nullable()
      .optional(),
    executionTimeUnit: z.nativeEnum(EXECUTION_TIME_UNIT).nullable().optional(),
    note: quoteNoteSchema,
  })
  .superRefine((v, ctx) => {
    if (v.executionTime != null && v.executionTimeUnit == null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["executionTime"], message: "Informe se o tempo é em horas ou dias" });
    }
    if (v.amount == null && v.executionTime == null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["amount"], message: "Informe um novo valor, um novo tempo ou os dois" });
    }
  });

/** Seleção carrega só uma observação opcional. */
export const airbrushingQuoteNoteSchema = z.object({
  note: quoteNoteSchema,
});

export type AirbrushingQuoteCounterFormData = z.infer<typeof airbrushingQuoteCounterSchema>;
export type AirbrushingQuoteCounterAllFormData = z.infer<typeof airbrushingQuoteCounterAllSchema>;
export type AirbrushingQuoteNoteFormData = z.infer<typeof airbrushingQuoteNoteSchema>;
