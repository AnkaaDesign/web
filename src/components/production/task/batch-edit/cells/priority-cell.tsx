// apps/web/src/components/production/task/batch-edit/cells/priority-cell.tsx

import { FormField, FormItem, FormControl } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { PRIORITY_TYPE, PRIORITY_TYPE_LABELS } from "../../../../../constants";

interface PriorityCellProps {
  control: any;
  index: number;
}

const priorityOptions = Object.values(PRIORITY_TYPE).map((priority) => ({
  value: priority,
  label: PRIORITY_TYPE_LABELS[priority],
}));

export function PriorityCell({ control, index }: PriorityCellProps) {
  return (
    <FormField
      control={control}
      name={`tasks.${index}.data.priority`}
      render={({ field }) => (
        <FormItem>
          <FormControl>
            <Combobox
              value={field.value || ""}
              onValueChange={field.onChange}
              options={priorityOptions}
              placeholder="Selecionar prioridade"
              emptyMessage="Nenhuma prioridade encontrada"
              searchPlaceholder="Buscar prioridade..."
              allowClear
            />
          </FormControl>
        </FormItem>
      )}
    />
  );
}
