import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { getPaints } from "../../../../api-client";
import type { Paint } from "../../../../types";
import { PAINT_FINISH_LABELS, TRUCK_MANUFACTURER_LABELS, PAINT_FINISH } from "../../../../constants";
import { IconX } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { CanvasNormalMapRenderer } from "@/components/paint/effects/canvas-normal-map-renderer";

const paletteColors: Record<string, string> = {
  BLACK: "#000000",
  GRAY: "#6B7280",
  WHITE: "#FFFFFF",
  SILVER: "#C0C0C0",
  GOLDEN: "#FFD700",
  YELLOW: "#FFEB3B",
  ORANGE: "#FF9800",
  BROWN: "#8B4513",
  RED: "#EF4444",
  PINK: "#EC4899",
  PURPLE: "#9333EA",
  BLUE: "#3B82F6",
  GREEN: "#22C55E",
  BEIGE: "#F5F5DC",
};

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
    console.log('[GeneralPaintingSelector] searchPaints called:', { search, page });

    const params: any = {
      orderBy: { name: "asc" },
      page: page,
      take: 20,
      include: {
        paintType: true,
        paintBrand: true,
      },
    };

    // Only add searchingFor if there's actually a search query
    if (search && search.trim()) {
      params.searchingFor = search.trim();
    }

    console.log('[GeneralPaintingSelector] API params:', params);

    try {
      const response = await getPaints(params);
      console.log('[GeneralPaintingSelector] API response:', {
        dataLength: response.data?.length,
        hasMore: response.meta?.hasNextPage,
        firstItem: response.data?.[0],
      });

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
      console.error('[GeneralPaintingSelector] Error fetching paints:', error);
      return { data: [], hasMore: false };
    }
  };

  // Custom render function for paint items
  const renderPaintItem = (paint: Paint, isSelected: boolean) => {
    const color = paint.hex || paletteColors[paint.palette || ""] || "#888888";

    return (
      <div className="flex items-center gap-3 w-full">
        {/* Square color preview with finish effect */}
        {paint.finish ? (
          <div className="w-6 h-6 rounded border border-border shadow-sm flex-shrink-0 overflow-hidden">
            <CanvasNormalMapRenderer baseColor={color} finish={paint.finish as PAINT_FINISH} width={24} height={24} quality="low" className="w-full h-full" />
          </div>
        ) : (
          <div className="w-6 h-6 rounded border border-border shadow-sm flex-shrink-0" style={{ backgroundColor: color }} />
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
  };

  return (
    <FormField
      control={control}
      name="generalPaintingId"
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
                  clearable={true}
                  initialOptions={initialOptions}
                />

                {/* Selected paint display with improved design */}
                {selectedPaint && (
                  <div className="rounded-lg border bg-muted/30 p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {selectedPaint.finish ? (
                          <div className="w-5 h-5 rounded border border-border shadow-sm overflow-hidden">
                            <CanvasNormalMapRenderer
                              baseColor={selectedPaint.hex || paletteColors[selectedPaint.palette || ""] || "#888888"}
                              finish={selectedPaint.finish as PAINT_FINISH}
                              width={20}
                              height={20}
                              quality="low"
                              className="w-full h-full"
                            />
                          </div>
                        ) : (
                          <div
                            className="w-5 h-5 rounded border border-border shadow-sm"
                            style={{ backgroundColor: selectedPaint.hex || paletteColors[selectedPaint.palette || ""] || "#888888" }}
                          />
                        )}
                        <span className="text-sm font-medium">{selectedPaint.name}</span>
                        {selectedPaint.paintType?.name && <span className="text-xs text-muted-foreground">({selectedPaint.paintType.name})</span>}
                      </div>
                      <Button type="button" variant="ghost" size="icon" className="h-5 w-5" onClick={() => field.onChange(null)} disabled={disabled}>
                        <IconX className="h-3 w-3" />
                      </Button>
                    </div>
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
