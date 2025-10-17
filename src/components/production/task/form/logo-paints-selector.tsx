import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { getPaints } from "../../../../api-client";
import type { Paint } from "../../../../types";
import { PAINT_FINISH_LABELS, TRUCK_MANUFACTURER_LABELS, PAINT_FINISH } from "../../../../constants";
import { IconX } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { CanvasNormalMapRenderer } from "@/components/paint/effects/canvas-normal-map-renderer";

interface LogoPaintsSelectorProps {
  control: any;
  disabled?: boolean;
  initialPaints?: Paint[];
}

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

export function LogoPaintsSelector({ control, disabled, initialPaints }: LogoPaintsSelectorProps) {
  // Cache of selected paints to display in badges
  const [selectedPaints, setSelectedPaints] = useState<Map<string, Paint>>(
    new Map((initialPaints || []).map(paint => [paint.id, paint]))
  );
  const paintsCache = useRef<Map<string, Paint>>(new Map());

  // Memoize initialOptions to prevent infinite loop
  const initialOptions = useMemo(() => initialPaints || [], [initialPaints?.map(p => p.id).join(',')]);

  // Memoize callbacks to prevent infinite loop
  const getOptionLabel = useCallback((paint: Paint) => paint.name, []);
  const getOptionValue = useCallback((paint: Paint) => paint.id, []);

  // Initialize cache with initial paints
  useEffect(() => {
    if (initialPaints) {
      initialPaints.forEach(paint => {
        paintsCache.current.set(paint.id, paint);
      });
    }
  }, [initialPaints]);

  // Search function for Combobox
  const searchPaints = async (
    search: string,
    page: number = 1,
  ): Promise<{
    data: Paint[];
    hasMore: boolean;
  }> => {
    console.log('[LogoPaintsSelector] searchPaints called:', { search, page });

    const params: any = {
      orderBy: { name: "asc" },
      page: page,
      take: 50,
      include: {
        paintType: true,
        paintBrand: true,
      },
    };

    // Only add searchingFor if there's actually a search query
    if (search && search.trim()) {
      params.searchingFor = search.trim();
    }

    console.log('[LogoPaintsSelector] API params:', params);

    try {
      const response = await getPaints(params);
      console.log('[LogoPaintsSelector] API response:', {
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
      console.error('[LogoPaintsSelector] Error fetching paints:', error);
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
      name="paintIds"
      render={({ field }) => {
        // Update selected paints when field value changes
        useEffect(() => {
          if (field.value && Array.isArray(field.value)) {
            const newSelectedPaints = new Map<string, Paint>();
            field.value.forEach((paintId: string) => {
              const cachedPaint = paintsCache.current.get(paintId);
              if (cachedPaint) {
                newSelectedPaints.set(paintId, cachedPaint);
              }
            });
            setSelectedPaints(newSelectedPaints);
          } else {
            setSelectedPaints(new Map());
          }
        }, [field.value]);

        return (
          <FormItem>
            <FormLabel>Tintas do Logo</FormLabel>
            <FormControl>
              <div className="space-y-3">
                <Combobox<Paint>
                  value={field.value || []}
                  onValueChange={(value) => {
                    field.onChange(value);
                  }}
                  mode="multiple"
                  placeholder="Selecione as tintas do logo..."
                  emptyText="Nenhuma tinta encontrada"
                  searchPlaceholder="Pesquisar por código ou nome da tinta..."
                  disabled={disabled}
                  async={true}
                  queryKey={["paints", "logo-selector"]}
                  queryFn={searchPaints}
                  getOptionLabel={getOptionLabel}
                  getOptionValue={getOptionValue}
                  renderOption={(paint, isSelected) => renderPaintItem(paint, isSelected)}
                  minSearchLength={0}
                  pageSize={50}
                  debounceMs={300}
                  showCount={true}
                  singleMode={false}
                  clearable={true}
                  initialOptions={initialOptions}
                />

                {/* Selected paints display with improved design */}
                {selectedPaints.size > 0 && (
                  <div className="rounded-lg border bg-muted/30 p-3">
                    <div className="flex flex-wrap gap-2">
                      {Array.from(selectedPaints.values()).map((paint) => {
                        const color = paint.hex || paletteColors[paint.palette || ""] || "#888888";

                        return (
                          <Badge key={paint.id} variant="secondary" className="pl-2.5 pr-1 py-1.5 flex items-center gap-2 border">
                            {paint.finish ? (
                              <div className="w-4 h-4 rounded border border-border shadow-sm overflow-hidden">
                                <CanvasNormalMapRenderer baseColor={color} finish={paint.finish as PAINT_FINISH} width={16} height={16} quality="low" className="w-full h-full" />
                              </div>
                            ) : (
                              <div className="w-4 h-4 rounded border border-border shadow-sm" style={{ backgroundColor: color }} />
                            )}
                            <span className="text-xs font-medium">{paint.name}</span>
                            {paint.paintType?.name && <span className="text-xs text-muted-foreground">({paint.paintType.name})</span>}
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-4 w-4 p-0 ml-1 hover:bg-transparent"
                              onClick={(e) => {
                                e.preventDefault();
                                const currentValue = field.value || [];
                                field.onChange(currentValue.filter((id: string) => id !== paint.id));
                              }}
                              disabled={disabled}
                            >
                              <IconX className="h-3 w-3" />
                            </Button>
                          </Badge>
                        );
                      })}
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
