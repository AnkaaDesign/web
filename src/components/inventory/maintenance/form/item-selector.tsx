import { useMemo } from "react";
import { type FieldValues, type FieldPath } from "react-hook-form";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { useItems } from "../../../../hooks";

interface ItemSelectorProps<TFieldValues extends FieldValues = FieldValues> {
  control: any;
  disabled?: boolean;
  required?: boolean;
  fieldName?: FieldPath<TFieldValues>;
  label?: string;
}

export function MaintenanceItemSelector<TFieldValues extends FieldValues = FieldValues>({
  control,
  disabled = false,
  required = false,
  fieldName = "itemId" as FieldPath<TFieldValues>,
  label = "Item",
}: ItemSelectorProps<TFieldValues>) {
  const {
    data: itemsResponse,
    isLoading,
    error,
  } = useItems({
    take: 50,
    where: {
      isActive: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  const items = itemsResponse?.data || [];

  // Show error state if there's an error loading items
  if (error) {
    console.error("Error loading items for maintenance selector:", error);
  }

  // Create options for the combobox
  const itemOptions = useMemo(() => {
    return items.map((item) => ({
      value: item.id,
      label: item.name,
      description: item.uniCode ? `Código: ${item.uniCode} • Estoque: ${item.quantity || 0}` : `Estoque: ${item.quantity || 0}`,
    }));
  }, [items]);

  return (
    <FormField
      control={control}
      name={fieldName}
      render={({ field }) => (
        <FormItem className="flex flex-col">
          <FormLabel className={required ? "after:content-['*'] after:ml-0.5 after:text-destructive" : ""}>{label}</FormLabel>
          <FormControl>
            <Combobox
              options={itemOptions}
              value={field.value || ""}
              onValueChange={(value) => {
                field.onChange(value);
                // Trigger validation when value changes
                if (required && !value) {
                  field.onBlur();
                }
              }}
              placeholder={isLoading ? "Carregando itens..." : "Selecione um item"}
              searchable
              disabled={disabled || isLoading}
              emptyText={error ? "Erro ao carregar itens" : isLoading ? "Carregando..." : itemOptions.length === 0 ? "Nenhum item ativo encontrado" : "Nenhum item encontrado"}
              className="w-full"
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
