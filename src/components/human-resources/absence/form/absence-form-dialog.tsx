import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { IconAlertTriangle, IconCalendar } from "@tabler/icons-react";
import { z } from "zod";

import { VACATION_JUSTIFICATIVA_ID, getJustificativaLabel } from "../../../../constants";
import type { SecullumAggregatedAbsence } from "../../../../types";
import { useSecullumCreateAbsenceForUsers, useSecullumUpdateAbsence } from "../../../../hooks";
import { stripGroupPrefix } from "../../../../types";

import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "@/components/ui/sonner";

import { COLLECTIVE_USER_ID, EmployeeSelect } from "./employee-select";

// Vacations-only form. Create flow hardcodes JustificativaId=2 (Férias);
// edits preserve whatever JustificativaId the record was created with so
// non-Férias records edited from the time-clock overview keep their type.
// The collective vacation mode is selected by picking the special
// COLLECTIVE_USER_ID entry from the employee combobox.
const absenceFormSchema = z
  .object({
    userId: z.string().min(1, { message: "Selecione um colaborador" }),
    startDate: z.union([z.string(), z.date()]).transform((v) => (v instanceof Date ? v : new Date(v))),
    endDate: z.union([z.string(), z.date()]).transform((v) => (v instanceof Date ? v : new Date(v))),
    motivo: z.string().max(500, "Máximo 500 caracteres").optional().default(""),
  })
  .refine((d) => d.endDate >= d.startDate, {
    message: "A data final deve ser posterior ou igual à data inicial",
    path: ["endDate"],
  });

type AbsenceFormInput = z.input<typeof absenceFormSchema>;

interface AbsenceFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // When provided, the dialog operates in edit mode.
  // Edit performs DELETE + POST against Secullum since there's no PUT endpoint.
  editing?: SecullumAggregatedAbsence | null;
}

export function AbsenceFormDialog({ open, onOpenChange, editing }: AbsenceFormDialogProps) {
  const isEdit = !!editing;
  const createForUsersMut = useSecullumCreateAbsenceForUsers();
  const updateMut = useSecullumUpdateAbsence();
  const [resultSummary, setResultSummary] = useState<string | null>(null);

  const form = useForm<AbsenceFormInput>({
    resolver: zodResolver(absenceFormSchema),
    defaultValues: {
      userId: "",
      startDate: new Date(),
      endDate: new Date(),
      motivo: "",
    },
  });

  const selectedUserId = form.watch("userId");
  const isCollective = selectedUserId === COLLECTIVE_USER_ID;

  useEffect(() => {
    if (!open) return;
    setResultSummary(null);
    if (isEdit && editing) {
      form.reset({
        userId: editing.userId,
        startDate: new Date(editing.Inicio),
        endDate: new Date(editing.Fim),
        motivo: stripGroupPrefix(editing.Motivo),
      });
    } else {
      form.reset({
        userId: "",
        startDate: new Date(),
        endDate: new Date(),
        motivo: "",
      });
    }
  }, [open, isEdit, editing?.Id]);

  const onSubmit = async (data: AbsenceFormInput) => {
    const startDate = data.startDate instanceof Date ? data.startDate : new Date(data.startDate);
    const endDate = data.endDate instanceof Date ? data.endDate : new Date(data.endDate);

    if (isEdit && editing) {
      try {
        await updateMut.mutateAsync({
          absenceId: editing.Id,
          original: {
            Id: editing.Id,
            Inicio: editing.Inicio,
            Fim: editing.Fim,
            JustificativaId: editing.JustificativaId,
            Motivo: editing.Motivo,
            FuncionarioId: editing.FuncionarioId,
          },
          next: {
            Inicio: format(startDate, "yyyy-MM-dd"),
            Fim: format(endDate, "yyyy-MM-dd"),
            JustificativaId: editing.JustificativaId,
            Motivo: data.motivo ?? "",
            FuncionarioId: editing.FuncionarioId,
          },
        });
        onOpenChange(false);
      } catch {
        // Error toast is emitted by the axios error interceptor.
      }
      return;
    }

    // Create flow — always Férias (JustificativaId=2). Server resolves userId → secullumEmployeeId,
    // or fans out to every active user with secullumEmployeeId when applyToAll=true.
    const useCollective = data.userId === COLLECTIVE_USER_ID;
    try {
      const response = await createForUsersMut.mutateAsync({
        ...(useCollective
          ? { applyToAll: true }
          : { userIds: [data.userId] }),
        Inicio: format(startDate, "yyyy-MM-dd"),
        Fim: format(endDate, "yyyy-MM-dd"),
        JustificativaId: VACATION_JUSTIFICATIVA_ID,
        Motivo: data.motivo ?? "",
      });
      const result = response?.data?.data ?? (response?.data as any)?.data ?? response?.data;
      const created: number = result?.created ?? 0;
      const failed: number = result?.failed ?? 0;
      if (created > 0 && failed === 0) {
        onOpenChange(false);
      } else if (created > 0 && failed > 0) {
        const failedNames = (result?.results ?? [])
          .filter((r: any) => !r.ok)
          .map((r: any) => r.userName)
          .slice(0, 5)
          .join(", ");
        toast.warning(`${created} criadas, ${failed} falharam: ${failedNames}${failed > 5 ? "..." : ""}`);
        setResultSummary(`${created} criadas, ${failed} falharam.`);
      } else {
        const firstError = (result?.results ?? []).find((r: any) => !r.ok)?.error;
        toast.error(firstError || "Nenhuma férias registrada.");
      }
    } catch {
      // Error toast is emitted by the axios error interceptor.
    }
  };

  const isSubmitting = createForUsersMut.isPending || updateMut.isPending;
  // For edits, mirror the record's actual justificativa (e.g. editing an
  // "Atestado Médico" via the time-clock overview shows that label).
  const editingLabel = isEdit && editing
    ? getJustificativaLabel(editing.JustificativaId, editing.JustificativaDescricao)
    : "Férias";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconCalendar className="h-5 w-5" />
            {isEdit ? `Editar ${editingLabel}` : "Adicionar Férias"}
          </DialogTitle>
          {isEdit && (
            <DialogDescription>
              <Alert className="mt-2 border-amber-500/40">
                <IconAlertTriangle className="h-4 w-4 text-amber-500" />
                <AlertDescription>
                  O Secullum não permite edição direta de afastamentos. Ao salvar, o registro original
                  será excluído e um novo será criado em seu lugar.
                </AlertDescription>
              </Alert>
            </DialogDescription>
          )}
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <EmployeeSelect
              control={form.control}
              required
              disabled={isEdit}
              allowCollective={!isEdit}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Início <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <DateTimeInput value={field.value as any} onChange={field.onChange} mode="date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Fim <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <DateTimeInput value={field.value as any} onChange={field.onChange} mode="date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="motivo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Motivo</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      rows={3}
                      placeholder="Observações adicionais..."
                      className="resize-none"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {resultSummary && (
              <Alert className="border-amber-500/40">
                <IconAlertTriangle className="h-4 w-4 text-amber-500" />
                <AlertDescription>{resultSummary}</AlertDescription>
              </Alert>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Salvando..." : isEdit ? "Atualizar" : isCollective ? "Criar para todos" : "Adicionar"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
