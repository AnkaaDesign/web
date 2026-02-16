import type { FieldErrors } from "react-hook-form";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import type { ItemCategoryCreateFormData, ItemCategoryUpdateFormData } from "../../../../../schemas";
import { ITEM_CATEGORY_TYPE, ITEM_CATEGORY_TYPE_LABELS } from "../../../../../constants";

interface TypeSelectorProps {
  control: any;
  errors?: FieldErrors<ItemCategoryCreateFormData | ItemCategoryUpdateFormData>;
  disabled?: boolean;
}

export function TypeSelector({ control, disabled }: TypeSelectorProps) {
  const options = Object.values(ITEM_CATEGORY_TYPE).map((type) => ({
    value: type,
    label: ITEM_CATEGORY_TYPE_LABELS[type],
  }));

  return (
    <FormField
      control={control}
      name="type"
      render={({ field }) => (
        <FormItem className="space-y-2">
          <FormLabel className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Tipo de Categoria</FormLabel>
          <FormControl>
            <Combobox
              options={options}
              value={field.value}
              onValueChange={field.onChange}
              placeholder="Selecione o tipo"
              disabled={disabled}
              searchable={false}
              clearable={false}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
