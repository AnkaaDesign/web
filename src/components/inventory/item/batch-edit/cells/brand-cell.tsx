import { Combobox } from "@/components/ui/combobox";
import { FormField, FormItem, FormControl } from "@/components/ui/form";
import { useItemBrands } from "../../../../../hooks";

interface BrandCellProps {
  control: any;
  index: number;
  disabled?: boolean;
}

export function BrandCell({ control, index, disabled }: BrandCellProps) {
  const { data: response, isLoading } = useItemBrands();
  const brands = response?.data || [];

  return (
    <FormField
      control={control}
      name={`items.${index}.data.brandId`}
      render={({ field }) => (
        <FormItem>
          <FormControl>
            <Combobox
              disabled={disabled || isLoading}
              value={field.value || ""}
              onValueChange={field.onChange}
              options={
                brands?.map((brand) => ({
                  label: brand.name,
                  value: brand.id,
                })) || []
              }
              placeholder={isLoading ? "Carregando..." : "Selecione"}
              searchPlaceholder="Buscar marca..."
              className="h-10"
            />
          </FormControl>
        </FormItem>
      )}
    />
  );
}
