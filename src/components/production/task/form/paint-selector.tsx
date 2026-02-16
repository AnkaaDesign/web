import { useMemo, useCallback, useRef } from "react";
import { useWatch } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { getPaints } from "../../../../api-client";
import type { Paint } from "../../../../types";
interface PaintSelectorProps {
  control: any;
  disabled?: boolean;
  initialPaints?: Paint[];
}

export function PaintSelector({ control, disabled, initialPaints }: PaintSelectorProps) {
  // Create a stable cache for fetched paints
  const cacheRef = useRef<Map<string, Paint>>(new Map());

  // Watch paintIds from form state - persists across accordion unmount/remount
  const paintIds = useWatch({ control, name: "paintIds" }) as string[] | undefined;

  // Stable query key based on sorted paint IDs
  const selectedPaintsQueryKey = useMemo(
    () => (paintIds || []).slice().sort().join(","),
    [paintIds]
  );

  // Fetch selected paint details by IDs - React Query cache persists across unmount/remount
  const { data: selectedPaintDetails } = useQuery({
    queryKey: ["paints", "selected-details-selector", selectedPaintsQueryKey],
    queryFn: async () => {
      if (!paintIds || paintIds.length === 0) return [];
      const response = await getPaints({
        where: { id: { in: paintIds } },
        select: {
          id: true,
          name: true,
          code: true,
          hex: true,
          finish: true,
          colorPreview: true,
          _count: { select: { formulas: true } },
        },
        limit: paintIds.length,
      } as any);
      return response.data || [];
    },
    enabled: (paintIds?.length ?? 0) > 0,
    staleTime: 5 * 60 * 1000,
  });

  // Create stable dependency for initialPaints array
  const initialPaintIds = useMemo(
    () => (initialPaints || []).map(p => p.id).sort().join(','),
    [initialPaints]
  );

  // Memoize initialOptions - include selected paint details for accordion remount scenarios
  const initialOptions = useMemo(() => {
    const options: Paint[] = [];
    const addedIds = new Set<string>();

    // Add initial paints
    if (initialPaints && initialPaints.length > 0) {
      initialPaints.forEach(paint => {
        options.push(paint);
        addedIds.add(paint.id);
        cacheRef.current.set(paint.id, paint);
      });
    }

    // Add fetched selected paints not already in initial
    if (selectedPaintDetails && selectedPaintDetails.length > 0) {
      selectedPaintDetails.forEach(paint => {
        if (!addedIds.has(paint.id)) {
          options.push(paint);
          addedIds.add(paint.id);
        }
        cacheRef.current.set(paint.id, paint);
      });
    }

    return options;
  }, [initialPaintIds, initialPaints, selectedPaintDetails]);

  // Memoize callbacks to prevent infinite loop
  const getOptionLabel = useCallback((paint: Paint) => paint.name, []);
  const getOptionValue = useCallback((paint: Paint) => paint.id, []);

  // Async query function for the combobox
  const queryPaints = useCallback(async (searchTerm: string, page = 1) => {
    try {
      const queryParams: any = {
        orderBy: { name: "asc" },
        page: page,
        take: 20, // Reduced page size for better performance
        // Use select to only fetch needed fields
        select: {
          id: true,
          name: true,
          code: true,
          hex: true,
          finish: true,
          colorPreview: true,
          // Only count formulas, don't load the data
          _count: {
            select: {
              formulas: true,
            },
          },
        },
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
      return {
        data: [],
        hasMore: false,
      };
    }
  }, []);

  // Custom render for paint option to show color
  const renderOption = useCallback((paint: Paint, _isSelected: boolean) => {
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
          <FormLabel>Tintas da Logomarca</FormLabel>
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
              pageSize={20}
              debounceMs={500}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
