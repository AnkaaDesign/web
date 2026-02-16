import { useMemo, useCallback } from "react";
import { useWatch } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { getPaints, getPaintById } from "../../../../api-client";
import type { Paint } from "../../../../types";

interface SinglePaintSelectorProps {
  control: any;
  disabled?: boolean;
  initialPaint?: Paint;
}

export function SinglePaintSelector({ control, disabled, initialPaint }: SinglePaintSelectorProps) {
  // Watch paintId from form state - persists across accordion unmount/remount
  const selectedPaintId = useWatch({ control, name: "paintId" }) as string | undefined;

  // Fetch selected paint details by ID - React Query cache persists across unmount/remount
  const { data: selectedPaintData } = useQuery({
    queryKey: ["paints", "selected-detail", selectedPaintId],
    queryFn: async () => {
      if (!selectedPaintId) return null;
      const response = await getPaintById(selectedPaintId);
      return response.data || null;
    },
    enabled: !!selectedPaintId && selectedPaintId !== initialPaint?.id,
    staleTime: 5 * 60 * 1000,
  });

  // Memoize initialOptions - include selected paint data for accordion remount scenarios
  const initialOptions = useMemo(() => {
    const options: Paint[] = [];
    if (initialPaint) options.push(initialPaint);
    if (selectedPaintData && selectedPaintData.id !== initialPaint?.id) {
      options.push(selectedPaintData);
    }
    return options;
  }, [initialPaint?.id, selectedPaintData?.id]);

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

  return (
    <FormField
      control={control}
      name="paintId"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Tinta Geral</FormLabel>
          <FormControl>
            <Combobox<Paint>
              value={field.value || ""}
              onValueChange={field.onChange}
              async={true}
              queryKey={["paints", "single-selector"]}
              queryFn={queryPaints}
              initialOptions={initialOptions}
              getOptionLabel={getOptionLabel}
              getOptionValue={getOptionValue}
              placeholder="Selecione uma tinta..."
              emptyText="Nenhuma tinta encontrada"
              searchPlaceholder="Pesquisar por código ou nome..."
              disabled={disabled}
              className="w-full"
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
