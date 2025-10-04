import { useMemo } from "react";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import type { PaintCreateFormData, PaintUpdateFormData } from "../../../schemas";
import { usePaintBrandsForSelection } from "../../../hooks";

interface BrandSelectorProps {
  control: any;
  disabled?: boolean;
  required?: boolean;
}

export function PaintBrandSelector({ control, disabled, required }: BrandSelectorProps) {
  const { data: paintBrands, isLoading } = usePaintBrandsForSelection({
    enabled: true,
  });

  const options: ComboboxOption[] = useMemo(() => {
    if (!paintBrands?.data) return [];

    return paintBrands.data.map((brand) => ({
      value: brand.id,
      label: brand.name,
    }));
  }, [paintBrands?.data]);

  return (
    <FormField
      control={control}
      name="paintBrandId"
      render={({ field }) => (
        <FormItem>
          <FormLabel>
            Marca
            {required && <span className="text-destructive ml-1">*</span>}
          </FormLabel>
          <FormControl>
            <Combobox
              options={options}
              value={field.value || ""}
              onValueChange={(value) => field.onChange(value || null)}
              placeholder="Selecione a marca"
              disabled={disabled || isLoading}
              searchable={true}
              clearable={!required}
              emptyMessage={isLoading ? "Carregando marcas..." : "Nenhuma marca encontrada"}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
