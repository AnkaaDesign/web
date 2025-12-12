import type { WarningCreateFormData, WarningUpdateFormData } from "../../../../schemas";
import { WARNING_CATEGORY_LABELS } from "../../../../constants";

import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";

interface CategorySelectProps {
  control: any;
  disabled?: boolean;
  required?: boolean;
}

export function CategorySelect({ control, disabled, required }: CategorySelectProps) {
  const categoryOptions = Object.entries(WARNING_CATEGORY_LABELS).map(([key, label]) => ({
    value: key,
    label: label,
  }));

  return (
    <FormField
      control={control}
      name="category"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Categoria {required && <span className="text-destructive">*</span>}</FormLabel>
          <FormControl>
            <Combobox
              mode="single"
              value={field.value}
              onValueChange={field.onChange}
              options={categoryOptions}
              disabled={disabled}
              placeholder="Selecione a categoria"
              emptyText="Nenhuma categoria encontrada"
              searchPlaceholder="Buscar categoria..."
              clearable={!required}
              searchable={false}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
