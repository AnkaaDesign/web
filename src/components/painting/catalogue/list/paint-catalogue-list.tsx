import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { usePaints, usePaintTypes, usePaintBrands, usePaintMerge } from "../../../../hooks";
import type { Paint, PaintOrderBy } from "../../../../types";
import type { PaintGetManyFormData } from "../../../../schemas";
import { PAINT_FINISH, TRUCK_MANUFACTURER } from "../../../../constants";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { IconFilter, IconMaximize, IconMinimize, IconTrash } from "@tabler/icons-react";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { PaintFilters } from "./paint-filters";
import { PaintGrid } from "./paint-grid";
import { PaintCardGridVirtualized } from "./paint-card-grid-virtualized";
import { SortSelector, type SortOption } from "./sort-selector";
import { FilterIndicators } from "@/components/ui/filter-indicator";
import { extractActiveFilters, createFilterRemover } from "./filter-utils";
import { cn } from "@/lib/utils";
import { ContextMenuProvider } from "@/components/ui/context-menu";
import { useTableFilters } from "@/hooks/common/use-table-filters";
import { PaintSelectionProvider, usePaintSelection } from "./paint-selection-context";
import { PaintMergeDialog } from "../merge/paint-merge-dialog";
import { IconX } from "@tabler/icons-react";
import { toast } from "@/components/ui/sonner";

interface PaintCatalogueListProps {
  className?: string;
  onOrderStateChange?: (hasChanges: boolean, orderedPaints: Paint[]) => void;
  onSaveOrderRequest?: () => void;
  onResetOrderRequest?: () => void;
  /** When true, disables reordering and selection features (for read-only access) */
  viewOnly?: boolean;
}

const DEFAULT_PAGE_SIZE = 60; // More items for color grid

interface SelectionInfoProps {
  selectedPaints: Paint[];
}

function SelectionInfo({ selectedPaints }: SelectionInfoProps) {
  const { clearSelection, toggleSelection } = usePaintSelection();

  if (selectedPaints.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted-foreground">Selecionados:</span>

      {selectedPaints.map((paint) => (
        <Badge
          key={paint.id}
          className={cn(
            "inline-flex items-center gap-2 px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer",
            "bg-neutral-400/20 text-neutral-600 border-border",
            "hover:bg-red-700 hover:text-white hover:border-red-700",
            "dark:bg-neutral-600 dark:text-neutral-300 dark:border-border",
            "dark:hover:bg-red-700 dark:hover:text-white dark:hover:border-red-700"
          )}
          onClick={() => toggleSelection(paint.id)}
        >
          <div className="w-3 h-3 rounded-full border border-white/30 overflow-hidden">
            {paint.colorPreview ? (
              <img src={paint.colorPreview} alt={paint.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full" style={{ backgroundColor: paint.hex }} />
            )}
          </div>
          <span>{paint.name}</span>
          <IconX className="h-3 w-3 ml-1" />
        </Badge>
      ))}

      <Button
        variant="ghost"
        size="sm"
        onClick={clearSelection}
        className={cn(
          "h-7 px-2 text-xs transition-colors",
          "text-muted-foreground hover:text-white",
          "hover:bg-red-700",
          "dark:hover:text-white dark:hover:bg-red-700"
        )}
      >
        <IconTrash className="h-3 w-3 mr-1" />
        Limpar todos
      </Button>
    </div>
  );
}

function PaintCatalogueListContent({ className, onOrderStateChange, onResetOrderRequest, viewOnly = false }: PaintCatalogueListProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { selectedPaintIds, clearSelection } = usePaintSelection();

  // Merge mutation
  const { mutateAsync: mergePaints } = usePaintMerge();

  // Merge dialog state
  const [showMergeDialog, setShowMergeDialog] = useState(false);

  // View state
  const [isMinimized, setIsMinimized] = useState(() => {
    // Check URL params first, then localStorage
    const view = searchParams.get("view");
    if (view) {
      return view !== "maximized";
    }
    const savedView = localStorage.getItem("paintCatalogueView");
    return savedView !== "maximized";
  });
  const [hasManualViewPreference, setHasManualViewPreference] = useState(() => {
    // Check if there's a saved preference in localStorage
    return localStorage.getItem("paintCatalogueView") !== null;
  });


  // Color order state
  const [, setHasOrderChanges] = useState(false);
  const [, setReorderedPaints] = useState<Paint[]>([]);
  const [gridResetKey, setGridResetKey] = useState(0);

  // Ref for scrolling
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);

  // Load paint types and paint brands for filter labels
  const { data: paintTypesData } = usePaintTypes({ orderBy: { name: "asc" } });
  const { data: paintBrandsData } = usePaintBrands({ orderBy: { name: "asc" } });

  const [showFilterModal, setShowFilterModal] = useState(false);

  // Sort state
  const [currentSort, setCurrentSort] = useState<SortOption>(() => {
    const sortParam = searchParams.get("sort");
    if (sortParam && ["name", "color", "type", "paintBrand", "finish", "manufacturer"].includes(sortParam)) {
      return sortParam as SortOption;
    }
    return "color"; // Default to color sorting
  });

  // Custom deserializer for paint filters
  const deserializePaintFilters = useCallback((params: URLSearchParams): Partial<PaintGetManyFormData> => {
    const filters: Partial<PaintGetManyFormData> = {};

    // Parse array filters
    const finishes = params.get("finishes");
    if (finishes) {
      filters.finishes = finishes.split(",") as PAINT_FINISH[];
    }

    const paintBrandIds = params.get("paintBrandIds");
    if (paintBrandIds) {
      filters.paintBrandIds = paintBrandIds.split(",");
    }

    const manufacturers = params.get("manufacturers");
    if (manufacturers) {
      filters.manufacturers = manufacturers.split(",") as TRUCK_MANUFACTURER[];
    }

    const paintTypeIds = params.get("paintTypeIds");
    if (paintTypeIds) {
      filters.paintTypeIds = paintTypeIds.split(",");
    }

    const tags = params.get("tags");
    if (tags) {
      filters.tags = tags.split(",");
    }

    const hasFormulas = params.get("hasFormulas");
    if (hasFormulas !== null) {
      filters.hasFormulas = hasFormulas === "true";
    }

    // Parse color similarity filters
    const similarColor = params.get("similarColor");
    if (similarColor && similarColor.trim() !== "" && similarColor !== "#000000") {
      filters.similarColor = similarColor;
    }

    const similarColorThreshold = params.get("similarColorThreshold");
    if (similarColorThreshold && !isNaN(Number(similarColorThreshold))) {
      filters.similarColorThreshold = Number(similarColorThreshold);
    }

    // Parse date range filters
    const createdAfter = params.get("createdAfter");
    const createdBefore = params.get("createdBefore");
    if (createdAfter || createdBefore) {
      filters.createdAt = {
        ...(createdAfter && { gte: new Date(createdAfter) }),
        ...(createdBefore && { lte: new Date(createdBefore) }),
      };
    }

    return filters;
  }, []);

  // Custom serializer for paint filters
  const serializePaintFilters = useCallback((filters: Partial<PaintGetManyFormData>): Record<string, string> => {
    const params: Record<string, string> = {};

    // Serialize array filters
    if (filters.finishes?.length) params.finishes = filters.finishes.join(",");
    if (filters.paintBrandIds?.length) params.paintBrandIds = filters.paintBrandIds.join(",");
    if (filters.manufacturers?.length) params.manufacturers = filters.manufacturers.join(",");
    if (filters.paintTypeIds?.length) params.paintTypeIds = filters.paintTypeIds.join(",");
    if (filters.tags?.length) params.tags = filters.tags.join(",");
    if (typeof filters.hasFormulas === "boolean") params.hasFormulas = String(filters.hasFormulas);

    // Color similarity filters
    if (filters.similarColor && filters.similarColor.trim() !== "" && filters.similarColor !== "#000000") {
      params.similarColor = filters.similarColor;
    }
    if (typeof filters.similarColorThreshold === "number") {
      params.similarColorThreshold = String(filters.similarColorThreshold);
    }

    // Date filters
    if (filters.createdAt?.gte) params.createdAfter = filters.createdAt.gte.toISOString();
    if (filters.createdAt?.lte) params.createdBefore = filters.createdAt.lte.toISOString();

    return params;
  }, []);

  // Use the unified table filters hook
  const {
    filters,
    setFilters,
    searchingFor,
    displaySearchText,
    setSearch,
    clearAllFilters,
    queryFilters: baseQueryFilters,
  } = useTableFilters<PaintGetManyFormData>({
    defaultFilters: {
      limit: DEFAULT_PAGE_SIZE,
    },
    searchDebounceMs: 500,
    searchParamName: "search",
    serializeToUrl: serializePaintFilters,
    deserializeFromUrl: deserializePaintFilters,
    excludeFromUrl: ["limit", "orderBy"],
  });

  // Update sort in URL when changed
  useEffect(() => {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        if (currentSort !== "color") {
          params.set("sort", currentSort);
        } else {
          params.delete("sort");
        }
        return params;
      },
      { replace: true },
    );
  }, [currentSort, setSearchParams]);

  // Handle sort change
  const handleSortChange = useCallback((sort: SortOption) => {
    setCurrentSort(sort);
  }, []);

  // Update view state in URL
  useEffect(() => {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        if (isMinimized) {
          params.delete("view");
        } else {
          params.set("view", "maximized");
        }
        return params;
      },
      { replace: true },
    );
  }, [isMinimized, setSearchParams]);



  // Query filters
  const queryFilters = useMemo(() => {
    const { orderBy: _, ...filterWithoutOrderBy } = baseQueryFilters;

    // Build orderBy based on current sort
    let orderBy: PaintOrderBy = {};
    switch (currentSort) {
      case "name":
        orderBy = { name: "asc" };
        break;
      case "color":
        orderBy = { colorOrder: "asc" };
        break;
      case "type":
        orderBy = { paintType: { name: "asc" } };
        break;
      case "brand":
        orderBy = { paintBrand: { name: "asc" } };
        break;
      case "finish":
        orderBy = { finish: "asc" };
        break;
      case "manufacturer":
        orderBy = { manufacturer: "asc" };
        break;
    }

    // Build final query object
    const result = {
      ...filterWithoutOrderBy,
      orderBy,
      limit: 1000, // Get all paints
      include: {
        paintType: true,
        paintBrand: true,
        _count: {
          select: {
            formulas: true,
            logoTasks: true,
            generalPaintings: true,
          },
        },
      },
    };

    return result;
  }, [baseQueryFilters, currentSort]);

  // Fetch paints
  const { data: paintsData, isLoading, refetch } = usePaints(queryFilters);

  // Fetch total count of all paints (without filters)
  const { data: totalPaintsData } = usePaints({ limit: 1 });

  // Check if color similarity filter is active
  const hasSimilarColorFilter = useMemo(() => {
    return filters.similarColor && filters.similarColor.trim() !== "" && filters.similarColor !== "#000000";
  }, [filters.similarColor]);

  // Process and sort paints for color display
  const sortedPaints = useMemo(() => {
    if (!paintsData?.data) return [];

    // If color similarity filter is active, the API already sorted by similarity - don't re-sort
    if (hasSimilarColorFilter) {
      return paintsData.data;
    }

    // If color sort is selected, use colorOrder (all paints have it now)
    if (currentSort === "color") {
      const sorted = [...paintsData.data].sort((a, b) => a.colorOrder - b.colorOrder);
      return sorted;
    }

    // For other sorts, the API already sorted them
    return paintsData.data;
  }, [paintsData?.data, currentSort, hasSimilarColorFilter]);

  // Get selected paints
  const selectedPaints = useMemo(() => {
    return sortedPaints.filter((paint) => selectedPaintIds.has(paint.id));
  }, [sortedPaints, selectedPaintIds]);

  // Handle merge action
  const handleMerge = useCallback(() => {
    if (selectedPaints.length < 2) {
      toast.error("Selecione pelo menos 2 tintas para mesclar");
      return;
    }
    setShowMergeDialog(true);
  }, [selectedPaints.length]);

  // Handle merge confirmation
  const handleMergeConfirm = useCallback(
    async (targetPaintId: string, resolutions: Record<string, any>) => {
      try {
        // Get all selected paint IDs
        const sourcePaintIds = Array.from(selectedPaintIds).filter((id) => id !== targetPaintId);

        // Call merge API
        await mergePaints({
          sourcePaintIds,
          targetPaintId,
          conflictResolutions: resolutions,
        });

        // Clear selection
        clearSelection();

        // Close dialog
        setShowMergeDialog(false);
      } catch (error) {
        // Error is handled by the API client
        if (process.env.NODE_ENV !== 'production') {
          console.error("Erro ao mesclar tintas:", error);
        }
      }
    },
    [selectedPaintIds, mergePaints, clearSelection],
  );

  // Automatically switch to maximized view if less than 8 results (only if user hasn't manually set preference)
  useEffect(() => {
    if (!hasManualViewPreference && sortedPaints.length > 0 && sortedPaints.length < 8 && isMinimized) {
      setIsMinimized(false);
      localStorage.setItem("paintCatalogueView", "maximized");
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          params.set("view", "maximized");
          return params;
        },
        { replace: true },
      );
    }
  }, [sortedPaints.length, isMinimized, setSearchParams, hasManualViewPreference]);

  // Handle filter changes
  const handleFilterChange = useCallback(
    (newFilters: Partial<PaintGetManyFormData>) => {
      // Remove orderBy from filters to avoid conflicts with sort management
      const { orderBy: _, ...filtersWithoutOrderBy } = newFilters;
      setFilters(filtersWithoutOrderBy);
    },
    [setFilters],
  );

  // Handle filter removal
  const baseOnRemoveFilter = createFilterRemover(filters, handleFilterChange);

  // Wrap to also handle searchingFor
  const onRemoveFilter = useCallback(
    (key: string, value?: any) => {
      if (key === "searchingFor") {
        setSearch("");
      } else {
        baseOnRemoveFilter(key, value);
      }
    },
    [baseOnRemoveFilter, setSearch],
  );

  // Extract active filters for display
  const activeFilters = useMemo(() => {
    if (!paintTypesData?.data || !paintBrandsData?.data) return [];

    // Include searchingFor in the filters object for extraction
    const filtersWithSearch = {
      ...filters,
      searchingFor: searchingFor || undefined,
    };

    return extractActiveFilters(filtersWithSearch, onRemoveFilter, {
      paintTypes: paintTypesData.data,
      paintBrands: paintBrandsData.data,
    });
  }, [filters, searchingFor, paintTypesData?.data, paintBrandsData?.data, onRemoveFilter]);

  // Count active filters (excluding search)
  const hasActiveFilters = useMemo(() => {
    let count = 0;
    if (filters.paintTypeIds?.length) count++;
    if (filters.paintBrandIds?.length) count++;
    if (filters.finishes?.length) count++;
    if (filters.manufacturers?.length) count++;
    if (filters.hasFormulas !== undefined) count++;
    if (filters.similarColor && filters.similarColor.trim() !== "" && filters.similarColor !== "#000000") count++;
    return count > 0;
  }, [filters]);

  const totalFilterCount = useMemo(() => {
    let count = 0;
    if (filters.paintTypeIds?.length) count += filters.paintTypeIds.length;
    if (filters.paintBrandIds?.length) count += filters.paintBrandIds.length;
    if (filters.finishes?.length) count += filters.finishes.length;
    if (filters.manufacturers?.length) count += filters.manufacturers.length;
    if (filters.hasFormulas !== undefined) count++;
    if (filters.similarColor && filters.similarColor.trim() !== "" && filters.similarColor !== "#000000") count++;
    return count;
  }, [filters]);


  // Handle paint click in minimized view
  const handlePaintClick = useCallback((paint: Paint) => {
    setIsMinimized(false);
    // Scroll to the paint in maximized view after a short delay
    setTimeout(() => {
      const element = document.getElementById(`paint-card-${paint.id}`);
      if (element && scrollContainerRef.current) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 300);
  }, []);

  // Toggle view
  const toggleView = () => {
    const newIsMinimized = !isMinimized;
    setIsMinimized(newIsMinimized);
    setHasManualViewPreference(true);
    // Save to localStorage
    localStorage.setItem("paintCatalogueView", newIsMinimized ? "minimized" : "maximized");
  };

  // Handle order change from drag-and-drop
  const handleOrderChange = useCallback((newOrder: Paint[]) => {
    setReorderedPaints(newOrder);
    setHasOrderChanges(true);
    if (onOrderStateChange) {
      onOrderStateChange(true, newOrder);
    }
  }, [onOrderStateChange]);

  // Expose reset handler
  useEffect(() => {
    if (onResetOrderRequest) {
      // Store the handler to be called from parent
      (window as any).__resetPaintOrder = () => {
        setReorderedPaints(sortedPaints);
        setHasOrderChanges(false);
        setGridResetKey(prev => prev + 1); // Force grid remount to reset positions
        if (onOrderStateChange) {
          onOrderStateChange(false, sortedPaints);
        }
      };
    }
    return () => {
      delete (window as any).__resetPaintOrder;
    };
  }, [sortedPaints, onOrderStateChange, onResetOrderRequest]);

  // Expose refetch handler for after save
  useEffect(() => {
    (window as any).__paintOrderSaved = () => {
      refetch();
      setHasOrderChanges(false);
    };
    return () => {
      delete (window as any).__paintOrderSaved;
    };
  }, [refetch]);

  return (
    <ContextMenuProvider>
      <Card className={cn("w-full flex flex-col shadow-sm border border-border", className)}>
        <CardContent className="flex-1 flex flex-col p-4 space-y-4 overflow-hidden w-full">
          {/* Search and controls */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex-1">
              <TableSearchInput
                value={displaySearchText}
                onChange={setSearch}
                placeholder="Buscar por nome, código hex, marca, tags, tarefas, clientes..."
                isPending={displaySearchText !== searchingFor}
                suffix={!isLoading ? `${sortedPaints.length} de ${totalPaintsData?.meta?.totalRecords ?? sortedPaints.length} tintas` : undefined}
              />
            </div>
            <div className="flex items-center gap-2">
              {/* Filter Button */}
              <Button variant={hasActiveFilters ? "default" : "outline"} size="default" onClick={() => setShowFilterModal(true)}>
                <IconFilter className="h-4 w-4" />
                <span>
                  Filtros
                  {hasActiveFilters ? ` (${totalFilterCount})` : ""}
                </span>
              </Button>

              {/* Sort Selector */}
              <SortSelector
                currentSort={currentSort}
                onSortChange={handleSortChange}
                disabled={hasSimilarColorFilter}
                disabledLabel="Similaridade"
              />

              {/* View Toggle Button */}
              <Button variant="outline" size="icon" onClick={toggleView} title={isMinimized ? "Maximizar" : "Minimizar"}>
                {isMinimized ? <IconMaximize className="h-4 w-4" /> : <IconMinimize className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Active Filter Indicators */}
          {activeFilters.length > 0 && <FilterIndicators filters={activeFilters} onClearAll={clearAllFilters} />}

          {/* Selection Info - only show when not in viewOnly mode */}
          {!viewOnly && <SelectionInfo selectedPaints={selectedPaints} />}


          {/* Paint display with smooth transitions */}
          <div ref={scrollContainerRef} className="flex-1 min-h-0 relative overflow-auto w-full">
            {isMinimized ? (
              <PaintGrid key={gridResetKey} paints={sortedPaints} isLoading={isLoading} onPaintClick={handlePaintClick} onOrderChange={handleOrderChange} />
            ) : (
              <PaintCardGridVirtualized paints={sortedPaints} isLoading={isLoading} onFilterChange={handleFilterChange} currentFilters={filters} onMerge={handleMerge} />
            )}
          </div>
        </CardContent>

          {/* Filter Modal */}
          <PaintFilters open={showFilterModal} onOpenChange={setShowFilterModal} filters={filters} onFilterChange={handleFilterChange} />

          {/* Merge Dialog - only show when not in viewOnly mode */}
          {!viewOnly && (
            <PaintMergeDialog
              open={showMergeDialog}
              onOpenChange={setShowMergeDialog}
              paints={selectedPaints}
              onMerge={handleMergeConfirm}
            />
          )}
      </Card>
    </ContextMenuProvider>
  );
}

export function PaintCatalogueList({ className, onOrderStateChange, onSaveOrderRequest, onResetOrderRequest, viewOnly = false }: PaintCatalogueListProps) {
  return (
    <PaintSelectionProvider>
      <PaintCatalogueListContent
        className={className}
        onOrderStateChange={onOrderStateChange}
        onSaveOrderRequest={onSaveOrderRequest}
        onResetOrderRequest={onResetOrderRequest}
        viewOnly={viewOnly}
      />
    </PaintSelectionProvider>
  );
}
