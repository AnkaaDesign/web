import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useTaskBatchMutations } from "../../../../hooks/useTask";
import { useSectors } from "../../../../hooks/useSector";
import { usePaints } from "../../../../hooks/usePaint";
import { TASK_STATUS, TASK_STATUS_LABELS } from "../../../../constants";
import { IconLoader2 } from "@tabler/icons-react";
import type { Task } from "../../../../types";

// Schema for batch edit
const batchEditSchema = z.object({
  // Fields to update
  status: z.enum(Object.values(TASK_STATUS) as [string, ...string[]]).optional(),
  sectorId: z.string().uuid().optional().nullable(),
  paintId: z.string().uuid().optional().nullable(),
  term: z.date().optional().nullable(),
  // Flags for which fields to update
  updateStatus: z.boolean().default(false),
  updateSector: z.boolean().default(false),
  updatePaint: z.boolean().default(false),
  updateTerm: z.boolean().default(false),
});

type BatchEditFormData = z.infer<typeof batchEditSchema>;

interface TaskBatchEditModalProps {
  tasks: Task[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export const TaskBatchEditModal = ({ tasks, open, onOpenChange, onSuccess }: TaskBatchEditModalProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { batchUpdateAsync } = useTaskBatchMutations();

  const { data: sectors } = useSectors({
    orderBy: { name: "asc" },
  });

  const { data: paints } = usePaints({
    orderBy: { name: "asc" },
  });

  const form = useForm<BatchEditFormData>({
    resolver: zodResolver(batchEditSchema),
    defaultValues: {
      updateStatus: false,
      updateSector: false,
      updatePaint: false,
      updateTerm: false,
      updateCommission: false,
    },
  });

  const handleSubmit = async (data: BatchEditFormData) => {
    try {
      setIsSubmitting(true);

      // Build update data based on flags
      const updateData: any = {};

      if (data.updateStatus && data.status) {
        updateData.status = data.status;
      }
      if (data.updateSector) {
        updateData.sectorId = data.sectorId;
      }
      if (data.updatePaint) {
        updateData.paintId = data.paintId;
      }
      if (data.updateTerm) {
        updateData.term = data.term;
      }

      // Prepare batch update
      const batchData = {
        tasks: tasks.map((task) => ({
          id: task.id,
          data: updateData,
        })),
      };

      const result = await batchUpdateAsync(batchData);

      if (result.success) {
        onOpenChange(false);
        onSuccess?.();
      }
    } catch (error) {
      console.error("Error updating tasks:", error);
      // Error is handled by the mutation hook
    } finally {
      setIsSubmitting(false);
    }
  };

  const watchUpdateStatus = form.watch("updateStatus");
  const watchUpdateSector = form.watch("updateSector");
  const watchUpdatePaint = form.watch("updatePaint");
  const watchUpdateTerm = form.watch("updateTerm");
  const watchUpdateCommission = form.watch("updateCommission");

  // Check if tasks can be batch edited based on their status
  const canEdit = tasks.every((task) => task.status !== TASK_STATUS.COMPLETED && task.status !== TASK_STATUS.CANCELLED);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Editar Tarefas em Lote</DialogTitle>
          <DialogDescription>
            Editando {tasks.length} tarefa{tasks.length > 1 ? "s" : ""}. Marque os campos que deseja atualizar.
          </DialogDescription>
        </DialogHeader>

        {!canEdit && (
          <div className="bg-destructive/10 text-destructive p-4 rounded-lg">
            <p className="text-sm">Algumas tarefas selecionadas estão finalizadas ou canceladas e não podem ser editadas.</p>
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="flex-1 min-h-0 overflow-y-auto">
            <div className="space-y-6 px-1">
              {/* Status */}
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <FormField
                    control={form.control}
                    name="updateStatus"
                    render={({ field }) => (
                      <FormItem className="flex items-center space-x-2">
                        <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} disabled={!canEdit || isSubmitting} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormLabel className="font-medium">Status</FormLabel>
                </div>

                {watchUpdateStatus && (
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Combobox
                            value={field.value}
                            onValueChange={field.onChange}
                            options={Object.entries(TASK_STATUS_LABELS).map(
                              ([value, label]): ComboboxOption => ({
                                value,
                                label: label as string,
                              }),
                            )}
                            placeholder="Selecione o status"
                            disabled={isSubmitting}
                            searchable={false}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>

              {/* Sector */}
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <FormField
                    control={form.control}
                    name="updateSector"
                    render={({ field }) => (
                      <FormItem className="flex items-center space-x-2">
                        <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} disabled={!canEdit || isSubmitting} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormLabel className="font-medium">Setor</FormLabel>
                </div>

                {watchUpdateSector && (
                  <FormField
                    control={form.control}
                    name="sectorId"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Combobox
                            value={field.value || undefined}
                            onValueChange={(value) => field.onChange(value || null)}
                            options={[
                              { value: "", label: "Nenhum" },
                              ...(sectors?.data?.map(
                                (sector): ComboboxOption => ({
                                  value: sector.id,
                                  label: sector.name,
                                }),
                              ) || []),
                            ]}
                            placeholder="Selecione o setor"
                            disabled={isSubmitting}
                            searchable={sectors?.data && sectors.data.length > 10}
                            clearable
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>

              {/* Paint */}
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <FormField
                    control={form.control}
                    name="updatePaint"
                    render={({ field }) => (
                      <FormItem className="flex items-center space-x-2">
                        <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} disabled={!canEdit || isSubmitting} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormLabel className="font-medium">Tinta</FormLabel>
                </div>

                {watchUpdatePaint && (
                  <FormField
                    control={form.control}
                    name="paintId"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Combobox
                            value={field.value || undefined}
                            onValueChange={(value) => field.onChange(value || null)}
                            options={[
                              { value: "", label: "Nenhuma" },
                              ...(paints?.data?.map(
                                (paint): ComboboxOption => ({
                                  value: paint.id,
                                  label: paint.name,
                                }),
                              ) || []),
                            ]}
                            placeholder="Selecione a tinta"
                            disabled={isSubmitting}
                            searchable={paints?.data && paints.data.length > 10}
                            clearable
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>

              {/* Term */}
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <FormField
                    control={form.control}
                    name="updateTerm"
                    render={({ field }) => (
                      <FormItem className="flex items-center space-x-2">
                        <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} disabled={!canEdit || isSubmitting} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormLabel className="font-medium">Prazo de Entrega</FormLabel>
                </div>

                {watchUpdateTerm && (
                  <FormField
                    control={form.control}
                    name="term"
                    render={({ field }) => (
                      <DateTimeInput
                        field={field}
                        mode="datetime"
                        context="due"
                        placeholder="Selecione o prazo de entrega"
                        disabled={isSubmitting}
                        constraints={{
                          minDate: new Date(), // Term should be in the future
                        }}
                        allowManualInput={true}
                      />
                    )}
                  />
                )}
              </div>

            </div>

            <DialogFooter className="flex-shrink-0 px-6 py-4 border-t">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={
                  !canEdit || isSubmitting || (!watchUpdateStatus && !watchUpdateSector && !watchUpdatePaint && !watchUpdateTerm && !watchUpdateCommission)
                }
              >
                {isSubmitting && <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />}
                Atualizar Tarefas
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
