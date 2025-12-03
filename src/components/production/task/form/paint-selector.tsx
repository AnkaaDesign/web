import { useMemo, useCallback, useRef } from "react";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { getPaints } from "../../../../api-client";
import type { Paint } from "../../../../types";
import type { TaskCreateFormData, TaskUpdateFormData } from "../../../../schemas";
interface PaintSelectorProps {
  control: any;
  disabled?: boolean;
  initialPaints?: Paint[];
}

export function PaintSelector({ control, disabled, initialPaints }: PaintSelectorProps) {
  // Create a stable cache for fetched paints
  const cacheRef = useRef<Map<string, Paint>>(new Map());

  // Create stable dependency for initialPaints array
  const initialPaintIds = useMemo(
    () => (initialPaints || []).map(p => p.id).sort().join(','),
    [initialPaints]
  );

  // Memoize initialOptions with stable dependency
  const initialOptions = useMemo(() => {
    if (!initialPaints || initialPaints.length === 0) return [];

    // Add initial paints to cache
    initialPaints.forEach(paint => {
      cacheRef.current.set(paint.id, paint);
    });

    return initialPaints;
  }, [initialPaintIds, initialPaints]);

  // Memoize callbacks to prevent infinite loop
  const getOptionLabel = useCallback((paint: Paint) => paint.name, []);
  const getOptionValue = useCallback((paint: Paint) => paint.id, []);

  // Async query function for the combobox
  const queryPaints = useCallback(async (searchTerm: string, page = 1) => {
    try {
      const queryParams: any = {
        orderBy: { name: "asc" },
        page: page,
        take: 50,
      };

      // Only add searchingFor if there's a search term
      if (searchTerm && searchTerm.trim()) {
        queryParams.searchingFor = searchTerm.trim();
      }

      const response = await getPaints(queryParams);
      const paints = response.data || [];
      const hasMore = response.meta?.hasNextPage || false;

      // Add to cache
      paints.forEach(paint => {
        cacheRef.current.set(paint.id, paint);
      });

      return {
        data: paints,
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

  // Custom render for paint option to show color
  const renderOption = useCallback((paint: Paint, isSelected: boolean) => {
    return (
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-2">
          <div
            className="w-4 h-4 rounded-full border border-border shrink-0"
            style={{ backgroundColor: paint.hex || "#ccc" }}
            title={paint.hex}
          />
          <span>{paint.name}</span>
        </div>
      </div>
    );
  }, []);

  return (
    <FormField
      control={control}
      name="paintIds"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Tintas do Logo</FormLabel>
          <FormControl>
            <Combobox<Paint>
              value={field.value || []}
              onValueChange={field.onChange}
              async={true}
              queryKey={["paints", "task-selector"]}
              queryFn={queryPaints}
              initialOptions={initialOptions}
              getOptionLabel={getOptionLabel}
              getOptionValue={getOptionValue}
              mode="multiple"
              placeholder="Selecione as tintas..."
              emptyText="Nenhuma tinta encontrada"
              searchPlaceholder="Pesquisar por código ou nome..."
              disabled={disabled}
              className="w-full"
              renderOption={renderOption}
              minSearchLength={0}
              pageSize={50}
              debounceMs={300}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
