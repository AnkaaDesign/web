import { z } from "zod";

export const manualMatchSchema = z
  .object({
    fiscalDocumentIds: z.array(z.string().uuid()).min(1, "Selecione ao menos uma nota fiscal"),
    allocations: z
      .array(
        z.object({
          fiscalDocumentId: z.string().uuid(),
          amount: z.number().positive("Valor alocado deve ser positivo"),
          // Signed per-note settlement adjustment (paid vs note total), with a
          // reason. POSITIVE = paid LESS (discount) → unpaid slice written off;
          // NEGATIVE = paid MORE (frete/seguro on top) → surcharge. Note settled
          // when amount + adjustmentAmount ≈ note total.
          adjustmentAmount: z.number().optional(),
          adjustmentReason: z
            .enum(["DESCONTO", "FRETE", "GARANTIA_ESTENDIDA", "SEGURO", "TAXAS", "OUTROS"])
            .optional(),
        }),
      )
      .optional(),
    // Resolve the non-NF remainder of the payment (marketplace frete/seguro/
    // taxas) WITHOUT a category — just a reason. Marks the tx RECONCILED and
    // is appended to the notes. Omit to leave the remainder open (→ Parcial).
    remainderReason: z.enum(["FRETE", "SEGURO", "TAXAS", "OUTROS"]).optional(),
    notes: z.string().max(500).optional(),
  })
  .refine(
    data => {
      if (!data.allocations) return true;
      return data.allocations.every(a => data.fiscalDocumentIds.includes(a.fiscalDocumentId));
    },
    { message: "Alocações devem referenciar apenas documentos selecionados" },
  );

export type ManualMatchPayload = z.infer<typeof manualMatchSchema>;

export const ignoreReasonSchema = z.object({
  reason: z.string().min(10, "Mínimo 10 caracteres").max(500),
});

export type IgnoreReasonPayload = z.infer<typeof ignoreReasonSchema>;

export const ofxImportSchema = z.object({
  files: z
    .array(z.instanceof(File))
    .min(1, "Selecione ao menos um arquivo")
    .refine(
      files =>
        files.every(f => {
          const n = f.name.toLowerCase();
          return n.endsWith(".ofx") || n.endsWith(".qfx") || n.endsWith(".zip");
        }),
      { message: "Apenas arquivos .ofx, .qfx ou .zip são aceitos" },
    ),
});

export const xmlImportSchema = z.object({
  files: z
    .array(z.instanceof(File))
    .min(1, "Selecione ao menos um arquivo")
    .refine(
      files =>
        files.every(f => {
          const n = f.name.toLowerCase();
          return n.endsWith(".xml") || n.endsWith(".zip");
        }),
      { message: "Apenas arquivos .xml ou .zip são aceitos" },
    ),
});

export const rerunMatchingSchema = z.object({
  statementId: z.string().uuid().optional(),
  transactionIds: z.array(z.string().uuid()).optional(),
  dateStart: z.string().optional(),
  dateEnd: z.string().optional(),
  // Omit all fields to re-run against ALL PENDING NF transactions.
  runAll: z.boolean().optional(),
});

export type RerunMatchingPayload = z.infer<typeof rerunMatchingSchema>;

export const siegFetchSchema = z.object({
  dateStart: z.string(),
  dateEnd: z.string(),
  xmlType: z.enum(["NFE", "NFSE", "CTE", "NFCE", "CFE"]).optional(),
  cnpjEmit: z
    .string()
    .regex(/^\d{14}$/, "CNPJ deve conter 14 dígitos")
    .optional(),
  cnpjDest: z
    .string()
    .regex(/^\d{14}$/, "CNPJ deve conter 14 dígitos")
    .optional(),
});

export type SiegFetchPayload = z.infer<typeof siegFetchSchema>;
