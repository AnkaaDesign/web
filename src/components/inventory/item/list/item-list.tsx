import React, { useState, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useItemMutations, useItemBatchMutations, useItemBrands, useItemCategories, useSuppliers, useItemMerge } from "../../../../hooks";
import type { Item } from "../../../../types";
import type { ItemGetManyFormData } from "../../../../schemas";
import { routes, STOCK_LEVEL } from "../../../../constants";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { ItemTable } from "./item-table";
import { IconFilter } from "@tabler/icons-react";
import { ItemFilters } from "./item-filters";
import { ItemExport } from "./item-export";
import { ColumnVisibilityManager } from "./column-visibility-manager";
import { createItemColumns } from "./item-table-columns";
import { extractActiveFilters, createFilterRemover } from "./filter-utils";
import { FilterIndicators } from "./filter-indicator";
import { cn } from "@/lib/utils";
import { useTableState } from "@/hooks/use-table-state";
import { ShowSelectedToggle } from "@/components/ui/show-selected-toggle";
import { useTableFilters } from "@/hooks/use-table-filters";
import { useColumnVisibility } from "@/hooks/use-column-visibility";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ItemMergeDialog } from "../merge/item-merge-dialog";
import { toast } from "@/components/ui/sonner";

interface ItemListProps {
  className?: string;
}

const DEFAULT_PAGE_SIZE = 40;

export function ItemList({ className }: ItemListProps) {
  const navigate = useNavigate();
  const { update } = useItemMutations();
  const { batchDelete, batchUpdate } = useItemBatchMutations();
  const { mutate: mergeItems, isPending: isMerging } = useItemMerge();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // State to hold current page items and total count from the table
  const [tableData, setTableData] = useState<{ items: Item[]; totalRecords: number }>({ items: [], totalRecords: 0 });
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<{ items: Item[]; isBulk: boolean } | null>(null);
  const [mergeDialog, setMergeDialog] = useState<{ open: boolean; items: Item[] }>({ open: false, items: [] });

  // Stable callback for table data updates
  const handleTableDataChange = useCallback((data: { items: Item[]; totalRecords: number }) => {
    setTableData(data);
  }, []);

  // Load entity data for filter labels
  const { data: categoriesData } = useItemCategories({ orderBy: { name: "asc" } });
  const { data: brandsData } = useItemBrands({ orderBy: { name: "asc" } });
  const { data: suppliersData } = useSuppliers({ orderBy: { fantasyName: "asc" } });

  // Get table state for selected items functionality
  const { selectionCount, showSelectedOnly, toggleShowSelectedOnly } = useTableState({
    defaultPageSize: 40,
    resetSelectionOnPageChange: false,
  });

  // Custom deserializer for item filters
  const deserializeItemFilters = useCallback((params: URLSearchParams): Partial<ItemGetManyFormData> => {
    const filters: Partial<ItemGetManyFormData> = {};

    // Parse entity filters (support both single and multiple selections)
    const category = params.get("category");
    const categories = params.get("categories");
    if (categories) {
      filters.categoryIds = categories.split(",");
    } else if (category) {
      filters.where = { ...filters.where, categoryId: category };
    }

    const brand = params.get("brand");
    const brands = params.get("brands");
    if (brands) {
      filters.brandIds = brands.split(",");
    } else if (brand) {
      filters.where = { ...filters.where, brandId: brand };
    }

    const supplier = params.get("supplier");
    const suppliers = params.get("suppliers");
    if (suppliers) {
      filters.supplierIds = suppliers.split(",");
    } else if (supplier) {
      filters.where = { ...filters.where, supplierId: supplier };
    }

    // Parse boolean filters
    const showInactive = params.get("showInactive");
    if (showInactive === "true") {
      filters.showInactive = true;
    }

    const shouldAssignToUser = params.get("shouldAssignToUser");
    if (shouldAssignToUser !== null) {
      filters.where = { ...filters.where, shouldAssignToUser: shouldAssignToUser === "true" };
    }

    // Parse stock levels array filter
    const stockLevels = params.get("stockLevels");
    if (stockLevels) {
      try {
        const levelsArray = JSON.parse(stockLevels);
        if (Array.isArray(levelsArray) && levelsArray.length > 0) {
          // Ensure the values are valid STOCK_LEVEL enum values
          const validLevels = levelsArray.filter((level) => Object.values(STOCK_LEVEL).includes(level as STOCK_LEVEL)) as STOCK_LEVEL[];
          if (validLevels.length > 0) {
            filters.stockLevels = validLevels;
          }
        }
      } catch (e) {
        // If parsing fails, ignore the filter
      }
    }

    // Parse additional stock filters
    const nearReorderPoint = params.get("nearReorderPoint");
    if (nearReorderPoint === "true") {
      filters.nearReorderPoint = true;
    }

    const noReorderPoint = params.get("noReorderPoint");
    if (noReorderPoint === "true") {
      filters.noReorderPoint = true;
    }

    // Parse range filters
    const quantityMin = params.get("quantityMin");
    const quantityMax = params.get("quantityMax");
    if (quantityMin || quantityMax) {
      filters.quantityRange = {
        ...(quantityMin && { min: Number(quantityMin) }),
        ...(quantityMax && { max: Number(quantityMax) }),
      };
    }

    const icmsMin = params.get("icmsMin");
    const icmsMax = params.get("icmsMax");
    if (icmsMin || icmsMax) {
      filters.icmsRange = {
        ...(icmsMin && { min: Number(icmsMin) }),
        ...(icmsMax && { max: Number(icmsMax) }),
      };
    }

    const ipiMin = params.get("ipiMin");
    const ipiMax = params.get("ipiMax");
    if (ipiMin || ipiMax) {
      filters.ipiRange = {
        ...(ipiMin && { min: Number(ipiMin) }),
        ...(ipiMax && { max: Number(ipiMax) }),
      };
    }

    const monthlyConsumptionMin = params.get("monthlyConsumptionMin");
    const monthlyConsumptionMax = params.get("monthlyConsumptionMax");
    if (monthlyConsumptionMin || monthlyConsumptionMax) {
      filters.monthlyConsumptionRange = {
        ...(monthlyConsumptionMin && { min: Number(monthlyConsumptionMin) }),
        ...(monthlyConsumptionMax && { max: Number(monthlyConsumptionMax) }),
      };
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

    const updatedAfter = params.get("updatedAfter");
    const updatedBefore = params.get("updatedBefore");
    if (updatedAfter || updatedBefore) {
      filters.updatedAt = {
        ...(updatedAfter && { gte: new Date(updatedAfter) }),
        ...(updatedBefore && { lte: new Date(updatedBefore) }),
      };
    }

    return filters;
  }, []);

  // Custom serializer for item filters
  const serializeItemFilters = useCallback((filters: Partial<ItemGetManyFormData>): Record<string, string> => {
    const params: Record<string, string> = {};

    // Entity filters
    if (filters.categoryIds?.length) params.categories = filters.categoryIds.join(",");
    else if (filters.where?.categoryId) params.category = filters.where.categoryId as string;

    if (filters.brandIds?.length) params.brands = filters.brandIds.join(",");
    else if (filters.where?.brandId) params.brand = filters.where.brandId as string;

    if (filters.supplierIds?.length) params.suppliers = filters.supplierIds.join(",");
    else if (filters.where?.supplierId) params.supplier = filters.where.supplierId as string;

    // Boolean filters
    if (filters.showInactive) params.showInactive = "true";
    if (typeof filters.where?.shouldAssignToUser === "boolean") {
      params.shouldAssignToUser = String(filters.where.shouldAssignToUser);
    }

    // Stock filters
    if (filters.stockLevels?.length) params.stockLevels = JSON.stringify(filters.stockLevels);
    if (filters.nearReorderPoint) params.nearReorderPoint = "true";
    if (filters.noReorderPoint) params.noReorderPoint = "true";

    // Range filters
    if (filters.quantityRange?.min !== undefined) params.quantityMin = String(filters.quantityRange.min);
    if (filters.quantityRange?.max !== undefined) params.quantityMax = String(filters.quantityRange.max);
    if (filters.icmsRange?.min !== undefined) params.icmsMin = String(filters.icmsRange.min);
    if (filters.icmsRange?.max !== undefined) params.icmsMax = String(filters.icmsRange.max);
    if (filters.ipiRange?.min !== undefined) params.ipiMin = String(filters.ipiRange.min);
    if (filters.ipiRange?.max !== undefined) params.ipiMax = String(filters.ipiRange.max);
    if (filters.monthlyConsumptionRange?.min !== undefined) params.monthlyConsumptionMin = String(filters.monthlyConsumptionRange.min);
    if (filters.monthlyConsumptionRange?.max !== undefined) params.monthlyConsumptionMax = String(filters.monthlyConsumptionRange.max);

    // Date filters
    if (filters.createdAt?.gte) params.createdAfter = filters.createdAt.gte.toISOString();
    if (filters.createdAt?.lte) params.createdBefore = filters.createdAt.lte.toISOString();
    if (filters.updatedAt?.gte) params.updatedAfter = filters.updatedAt.gte.toISOString();
    if (filters.updatedAt?.lte) params.updatedBefore = filters.updatedAt.lte.toISOString();

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
  } = useTableFilters<ItemGetManyFormData>({
    defaultFilters: {
      limit: DEFAULT_PAGE_SIZE,
    },
    searchDebounceMs: 300,
    searchParamName: "search", // Use "search" for URL compatibility
    serializeToUrl: serializeItemFilters,
    deserializeFromUrl: deserializeItemFilters,
    excludeFromUrl: ["limit", "orderBy"],
  });

  // Visible columns state with localStorage persistence
  const { visibleColumns, setVisibleColumns } = useColumnVisibility(
    "item-list-visible-columns",
    new Set(["uniCode", "name", "brand.name", "category.name", "quantity", "monthlyConsumption", "price"])
  );

  // Get all available columns for column visibility manager
  const allColumns = useMemo(() => createItemColumns(), []);

  // Query filters to pass to the paginated table
  const queryFilters = useMemo(() => {
    const { orderBy: _, ...filterWithoutOrderBy } = baseQueryFilters;

    console.log("[ItemList] baseQueryFilters:", baseQueryFilters);
    console.log("[ItemList] filterWithoutOrderBy:", filterWithoutOrderBy);

    // Build where clause with default active filter
    const where = filterWithoutOrderBy.where || {};

    // Only show active items by default, unless showInactive is true
    if (!filterWithoutOrderBy.showInactive) {
      where.isActive = true;
    }

    const result = {
      ...filterWithoutOrderBy,
      where: Object.keys(where).length > 0 ? where : undefined,
      limit: DEFAULT_PAGE_SIZE,
    };

    console.log("[ItemList] queryFilters result:", result);
    return result;
  }, [baseQueryFilters]);

  // Handle filter changes
  const handleFilterChange = useCallback(
    (newFilters: Partial<ItemGetManyFormData>) => {
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
    if (!categoriesData?.data || !brandsData?.data || !suppliersData?.data) return [];

    // Include searchingFor in the filters object for extraction
    const filtersWithSearch = {
      ...filters,
      searchingFor: searchingFor || undefined,
    };

    return extractActiveFilters(filtersWithSearch, onRemoveFilter, {
      categories: categoriesData.data,
      brands: brandsData.data,
      suppliers: suppliersData.data,
    });
  }, [filters, searchingFor, categoriesData?.data, brandsData?.data, suppliersData?.data, onRemoveFilter]);

  // Context menu handlers
  const handleBulkEdit = (items: Item[]) => {
    if (items.length === 1) {
      // Single item - navigate to edit page
      navigate(routes.inventory.products.edit(items[0].id));
    } else {
      // Multiple items - navigate to batch edit page
      const ids = items.map((item) => item.id).join(",");
      navigate(`${routes.inventory.products.batchEdit}?ids=${ids}`);
    }
  };

  const handleActivate = async (items: Item[]) => {
    try {
      if (items.length === 1) {
        // Single item update
        const updateData = { id: items[0].id, data: { isActive: true } };

        await update(updateData);
      } else {
        // Batch update - use 'items' property as expected by the schema
        const updateItems = items.map((item) => ({
          id: item.id,
          data: { isActive: true },
        }));
        const batchData = { items: updateItems };

        await batchUpdate(batchData);
      }
    } catch (error: any) {
      // Error is handled by the API client with detailed message
      console.error("Error activating item(s):", error);
    }
  };

  const handleDeactivate = async (items: Item[]) => {
    try {
      if (items.length === 1) {
        // Single item update
        const updateData = { id: items[0].id, data: { isActive: false } };

        await update(updateData);
      } else {
        // Batch update - use 'items' property as expected by the schema
        const updateItems = items.map((item) => ({
          id: item.id,
          data: { isActive: false },
        }));
        const batchData = { items: updateItems };

        await batchUpdate(batchData);
      }
    } catch (error: any) {
      // Error is handled by the API client with detailed message
      console.error("Error deactivating item(s):", error);
    }
  };

  const handleBulkDelete = (items: Item[]) => {
    setDeleteDialog({ items, isBulk: items.length > 1 });
  };

  const confirmDelete = async () => {
    if (!deleteDialog) return;

    try {
      const ids = deleteDialog.items.map((item) => item.id);
      await batchDelete({ itemIds: ids });
      setDeleteDialog(null);
    } catch (error) {
      // Error is handled by the API client with detailed message
      console.error("Error deleting item(s):", error);
    }
  };

  // Handle merge action
  const handleMerge = useCallback((items: Item[]) => {
    if (items.length < 2) {
      toast.error("Selecione pelo menos 2 itens para mesclar");
      return;
    }
    setMergeDialog({ open: true, items });
  }, []);

  // Handle stock balance action
  const handleStockBalance = useCallback((items: Item[]) => {
    if (items.length === 0) {
      toast.error("Selecione pelo menos 1 item para balanço de estoque");
      return;
    }
    const ids = items.map((item) => item.id).join(",");
    navigate(`${routes.inventory.products.stockBalance}?ids=${ids}`);
  }, [navigate]);

  const handleMergeConfirm = useCallback(
    async (targetId: string, resolutions: Record<string, any>) => {
      try {
        // Calculate source IDs from the items in the merge dialog
        const sourceIds = mergeDialog.items.map(item => item.id).filter(id => id !== targetId);

        await mergeItems({
          targetItemId: targetId,
          sourceItemIds: sourceIds,
          conflictResolutions: resolutions,
        });

        // Close dialog on success
        setMergeDialog({ open: false, items: [] });
      } catch (error) {
        // Error is handled by the API client
        console.error("Error merging items:", error);
      }
    },
    [mergeItems, mergeDialog.items]
  );

  return (
    <Card className={cn("h-full flex flex-col shadow-sm border border-border", className)}>
      <CardContent className="flex-1 flex flex-col p-6 space-y-4 overflow-hidden">
        {/* Search and controls */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <TableSearchInput
            ref={searchInputRef}
            value={displaySearchText}
            onChange={(value) => {
              console.log("[ItemList] Search input changed to:", value);
              setSearch(value);
            }}
            placeholder="Buscar por nome, código, código de barras..."
            isPending={displaySearchText !== searchingFor}
          />
          <div className="flex gap-2">
            <ShowSelectedToggle showSelectedOnly={showSelectedOnly} onToggle={toggleShowSelectedOnly} selectionCount={selectionCount} />
            <Button
              variant={hasActiveFilters ? "default" : "outline"}
              size="default"
              onClick={() => setShowFilterModal(true)}
            >
              <IconFilter className="h-4 w-4" />
              <span>
                Filtros
                {hasActiveFilters ? ` (${activeFilters.length})` : ""}
              </span>
            </Button>
            <ColumnVisibilityManager columns={allColumns} visibleColumns={visibleColumns} onVisibilityChange={setVisibleColumns} />
            <ItemExport filters={filters} currentItems={tableData.items} totalRecords={tableData.totalRecords} visibleColumns={visibleColumns} />
          </div>
        </div>

        {/* Active Filter Indicators */}
        {activeFilters.length > 0 && <FilterIndicators filters={activeFilters} onClearAll={clearAllFilters} className="px-1 py-1" />}

        {/* Paginated table */}
        <div className="flex-1 min-h-0">
          <ItemTable
            visibleColumns={visibleColumns}
            onEdit={handleBulkEdit}
            onActivate={handleActivate}
            onDeactivate={handleDeactivate}
            onDelete={handleBulkDelete}
            onMerge={handleMerge}
            onStockBalance={handleStockBalance}
            filters={queryFilters}
            className="h-full"
            onDataChange={handleTableDataChange}
          />
        </div>
      </CardContent>

      {/* Enhanced Filter Modal */}
      <ItemFilters open={showFilterModal} onOpenChange={setShowFilterModal} filters={filters} onFilterChange={handleFilterChange} />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteDialog} onOpenChange={(open) => !open && setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteDialog && (
                <>
                  Tem certeza que deseja deletar {deleteDialog.isBulk ? `${deleteDialog.items.length} produtos` : "este produto"}?
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

      {/* Merge Dialog */}
      <ItemMergeDialog
        open={mergeDialog.open}
        onOpenChange={(open) => setMergeDialog({ open, items: mergeDialog.items })}
        items={mergeDialog.items}
        onMerge={handleMergeConfirm}
      />
    </Card>
  );
}
