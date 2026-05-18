import { z } from "zod";

export const manualMatchSchema = z
  .object({
    fiscalDocumentIds: z.array(z.string().uuid()).min(1, "Selecione ao menos uma nota fiscal"),
    allocations: z
      .array(
        z.object({
          fiscalDocumentId: z.string().uuid(),
          amount: z.number().positive("Valor alocado deve ser positivo"),
        }),
      )
      .optional(),
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
  file: z
    .instanceof(File)
    .refine(f => f.name.toLowerCase().endsWith(".ofx") || f.name.toLowerCase().endsWith(".qfx"), {
      message: "Apenas arquivos .ofx ou .qfx são aceitos",
    })
    .refine(f => f.size <= 10 * 1024 * 1024, { message: "Arquivo excede 10 MB" }),
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

export const rerunMatchingSchema = z
  .object({
    statementId: z.string().uuid().optional(),
    transactionIds: z.array(z.string().uuid()).optional(),
    dateStart: z.string().optional(),
    dateEnd: z.string().optional(),
  })
  .refine(d => d.statementId || d.transactionIds?.length || d.dateStart || d.dateEnd, {
    message: "Informe um escopo: extrato, transações selecionadas ou período",
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
