import type { VacationCreateFormData, VacationUpdateFormData } from "../../../../schemas";
import { VACATION_TYPE, VACATION_TYPE_LABELS } from "../../../../constants";

import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";

interface TypeSelectProps {
  control: any;
  disabled?: boolean;
  allowEmpty?: boolean;
  placeholder?: string;
}

export function TypeSelect({ control, disabled, allowEmpty, placeholder }: TypeSelectProps) {
  // Convert enum to ComboboxOption format
  const options: ComboboxOption[] = Object.entries(VACATION_TYPE_LABELS).map(([value, label]) => ({
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
      name="type"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Tipo</FormLabel>
          <FormControl>
            <Combobox
              value={field.value || (allowEmpty ? "__empty__" : VACATION_TYPE.ANNUAL)}
              onValueChange={(value) => {
                if (allowEmpty && value === "__empty__") {
                  field.onChange(undefined);
                } else {
                  field.onChange(value);
                }
              }}
              options={options}
              disabled={disabled}
              placeholder={placeholder || "Selecione um tipo"}
              emptyText="Nenhum tipo encontrado"
              searchPlaceholder="Buscar tipo..."
              clearable={allowEmpty}
              searchable={false} // Simple select, no need for search
              renderOption={(option) => <span className={option.value === "__empty__" ? "text-muted-foreground italic" : ""}>{option.label}</span>}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
