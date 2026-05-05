import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { IconAlertTriangle, IconCalendar, IconUsers } from "@tabler/icons-react";
import { z } from "zod";

import type { SecullumJustificativaCategory } from "../../../../constants";
import type { SecullumAggregatedAbsence } from "../../../../types";
import { useSecullumCreateAbsenceForUsers, useSecullumUpdateAbsence } from "../../../../hooks";
import { stripGroupPrefix } from "../../../../types";

import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/sonner";

import { EmployeeSelect } from "./employee-select";
import { JustificationSelect } from "./justification-select";

// Schema accepts either a single userId OR collective mode (applies to all).
const absenceFormSchema = z
  .object({
    userId: z.string().optional(),
    isCollective: z.boolean().default(false),
    startDate: z.union([z.string(), z.date()]).transform((v) => (v instanceof Date ? v : new Date(v))),
    endDate: z.union([z.string(), z.date()]).transform((v) => (v instanceof Date ? v : new Date(v))),
    justificativaId: z
      .number({ invalid_type_error: "Selecione uma justificativa" })
      .int()
      .positive({ message: "Selecione uma justificativa" }),
    motivo: z.string().max(500, "Máximo 500 caracteres").optional().default(""),
  })
  .refine((d) => d.endDate >= d.startDate, {
    message: "A data final deve ser posterior ou igual à data inicial",
    path: ["endDate"],
  })
  .refine((d) => d.isCollective || (d.userId && d.userId.length > 0), {
    message: "Selecione um colaborador",
    path: ["userId"],
  });

// Schema input type (pre-transform), used by useForm so defaults can include
// dates as Date objects without TS type fights.
type AbsenceFormInput = z.input<typeof absenceFormSchema>;

interface AbsenceFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: SecullumJustificativaCategory;
  // When provided, the dialog operates in edit mode.
  // Edit performs DELETE + POST against Secullum since there's no PUT endpoint.
  editing?: SecullumAggregatedAbsence | null;
}

export function AbsenceFormDialog({ open, onOpenChange, category, editing }: AbsenceFormDialogProps) {
  const isEdit = !!editing;
  const createForUsersMut = useSecullumCreateAbsenceForUsers();
  const updateMut = useSecullumUpdateAbsence();
  const [resultSummary, setResultSummary] = useState<string | null>(null);

  const form = useForm<AbsenceFormInput>({
    resolver: zodResolver(absenceFormSchema),
    defaultValues: {
      userId: "",
      isCollective: false,
      startDate: new Date(),
      endDate: new Date(),
      // Cast: form starts unfilled; refine triggers a clear validation message
      // if the user submits without picking a justification.
      justificativaId: undefined as unknown as number,
      motivo: "",
    },
  });

  const isCollective = form.watch("isCollective");

  // When user toggles collective ON, clear userId so the validation refine
  // doesn't mistakenly retain a stale selection from a previous open.
  useEffect(() => {
    if (isCollective) {
      form.setValue("userId", "", { shouldValidate: false });
    }
  }, [isCollective, form]);

  useEffect(() => {
    if (!open) return;
    setResultSummary(null);
    if (isEdit && editing) {
      form.reset({
        userId: editing.userId,
        isCollective: false,
        startDate: new Date(editing.Inicio),
        endDate: new Date(editing.Fim),
        justificativaId: editing.JustificativaId,
        motivo: stripGroupPrefix(editing.Motivo),
      });
    } else {
      form.reset({
        userId: "",
        isCollective: false,
        startDate: new Date(),
        endDate: new Date(),
        justificativaId: undefined as unknown as number,
        motivo: "",
      });
    }
  }, [open, isEdit, editing?.Id]);

  const onSubmit = async (data: AbsenceFormInput) => {
    // Schema's transform converts strings → Dates; the input type still says
    // string|Date, so re-coerce here defensively.
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
            JustificativaId: data.justificativaId as number,
            Motivo: data.motivo ?? "",
            FuncionarioId: editing.FuncionarioId,
          },
        });
        toast.success("Afastamento atualizado");
        onOpenChange(false);
      } catch (err: any) {
        toast.error(err?.response?.data?.message || "Falha ao atualizar afastamento");
      }
      return;
    }

    // Create flow — server resolves userId → secullumEmployeeId.
    try {
      const response = await createForUsersMut.mutateAsync({
        ...(data.isCollective
          ? { applyToAll: true }
          : { userIds: [data.userId as string] }),
        Inicio: format(startDate, "yyyy-MM-dd"),
        Fim: format(endDate, "yyyy-MM-dd"),
        JustificativaId: data.justificativaId as number,
        Motivo: data.motivo ?? "",
      });
      const result = response?.data?.data ?? (response?.data as any)?.data ?? response?.data;
      const created: number = result?.created ?? 0;
      const failed: number = result?.failed ?? 0;
      if (created > 0 && failed === 0) {
        toast.success(
          created === 1 ? "Afastamento criado" : `${created} afastamentos criados`,
        );
        onOpenChange(false);
      } else if (created > 0 && failed > 0) {
        const failedNames = (result?.results ?? [])
          .filter((r: any) => !r.ok)
          .map((r: any) => r.userName)
          .slice(0, 5)
          .join(", ");
        toast.warning(`${created} criados, ${failed} falharam: ${failedNames}${failed > 5 ? "..." : ""}`);
        setResultSummary(`${created} criados, ${failed} falharam.`);
      } else {
        const firstError = (result?.results ?? []).find((r: any) => !r.ok)?.error;
        toast.error(firstError || "Nenhum afastamento criado.");
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Falha ao criar afastamento");
    }
  };

  const isSubmitting = createForUsersMut.isPending || updateMut.isPending;
  const allowCollective = !isEdit && category === "AUSENCIA";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconCalendar className="h-5 w-5" />
            {isEdit ? "Editar" : "Adicionar"} {category === "AUSENCIA" ? "Ausência" : "Falta"}
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
            {allowCollective && (
              <FormField
                control={form.control}
                name="isCollective"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel className="flex items-center gap-2 m-0">
                        <IconUsers className="h-4 w-4" />
                        Ausência Coletiva
                      </FormLabel>
                      <p className="text-xs text-muted-foreground">
                        {field.value
                          ? "Aplicar a todos os colaboradores ativos vinculados ao Secullum."
                          : "Aplicar apenas ao colaborador selecionado."}
                      </p>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
            )}

            {!isCollective && <EmployeeSelect control={form.control} required disabled={isEdit} />}

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Início *</FormLabel>
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
                    <FormLabel>Fim *</FormLabel>
                    <FormControl>
                      <DateTimeInput value={field.value as any} onChange={field.onChange} mode="date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <JustificationSelect control={form.control} category={category} required />
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
