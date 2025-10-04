import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { useTasks } from "../../../../hooks";
import type { ServiceOrderCreateFormData, ServiceOrderUpdateFormData } from "../../../../schemas";
import { TASK_STATUS } from "../../../../constants";

interface TaskSelectorProps {
  control: any;
  disabled?: boolean;
}

export function TaskSelector({ control, disabled }: TaskSelectorProps) {
  // Fetch active tasks for task selection
  const { data: tasksResponse, isLoading } = useTasks({
    where: {
      status: {
        notIn: [TASK_STATUS.COMPLETED, TASK_STATUS.CANCELLED],
      },
    },
    include: {
      customer: true,
      sector: true,
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const tasks = tasksResponse?.data || [];

  // Create combobox options with customer and sector info
  const taskOptions: ComboboxOption[] = tasks.map((task) => ({
    value: task.id,
    label: `#${task.serialNumber} - ${task.name}`,
    description: `Cliente: ${task.customer?.name || "N/A"} | Setor: ${task.sector?.name || "N/A"}`,
  }));

  return (
    <FormField
      control={control}
      name="taskId"
      render={({ field }) => (
        <FormItem>
          <FormLabel>
            Tarefa
            <span className="text-destructive ml-1">*</span>
          </FormLabel>
          <FormControl>
            <Combobox
              options={taskOptions}
              value={field.value || ""}
              onValueChange={field.onChange}
              placeholder="Selecione a tarefa..."
              emptyText="Nenhuma tarefa encontrada"
              disabled={disabled || isLoading}
              searchable={true}
              className="w-full"
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
