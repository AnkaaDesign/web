import { useCallback, useMemo, useRef } from "react";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { getGarages } from "../../../../api-client";
import type { GarageLaneCreateFormData, GarageLaneUpdateFormData } from "../../../../schemas";
import { IconBuilding } from "@tabler/icons-react";

interface GarageSelectorProps {
  control: any;
  disabled?: boolean;
  initialGarage?: any; // Initial garage data for editing
}

export function GarageSelector({ control, disabled, initialGarage }: GarageSelectorProps) {
  // Create a stable cache for fetched garages
  const cacheRef = useRef<Map<string, { label: string; value: string; description?: string }>>(new Map());

  // Memoize initial options
  const initialOptions = useMemo(() => {
    if (!initialGarage) return [];

    const description = `${initialGarage.width}m × ${initialGarage.length}m${initialGarage.location ? ` | ${initialGarage.location}` : ""}`;

    const option = {
      label: initialGarage.name,
      value: initialGarage.id,
      description,
    };

    cacheRef.current.set(initialGarage.id, option);
    return [option];
  }, [initialGarage]);

  // Async query function for garages
  const queryGarages = useCallback(async (searchTerm: string, page = 1) => {
    try {
      const queryParams: any = {
        orderBy: { name: "asc" },
        page: page,
        take: 50,
      };

      if (searchTerm && searchTerm.trim()) {
        queryParams.searchingFor = searchTerm.trim();
      }

      const response = await getGarages(queryParams);
      const garages = response.data || [];
      const hasMore = response.meta?.hasNextPage || false;

      const options = garages.map((garage) => {
        const description = `${garage.width}m × ${garage.length}m${garage.location ? ` | ${garage.location}` : ""}`;

        const option = {
          label: garage.name,
          value: garage.id,
          description,
        };

        cacheRef.current.set(garage.id, option);
        return option;
      });

      return {
        data: options,
        hasMore: hasMore,
      };
    } catch (error) {
      console.error("Error fetching garages:", error);
      return {
        data: [],
        hasMore: false,
      };
    }
  }, []);

  return (
    <FormField
      control={control}
      name="garageId"
      render={({ field }) => (
        <FormItem>
          <FormLabel className="flex items-center gap-2">
            <IconBuilding className="h-4 w-4 text-muted-foreground" />
            Garagem
            <span className="text-destructive">*</span>
          </FormLabel>
          <FormControl>
            <Combobox
              async={true}
              queryKey={["garages-selector"]}
              queryFn={queryGarages}
              initialOptions={initialOptions}
              value={field.value || ""}
              onValueChange={field.onChange}
              placeholder="Selecione a garagem..."
              emptyText="Nenhuma garagem encontrada"
              searchPlaceholder="Buscar garagem..."
              disabled={disabled}
              searchable={true}
              clearable={true}
              pageSize={50}
              minSearchLength={0}
              debounceMs={300}
              className="w-full"
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
