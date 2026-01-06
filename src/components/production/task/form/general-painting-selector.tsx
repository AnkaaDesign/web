import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Combobox } from "@/components/ui/combobox";
import { getPaints } from "../../../../api-client";
import type { Paint } from "../../../../types";
import { PAINT_FINISH_LABELS, TRUCK_MANUFACTURER_LABELS, PAINT_FINISH } from "../../../../constants";
import { IconX, IconFlask } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { CanvasNormalMapRenderer } from "@/components/painting/effects/canvas-normal-map-renderer";

interface GeneralPaintingSelectorProps {
  control: any;
  disabled?: boolean;
  initialPaint?: Paint;
}

export function GeneralPaintingSelector({ control, disabled, initialPaint }: GeneralPaintingSelectorProps) {
  // Cache of selected paint to display details
  const [selectedPaint, setSelectedPaint] = useState<Paint | null>(initialPaint || null);
  const paintsCache = useRef<Map<string, Paint>>(new Map());

  // Memoize initialOptions to prevent infinite loop
  const initialOptions = useMemo(() => initialPaint ? [initialPaint] : [], [initialPaint?.id]);

  // Memoize callbacks to prevent infinite loop
  const getOptionLabel = useCallback((paint: Paint) => paint.name, []);
  const getOptionValue = useCallback((paint: Paint) => paint.id, []);

  // Initialize cache with initial paint
  useEffect(() => {
    if (initialPaint) {
      paintsCache.current.set(initialPaint.id, initialPaint);
    }
  }, [initialPaint]);

  // Search function for Combobox
  const searchPaints = async (
    search: string,
    page: number = 1,
  ): Promise<{
    data: Paint[];
    hasMore: boolean;
  }> => {
    const params: any = {
      orderBy: { name: "asc" },
      page: page,
      take: 50,
      include: {
        paintType: true,
        paintBrand: true,
        formulas: true,
        _count: {
          select: {
            formulas: true,
          },
        },
      },
    };

    // Only add searchingFor if there's actually a search query
    if (search && search.trim()) {
      params.searchingFor = search.trim();
    }

    try {
      const response = await getPaints(params);

      const paints = response.data || [];
      const hasMore = response.meta?.hasNextPage || false;

      // Cache all paints we fetch for later display
      paints.forEach(paint => {
        paintsCache.current.set(paint.id, paint);
      });

      return {
        data: paints,
        hasMore: hasMore,
      };
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[GeneralPaintingSelector] Error fetching paints:', error);
      }
      return { data: [], hasMore: false };
    }
  };

  // Custom render function for paint items
  const renderPaintItem = (paint: Paint, isSelected: boolean) => {
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

        {/* Formula indicator */}
        <IconFlask
          className={cn(
            "h-4 w-4 flex-shrink-0 transition-colors",
            ((paint._count?.formulas ?? 0) > 0 || (paint.formulas?.length ?? 0) > 0)
              ? "text-green-600 group-hover:text-primary-foreground"
              : "text-destructive"
          )}
        />
      </div>
    );
  };

  return (
    <FormField
      control={control}
      name="paintId"
      render={({ field }) => {
        // Update selected paint when field value changes
        useEffect(() => {
          if (field.value) {
            const cachedPaint = paintsCache.current.get(field.value);
            if (cachedPaint) {
              setSelectedPaint(cachedPaint);
            }
          } else {
            setSelectedPaint(null);
          }
        }, [field.value]);

        return (
          <FormItem>
            <FormLabel>Pintura Geral</FormLabel>
            <FormControl>
              <div className="space-y-3">
                <Combobox<Paint>
                  value={field.value || null}
                  onValueChange={(value) => {
                    field.onChange(value);
                  }}
                  mode="single"
                  placeholder="Selecione a tinta para pintura geral..."
                  emptyText="Nenhuma tinta encontrada"
                  searchPlaceholder="Pesquisar por código ou nome da tinta..."
                  disabled={disabled}
                  async={true}
                  queryKey={["paints", "general-selector"]}
                  queryFn={searchPaints}
                  getOptionLabel={getOptionLabel}
                  getOptionValue={getOptionValue}
                  renderOption={(paint, isSelected) => renderPaintItem(paint, isSelected)}
                  minSearchLength={0}
                  pageSize={50}
                  debounceMs={300}
                  clearable={true}
                  initialOptions={initialOptions}
                />

                {/* Selected paint display with improved design */}
                {selectedPaint && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    <Badge
                      variant="secondary"
                      className="pl-2.5 pr-2.5 py-1.5 flex items-center gap-2 border cursor-pointer hover:bg-destructive hover:text-destructive-foreground transition-colors"
                      onClick={() => field.onChange(null)}
                    >
                      {selectedPaint.colorPreview ? (
                        <div className="w-4 h-4 rounded ring-1 ring-border shadow-sm overflow-hidden">
                          <img src={selectedPaint.colorPreview} alt={selectedPaint.name} className="w-full h-full object-cover" />
                        </div>
                      ) : selectedPaint.finish ? (
                        <div className="w-4 h-4 rounded ring-1 ring-border shadow-sm overflow-hidden">
                          <CanvasNormalMapRenderer
                            baseColor={selectedPaint.hex || "#888888"}
                            finish={selectedPaint.finish as PAINT_FINISH}
                            width={16}
                            height={16}
                            quality="low"
                            className="w-full h-full"
                          />
                        </div>
                      ) : (
                        <div
                          className="w-4 h-4 rounded ring-1 ring-border shadow-sm"
                          style={{ backgroundColor: selectedPaint.hex || "#888888" }}
                        />
                      )}
                      <span className="text-xs font-medium">{selectedPaint.name}</span>
                      {selectedPaint.paintType?.name && <span className="text-xs opacity-70">({selectedPaint.paintType.name})</span>}
                      <IconX className="h-3 w-3 ml-1" />
                    </Badge>
                  </div>
                )}
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}
