// apps/web/src/components/production/task/batch-edit/cells/status-cell.tsx

import { FormField, FormItem, FormControl } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { TASK_STATUS, TASK_STATUS_LABELS } from "../../../../../constants";

interface StatusCellProps {
  control: any;
  index: number;
}

const statusOptions = Object.values(TASK_STATUS).map((status) => ({
  value: status,
  label: TASK_STATUS_LABELS[status],
}));

export function StatusCell({ control, index }: StatusCellProps) {
  // Defensive check to prevent undefined field names
  if (typeof index !== "number" || index < 0) {
    if (process.env.NODE_ENV !== 'production') {
      console.error("StatusCell: Invalid index provided:", index);
    }
    return <div className="text-red-500 text-xs">Error: Invalid index</div>;
  }

  return (
    <FormField
      control={control}
      name={`tasks.${index}.data.status`}
      render={({ field }) => (
        <FormItem>
          <FormControl>
            <Combobox
              value={field.value || ""}
              onValueChange={field.onChange}
              options={statusOptions}
              placeholder="Selecionar status"
              emptyText="Nenhum status encontrado"
              searchPlaceholder="Buscar status..."
              clearable
            />
          </FormControl>
        </FormItem>
      )}
    />
  );
}
