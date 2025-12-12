import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import type { PaintCreateFormData, PaintUpdateFormData } from "../../../schemas";
import { usePaintTypes } from "../../../hooks";
import { IconPaint } from "@tabler/icons-react";

interface PaintTypeSelectorProps {
  control: any;
  disabled?: boolean;
  required?: boolean;
}

export function PaintTypeSelector({ control, disabled, required }: PaintTypeSelectorProps) {
  const { data: paintTypesResponse, isLoading } = usePaintTypes({
    orderBy: { name: "asc" },
  });

  const paintTypes = paintTypesResponse?.data || [];

  const options: ComboboxOption[] = paintTypes.map((paintType) => ({
    value: paintType.id,
    label: paintType.name,
  }));

  return (
    <FormField
      control={control}
      name="paintTypeId"
      render={({ field }) => (
        <FormItem>
          <FormLabel className="flex items-center gap-2">
            <IconPaint className="h-4 w-4" />
            Tipo de Tinta
            {required && <span className="text-destructive ml-1">*</span>}
          </FormLabel>
          <FormControl>
            <Combobox
              options={options}
              value={field.value}
              onValueChange={field.onChange}
              placeholder={isLoading ? "Carregando..." : "Selecione o tipo de tinta"}
              disabled={disabled || isLoading}
              loading={isLoading}
              searchable={true}
              className="bg-transparent"
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
