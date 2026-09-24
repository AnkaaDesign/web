// Corpos das ações da cotação da aerografia — espelha a API (src/schemas/airbrushing-quote.ts).

import { z } from "zod";

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

/** Seleção carrega só uma observação opcional. */
export const airbrushingQuoteNoteSchema = z.object({
  note: quoteNoteSchema,
});

export type AirbrushingQuoteCounterFormData = z.infer<typeof airbrushingQuoteCounterSchema>;
export type AirbrushingQuoteNoteFormData = z.infer<typeof airbrushingQuoteNoteSchema>;
