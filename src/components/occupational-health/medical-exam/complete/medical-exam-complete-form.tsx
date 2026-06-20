// medical-exam-complete-form.tsx
// Corpo do formulário de CONCLUSÃO do ASO (data, resultado, médico, CRM, clínica,
// validade, restrições, anexo). Possui o próprio FormProvider, então funciona
// tanto dentro do dialog (Medicina do Trabalho) quanto INLINE (página da
// admissão/rescisão). A data usa DateTimeInput (digitável ou pelo calendário).

import { useEffect, useRef, useState } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { IconClipboardCheck, IconLoader2, IconPaperclip, IconX } from "@tabler/icons-react";

import { MEDICAL_EXAM_RESULT, MEDICAL_EXAM_RESULT_LABELS, MEDICAL_EXAM_TYPE } from "../../../../constants";
import { medicalExamCompleteSchema, type MedicalExamCompleteFormData } from "@/schemas/medical-exam";
import { useCompleteMedicalExam, useUploadMedicalExamDocument } from "@/hooks/occupational-health/use-medical-exams";
import type { MedicalExam } from "@/types/medical-exam";

import { Button } from "@/components/ui/button";
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { cn } from "@/lib/utils";

interface MedicalExamCompleteFormProps {
  exam: MedicalExam | null;
  onCompleted?: () => void;
  /** Quando fornecido, renderiza um botão "Cancelar" (usado no dialog). */
  onCancel?: () => void;
  /** Desabilita as ações (ex.: processo cancelado/concluído). */
  disabled?: boolean;
  className?: string;
}

const allResultOptions = [
  { value: MEDICAL_EXAM_RESULT.FIT, label: MEDICAL_EXAM_RESULT_LABELS[MEDICAL_EXAM_RESULT.FIT] },
  { value: MEDICAL_EXAM_RESULT.FIT_WITH_RESTRICTIONS, label: MEDICAL_EXAM_RESULT_LABELS[MEDICAL_EXAM_RESULT.FIT_WITH_RESTRICTIONS] },
  { value: MEDICAL_EXAM_RESULT.UNFIT, label: MEDICAL_EXAM_RESULT_LABELS[MEDICAL_EXAM_RESULT.UNFIT] },
];

// O ASO demissional apenas atesta se, no desligamento, o colaborador está
// Apto ou Inapto (este último pode indicar doença ocupacional / estabilidade).
// "Apto com restrições" não se aplica a quem está saindo.
const dismissalResultOptions = allResultOptions.filter((option) => option.value !== MEDICAL_EXAM_RESULT.FIT_WITH_RESTRICTIONS);

/** Soma `months` meses a uma data (validade do ASO periódico: 12 ou 24 meses). */
function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

export function MedicalExamCompleteForm({ exam, onCompleted, onCancel, disabled, className }: MedicalExamCompleteFormProps) {
  const completeMutation = useCompleteMedicalExam();
  const uploadMutation = useUploadMedicalExamDocument();
  const asoInputRef = useRef<HTMLInputElement>(null);
  const [asoFile, setAsoFile] = useState<File | null>(null);

  const form = useForm<MedicalExamCompleteFormData>({
    resolver: zodResolver(medicalExamCompleteSchema),
    defaultValues: {
      examDate: exam?.examDate ? new Date(exam.examDate) : exam?.scheduledAt ? new Date(exam.scheduledAt) : new Date(),
      result: "" as any,
      restrictions: exam?.restrictions ?? "",
      periodicityMonths: exam?.periodicityMonths ?? null,
      expiresAt: exam?.expiresAt ? new Date(exam.expiresAt) : null,
      physicianName: exam?.physicianName ?? "",
      crm: exam?.crm ?? "",
      clinic: exam?.clinic ?? "",
    },
  });

  // Re-prefill when the target exam changes.
  useEffect(() => {
    if (!exam) return;
    form.reset({
      examDate: exam.examDate ? new Date(exam.examDate) : exam.scheduledAt ? new Date(exam.scheduledAt) : new Date(),
      result: "" as any,
      restrictions: exam.restrictions ?? "",
      periodicityMonths: exam.periodicityMonths ?? null,
      expiresAt: exam.expiresAt ? new Date(exam.expiresAt) : null,
      physicianName: exam.physicianName ?? "",
      crm: exam.crm ?? "",
      clinic: exam.clinic ?? "",
    });
    setAsoFile(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exam?.id]);

  const isSubmitting = completeMutation.isPending || uploadMutation.isPending;
  const busy = isSubmitting || !!disabled;

  const selectedResult = form.watch("result");
  const requiresRestrictions = selectedResult === MEDICAL_EXAM_RESULT.FIT_WITH_RESTRICTIONS;
  const isPeriodic = exam?.type === MEDICAL_EXAM_TYPE.PERIODIC;
  // ASO demissional não tem validade (é um atestado pontual no desligamento) e
  // só admite Apto/Inapto como resultado.
  const isDismissal = exam?.type === MEDICAL_EXAM_TYPE.DISMISSAL;
  const resultOptions = isDismissal ? dismissalResultOptions : allResultOptions;

  /**
   * Validade = data do exame + 12/24 meses. Também grava a periodicidade (em meses)
   * para que o próximo periódico seja agendado automaticamente pelo backend.
   */
  const applyExpiresPreset = (months: number) => {
    const baseDate = form.getValues("examDate");
    form.setValue("expiresAt", addMonths(baseDate ? new Date(baseDate) : new Date(), months), { shouldDirty: true });
    if (isPeriodic) {
      form.setValue("periodicityMonths", months, { shouldDirty: true });
    }
  };

  const handleAsoFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) setAsoFile(file);
  };

  const handleSubmit = async (data: MedicalExamCompleteFormData) => {
    if (!exam) return;

    // Restrições são obrigatórias quando o resultado é "Apto com restrições".
    if (data.result === MEDICAL_EXAM_RESULT.FIT_WITH_RESTRICTIONS && !data.restrictions?.trim()) {
      form.setError("restrictions", { type: "manual", message: "Descreva as restrições para o resultado 'Apto com restrições'" });
      return;
    }

    try {
      await completeMutation.mutateAsync({
        id: exam.id,
        data: {
          ...data,
          restrictions: data.result === MEDICAL_EXAM_RESULT.FIT_WITH_RESTRICTIONS ? data.restrictions?.trim() || null : null,
          periodicityMonths: isPeriodic ? data.periodicityMonths ?? null : null,
          physicianName: data.physicianName || null,
          crm: data.crm || null,
          clinic: data.clinic || null,
        },
      });

      // Attach the ASO document after completing — the server links the file
      // and (for DISMISSAL exams) syncs the termination's DISMISSAL_EXAM doc.
      if (asoFile) {
        await uploadMutation.mutateAsync({ id: exam.id, file: asoFile });
      }

      onCompleted?.();
    } catch (error) {
      // Error is handled by the API client with detailed message
      if (process.env.NODE_ENV !== "production") {
        console.error("Error completing medical exam:", error);
      }
    }
  };

  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className={cn("space-y-4", className)}>
        {/* Data do Exame | Validade (lado a lado). O ASO demissional não tem
            validade, então a data ocupa a linha inteira nesse caso. */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField control={form.control} name="examDate" render={({ field }) => <DateTimeInput field={field as any} label="Data do Exame" mode="date" disabled={busy} required />} />

          {!isDismissal && (
            <FormField
              control={form.control}
              name="expiresAt"
              render={({ field }) => (
                <FormItem>
                  <DateTimeInput field={field as any} label="Validade (opcional)" mode="date" disabled={busy} />
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => applyExpiresPreset(12)} disabled={busy}>
                      +12 meses
                    </Button>
                    <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => applyExpiresPreset(24)} disabled={busy}>
                      +24 meses
                    </Button>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </div>

        {/* Resultado | Anexar ASO (na mesma linha) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="result"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Resultado <span className="text-destructive">*</span>
                </FormLabel>
                <FormControl>
                  <Combobox
                    mode="single"
                    value={field.value}
                    onValueChange={field.onChange}
                    options={resultOptions}
                    disabled={busy}
                    placeholder="Selecione o resultado"
                    emptyText="Nenhum resultado encontrado"
                    searchable={false}
                    clearable={false}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormItem>
            <FormLabel>Documento ASO (opcional)</FormLabel>
            <input ref={asoInputRef} type="file" className="hidden" accept="application/pdf,image/*" onChange={handleAsoFileSelected} />
            {asoFile ? (
              <div className="flex h-9 items-center gap-2 rounded-md border border-border px-3 text-sm">
                <IconPaperclip className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">{asoFile.name}</span>
                <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setAsoFile(null)} disabled={busy}>
                  <IconX className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button type="button" variant="outline" onClick={() => asoInputRef.current?.click()} disabled={busy} className="w-full justify-start font-normal">
                <IconPaperclip className="h-4 w-4 mr-2" />
                Anexar ASO
              </Button>
            )}
          </FormItem>
        </div>

        {/* Restrições — obrigatórias quando "Apto com restrições" */}
        {requiresRestrictions && (
          <FormField
            control={form.control}
            name="restrictions"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Restrições <span className="text-destructive">*</span>
                </FormLabel>
                <FormControl>
                  <Textarea
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    name={field.name}
                    placeholder="Descreva as restrições (ex.: não operar máquinas, evitar esforço físico...)"
                    disabled={busy}
                    rows={2}
                    className="resize-none"
                    maxLength={2000}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {/* Periodicidade do próximo exame (apenas para periódicos) */}
        {isPeriodic && (
          <FormField
            control={form.control}
            name="periodicityMonths"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Periodicidade do próximo exame (meses)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={1}
                    max={120}
                    value={field.value ?? ""}
                    onChange={(value) => {
                      const num = value === null || value === "" ? null : Number(value);
                      field.onChange(num !== null && !Number.isNaN(num) ? num : null);
                    }}
                    placeholder="12 (risco) ou 24"
                    disabled={busy}
                  />
                </FormControl>
                <FormDescription>Define quando o próximo exame periódico será agendado automaticamente.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {/* Médico | CRM */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="physicianName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Médico(a)</FormLabel>
                <FormControl>
                  <Input value={field.value ?? ""} onChange={(value) => field.onChange(value === null ? "" : String(value))} placeholder="Nome do(a) médico(a)" disabled={busy} maxLength={200} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="crm"
            render={({ field }) => (
              <FormItem>
                <FormLabel>CRM</FormLabel>
                <FormControl>
                  <Input value={field.value ?? ""} onChange={(value) => field.onChange(value === null ? "" : String(value))} placeholder="CRM do médico" disabled={busy} maxLength={50} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Clínica */}
        <FormField
          control={form.control}
          name="clinic"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Clínica</FormLabel>
              <FormControl>
                <Input value={field.value ?? ""} onChange={(value) => field.onChange(value === null ? "" : String(value))} placeholder="Nome da clínica" disabled={busy} maxLength={200} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
              Cancelar
            </Button>
          )}
          <Button type="submit" disabled={busy}>
            {isSubmitting ? <IconLoader2 className="h-4 w-4 mr-2 animate-spin" /> : <IconClipboardCheck className="h-4 w-4 mr-2" />}
            Concluir Exame
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}
