import { useState, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useItemBrandBatchMutations } from "../../../../../hooks";
import type { ItemBrand } from "../../../../../types";
import type { ItemBrandGetManyFormData } from "../../../../../schemas";
import { routes } from "../../../../../constants";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { BrandTable } from "./brand-table";
import { IconFilter } from "@tabler/icons-react";
import { BrandFilters } from "./brand-filters";
import { FilterIndicators } from "./filter-indicator";
import { extractActiveFilters, createFilterRemover } from "./filter-utils";
import { cn } from "@/lib/utils";
import { ShowSelectedToggle } from "@/components/ui/show-selected-toggle";
import { useTableState } from "@/hooks/common/use-table-state";
import { useTableFilters } from "@/hooks/common/use-table-filters";
import { useColumnVisibility } from "@/hooks/common/use-column-visibility";
import { BrandColumnVisibilityManager } from "./brand-column-visibility-manager";
import { createBrandColumns, getDefaultVisibleColumns } from "./brand-table-columns";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface BrandListProps {
  className?: string;
}

const DEFAULT_PAGE_SIZE = 40;

export function BrandList({ className }: BrandListProps) {
  const navigate = useNavigate();
  const { batchDelete } = useItemBrandBatchMutations();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // State to hold current page items and total count from the table
  const [tableData, setTableData] = useState<{ brands: ItemBrand[]; totalRecords: number }>({ brands: [], totalRecords: 0 });
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<{ brands: ItemBrand[]; isBulk: boolean } | null>(null);

  // Stable callback for table data updates
  const handleTableDataChange = useCallback((data: { brands: ItemBrand[]; totalRecords: number }) => {
    setTableData(data);
  }, []);

  // Get table state for selected items functionality
  const { selectionCount, showSelectedOnly, toggleShowSelectedOnly } = useTableState({
    defaultPageSize: 40,
    resetSelectionOnPageChange: false,
  });

  // Column management with localStorage persistence
  const allColumns = useMemo(() => createBrandColumns(), []);
  const { visibleColumns, setVisibleColumns } = useColumnVisibility(
    "brand-list-visible-columns",
    getDefaultVisibleColumns()
  );

  // Custom deserializer for brand filters
  const deserializeBrandFilters = useCallback((params: URLSearchParams): Partial<ItemBrandGetManyFormData> => {
    const filters: Partial<ItemBrandGetManyFormData> = {};

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

  // Custom serializer for brand filters
  const serializeBrandFilters = useCallback((filters: Partial<ItemBrandGetManyFormData>): Record<string, string> => {
    const params: Record<string, string> = {};

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
    hasActiveFilters,
  } = useTableFilters<ItemBrandGetManyFormData>({
    defaultFilters: {
      limit: DEFAULT_PAGE_SIZE,
    },
    searchDebounceMs: 500,
    searchParamName: "search", // Use "search" for URL compatibility
    serializeToUrl: serializeBrandFilters,
    deserializeFromUrl: deserializeBrandFilters,
    excludeFromUrl: ["limit", "orderBy"],
  });

  // Query filters to pass to the paginated table
  const queryFilters = useMemo(() => {
    const { orderBy: _, ...filterWithoutOrderBy } = baseQueryFilters;

    const result = {
      ...filterWithoutOrderBy,
      limit: DEFAULT_PAGE_SIZE,
    };

    return result;
  }, [baseQueryFilters]);

  // Handle filter changes
  const handleFilterChange = useCallback(
    (newFilters: Partial<ItemBrandGetManyFormData>) => {
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
    // Include searchingFor in the filters object for extraction
    const filtersWithSearch = {
      ...filters,
      searchingFor: searchingFor || undefined,
    };

    return extractActiveFilters(filtersWithSearch, onRemoveFilter);
  }, [filters, searchingFor, onRemoveFilter]);

  // Context menu handlers
  const handleBulkEdit = (brands: ItemBrand[]) => {
    if (brands.length === 1) {
      // Single brand - navigate to edit page
      navigate(routes.inventory.products.brands.edit(brands[0].id));
    } else {
      // Multiple brands - navigate to batch edit page
      const ids = brands.map((brand) => brand.id).join(",");
      navigate(`${routes.inventory.products.brands.batchEdit}?ids=${ids}`);
    }
  };

  const handleBulkDelete = (brands: ItemBrand[]) => {
    setDeleteDialog({ brands, isBulk: brands.length > 1 });
  };

  const confirmDelete = async () => {
    if (!deleteDialog) return;

    try {
      const ids = deleteDialog.brands.map((brand) => brand.id);
      await batchDelete({ itemBrandIds: ids });
      setDeleteDialog(null);
    } catch (error) {
      // Error is handled by the API client with detailed message
      console.error(`Error deleting brand${deleteDialog.brands.length > 1 ? "s" : ""}:`, error);
    }
  };

  return (
    <Card className={cn("flex flex-col shadow-sm border border-border", className)}>
      <CardContent className="flex-1 flex flex-col p-4 space-y-4 overflow-hidden">
        {/* Search and controls */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <TableSearchInput
            ref={searchInputRef}
            value={displaySearchText}
            onChange={(value) => {
              setSearch(value);
            }}
            placeholder="Buscar marcas..."
            isPending={displaySearchText !== searchingFor}
          />
          <div className="flex gap-2">
            <ShowSelectedToggle showSelectedOnly={showSelectedOnly} onToggle={toggleShowSelectedOnly} selectionCount={selectionCount} />
            <BrandColumnVisibilityManager columns={allColumns} visibleColumns={visibleColumns} onVisibilityChange={setVisibleColumns} />
            <Button variant={hasActiveFilters ? "default" : "outline"} size="default" onClick={() => setShowFilterModal(true)}>
              <IconFilter className="h-4 w-4" />
              <span>
                {hasActiveFilters ? `Filtros (${activeFilters.length})` : "Filtros"}
              </span>
            </Button>
          </div>
        </div>

        {/* Active Filter Indicators */}
        {activeFilters.length > 0 && <FilterIndicators filters={activeFilters} onClearAll={clearAllFilters} className="px-1 py-1" />}

        {/* Paginated table */}
        <div className="flex-1 min-h-0 overflow-auto">
          <BrandTable
            columns={allColumns}
            visibleColumns={visibleColumns}
            onEdit={handleBulkEdit}
            onDelete={handleBulkDelete}
            filters={queryFilters}
            className="h-full"
            onDataChange={handleTableDataChange}
          />
        </div>
      </CardContent>

      {/* Enhanced Filter Modal */}
      <BrandFilters open={showFilterModal} onOpenChange={setShowFilterModal} filters={filters} onFilterChange={handleFilterChange} />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteDialog} onOpenChange={(open) => !open && setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteDialog && (
                <>
                  Tem certeza que deseja deletar {deleteDialog.isBulk ? `${deleteDialog.brands.length} marcas` : "esta marca"}?
                  <br />
                  <strong>Esta ação não pode ser desfeita.</strong>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Deletar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
