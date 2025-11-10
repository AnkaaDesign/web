import React, { useState, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { usePaintProductions, usePaintTypes, usePaintProductionMutations, usePaintProductionBatchMutations } from "../../../../hooks";
import type { PaintProduction } from "../../../../types";
import type { PaintProductionGetManyFormData } from "../../../../schemas";
import { routes } from "../../../../constants";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { Badge } from "@/components/ui/badge";
import { SimplePaginationAdvanced } from "@/components/ui/pagination-advanced";
import { useTableState, convertSortConfigsToOrderBy } from "@/hooks/use-table-state";
import { useTableFilters } from "@/hooks/use-table-filters";
import { IconFilter, IconFlask, IconExternalLink, IconChevronDown, IconChevronUp, IconSelector, IconTrash, IconAlertTriangle } from "@tabler/icons-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { PositionedDropdownMenuContent } from "@/components/ui/positioned-dropdown-menu";
import { cn } from "@/lib/utils";
import { PaintProductionFilters } from "@/components/painting/production/filters/paint-production-filters";
import { FilterIndicators } from "@/components/painting/production/filters/filter-indicator";
import { extractActiveFilters, createFilterRemover } from "@/components/painting/production/filters/filter-utils";
import { ShowSelectedToggle } from "@/components/ui/show-selected-toggle";
import { PaintProductionSkeleton } from "./paint-production-skeleton";
import { createPaintProductionColumns, getDefaultVisibleColumns } from "./paint-production-table-columns";
import type { PaintProductionColumn } from "./paint-production-table-columns";
import { ColumnVisibilityManager } from "./column-visibility-manager";
import { TABLE_LAYOUT } from "@/components/ui/table-constants";
import { useScrollbarWidth } from "@/hooks/use-scrollbar-width";
import { Checkbox } from "@/components/ui/checkbox";
import { TruncatedTextWithTooltip } from "@/components/ui/truncated-text-with-tooltip";
import { useColumnVisibility } from "@/hooks/use-column-visibility";
import { PaintProductionExport } from "./paint-production-export";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface PaintProductionListProps {
  className?: string;
}

const DEFAULT_PAGE_SIZE = 40;

export function PaintProductionList({ className }: PaintProductionListProps) {
  const navigate = useNavigate();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Use URL state management for pagination, sorting, and selection
  const {
    page: currentPage,
    pageSize,
    selectedIds,
    sortConfigs,
    showSelectedOnly,
    setPage,
    setPageSize,
    toggleSelection,
    toggleSelectAll,
    toggleSort,
    getSortDirection,
    getSortOrder,
    isSelected,
    isAllSelected,
    isPartiallySelected,
    selectionCount,
    toggleShowSelectedOnly,
  } = useTableState({
    defaultPageSize: DEFAULT_PAGE_SIZE,
    resetSelectionOnPageChange: false,
  });

  const [showFilterModal, setShowFilterModal] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    production: PaintProduction;
  } | null>(null);

  // Use viewport boundary checking hook

  // Delete confirmation dialog state - supports single or batch delete
  const [deleteDialog, setDeleteDialog] = useState<{ production: PaintProduction } | { productions: PaintProduction[] } | null>(null);

  // Column visibility state with localStorage persistence
  const { visibleColumns, setVisibleColumns } = useColumnVisibility("paint-production-list-visible-columns", getDefaultVisibleColumns());

  // Load paint types for filter labels
  const { data: paintTypesData } = usePaintTypes({ orderBy: { name: "asc" } });

  // Get mutation functions
  const { deleteAsync: deletePaintProduction, isDeleting } = usePaintProductionMutations();
  const { batchDeleteAsync: batchDeletePaintProductions, isBatchDeleting } = usePaintProductionBatchMutations();

  // Custom deserializer for paint production filters
  const deserializePaintProductionFilters = useCallback((params: URLSearchParams): Partial<PaintProductionGetManyFormData> => {
    const filters: Partial<PaintProductionGetManyFormData> = {};

    // Parse paint type IDs
    const paintTypeIds = params.get("paintTypeIds");
    if (paintTypeIds) {
      filters.paintTypeIds = paintTypeIds.split(",");
    }

    // Parse paint finishes
    const paintFinishes = params.get("paintFinishes");
    if (paintFinishes) {
      filters.paintFinishes = paintFinishes.split(",") as any[];
    }

    // Parse paint brands
    const paintBrands = params.get("paintBrands");
    if (paintBrands) {
      filters.paintBrands = paintBrands.split(",") as any[];
    }

    // Parse volume range
    const volumeMin = params.get("volumeMin");
    const volumeMax = params.get("volumeMax");
    if (volumeMin || volumeMax) {
      filters.volumeRange = {
        ...(volumeMin && { min: parseFloat(volumeMin) }),
        ...(volumeMax && { max: parseFloat(volumeMax) }),
      };
    }

    // Parse date ranges
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

  // Custom serializer for paint production filters
  const serializePaintProductionFilters = useCallback((filters: Partial<PaintProductionGetManyFormData>): Record<string, string> => {
    const params: Record<string, string> = {};

    if (filters.paintTypeIds?.length) {
      params.paintTypeIds = filters.paintTypeIds.join(",");
    }
    if (filters.paintFinishes?.length) {
      params.paintFinishes = filters.paintFinishes.join(",");
    }
    if (filters.paintBrands?.length) {
      params.paintBrands = filters.paintBrands.join(",");
    }
    if (filters.volumeRange?.min !== undefined) {
      params.volumeMin = filters.volumeRange.min.toString();
    }
    if (filters.volumeRange?.max !== undefined) {
      params.volumeMax = filters.volumeRange.max.toString();
    }
    if (filters.createdAt?.gte) {
      params.createdAfter = filters.createdAt.gte.toISOString();
    }
    if (filters.createdAt?.lte) {
      params.createdBefore = filters.createdAt.lte.toISOString();
    }

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
    hasActiveFilters,
  } = useTableFilters<PaintProductionGetManyFormData>({
    defaultFilters: {
      limit: DEFAULT_PAGE_SIZE,
    },
    searchDebounceMs: 300,
    searchParamName: "search",
    serializeToUrl: serializePaintProductionFilters,
    deserializeFromUrl: deserializePaintProductionFilters,
    excludeFromUrl: ["limit", "orderBy"],
  });

  // Memoize include configuration
  const includeConfig = React.useMemo(
    () => ({
      formula: {
        include: {
          paint: {
            include: {
              paintType: true, // Include paint type for display
              paintBrand: true, // Include paint brand for display
            },
          },
        },
      },
    }),
    [],
  );

  // Query filters to pass to the API
  const queryFilters = useMemo(() => {
    const { orderBy: _, ...filterWithoutOrderBy } = baseQueryFilters;

    return {
      ...filterWithoutOrderBy,
      limit: DEFAULT_PAGE_SIZE,
    };
  }, [baseQueryFilters]);

  // Memoize query parameters to prevent unnecessary re-fetches
  const queryParams = React.useMemo(
    () => ({
      ...queryFilters,
      page: currentPage,
      limit: pageSize,
      include: includeConfig,
      // Convert sortConfigs to orderBy format for API
      ...(sortConfigs.length > 0 && {
        orderBy: convertSortConfigsToOrderBy(sortConfigs),
      }),
      // Filter by selected IDs when showSelectedOnly is true
      ...(showSelectedOnly &&
        selectedIds.length > 0 && {
          where: {
            ...queryFilters.where,
            id: { in: selectedIds },
          },
        }),
    }),
    [queryFilters, currentPage, pageSize, includeConfig, sortConfigs, showSelectedOnly, selectedIds],
  );

  // Fetch productions with pagination
  const { data: response, isLoading, error } = usePaintProductions(queryParams);

  // Extract productions and pagination info
  const productions = response?.data || [];
  const totalPages = response?.meta ? Math.ceil(response.meta.totalRecords / pageSize) : 1;
  const totalRecords = response?.meta?.totalRecords || 0;

  // Navigate to production details
  const handleViewDetails = (production: PaintProduction) => {
    navigate(routes.painting.productions.details(production.id));
  };

  // Context menu handlers
  const handleContextMenu = (e: React.MouseEvent, production: PaintProduction) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      production,
    });
  };

  const handleDelete = () => {
    if (contextMenu) {
      setDeleteDialog({ production: contextMenu.production });
      setContextMenu(null);
    }
  };

  const confirmDelete = async (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent dialog from auto-closing

    if (!deleteDialog) {
      console.error("No deleteDialog found");
      return;
    }

    if (isDeleting || isBatchDeleting) {
      console.log("Already deleting, skipping...");
      return;
    }

    try {
      // Check if it's a batch delete or single delete
      if ("productions" in deleteDialog) {
        // Batch delete
        const productionIds = deleteDialog.productions.map((p) => p.id);
        console.log("Calling batchDeletePaintProductions with IDs:", productionIds);
        const result = await batchDeletePaintProductions({ ids: productionIds });
        console.log("Productions deleted successfully, result:", result);
        // Clear selection after successful batch delete
        selectedIds.forEach((id) => toggleSelection(id));
      } else {
        // Single delete
        console.log("Calling deletePaintProduction with ID:", deleteDialog.production.id);
        const result = await deletePaintProduction(deleteDialog.production.id);
        console.log("Production deleted successfully, result:", result);
      }
      setDeleteDialog(null);
    } catch (error: any) {
      console.error("Error deleting production:", error);
      // Error toast is already handled by the API client
    }
  };

  // Close context menu when clicking outside
  React.useEffect(() => {
    const handleClick = () => setContextMenu(null);
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  // Handle filter changes
  const handleFilterChange = useCallback(
    (newFilters: Partial<PaintProductionGetManyFormData>) => {
      // Remove orderBy from filters to avoid conflicts with sort management
      const { orderBy: _, ...filtersWithoutOrderBy } = newFilters;
      setFilters(filtersWithoutOrderBy);
      setShowFilterModal(false);
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
    // Include searchingFor in the filters object for extraction
    const filtersWithSearch = {
      ...filters,
      searchingFor: searchingFor || undefined,
    };

    return extractActiveFilters(filtersWithSearch, onRemoveFilter, {
      paintTypes: paintTypesData?.data || [],
    });
  }, [filters, searchingFor, onRemoveFilter, paintTypesData?.data]);

  // Get scrollbar width info
  const { width: scrollbarWidth, isOverlay } = useScrollbarWidth();

  // Define columns
  const allColumns: PaintProductionColumn[] = createPaintProductionColumns();
  const filteredVisibleColumns = allColumns.filter((col) => visibleColumns.has(col.key));

  // Get current page production IDs for selection
  const currentPageProductionIds = React.useMemo(() => {
    return productions.map((p) => p.id);
  }, [productions]);

  // Selection handlers
  const allSelected = isAllSelected(currentPageProductionIds);
  const partiallySelected = isPartiallySelected(currentPageProductionIds);

  const handleSelectAll = () => {
    toggleSelectAll(currentPageProductionIds);
  };

  const handleSelectProduction = (productionId: string) => {
    toggleSelection(productionId);
  };


  // Render sort indicator function (standardized pattern)
  const renderSortIndicator = (columnKey: string) => {
    const sortDirection = getSortDirection(columnKey);
    const sortOrder = getSortOrder(columnKey);

    return (
      <div className="inline-flex items-center ml-1">
        {sortDirection === null && <IconSelector className="h-4 w-4 text-muted-foreground" />}
        {sortDirection === "asc" && <IconChevronUp className="h-4 w-4 text-foreground" />}
        {sortDirection === "desc" && <IconChevronDown className="h-4 w-4 text-foreground" />}
        {sortOrder !== null && sortConfigs.length > 1 && <span className="text-xs ml-0.5">{sortOrder + 1}</span>}
      </div>
    );
  };

  // Render loading state
  if (isLoading) {
    return <PaintProductionSkeleton />;
  }

  return (
    <Card className={cn("h-full flex flex-col shadow-sm border border-border", className)}>
      <CardContent className="flex-1 flex flex-col p-6 space-y-4 overflow-hidden">
        {/* Search and Filter Controls */}
        <div className="flex items-center gap-3">
          <TableSearchInput
            ref={searchInputRef}
            value={displaySearchText}
            onChange={(value) => {
              setSearch(value);
            }}
            placeholder="Buscar por ID, fórmula ou tinta..."
            isPending={displaySearchText !== searchingFor}
          />

          {/* Show Selected Toggle */}
          {selectionCount > 0 && <ShowSelectedToggle selectionCount={selectionCount} showSelectedOnly={showSelectedOnly} onToggle={toggleShowSelectedOnly} />}

          {/* Delete Selected Button */}
          {selectionCount > 0 && (
            <Button
              variant="destructive"
              size="default"
              onClick={() => {
                // For batch delete, we'll just pass the IDs since we may not have all production objects loaded
                // Create a minimal array with just the IDs - the dialog will show count instead of details
                setDeleteDialog({
                  productions: selectedIds.map((id) => {
                    // Try to find the production in current page, otherwise create a minimal object
                    const production = productions.find((p) => p.id === id);
                    return production || { id, volumeLiters: 0 } as PaintProduction;
                  })
                });
              }}
              disabled={isDeleting || isBatchDeleting}
            >
              <IconTrash className="h-4 w-4 mr-2" />
              Deletar Selecionados ({selectionCount})
            </Button>
          )}

          {/* Filter Button */}
          <Button variant={hasActiveFilters ? "default" : "outline"} size="default" onClick={() => setShowFilterModal(true)}>
            <IconFilter className="h-4 w-4 mr-2" />
            {hasActiveFilters ? `Filtros (${activeFilters.length})` : "Filtros"}
          </Button>

          {/* Column Visibility Manager */}
          <ColumnVisibilityManager columns={allColumns} visibleColumns={visibleColumns} onVisibilityChange={setVisibleColumns} />

          {/* Export Button */}
          <PaintProductionExport filters={queryFilters} currentItems={productions} totalRecords={totalRecords} visibleColumns={visibleColumns} />
        </div>

        {/* Active Filter Indicators */}
        {activeFilters.length > 0 && <FilterIndicators filters={activeFilters} onClearAll={clearAllFilters} className="px-1 py-1" />}

        {/* Table Container */}
        <div className="flex-1 flex flex-col overflow-hidden rounded-lg">
          {/* Fixed Header Table */}
          <div className="border-l border-r border-t border-border rounded-t-lg overflow-hidden">
            <Table className={cn("w-full [&>div]:border-0 [&>div]:rounded-none", TABLE_LAYOUT.tableLayout)}>
              <TableHeader className="[&_tr]:border-b-0 [&_tr]:hover:bg-muted">
                <TableRow className="bg-muted hover:bg-muted even:bg-muted">
                  {/* Selection column */}
                  <TableHead className={cn(TABLE_LAYOUT.checkbox.className, "whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted !border-r-0 p-0")}>
                    <div className="flex items-center justify-center h-full w-full px-2">
                      <Checkbox
                        checked={allSelected}
                        indeterminate={partiallySelected}
                        onCheckedChange={handleSelectAll}
                        aria-label="Select all productions"
                        disabled={isLoading || productions.length === 0}
                      />
                    </div>
                  </TableHead>

                  {/* Data columns */}
                  {filteredVisibleColumns.map((column) => (
                    <TableHead key={column.key} className={cn("whitespace-nowrap text-foreground font-bold uppercase text-xs p-0 bg-muted !border-r-0", column.className)}>
                      {column.sortable ? (
                        <button
                          onClick={() => toggleSort(column.key)}
                          className={cn(
                            "flex items-center gap-1 w-full h-full min-h-[2.5rem] px-4 py-2 hover:bg-muted/80 transition-colors cursor-pointer text-left border-0 bg-transparent",
                            column.align === "center" && "justify-center",
                            column.align === "right" && "justify-end",
                            !column.align && "justify-start",
                          )}
                          disabled={isLoading || productions.length === 0}
                        >
                          <TruncatedTextWithTooltip text={column.header} />
                          {renderSortIndicator(column.key)}
                        </button>
                      ) : (
                        <div
                          className={cn(
                            "flex items-center h-full min-h-[2.5rem] px-4 py-2",
                            column.align === "center" && "justify-center text-center",
                            column.align === "right" && "justify-end text-right",
                            !column.align && "justify-start text-left",
                          )}
                        >
                          <TruncatedTextWithTooltip text={column.header} />
                        </div>
                      )}
                    </TableHead>
                  ))}

                  {/* Scrollbar spacer - only show if not overlay scrollbar */}
                  {!isOverlay && (
                    <TableHead style={{ width: `${scrollbarWidth}px`, minWidth: `${scrollbarWidth}px` }} className="bg-muted p-0 border-0 !border-r-0 shrink-0"></TableHead>
                  )}
                </TableRow>
              </TableHeader>
            </Table>
          </div>

          {/* Scrollable Body Table */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden border-l border-r border-border">
            <Table className={cn("w-full [&>div]:border-0 [&>div]:rounded-none", TABLE_LAYOUT.tableLayout)}>
              <TableBody>
                {error ? (
                  <TableRow>
                    <TableCell colSpan={filteredVisibleColumns.length + 1} className="p-0">
                      <div className="flex flex-col items-center justify-center p-8 text-center text-destructive">
                        <IconAlertTriangle className="h-8 w-8 mb-4" />
                        <div className="text-lg font-medium mb-2">Não foi possível carregar as produções</div>
                        <div className="text-sm text-muted-foreground">Tente novamente mais tarde.</div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : productions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={filteredVisibleColumns.length + 1} className="p-0">
                      <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                        <IconFlask className="h-12 w-12 text-muted-foreground/50 mb-4" />
                        <div className="text-lg font-medium mb-2">Nenhuma produção encontrada</div>
                        {(searchingFor || activeFilters.length > 0) && <div className="text-sm">Ajuste os filtros para ver mais resultados.</div>}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  productions.map((production, index) => {
                    const productionIsSelected = isSelected(production.id);

                    return (
                      <TableRow
                        key={production.id}
                        data-state={productionIsSelected ? "selected" : undefined}
                        className={cn(
                          "cursor-pointer transition-colors border-b border-border",
                          // Alternating row colors
                          index % 2 === 1 && "bg-muted/10",
                          // Hover state that works with alternating colors
                          "hover:bg-muted/20",
                          // Selected state overrides alternating colors
                          productionIsSelected && "bg-muted/30 hover:bg-muted/40",
                        )}
                        onClick={() => handleViewDetails(production)}
                        onContextMenu={(e) => handleContextMenu(e, production)}
                      >
                        {/* Selection checkbox */}
                        <TableCell className={cn(TABLE_LAYOUT.checkbox.className, "p-0 !border-r-0")}>
                          <div className="flex items-center justify-center h-full w-full px-2 py-2" onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={productionIsSelected}
                              onCheckedChange={() => handleSelectProduction(production.id)}
                              aria-label={`Select production ${production.id}`}
                              data-checkbox
                            />
                          </div>
                        </TableCell>

                        {/* Data columns */}
                        {filteredVisibleColumns.map((column) => (
                          <TableCell
                            key={column.key}
                            className={cn(
                              column.className,
                              "p-0 !border-r-0",
                              column.align === "center" && "text-center",
                              column.align === "right" && "text-right",
                              column.align === "left" && "text-left",
                              !column.align && "text-left",
                            )}
                          >
                            <div className="px-4 py-2">{column.accessor(production)}</div>
                          </TableCell>
                        ))}
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination Footer */}
          <div className="px-4 border-l border-r border-b border-border rounded-b-lg bg-muted/50">
            <SimplePaginationAdvanced
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setPage}
              pageSize={pageSize}
              totalItems={totalRecords}
              pageSizeOptions={[20, 40, 60, 100]}
              onPageSizeChange={setPageSize}
              showPageSizeSelector={true}
              showGoToPage={true}
              showPageInfo={true}
            />
          </div>
        </div>
      </CardContent>

      {/* Filter Modal */}
      <PaintProductionFilters open={showFilterModal} onOpenChange={setShowFilterModal} filters={filters} onFiltersChange={handleFilterChange} />

      {/* Context Menu */}
      <DropdownMenu open={!!contextMenu} onOpenChange={(open) => !open && setContextMenu(null)}>
        <PositionedDropdownMenuContent
        position={contextMenu}
        isOpen={!!contextMenu}
        className="w-56 ![position:fixed]"
        onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <DropdownMenuItem onClick={() => contextMenu && handleViewDetails(contextMenu.production)}>
            <IconExternalLink className="mr-2 h-4 w-4" />
            Ver Detalhes
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleDelete} className="text-destructive">
            <IconTrash className="mr-2 h-4 w-4" />
            Deletar
          </DropdownMenuItem>
        </PositionedDropdownMenuContent>
      </DropdownMenu>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteDialog} onOpenChange={(open) => !open && !isDeleting && !isBatchDeleting && setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <IconAlertTriangle className="h-5 w-5 text-destructive" />
              {deleteDialog && "productions" in deleteDialog
                ? `Confirmar exclusão de ${deleteDialog.productions.length} produções`
                : "Confirmar exclusão de produção"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteDialog && "productions" in deleteDialog ? (
                <>
                  Tem certeza que deseja deletar <strong>{deleteDialog.productions.length} produções</strong>?
                  <br />
                  <br />
                  Volume total:{" "}
                  <strong>
                    {deleteDialog.productions.reduce((sum, p) => sum + (p.volumeLiters || 0), 0).toFixed(2)}L
                  </strong>
                  <br />
                  <br />
                  Esta ação irá:
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>Restaurar o estoque de todos os componentes utilizados</li>
                    <li>Remover as atividades de saída criadas</li>
                    <li>Deletar permanentemente os registros das produções</li>
                  </ul>
                  <br />
                  <strong>Esta ação não pode ser desfeita.</strong>
                </>
              ) : (
                <>
                  Tem certeza que deseja deletar a produção de{" "}
                  <strong>{deleteDialog && "production" in deleteDialog ? deleteDialog.production?.volumeLiters?.toFixed(2) : 0}L</strong>?
                  <br />
                  <br />
                  Esta ação irá:
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>Restaurar o estoque de todos os componentes utilizados</li>
                    <li>Remover as atividades de saída criadas</li>
                    <li>Deletar permanentemente o registro da produção</li>
                  </ul>
                  <br />
                  <strong>Esta ação não pode ser desfeita.</strong>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting || isBatchDeleting}>Cancelar</AlertDialogCancel>
            <Button onClick={confirmDelete} disabled={isDeleting || isBatchDeleting} variant="destructive">
              {isDeleting || isBatchDeleting ? "Deletando..." : "Deletar"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
