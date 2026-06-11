import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useWatch } from "react-hook-form";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Combobox } from "@/components/ui/combobox";
import { getPaints, getPaintById } from "../../../../api-client";
import type { Paint } from "../../../../types";
import { PAINT_FINISH_LABELS, TRUCK_MANUFACTURER_LABELS, PAINT_FINISH, SECTOR_PRIVILEGES } from "../../../../constants";
import { IconX, IconFlask, IconBriefcase } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { CanvasNormalMapRenderer } from "@/components/painting/effects/canvas-normal-map-renderer";
import { DesignarServiceOrderDialog, type ServiceOrderData } from "./designar-service-order-dialog";
import { PaintQuickCreateDialog } from "@/components/painting/form/paint-quick-create-dialog";

interface GeneralPaintingSelectorProps {
  control: any;
  disabled?: boolean;
  initialPaint?: Paint;
  onDesignarServiceOrder?: (serviceOrder: ServiceOrderData) => void;
  userPrivilege?: string;
  /** Enables creating a new paint inline when the search finds no results */
  allowQuickCreate?: boolean;
  /** Called after a paint is created inline (already selected in the form) */
  onPaintCreated?: (paint: Paint) => void;
  /** Subtitle for the quick-create dialog (context-specific) */
  quickCreateDescription?: string;
}

export function GeneralPaintingSelector({
  control,
  disabled,
  initialPaint,
  onDesignarServiceOrder,
  userPrivilege,
  allowQuickCreate,
  onPaintCreated,
  quickCreateDescription,
}: GeneralPaintingSelectorProps) {
  const queryClient = useQueryClient();

  // Quick-create is limited to the privileges allowed by POST /paints
  const canQuickCreate =
    !!allowQuickCreate &&
    !!userPrivilege &&
    (
      [
        SECTOR_PRIVILEGES.ADMIN,
        SECTOR_PRIVILEGES.WAREHOUSE,
        SECTOR_PRIVILEGES.COMMERCIAL,
        SECTOR_PRIVILEGES.FINANCIAL,
      ] as string[]
    ).includes(userPrivilege);
  // Cache of selected paint to display details
  const [selectedPaint, setSelectedPaint] = useState<Paint | null>(initialPaint || null);
  const paintsCache = useRef<Map<string, Paint>>(new Map());

  // Watch paintId from form state - persists across accordion unmount/remount
  const selectedPaintId = useWatch({ control, name: "paintId" }) as string | undefined;

  // Fetch selected paint details by ID - React Query cache persists across unmount/remount
  const { data: selectedPaintData } = useQuery({
    queryKey: ["paints", "selected-general-detail", selectedPaintId],
    queryFn: async () => {
      if (!selectedPaintId) return null;
      const response = await getPaintById(selectedPaintId, {
        select: {
          id: true,
          name: true,
          code: true,
          hex: true,
          finish: true,
          colorPreview: true,
          manufacturer: true,
          paintType: { select: { id: true, name: true, needGround: true } },
          paintBrand: { select: { id: true, name: true } },
          _count: { select: { formulas: true } },
        },
      } as any);
      return response.data || null;
    },
    enabled: !!selectedPaintId && selectedPaintId !== initialPaint?.id,
    staleTime: 5 * 60 * 1000,
  });

  // Update selectedPaint and cache when fetched data arrives
  useEffect(() => {
    if (selectedPaintData) {
      paintsCache.current.set(selectedPaintData.id, selectedPaintData);
      setSelectedPaint(selectedPaintData);
    }
  }, [selectedPaintData]);

  // State for Designar Service Order dialog
  const [designarDialogOpen, setDesignarDialogOpen] = useState(false);

  // State for inline paint quick-create dialog
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [quickCreateName, setQuickCreateName] = useState("");
  // Resolver for the Combobox onCreate promise — resolving with the created
  // paint lets the Combobox cache it, select it and close its popover
  const pendingCreateResolveRef = useRef<((paint: Paint | null) => void) | null>(null);

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
      take: 20, // Reduced page size for better performance
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
    <>
    <FormField
      control={control}
      name="paintId"
      render={({ field }) => {
        // Update selected paint when field value changes
        useEffect(() => {
          if (field.value) {
            // First check cache, then fall back to initialPaint
            const cachedPaint = paintsCache.current.get(field.value);
            if (cachedPaint) {
              setSelectedPaint(cachedPaint);
            } else if (initialPaint && initialPaint.id === field.value) {
              // Fallback to initialPaint if not in cache
              setSelectedPaint(initialPaint);
              paintsCache.current.set(field.value, initialPaint);
            }
          } else {
            setSelectedPaint(null);
          }
        }, [field.value, initialPaint]);

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
                  pageSize={20}
                  debounceMs={500}
                  clearable={true}
                  initialOptions={initialOptions}
                  allowCreate={canQuickCreate}
                  createLabel={(value) => `Cadastrar tinta "${value}"`}
                  onCreate={
                    canQuickCreate
                      ? (name: string) => {
                          setQuickCreateName(name);
                          setQuickCreateOpen(true);
                          // Resolved by the dialog with the created paint (or null on cancel)
                          return new Promise<Paint | null>((resolve) => {
                            pendingCreateResolveRef.current = resolve;
                          }) as Promise<any>;
                        }
                      : undefined
                  }
                  customEmptyAction={onDesignarServiceOrder ? {
                    label: "Designar Ordem de Serviço",
                    icon: <IconBriefcase className="mr-2 h-4 w-4" />,
                    onClick: () => {
                      setDesignarDialogOpen(true);
                    },
                  } : undefined}
                />

                {/* Selected paint display with improved design */}
                {selectedPaint && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    <Badge
                      variant="secondary"
                      className={cn(
                        "pl-2.5 pr-2.5 py-1.5 flex items-center gap-2 border transition-colors",
                        !disabled && "cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                      )}
                      onClick={disabled ? undefined : () => field.onChange(null)}
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
                      {!disabled && <IconX className="h-3 w-3 ml-1" />}
                    </Badge>
                  </div>
                )}
              </div>
            </FormControl>
            <FormMessage />

            {/* Inline paint quick-create dialog */}
            {canQuickCreate && (
              <PaintQuickCreateDialog
                open={quickCreateOpen}
                onOpenChange={(open) => {
                  setQuickCreateOpen(open);
                  // Cancelled without creating — release the Combobox onCreate promise
                  if (!open && pendingCreateResolveRef.current) {
                    pendingCreateResolveRef.current(null);
                    pendingCreateResolveRef.current = null;
                  }
                }}
                initialName={quickCreateName}
                description={quickCreateDescription}
                onPaintCreated={(paint) => {
                  // Seed local + query caches so the selector renders the new paint without refetching
                  paintsCache.current.set(paint.id, paint);
                  setSelectedPaint(paint);
                  queryClient.setQueryData(["paints", "selected-general-detail", paint.id], paint);
                  queryClient.invalidateQueries({ queryKey: ["paints", "general-selector"] });
                  if (pendingCreateResolveRef.current) {
                    // Combobox finishes the flow: caches the paint, selects it, closes the popover
                    pendingCreateResolveRef.current(paint);
                    pendingCreateResolveRef.current = null;
                  } else {
                    field.onChange(paint.id);
                  }
                  onPaintCreated?.(paint);
                }}
              />
            )}
          </FormItem>
        );
      }}
    />

    {/* Designar Service Order Dialog */}
    {onDesignarServiceOrder && (
      <DesignarServiceOrderDialog
        open={designarDialogOpen}
        onOpenChange={setDesignarDialogOpen}
        onServiceOrderCreated={onDesignarServiceOrder}
        userPrivilege={userPrivilege}
      />
    )}
    </>
  );
}
