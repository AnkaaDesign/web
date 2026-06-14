import { useEffect, useRef, useState } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { IconClipboardCheck, IconLoader2, IconPaperclip, IconX } from "@tabler/icons-react";

import { MEDICAL_EXAM_RESULT, MEDICAL_EXAM_RESULT_LABELS, MEDICAL_EXAM_TYPE } from "../../../../constants";
import { medicalExamCompleteSchema, type MedicalExamCompleteFormData } from "@/schemas/medical-exam";
import { useCompleteMedicalExam, useUploadMedicalExamDocument } from "@/hooks/occupational-health/use-medical-exams";
import type { MedicalExam } from "@/types/medical-exam";

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DateTimeInput } from "@/components/ui/date-time-input";

interface MedicalExamCompleteDialogProps {
  exam: MedicalExam | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCompleted?: () => void;
}

const resultOptions = [
  { value: MEDICAL_EXAM_RESULT.FIT, label: MEDICAL_EXAM_RESULT_LABELS[MEDICAL_EXAM_RESULT.FIT] },
  { value: MEDICAL_EXAM_RESULT.FIT_WITH_RESTRICTIONS, label: MEDICAL_EXAM_RESULT_LABELS[MEDICAL_EXAM_RESULT.FIT_WITH_RESTRICTIONS] },
  { value: MEDICAL_EXAM_RESULT.UNFIT, label: MEDICAL_EXAM_RESULT_LABELS[MEDICAL_EXAM_RESULT.UNFIT] },
];

/** Soma `months` meses a uma data (validade do ASO periódico: 12 ou 24 meses). */
function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

export function MedicalExamCompleteDialog({ exam, open, onOpenChange, onCompleted }: MedicalExamCompleteDialogProps) {
  const completeMutation = useCompleteMedicalExam();
  const uploadMutation = useUploadMedicalExamDocument();
  const asoInputRef = useRef<HTMLInputElement>(null);
  const [asoFile, setAsoFile] = useState<File | null>(null);

  const form = useForm<MedicalExamCompleteFormData>({
    resolver: zodResolver(medicalExamCompleteSchema),
    defaultValues: {
      examDate: new Date(),
      result: "" as any,
      restrictions: "",
      periodicityMonths: null,
      expiresAt: null,
      physicianName: exam?.physicianName ?? "",
      crm: exam?.crm ?? "",
      clinic: exam?.clinic ?? "",
    },
  });

  // Re-prefill when the dialog opens for a (new) exam
  useEffect(() => {
    if (open && exam) {
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
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, exam?.id]);

  const isSubmitting = completeMutation.isPending || uploadMutation.isPending;

  const selectedResult = form.watch("result");
  const requiresRestrictions = selectedResult === MEDICAL_EXAM_RESULT.FIT_WITH_RESTRICTIONS;
  const isPeriodic = exam?.type === MEDICAL_EXAM_TYPE.PERIODIC;

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

      onOpenChange(false);
      onCompleted?.();
    } catch (error) {
      // Error is handled by the API client with detailed message
      if (process.env.NODE_ENV !== "production") {
        console.error("Error completing medical exam:", error);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !isSubmitting && onOpenChange(value)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconClipboardCheck className="h-5 w-5 text-muted-foreground" />
            Concluir Exame
          </DialogTitle>
          <DialogDescription>
            Registre o resultado do exame{exam?.user?.name ? ` de ${exam.user.name}` : ""}. O exame será marcado como realizado.
          </DialogDescription>
        </DialogHeader>

        <FormProvider {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="examDate"
                render={({ field }) => (
                  <DateTimeInput field={field as any} label="Data do Exame" mode="date" disabled={isSubmitting} required />
                )}
              />

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
                        disabled={isSubmitting}
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
                        disabled={isSubmitting}
                        rows={3}
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
                        disabled={isSubmitting}
                      />
                    </FormControl>
                    <FormDescription>Define quando o próximo exame periódico será agendado automaticamente.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="expiresAt"
              render={({ field }) => (
                <FormItem>
                  <DateTimeInput field={field as any} label="Validade" mode="date" disabled={isSubmitting} />
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => applyExpiresPreset(12)} disabled={isSubmitting}>
                      +12 meses
                    </Button>
                    <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => applyExpiresPreset(24)} disabled={isSubmitting}>
                      +24 meses
                    </Button>
                  </div>
                  <FormDescription>Periódico: 12 meses (exposição a risco) ou 24 meses, a partir da data do exame</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* ASO document (optional) — uploaded right after completion */}
            <div className="space-y-2">
              <span className="text-sm font-medium">Documento ASO</span>
              <input ref={asoInputRef} type="file" className="hidden" accept="application/pdf,image/*" onChange={handleAsoFileSelected} />
              {asoFile ? (
                <div className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
                  <IconPaperclip className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">{asoFile.name}</span>
                  <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setAsoFile(null)} disabled={isSubmitting}>
                    <IconX className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Button type="button" variant="outline" size="sm" onClick={() => asoInputRef.current?.click()} disabled={isSubmitting}>
                  <IconPaperclip className="h-4 w-4 mr-1" />
                  Anexar ASO
                </Button>
              )}
              <p className="text-xs text-muted-foreground">Opcional — o ASO também pode ser anexado depois, na página do exame.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="physicianName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Médico</FormLabel>
                    <FormControl>
                      <Input
                        value={field.value ?? ""}
                        onChange={(value) => field.onChange(value === null ? "" : String(value))}
                        placeholder="Nome do médico"
                        disabled={isSubmitting}
                        maxLength={200}
                      />
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
                      <Input
                        value={field.value ?? ""}
                        onChange={(value) => field.onChange(value === null ? "" : String(value))}
                        placeholder="CRM do médico"
                        disabled={isSubmitting}
                        maxLength={50}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="clinic"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Clínica</FormLabel>
                  <FormControl>
                    <Input
                      value={field.value ?? ""}
                      onChange={(value) => field.onChange(value === null ? "" : String(value))}
                      placeholder="Nome da clínica"
                      disabled={isSubmitting}
                      maxLength={200}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <IconLoader2 className="h-4 w-4 mr-2 animate-spin" /> : <IconClipboardCheck className="h-4 w-4 mr-2" />}
                Concluir Exame
              </Button>
            </DialogFooter>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}
