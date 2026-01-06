import { useMemo, useCallback } from "react";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { getPaints } from "../../../../api-client";
import type { Paint } from "../../../../types";
import type { TaskCreateFormData, TaskUpdateFormData } from "../../../../schemas";

interface SinglePaintSelectorProps {
  control: any;
  disabled?: boolean;
  initialPaint?: Paint;
}

export function SinglePaintSelector({ control, disabled, initialPaint }: SinglePaintSelectorProps) {
  // Memoize initialOptions to prevent infinite loop
  const initialOptions = useMemo(() => initialPaint ? [initialPaint] : [], [initialPaint?.id]);

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
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error fetching paints:", error);
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
