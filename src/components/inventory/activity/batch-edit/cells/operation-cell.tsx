import type { UseFormReturn } from "react-hook-form";
import { FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { ACTIVITY_OPERATION, ACTIVITY_OPERATION_LABELS } from "../../../../../constants";

interface OperationCellProps {
  form: UseFormReturn<any>;
  index: number;
}

export function OperationCell({ form, index }: OperationCellProps) {
  return (
    <FormField
      control={form.control}
      name={`activities.${index}.data.operation`}
      render={({ field }) => (
        <FormItem>
          <FormControl>
            <Combobox
              value={field.value}
              onValueChange={field.onChange}
              options={Object.values(ACTIVITY_OPERATION).map((operation) => ({
                label: ACTIVITY_OPERATION_LABELS[operation],
                value: operation,
              }))}
              placeholder="Selecione a operação"
              className="h-8 text-sm"
              searchable={false}
              clearable={false}
            />
          </FormControl>
          <FormMessage className="text-xs" />
        </FormItem>
      )}
    />
  );
}
