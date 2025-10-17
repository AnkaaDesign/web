import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { TASK_STATUS } from "../../../../constants";
import type { Task } from "../../../../types";

const setStatusSchema = z.object({
  status: z.enum([TASK_STATUS.IN_PRODUCTION, TASK_STATUS.COMPLETED, TASK_STATUS.INVOICED, TASK_STATUS.SETTLED], {
    required_error: "Selecione um status",
  }),
});

type SetStatusFormData = z.infer<typeof setStatusSchema>;

interface SetStatusModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tasks: Task[];
  onConfirm: (status: typeof TASK_STATUS.IN_PRODUCTION | typeof TASK_STATUS.COMPLETED | typeof TASK_STATUS.INVOICED | typeof TASK_STATUS.SETTLED) => void;
  allowedStatuses?: Array<typeof TASK_STATUS.IN_PRODUCTION | typeof TASK_STATUS.COMPLETED | typeof TASK_STATUS.INVOICED | typeof TASK_STATUS.SETTLED>;
}

export function SetStatusModal({ open, onOpenChange, tasks, onConfirm, allowedStatuses }: SetStatusModalProps) {
  console.log('[SetStatusModal] Rendering with open:', open, 'tasks:', tasks.length);

  // Determine the initial status value
  // If all tasks have the same status, use that; otherwise leave empty
  const initialStatus = React.useMemo(() => {
    if (tasks.length === 0) return undefined;
    const firstStatus = tasks[0].status;
    const allSameStatus = tasks.every(t => t.status === firstStatus);
    console.log('[SetStatusModal] Initial status calculated:', {
      tasksCount: tasks.length,
      firstStatus,
      allSameStatus,
      result: allSameStatus ? firstStatus : undefined
    });
    return allSameStatus ? firstStatus : undefined;
  }, [tasks]);

  const form = useForm<SetStatusFormData>({
    resolver: zodResolver(setStatusSchema),
    defaultValues: {
      status: initialStatus as any,
    },
  });

  // Reset form with current status when modal opens
  React.useEffect(() => {
    if (open && initialStatus) {
      console.log('[SetStatusModal] Setting initial status:', initialStatus);
      form.reset({ status: initialStatus as any });
    }
  }, [open, initialStatus, form]);

  const handleSubmit = (data: SetStatusFormData) => {
    onConfirm(data.status);
    onOpenChange(false);
    form.reset();
  };

  // Default to invoiced/settled for schedule, but allow all statuses if specified
  const statusesToShow = allowedStatuses || [TASK_STATUS.INVOICED, TASK_STATUS.SETTLED];

  const allStatusOptions: Record<string, ComboboxOption> = {
    [TASK_STATUS.IN_PRODUCTION]: { value: TASK_STATUS.IN_PRODUCTION, label: "Em Produção" },
    [TASK_STATUS.COMPLETED]: { value: TASK_STATUS.COMPLETED, label: "Concluído" },
    [TASK_STATUS.INVOICED]: { value: TASK_STATUS.INVOICED, label: "Faturado" },
    [TASK_STATUS.SETTLED]: { value: TASK_STATUS.SETTLED, label: "Liquidado" },
  };

  const statusOptions: ComboboxOption[] = statusesToShow.map(status => allStatusOptions[status]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Alterar Status</DialogTitle>
          <DialogDescription>
            Selecione o novo status para {tasks.length === 1 ? "a tarefa" : `as ${tasks.length} tarefas`} selecionada{tasks.length > 1 ? "s" : ""}.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <FormControl>
                    <Combobox
                      value={field.value}
                      onValueChange={field.onChange}
                      options={statusOptions}
                      placeholder="Selecione um status"
                      searchable={false}
                      clearable={false}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit">Confirmar</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
