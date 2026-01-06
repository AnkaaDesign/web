import { useMemo, useCallback } from "react";
import { type FieldValues, type FieldPath } from "react-hook-form";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { getItems } from "../../../../api-client";
import type { Item } from "../../../../types";

interface ItemSelectorProps<TFieldValues extends FieldValues = FieldValues> {
  control: any;
  disabled?: boolean;
  required?: boolean;
  fieldName?: FieldPath<TFieldValues>;
  label?: string;
  initialItem?: Item;
}

export function MaintenanceItemSelector<TFieldValues extends FieldValues = FieldValues>({
  control,
  disabled = false,
  required = false,
  fieldName = "itemId" as FieldPath<TFieldValues>,
  label = "Item",
  initialItem,
}: ItemSelectorProps<TFieldValues>) {
  // Memoize initialOptions with stable dependency to prevent infinite loops
  const initialOptions = useMemo(() => {
    if (!initialItem) return [];

    return [{
      value: initialItem.id,
      label: initialItem.name,
      description: initialItem.uniCode ? `Código: ${initialItem.uniCode} • Estoque: ${initialItem.quantity || 0}` : `Estoque: ${initialItem.quantity || 0}`,
    }];
  }, [initialItem?.id]);

  // Memoize getOptionLabel and getOptionValue callbacks with stable dependencies
  const getOptionLabel = useCallback((item: any) => item.name, []);
  const getOptionValue = useCallback((item: any) => item.id, []);

  // Async query function for Combobox with pagination
  const queryFn = useCallback(async (searchTerm: string, page: number = 1) => {
    try {
      // Build query parameters - same structure as paint type selector
      const queryParams: any = {
        orderBy: { name: "asc" },
        page: page,
        take: 50,
        include: {
          brand: true,
          category: true,
        },
      };

      // Add search filter if provided
      if (searchTerm && searchTerm.trim()) {
        queryParams.searchingFor = searchTerm.trim();
      }

      // Add isActive filter
      queryParams.where = {
        isActive: true,
      };

      const response = await getItems(queryParams);
      const items = response.data || [];
      const hasMore = response.meta?.hasNextPage || false;

      return {
        data: items.map((item) => ({
          value: item.id,
          label: item.name,
          description: item.uniCode ? `Código: ${item.uniCode} • Estoque: ${item.quantity || 0}` : `Estoque: ${item.quantity || 0}`,
        })),
        hasMore,
      };
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error fetching items:", error);
      }
      return {
        data: [],
        hasMore: false,
      };
    }
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
              initialOptions={initialOptions}
              minSearchLength={0}
              pageSize={50}
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
              searchPlaceholder="Pesquisar itens..."
              className="w-full"
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
