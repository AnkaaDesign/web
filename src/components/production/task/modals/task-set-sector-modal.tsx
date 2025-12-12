import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { useTaskBatchMutations } from "../../../../hooks/useTask";
import { useSectors } from "../../../../hooks/useSector";
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
  const batchMutations = useTaskBatchMutations();
  const { batchUpdateAsync: batchUpdate } = batchMutations;

  // Debug log to verify hook returns correctly
  console.log('[TaskSetSectorModal] Hook result:', {
    hasBatchMutations: !!batchMutations,
    hasBatchUpdateAsync: !!batchMutations?.batchUpdateAsync,
    batchUpdateType: typeof batchUpdate,
  });

  // Load production sectors only
  const { data: sectorsData, isLoading: sectorsLoading } = useSectors({
    where: {
      privileges: {
        in: [SECTOR_PRIVILEGES.PRODUCTION, SECTOR_PRIVILEGES.ADMIN],
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

    console.log('[TaskSetSectorModal] ========== SUBMIT STARTED ==========');
    console.log('[TaskSetSectorModal] Form data:', data);
    console.log('[TaskSetSectorModal] sectorId value:', data.sectorId);
    console.log('[TaskSetSectorModal] sectorId type:', typeof data.sectorId);
    console.log('[TaskSetSectorModal] Number of updatable tasks:', updatableTasks.length);
    console.log('[TaskSetSectorModal] Task IDs:', updatableTasks.map(t => t.id));

    try {
      setIsSubmitting(true);

      // Defensive check for batchUpdate function
      if (!batchUpdate || typeof batchUpdate !== 'function') {
        console.error('[TaskSetSectorModal] ERROR: batchUpdate is not a function!', {
          batchUpdate,
          type: typeof batchUpdate
        });
        throw new Error('batchUpdate is not available');
      }

      // Prepare batch update data
      const updates = updatableTasks.map((task) => ({
        id: task.id,
        data: {
          sectorId: data.sectorId,
        },
      }));

      console.log('[TaskSetSectorModal] Prepared updates:', JSON.stringify(updates, null, 2));
      console.log('[TaskSetSectorModal] Calling batchUpdate...');

      const result = await batchUpdate({ tasks: updates });

      console.log('[TaskSetSectorModal] Batch update result:', result);

      if (result.success) {
        console.log('[TaskSetSectorModal] ========== SUBMIT SUCCESSFUL ==========');
        handleOpenChange(false);
        onSuccess?.();
      } else {
        console.error('[TaskSetSectorModal] ========== SUBMIT FAILED ==========');
        console.error('[TaskSetSectorModal] Result:', result);
      }
    } catch (error) {
      console.error('[TaskSetSectorModal] ========== ERROR OCCURRED ==========');
      console.error('[TaskSetSectorModal] Error:', error);
      console.error('[TaskSetSectorModal] Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        fullError: JSON.stringify(error, Object.getOwnPropertyNames(error))
      });
      // Error is handled by the mutation hook
    } finally {
      setIsSubmitting(false);
      console.log('[TaskSetSectorModal] ========== SUBMIT ENDED ==========');
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
                      value={field.value ?? undefined}
                      onValueChange={(value) => field.onChange(value || null)}
                      options={[
                        { value: "", label: "Indefinido (sem setor)" },
                        ...sectors.map(
                          (sector): ComboboxOption => ({
                            value: sector.id,
                            label: sector.name,
                          }),
                        ),
                      ]}
                      placeholder={sectorsLoading ? "Carregando..." : "Selecione um setor"}
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
