import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { IconAlertTriangle, IconCalendar } from "@tabler/icons-react";
import { z } from "zod";

import { getJustificativaLabel } from "../../../../constants";
import type { SecullumAggregatedAbsence } from "../../../../types";
import { useSecullumUpdateAbsence } from "../../../../hooks";
import { stripGroupPrefix } from "../../../../types";

import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { Alert, AlertDescription } from "@/components/ui/alert";

import { EmployeeSelect } from "./employee-select";

// EDIT-ONLY dialog over Secullum afastamentos (DELETE + POST, no PUT endpoint).
// The legacy Secullum-direct "Adicionar Férias" create path was retired — the
// DB-backed Férias module (Departamento Pessoal) is the only way to create
// vacations (it auto-mirrors to Secullum). Edits preserve whatever
// JustificativaId the record was created with, so non-Férias records edited
// from the time-clock overview keep their type.
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
  // The dialog only operates in edit mode over an existing Secullum record.
  // Edit performs DELETE + POST against Secullum since there's no PUT endpoint.
  editing: SecullumAggregatedAbsence | null;
}

export function AbsenceFormDialog({ open, onOpenChange, editing }: AbsenceFormDialogProps) {
  const updateMut = useSecullumUpdateAbsence();

  const form = useForm<AbsenceFormInput>({
    resolver: zodResolver(absenceFormSchema),
    defaultValues: {
      userId: "",
      startDate: new Date(),
      endDate: new Date(),
      motivo: "",
    },
  });

  useEffect(() => {
    if (!open || !editing) return;
    form.reset({
      userId: editing.userId,
      startDate: new Date(editing.Inicio),
      endDate: new Date(editing.Fim),
      motivo: stripGroupPrefix(editing.Motivo),
    });
  }, [open, editing?.Id]);

  const onSubmit = async (data: AbsenceFormInput) => {
    if (!editing) return;
    const startDate = data.startDate instanceof Date ? data.startDate : new Date(data.startDate);
    const endDate = data.endDate instanceof Date ? data.endDate : new Date(data.endDate);

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
  };

  const isSubmitting = updateMut.isPending;
  // Mirror the record's actual justificativa (e.g. editing an "Atestado Médico"
  // via the time-clock overview shows that label).
  const editingLabel = editing
    ? getJustificativaLabel(editing.JustificativaId, editing.JustificativaDescricao)
    : "Afastamento";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconCalendar className="h-5 w-5" />
            {`Editar ${editingLabel}`}
          </DialogTitle>
          <DialogDescription>
            <Alert className="mt-2 border-amber-500/40">
              <IconAlertTriangle className="h-4 w-4 text-amber-500" />
              <AlertDescription>
                O Secullum não permite edição direta de afastamentos. Ao salvar, o registro original
                será excluído e um novo será criado em seu lugar.
              </AlertDescription>
            </Alert>
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <EmployeeSelect
              control={form.control}
              required
              disabled
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
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Salvando..." : "Atualizar"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
