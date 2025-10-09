import { useMemo, useEffect, useState } from "react";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import type { PaintTypeCreateFormData, PaintTypeUpdateFormData } from "../../../../schemas";
import { getItems, getItem } from "../../../../api-client";
import { MEASURE_TYPE } from "../../../../constants";

interface ComponentItemsSelectorProps {
  control: any;
  disabled?: boolean;
}

export function ComponentItemsSelector({ control, disabled }: ComponentItemsSelectorProps) {
  const [initialOptions, setInitialOptions] = useState<Array<{ label: string; value: string }>>([]);

  // Async query function for the combobox
  const queryItems = useMemo(
    () => async (searchTerm: string, page = 1) => {
      try {
        // Build query parameters
        const queryParams: any = {
          include: {
            measures: true,
            category: true,
            brand: true,
          },
          take: 50, // Load 50 items at a time
          skip: (page - 1) * 50,
          orderBy: { name: "asc" },
        };

        // Only add searchingFor if there's a search term
        if (searchTerm && searchTerm.trim()) {
          queryParams.searchingFor = searchTerm.trim();
        }

        const response = await getItems(queryParams);
        const items = response.data?.data || [];

        // Filter items that have weight measures (volume not required for paint components)
        const validComponentItems = items.filter((item) => {
          if (!item.measures || item.measures.length === 0) return false;

          // Only require weight measure for paint components
          const hasWeightMeasure = item.measures.some((m) => m.measureType === MEASURE_TYPE.WEIGHT && m.value !== null && m.value > 0);
          return hasWeightMeasure;
        });

        // Convert items to options format
        const options = validComponentItems.map((item) => {
          // Format: unicode - name - brand
          const unicode = item.uniCode || "";
          const name = item.name || "";
          const brand = item.brand?.name || "";
          const label = `${unicode} - ${name} - ${brand}`.replace(/^\s*-\s*/, "").replace(/\s*-\s*$/, "");

          return {
            label,
            value: item.id,
          };
        });

        console.log(`Component Items Query - Page ${page}, Search: "${searchTerm}", Found: ${options.length} valid items`);

        return {
          data: options,
          hasMore: response.data?.meta?.hasNextPage || false,
          total: response.data?.meta?.totalRecords || 0,
        };
      } catch (error) {
        console.error("Error fetching items:", error);
        return {
          data: [],
          hasMore: false,
          total: 0,
        };
      }
    },
    []
  );

  // Fetch selected items to populate initialOptions
  useEffect(() => {
    const fetchSelectedItems = async () => {
      const selectedIds = control._formValues?.componentItemIds || [];
      if (!selectedIds || selectedIds.length === 0) {
        setInitialOptions([]);
        return;
      }

      try {
        const itemPromises = selectedIds.map(async (id: string) => {
          try {
            const response = await getItem(id, {
              include: {
                measures: true,
                category: true,
                brand: true,
              },
            });
            const item = response.data;
            if (!item) return null;

            const unicode = item.uniCode || "";
            const name = item.name || "";
            const brand = item.brand?.name || "";
            const label = `${unicode} - ${name} - ${brand}`.replace(/^\s*-\s*/, "").replace(/\s*-\s*$/, "");

            return {
              label,
              value: item.id,
            };
          } catch (error) {
            console.error(`Error fetching item ${id}:`, error);
            return null;
          }
        });

        const items = await Promise.all(itemPromises);
        const validItems = items.filter((item): item is { label: string; value: string } => item !== null);
        setInitialOptions(validItems);
      } catch (error) {
        console.error("Error fetching selected items:", error);
        setInitialOptions([]);
      }
    };

    fetchSelectedItems();
  }, [control]);

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
