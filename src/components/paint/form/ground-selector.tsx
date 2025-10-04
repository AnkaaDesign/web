import { useMemo } from "react";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import type { PaintCreateFormData, PaintUpdateFormData } from "../../../schemas";
import { getPaints } from "../../../api-client";
import { PAINT_BRAND_LABELS, PAINT_FINISH_LABELS } from "../../../constants";

interface GroundSelectorProps {
  control: any;
  disabled?: boolean;
  required?: boolean;
}

export function GroundSelector({ control, disabled, required }: GroundSelectorProps) {
  // Async query function for the combobox
  const queryPaints = useMemo(
    () => async (searchTerm: string, page = 1) => {
      try {
        // Build query parameters
        const queryParams: any = {
          orderBy: { name: "asc" },
          take: 50, // Load 50 items at a time
          skip: (page - 1) * 50,
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

        // Convert paints to options format
        const options = paints.map((paint) => ({
          value: paint.id,
          label: paint.name,
          description: paint.paintBrand?.name && paint.finish ? `${paint.paintBrand?.name} - ${PAINT_FINISH_LABELS[paint.finish]}` : undefined,
          metadata: {
            hex: paint.hex || undefined,
          },
        }));

        console.log(`Ground Paints Query - Page ${page}, Search: "${searchTerm}", Found: ${options.length} paints`);

        return {
          data: options,
          hasMore: response.data?.meta?.hasNextPage || false,
          total: response.data?.meta?.totalRecords || 0,
        };
      } catch (error) {
        console.error("Error fetching paints:", error);
        return {
          data: [],
          hasMore: false,
          total: 0,
        };
      }
    },
    []
  );

  return (
    <FormField
      control={control}
      name="groundIds"
      render={({ field }) => (
        <FormItem>
          <FormLabel>
            Fundo da Tinta
            {required && <span className="text-destructive ml-1">*</span>}
          </FormLabel>
          <FormControl>
            <Combobox
              async={true}
              queryKey={["ground-paints"]}
              queryFn={queryPaints}
              value={field.value || []}
              onValueChange={field.onChange}
              placeholder="Selecione os fundos"
              disabled={disabled}
              className="w-full"
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
