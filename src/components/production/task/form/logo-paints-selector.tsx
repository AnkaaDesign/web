import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Combobox } from "@/components/ui/combobox";
import { getPaints } from "../../../../api-client";
import type { Paint } from "../../../../types";
import { PAINT_FINISH_LABELS, TRUCK_MANUFACTURER_LABELS, PAINT_FINISH } from "../../../../constants";
import { IconX, IconFlask } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { CanvasNormalMapRenderer } from "@/components/painting/effects/canvas-normal-map-renderer";

interface LogoPaintsSelectorProps {
  control: any;
  disabled?: boolean;
  initialPaints?: Paint[];
}

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
    const params: any = {
      orderBy: { name: "asc" },
      page: page,
      take: 15, // Reduced page size for multi-select performance
      // Use select instead of include to avoid loading full formulas
      select: {
        id: true,
        name: true,
        code: true,
        hex: true,
        finish: true,
        colorPreview: true,
        manufacturer: true,
        // Only get the IDs and names of related entities
        paintType: {
          select: {
            id: true,
            name: true,
            needGround: true,
          },
        },
        paintBrand: {
          select: {
            id: true,
            name: true,
          },
        },
        // Only get the count of formulas, not the actual data
        _count: {
          select: {
            formulas: true,
          },
        },
        // DO NOT include formulas data - only count is needed
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
      return { data: [], hasMore: false };
    }
  };

  // Custom render function for paint items
  const renderPaintItem = (paint: Paint, _isSelected: boolean) => {
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
      name="paintIds"
      render={({ field }) => {
        // Update selected paints when field value changes
        useEffect(() => {
          if (field.value && Array.isArray(field.value)) {
            const newSelectedPaints = new Map<string, Paint>();
            field.value.forEach((paintId: string) => {
              // First check cache, then fall back to initialPaints
              const cachedPaint = paintsCache.current.get(paintId);
              if (cachedPaint) {
                newSelectedPaints.set(paintId, cachedPaint);
              } else {
                // Fallback to initialPaints if not in cache
                const initialPaint = initialPaints?.find(p => p.id === paintId);
                if (initialPaint) {
                  newSelectedPaints.set(paintId, initialPaint);
                  // Also add to cache for future lookups
                  paintsCache.current.set(paintId, initialPaint);
                }
              }
            });
            setSelectedPaints(newSelectedPaints);
          } else {
            setSelectedPaints(new Map());
          }
        }, [field.value, initialPaints]);

        return (
          <FormItem>
            <FormLabel>Tintas da Logomarca</FormLabel>
            <FormControl>
              <div className="space-y-3">
                <Combobox<Paint>
                  value={field.value || []}
                  onValueChange={(value) => {
                    field.onChange(value);
                  }}
                  mode="multiple"
                  placeholder="Selecione as tintas da logomarca..."
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
                  pageSize={15}  // Reduced for multi-select performance
                  debounceMs={500}  // Increased debounce for less API calls
                  showCount={true}
                  singleMode={false}
                  clearable={true}
                  loadOnMount={false}  // Enable lazy loading
                  initialOptions={initialOptions}
                  hideDefaultBadges={true}
                />

                {/* Selected paints display with improved design */}
                {selectedPaints.size > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {Array.from(selectedPaints.values()).map((paint) => {
                      const color = paint.hex || "#888888";

                      return (
                        <Badge
                          key={paint.id}
                          variant="secondary"
                          className={cn(
                            "pl-2.5 pr-2.5 py-1.5 flex items-center gap-2 border transition-colors",
                            !disabled && "cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                          )}
                          onClick={disabled ? undefined : (e) => {
                            e.preventDefault();
                            const currentValue = field.value || [];
                            field.onChange(currentValue.filter((id: string) => id !== paint.id));
                          }}
                        >
                          {paint.colorPreview ? (
                            <div className="w-4 h-4 rounded ring-1 ring-border shadow-sm overflow-hidden">
                              <img src={paint.colorPreview} alt={paint.name} className="w-full h-full object-cover" />
                            </div>
                          ) : paint.finish ? (
                            <div className="w-4 h-4 rounded ring-1 ring-border shadow-sm overflow-hidden">
                              <CanvasNormalMapRenderer baseColor={color} finish={paint.finish as PAINT_FINISH} width={16} height={16} quality="low" className="w-full h-full" />
                            </div>
                          ) : (
                            <div className="w-4 h-4 rounded ring-1 ring-border shadow-sm" style={{ backgroundColor: color }} />
                          )}
                          <span className="text-xs font-medium">{paint.name}</span>
                          {paint.paintType?.name && <span className="text-xs opacity-70">({paint.paintType.name})</span>}
                          {!disabled && <IconX className="h-3 w-3 ml-1" />}
                        </Badge>
                      );
                    })}
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
