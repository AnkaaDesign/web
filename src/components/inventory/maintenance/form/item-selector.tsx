import { useMemo, useCallback } from "react";
import { type FieldValues, type FieldPath } from "react-hook-form";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { getItems } from "../../../../api-client";

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
  // Async query function for Combobox with pagination
  const queryFn = useCallback(async (searchTerm: string, page: number = 1) => {
    const pageSize = 20;
    const response = await getItems({
      take: pageSize,
      skip: (page - 1) * pageSize,
      where: {
        isActive: true,
        ...(searchTerm ? {
          OR: [
            { name: { contains: searchTerm, mode: "insensitive" } },
            { uniCode: { contains: searchTerm, mode: "insensitive" } },
          ],
        } : {}),
      },
      orderBy: {
        name: "asc",
      },
      include: {
        brand: true,
        category: true,
      },
    });

    const items = response.data || [];
    const total = response.total || 0;
    const hasMore = (page * pageSize) < total;

    return {
      data: items.map((item) => ({
        value: item.id,
        label: item.name,
        description: item.uniCode ? `Código: ${item.uniCode} • Estoque: ${item.quantity || 0}` : `Estoque: ${item.quantity || 0}`,
      })),
      hasMore,
      total,
    };
  }, []);

  return (
    <FormField
      control={control}
      name={fieldName}
      render={({ field }) => (
        <FormItem className="flex flex-col">
          <FormLabel className={required ? "after:content-['*'] after:ml-0.5 after:text-destructive" : ""}>{label}</FormLabel>
          <FormControl>
            <Combobox
              async
              queryKey={["items", "maintenance-selector"]}
              queryFn={queryFn}
              minSearchLength={0}
              pageSize={20}
              value={field.value || ""}
              onValueChange={(value) => {
                field.onChange(value);
                // Trigger validation when value changes
                if (required && !value) {
                  field.onBlur();
                }
              }}
              placeholder="Selecione um item"
              searchable
              disabled={disabled}
              emptyText="Nenhum item encontrado"
              className="w-full"
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
