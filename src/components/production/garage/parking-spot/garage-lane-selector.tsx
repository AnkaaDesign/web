import { useCallback, useMemo, useRef } from "react";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { getGarageLanes } from "../../../../api-client";
import type { ParkingSpotCreateFormData, ParkingSpotUpdateFormData } from "../../../../schemas";
import { IconRoad } from "@tabler/icons-react";

interface GarageLaneSelectorProps {
  control: any;
  disabled?: boolean;
  garageId?: string; // Filter lanes by garage
  initialLane?: any; // Initial lane data for editing
}

export function GarageLaneSelector({ control, disabled, garageId, initialLane }: GarageLaneSelectorProps) {
  // Create a stable cache for fetched lanes
  const cacheRef = useRef<Map<string, { label: string; value: string; description?: string }>>(new Map());

  // Memoize initial options
  const initialOptions = useMemo(() => {
    if (!initialLane) return [];

    const laneName = initialLane.name || `Faixa ${initialLane.id.slice(0, 8)}`;
    const garageName = initialLane.garage?.name || "Garagem";
    const label = `${laneName} - ${garageName}`;
    const description = `${initialLane.width}m × ${initialLane.length}m | Posição: (${initialLane.xPosition}, ${initialLane.yPosition})`;

    const option = {
      label,
      value: initialLane.id,
      description,
    };

    cacheRef.current.set(initialLane.id, option);
    return [option];
  }, [initialLane]);

  // Async query function for lanes
  const queryLanes = useCallback(async (searchTerm: string, page = 1) => {
    try {
      const queryParams: any = {
        orderBy: { createdAt: "asc" },
        page: page,
        take: 50,
        include: {
          garage: true,
        },
      };

      if (garageId) {
        queryParams.where = { garageId };
      }

      if (searchTerm && searchTerm.trim()) {
        queryParams.searchingFor = searchTerm.trim();
      }

      const response = await getGarageLanes(queryParams);
      const lanes = response.data || [];
      const hasMore = response.meta?.hasNextPage || false;

      const options = lanes.map((lane) => {
        const laneName = lane.name || `Faixa ${lane.id.slice(0, 8)}`;
        const garageName = lane.garage?.name || "Garagem";
        const label = `${laneName} - ${garageName}`;
        const description = `${lane.width}m × ${lane.length}m | Posição: (${lane.xPosition}, ${lane.yPosition})`;

        const option = {
          label,
          value: lane.id,
          description,
        };

        cacheRef.current.set(lane.id, option);
        return option;
      });

      return {
        data: options,
        hasMore: hasMore,
      };
    } catch (error) {
      console.error("Error fetching garage lanes:", error);
      return {
        data: [],
        hasMore: false,
      };
    }
  }, [garageId]);

  return (
    <FormField
      control={control}
      name="garageLaneId"
      render={({ field }) => (
        <FormItem>
          <FormLabel className="flex items-center gap-2">
            <IconRoad className="h-4 w-4 text-muted-foreground" />
            Faixa da Garagem
            <span className="text-destructive">*</span>
          </FormLabel>
          <FormControl>
            <Combobox
              async={true}
              queryKey={["garage-lanes-selector", garageId]}
              queryFn={queryLanes}
              initialOptions={initialOptions}
              value={field.value || ""}
              onValueChange={field.onChange}
              placeholder="Selecione a faixa..."
              emptyText="Nenhuma faixa encontrada"
              searchPlaceholder="Buscar faixa..."
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
