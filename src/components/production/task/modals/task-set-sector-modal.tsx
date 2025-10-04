import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { useTaskBatchMutations, useSectors } from "../../../../hooks";
import { TASK_STATUS, SECTOR_PRIVILEGES } from "../../../../constants";
import { IconLoader2, IconAlertTriangle } from "@tabler/icons-react";
import type { Task } from "../../../../types";
import { Alert, AlertDescription } from "@/components/ui/alert";

// Schema for set sector form
const setSectorSchema = z.object({
  sectorId: z.string().uuid("Setor inválido").nullable().optional(),
});

type SetSectorFormData = z.infer<typeof setSectorSchema>;

interface TaskSetSectorModalProps {
  tasks: Task[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export const TaskSetSectorModal = ({ tasks, open, onOpenChange, onSuccess }: TaskSetSectorModalProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { batchUpdateAsync: batchUpdate } = useTaskBatchMutations();

  // Load production sectors only
  const { data: sectorsData, isLoading: sectorsLoading } = useSectors({
    where: {
      privileges: {
        in: [SECTOR_PRIVILEGES.PRODUCTION, SECTOR_PRIVILEGES.LEADER, SECTOR_PRIVILEGES.ADMIN],
      },
    },
    orderBy: { name: "asc" },
  });

  const sectors = sectorsData?.data || [];

  const form = useForm<SetSectorFormData>({
    resolver: zodResolver(setSectorSchema),
    defaultValues: {
      sectorId: null,
    },
  });

  // Reset form when modal opens
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      form.reset({
        sectorId: null,
      });
    }
    onOpenChange(newOpen);
  };

  // Filter out completed or cancelled tasks
  const updatableTasks = tasks.filter((task) => task.status !== TASK_STATUS.COMPLETED && task.status !== TASK_STATUS.CANCELLED);

  const nonUpdatableTasks = tasks.filter((task) => task.status === TASK_STATUS.COMPLETED || task.status === TASK_STATUS.CANCELLED);

  const handleSubmit = async (data: SetSectorFormData) => {
    if (updatableTasks.length === 0) {
      return;
    }

    try {
      setIsSubmitting(true);

      // Prepare batch update data
      const updates = updatableTasks.map((task) => ({
        id: task.id,
        data: {
          sectorId: data.sectorId,
        },
      }));

      const result = await batchUpdate({ tasks: updates });

      if (result.success) {
        handleOpenChange(false);
        onSuccess?.();
      }
    } catch (error) {
      console.error("Error updating tasks sector:", error);
      // Error is handled by the mutation hook
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!tasks || tasks.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Definir Setor</DialogTitle>
          <DialogDescription>{tasks.length === 1 ? `Definir setor para a tarefa "${tasks[0].name}"` : `Definir setor para ${tasks.length} tarefas selecionadas`}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            {/* Warning for non-updatable tasks */}
            {nonUpdatableTasks.length > 0 && (
              <Alert variant="warning">
                <IconAlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {nonUpdatableTasks.length === 1
                    ? "1 tarefa não será atualizada por estar finalizada ou cancelada"
                    : `${nonUpdatableTasks.length} tarefas não serão atualizadas por estarem finalizadas ou canceladas`}
                </AlertDescription>
              </Alert>
            )}

            {/* Info about tasks to be updated */}
            {updatableTasks.length > 0 && (
              <div className="text-sm text-muted-foreground">{updatableTasks.length === 1 ? "1 tarefa será atualizada" : `${updatableTasks.length} tarefas serão atualizadas`}</div>
            )}

            {/* Sector selector */}
            <FormField
              control={form.control}
              name="sectorId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Setor de Produção</FormLabel>
                  <FormControl>
                    <Combobox
                      value={field.value}
                      onValueChange={field.onChange}
                      options={sectors.map(
                        (sector): ComboboxOption => ({
                          value: sector.id,
                          label: sector.name,
                        }),
                      )}
                      placeholder={sectorsLoading ? "Carregando..." : "Selecione um setor ou deixe vazio"}
                      disabled={isSubmitting || sectorsLoading}
                      loading={sectorsLoading}
                      searchable={sectors.length > 10}
                      clearable={true}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting || updatableTasks.length === 0}>
                {isSubmitting && <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />}
                Atualizar Setor
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
