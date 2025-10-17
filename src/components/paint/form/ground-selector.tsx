import { useMemo, useCallback, useRef } from "react";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import type { PaintCreateFormData, PaintUpdateFormData } from "../../../schemas";
import { getPaints } from "../../../api-client";
import { PAINT_BRAND_LABELS, PAINT_FINISH_LABELS } from "../../../constants";
import { IconLayersIntersect } from "@tabler/icons-react";
import type { Paint } from "../../../types";

interface GroundSelectorProps {
  control: any;
  disabled?: boolean;
  required?: boolean;
  initialPaints?: Paint[];
}

export function GroundSelector({ control, disabled, required, initialPaints }: GroundSelectorProps) {
  // Create a stable cache for fetched items
  const cacheRef = useRef<Map<string, { label: string; value: string; description?: string; metadata?: any }>>(new Map());

  // Create stable dependency for initialPaints array
  const initialPaintIds = useMemo(
    () => (initialPaints || []).map(p => p.id).sort().join(','),
    [initialPaints]
  );

  // Memoize initialOptions with stable dependency
  const initialOptions = useMemo(() => {
    if (!initialPaints || initialPaints.length === 0) return [];

    return initialPaints.map((paint) => {
      const option = {
        value: paint.id,
        label: paint.name,
        description: paint.paintBrand?.name && paint.finish ? `${paint.paintBrand?.name} - ${PAINT_FINISH_LABELS[paint.finish]}` : undefined,
        metadata: {
          hex: paint.hex || undefined,
        },
      };
      // Add to cache
      cacheRef.current.set(paint.id, option);
      return option;
    });
  }, [initialPaintIds, initialPaints]);

  // Async query function for the combobox - memoized with useCallback
  const queryPaints = useCallback(async (searchTerm: string, page = 1) => {
    try {
      // Build query parameters
      const queryParams: any = {
        orderBy: { name: "asc" },
        page: page,
        take: 50,
        include: {
          paintBrand: true,
        },
      };

      // Only add searchingFor if there's a search term
      if (searchTerm && searchTerm.trim()) {
        queryParams.searchingFor = searchTerm.trim();
      }

      const response = await getPaints(queryParams);
      const paints = response.data?.data || [];
      const hasMore = response.data?.meta?.hasNextPage || false;

      // Convert paints to options format and add to cache
      const options = paints.map((paint) => {
        const option = {
          value: paint.id,
          label: paint.name,
          description: paint.paintBrand?.name && paint.finish ? `${paint.paintBrand?.name} - ${PAINT_FINISH_LABELS[paint.finish]}` : undefined,
          metadata: {
            hex: paint.hex || undefined,
          },
        };

        // Add to cache
        cacheRef.current.set(paint.id, option);

        return option;
      });

      return {
        data: options,
        hasMore: hasMore,
      };
    } catch (error) {
      console.error("Error fetching paints:", error);
      return {
        data: [],
        hasMore: false,
      };
    }
  }, []);

  return (
    <FormField
      control={control}
      name="groundIds"
      render={({ field }) => (
        <FormItem>
          <FormLabel className="flex items-center gap-2">
            <IconLayersIntersect className="h-4 w-4" />
            Fundo da Tinta
            {required && <span className="text-destructive ml-1">*</span>}
          </FormLabel>
          <FormControl>
            <Combobox
              async={true}
              queryKey={["ground-paints"]}
              queryFn={queryPaints}
              initialOptions={initialOptions}
              value={field.value || []}
              onValueChange={field.onChange}
              placeholder="Selecione os fundos"
              disabled={disabled}
              className="w-full bg-transparent"
              mode="multiple"
              searchable={true}
              clearable={true}
              emptyText="Nenhuma tinta encontrada"
              searchPlaceholder="Pesquisar tintas..."
              pageSize={50}
              minSearchLength={0}
              debounceMs={300}
              renderOption={(option, isSelected) => (
                <div className="flex items-center gap-2">
                  {option.metadata?.hex && <div className="w-4 h-4 rounded border border-border" style={{ backgroundColor: option.metadata.hex }} />}
                  <div className="flex-1">
                    <div>{option.label}</div>
                    {option.description && <div className="text-xs text-muted-foreground">{option.description}</div>}
                  </div>
                </div>
              )}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
