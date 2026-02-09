import { IconInfoCircle } from "@tabler/icons-react";

import { VACATION_STATUS, VACATION_STATUS_LABELS } from "../../../../constants";

import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";

interface StatusSelectProps {
  control: any;
  disabled?: boolean;
  allowEmpty?: boolean;
  placeholder?: string;
}

export function StatusSelect({ control, disabled, allowEmpty, placeholder }: StatusSelectProps) {
  // Convert enum to ComboboxOption format
  const options: ComboboxOption[] = Object.entries(VACATION_STATUS_LABELS).map(([value, label]) => ({
    value,
    label,
  }));

  // Add empty option if allowed
  if (allowEmpty) {
    options.unshift({
      value: "__empty__",
      label: "Manter atual",
    });
  }

  return (
    <FormField
      control={control}
      name="status"
      render={({ field, fieldState }) => (
        <FormItem>
          <FormLabel>
            <div className="flex items-center gap-2">
              <IconInfoCircle className="h-4 w-4" />
              Status
            </div>
          </FormLabel>
          <FormControl>
            <Combobox
              value={field.value || (allowEmpty ? "__empty__" : VACATION_STATUS.PENDING)}
              onValueChange={(value) => {
                if (allowEmpty && value === "__empty__") {
                  field.onChange(undefined);
                } else {
                  field.onChange(value);
                }
              }}
              options={options}
              disabled={disabled}
              placeholder={placeholder || "Selecione um status"}
              emptyText="Nenhum status encontrado"
              searchPlaceholder="Buscar status..."
              clearable={allowEmpty}
              searchable={false} // Simple select, no need for search
              renderOption={(option) => <span className={option.value === "__empty__" ? "text-muted-foreground italic" : ""}>{option.label}</span>}
            />
          </FormControl>
          <FormDescription>
            Status atual do período de férias{fieldState.error && <span className="text-destructive"> (obrigatório)</span>}
          </FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
