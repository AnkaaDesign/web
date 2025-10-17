import { useMemo, useCallback, useRef } from "react";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import type { PaintTypeCreateFormData, PaintTypeUpdateFormData } from "../../../../schemas";
import { getItems } from "../../../../api-client";
import type { Item } from "../../../../types";

interface ComponentItemsSelectorProps {
  control: any;
  disabled?: boolean;
  initialItems?: Item[];
}

export function ComponentItemsSelector({ control, disabled, initialItems }: ComponentItemsSelectorProps) {
  // Create a stable cache for fetched items
  const cacheRef = useRef<Map<string, { label: string; value: string }>>(new Map());

  // Create stable dependency for initialItems array
  const initialItemIds = useMemo(
    () => (initialItems || []).map(i => i.id).sort().join(','),
    [initialItems]
  );

  // Memoize initialOptions with stable dependency
  const initialOptions = useMemo(() => {
    if (!initialItems || initialItems.length === 0) return [];

    return initialItems.map((item) => {
      const unicode = item.uniCode || "";
      const name = item.name || "";
      const brand = item.brand?.name || "";
      const label = `${unicode} - ${name} - ${brand}`.replace(/^\s*-\s*/, "").replace(/\s*-\s*$/, "");

      const option = { label, value: item.id };
      // Add to cache
      cacheRef.current.set(item.id, option);
      return option;
    });
  }, [initialItemIds, initialItems]);

  // Async query function for the combobox - memoized with useCallback
  const queryItems = useCallback(async (searchTerm: string, page = 1) => {
    try {
      // Build query parameters - same structure as paint selector
      const queryParams: any = {
        orderBy: { name: "asc" },
        page: page,
        take: 50,
        include: {
          measures: true,
          category: true,
          brand: true,
        },
      };

      // Only add searchingFor if there's a search term
      if (searchTerm && searchTerm.trim()) {
        queryParams.searchingFor = searchTerm.trim();
      }

      const response = await getItems(queryParams);
      const items = response.data || [];
      const hasMore = response.meta?.hasNextPage || false;

      // Convert items to options format and add to cache
      const options = items.map((item) => {
        // Format: unicode - name - brand
        const unicode = item.uniCode || "";
        const name = item.name || "";
        const brand = item.brand?.name || "";
        const label = `${unicode} - ${name} - ${brand}`.replace(/^\s*-\s*/, "").replace(/\s*-\s*$/, "");

        const option = {
          label,
          value: item.id,
        };

        // Add to cache
        cacheRef.current.set(item.id, option);

        return option;
      });

      return {
        data: options,
        hasMore: hasMore,
      };
    } catch (error) {
      console.error("Error fetching items:", error);
      return {
        data: [],
        hasMore: false,
      };
    }
  }, []);

  return (
    <FormField
      control={control}
      name="componentItemIds"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Componentes Disponíveis</FormLabel>
          <FormControl>
            <Combobox
              async={true}
              queryKey={["component-items"]}
              queryFn={queryItems}
              initialOptions={initialOptions}
              value={field.value || []}
              onValueChange={field.onChange}
              placeholder="Selecione os componentes"
              disabled={disabled}
              className="w-full"
              mode="multiple"
              searchable={true}
              clearable={true}
              emptyText="Nenhum componente encontrado"
              searchPlaceholder="Pesquisar componentes..."
              pageSize={50}
              minSearchLength={0}
              debounceMs={300}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
