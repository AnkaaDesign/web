import { Combobox } from "@/components/ui/combobox";
import { FormField, FormItem, FormControl } from "@/components/ui/form";
import { useSuppliers } from "../../../../../hooks";

interface SupplierCellProps {
  control: any;
  index: number;
  disabled?: boolean;
}

export function SupplierCell({ control, index, disabled }: SupplierCellProps) {
  const { data: response, isLoading } = useSuppliers();
  const suppliers = response?.data || [];

  return (
    <FormField
      control={control}
      name={`items.${index}.data.supplierId`}
      render={({ field }) => (
        <FormItem>
          <FormControl>
            <Combobox
              disabled={disabled || isLoading}
              value={field.value || ""}
              onValueChange={field.onChange}
              options={
                suppliers?.map((supplier) => ({
                  label: supplier.fantasyName,
                  value: supplier.id,
                })) || []
              }
              placeholder={isLoading ? "Carregando..." : "Selecione"}
              searchPlaceholder="Buscar fornecedor..."
              className="h-10"
            />
          </FormControl>
        </FormItem>
      )}
    />
  );
}
