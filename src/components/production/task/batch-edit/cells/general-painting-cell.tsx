// apps/web/src/components/production/task/batch-edit/cells/general-painting-cell.tsx

import { useMemo, useCallback } from "react";
import { FormField, FormItem, FormControl } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { getPaints } from "../../../../../api-client";
import type { Paint } from "../../../../../types";
import { PAINT_FINISH, PAINT_FINISH_LABELS, TRUCK_MANUFACTURER_LABELS } from "../../../../../constants";
import { CanvasNormalMapRenderer } from "@/components/painting/effects/canvas-normal-map-renderer";

interface GeneralPaintingCellProps {
  control: any;
  index: number;
  initialPaint?: Paint | null;
}

export function GeneralPaintingCell({ control, index, initialPaint }: GeneralPaintingCellProps) {
  // Memoize initial options to prevent infinite loops
  const initialOptions = useMemo(() =>
    initialPaint ? [initialPaint] : [],
    [initialPaint?.id]
  );

  // Memoize callbacks
  const getOptionLabel = useCallback((paint: Paint) => paint.name, []);
  const getOptionValue = useCallback((paint: Paint) => paint.id, []);

  // Search function for Combobox
  const searchPaints = useCallback(async (
    search: string,
    page: number = 1
  ): Promise<{ data: Paint[]; hasMore: boolean }> => {
    const params: any = {
      orderBy: { name: "asc" },
      page,
      take: 50,
      include: {
        paintType: true,
        paintBrand: true,
      },
    };

    if (search && search.trim()) {
      params.searchingFor = search.trim();
    }

    try {
      const response = await getPaints(params);
      return {
        data: response.data || [],
        hasMore: response.meta?.hasNextPage || false,
      };
    } catch (error) {
      console.error("Erro ao buscar tintas:", error);
      return { data: [], hasMore: false };
    }
  }, []);

  // Custom render function for paint items with preview
  const renderPaintItem = useCallback((paint: Paint, _isSelected: boolean) => {
    const color = paint.hex || "#888888";

    return (
      <div className="flex items-center gap-3 w-full">
        {/* Square color preview - prefer colorPreview image */}
        {paint.colorPreview ? (
          <div className="w-6 h-6 rounded ring-1 ring-border shadow-sm flex-shrink-0 overflow-hidden">
            <img src={paint.colorPreview} alt={paint.name} className="w-full h-full object-cover" loading="lazy" />
          </div>
        ) : paint.finish ? (
          <div className="w-6 h-6 rounded ring-1 ring-border shadow-sm flex-shrink-0 overflow-hidden">
            <CanvasNormalMapRenderer baseColor={color} finish={paint.finish as PAINT_FINISH} width={24} height={24} quality="low" className="w-full h-full" />
          </div>
        ) : (
          <div className="w-6 h-6 rounded ring-1 ring-border shadow-sm flex-shrink-0" style={{ backgroundColor: color }} />
        )}

        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">{paint.name}</div>
          <div className="text-xs flex items-center gap-2 mt-0.5 flex-wrap">
            {paint.paintType?.name && <span className="font-medium">{paint.paintType.name}</span>}
            {paint.finish && (
              <>
                <span className="opacity-60">•</span>
                <span>{PAINT_FINISH_LABELS[paint.finish]}</span>
              </>
            )}
            {paint.manufacturer && (
              <>
                <span className="opacity-60">•</span>
                <span>{TRUCK_MANUFACTURER_LABELS[paint.manufacturer]}</span>
              </>
            )}
            {paint.paintBrand?.name && (
              <>
                <span className="opacity-60">•</span>
                <span>{paint.paintBrand?.name}</span>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }, []);

  return (
    <FormField
      control={control}
      name={`tasks.${index}.data.paintId`}
      render={({ field }) => (
        <FormItem>
          <FormControl>
            <Combobox<Paint>
              value={field.value || ""}
              onValueChange={(value) => field.onChange(value || null)}
              placeholder="Selecionar tinta"
              emptyText="Nenhuma tinta encontrada"
              searchPlaceholder="Buscar tinta..."
              getOptionLabel={getOptionLabel}
              getOptionValue={getOptionValue}
              async={true}
              queryKey={["paints", "batch-edit-cell", index]}
              queryFn={searchPaints}
              minSearchLength={0}
              initialOptions={initialOptions}
              renderOption={renderPaintItem}
              clearable
              searchable
            />
          </FormControl>
        </FormItem>
      )}
    />
  );
}
