import React, { useState, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useOrderBatchMutations, useSuppliers } from "../../../../hooks";
import type { Order } from "../../../../types";
import type { OrderGetManyFormData } from "../../../../schemas";
import { routes, ORDER_STATUS } from "../../../../constants";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { OrderTable } from "./order-table";
import { createOrderColumns } from "./order-table-columns";
import { IconFilter } from "@tabler/icons-react";
import { OrderFilters } from "./order-filters";
import { FilterIndicators } from "./filter-indicator";
import { extractActiveFilters, createFilterRemover } from "./filter-utils";
import { cn } from "@/lib/utils";
import { ShowSelectedToggle } from "@/components/ui/show-selected-toggle";
import { useTableState } from "@/hooks/use-table-state";
import { useTableFilters } from "@/hooks/use-table-filters";
import { OrderExport } from "./order-export";
import { ColumnVisibilityManager } from "./column-visibility-manager";
import { useColumnVisibility } from "@/hooks/use-column-visibility";
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

interface OrderListProps {
  className?: string;
}

const DEFAULT_PAGE_SIZE = 40;

export function OrderList({ className }: OrderListProps) {
  const navigate = useNavigate();
  const { batchDelete } = useOrderBatchMutations();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // State to hold current page items and total count from the table
  const [tableData, setTableData] = useState<{ orders: Order[]; totalRecords: number }>({ orders: [], totalRecords: 0 });
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<{ items: Order[]; isBulk: boolean } | null>(null);

  // Stable callback for table data updates
  const handleTableDataChange = useCallback((data: { orders: Order[]; totalRecords: number }) => {
    setTableData(data);
  }, []);

  // Load entity data for filter labels
  const { data: suppliersData } = useSuppliers({ orderBy: { fantasyName: "asc" } });

  // Get table state for selected items functionality
  const { selectionCount, showSelectedOnly, toggleShowSelectedOnly } = useTableState({
    defaultPageSize: DEFAULT_PAGE_SIZE,
    resetSelectionOnPageChange: false,
  });

  // Custom deserializer for order filters
  const deserializeOrderFilters = useCallback((params: URLSearchParams): Partial<OrderGetManyFormData> => {
    const filters: Partial<OrderGetManyFormData> = {};

    // Parse entity filters (support both single and multiple selections)
    const supplierId = params.get("supplierId");
    const supplierIds = params.get("supplierIds");
    if (supplierIds) {
      filters.supplierIds = supplierIds.split(",");
    } else if (supplierId) {
      filters.where = { ...filters.where, supplierId };
    }

    // Parse status filter
    const status = params.get("status");
    if (status) {
      filters.status = status.split(",") as ORDER_STATUS[];
    }

    // Parse hasItems filter
    const hasItems = params.get("hasItems");
    if (hasItems !== null) {
      filters.hasItems = hasItems === "true";
    }

    // Parse isFromSchedule filter
    const isFromSchedule = params.get("isFromSchedule");
    if (isFromSchedule !== null) {
      filters.isFromSchedule = isFromSchedule === "true";
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

    const forecastAfter = params.get("forecastAfter");
    const forecastBefore = params.get("forecastBefore");
    if (forecastAfter || forecastBefore) {
      filters.forecastRange = {
        ...(forecastAfter && { gte: new Date(forecastAfter) }),
        ...(forecastBefore && { lte: new Date(forecastBefore) }),
      };
    }

    const updatedAfter = params.get("updatedAfter");
    const updatedBefore = params.get("updatedBefore");
    if (updatedAfter || updatedBefore) {
      filters.updatedAtRange = {
        ...(updatedAfter && { gte: new Date(updatedAfter) }),
        ...(updatedBefore && { lte: new Date(updatedBefore) }),
      };
    }

    return filters;
  }, []);

  // Custom serializer for order filters
  const serializeOrderFilters = useCallback((filters: Partial<OrderGetManyFormData>): Record<string, string> => {
    const params: Record<string, string> = {};

    // Handle multi-select filters
    if (filters.supplierIds && filters.supplierIds.length > 0) {
      params.supplierIds = filters.supplierIds.join(",");
    } else if (filters.where?.supplierId) {
      params.supplierId = filters.where.supplierId as string;
    }

    if (filters.status && filters.status.length > 0) {
      params.status = filters.status.join(",");
    }

    // Handle boolean filters
    if (filters.hasItems !== undefined) params.hasItems = String(filters.hasItems);
    if (filters.isFromSchedule !== undefined) params.isFromSchedule = String(filters.isFromSchedule);

    // Add date filters
    if (filters.createdAt?.gte) params.createdAfter = filters.createdAt.gte.toISOString();
    if (filters.createdAt?.lte) params.createdBefore = filters.createdAt.lte.toISOString();
    if (filters.forecastRange?.gte) params.forecastAfter = filters.forecastRange.gte.toISOString();
    if (filters.forecastRange?.lte) params.forecastBefore = filters.forecastRange.lte.toISOString();
    if (filters.updatedAtRange?.gte) params.updatedAfter = filters.updatedAtRange.gte.toISOString();
    if (filters.updatedAtRange?.lte) params.updatedBefore = filters.updatedAtRange.lte.toISOString();

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
  } = useTableFilters<OrderGetManyFormData>({
    defaultFilters: {
      limit: DEFAULT_PAGE_SIZE,
    },
    searchDebounceMs: 300,
    searchParamName: "search", // Use "search" for URL compatibility
    serializeToUrl: serializeOrderFilters,
    deserializeFromUrl: deserializeOrderFilters,
    excludeFromUrl: ["limit", "orderBy"],
  });

  // Use column visibility hook with localStorage persistence
  const { visibleColumns, setVisibleColumns } = useColumnVisibility(
    "order-list-visible-columns",
    new Set(["description", "supplier.fantasyName", "status", "itemCount", "total", "forecast"])
  );

  // Get all available columns for column visibility manager
  const allColumns = useMemo(() => createOrderColumns(), []);

  // Query filters to pass to the paginated table
  const queryFilters = useMemo(() => {
    const { orderBy: _, ...filterWithoutOrderBy } = baseQueryFilters;

    console.log("[OrderList] baseQueryFilters:", baseQueryFilters);
    console.log("[OrderList] filterWithoutOrderBy:", filterWithoutOrderBy);

    // Build where clause
    const where = filterWithoutOrderBy.where || {};

    const result = {
      ...filterWithoutOrderBy,
      where: Object.keys(where).length > 0 ? where : undefined,
      limit: DEFAULT_PAGE_SIZE,
    };

    console.log("[OrderList] queryFilters result:", result);
    return result;
  }, [baseQueryFilters]);

  // Handle filter changes
  const handleFilterChange = useCallback(
    (newFilters: Partial<OrderGetManyFormData>) => {
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
    if (!suppliersData?.data) return [];

    // Include searchingFor in the filters object for extraction
    const filtersWithSearch = {
      ...filters,
      searchingFor: searchingFor || undefined,
    };

    return extractActiveFilters(filtersWithSearch, onRemoveFilter, {
      suppliers: suppliersData.data,
    });
  }, [filters, searchingFor, suppliersData?.data, onRemoveFilter]);

  // Context menu handlers
  const handleBulkEdit = (orders: Order[]) => {
    if (orders.length === 1) {
      // Single order - navigate to edit page
      navigate(routes.inventory.orders.edit(orders[0].id));
    } else {
      // Multiple orders - batch edit not yet implemented for orders
      // For now, show a message to the user
      alert("A edição em lote para pedidos ainda não está disponível.");
    }
  };

  const handleBulkDelete = async (orders: Order[]) => {
    setDeleteDialog({ items: orders, isBulk: orders.length > 1 });
  };

  const confirmDelete = async () => {
    if (!deleteDialog) return;

    try {
      const ids = deleteDialog.items.map((order) => order.id);
      await batchDelete({ orderIds: ids });
    } catch (error) {
      // Error is handled by the API client with detailed message
      console.error(`Error deleting order${deleteDialog.items.length > 1 ? "s" : ""}:`, error);
    } finally {
      setDeleteDialog(null);
    }
  };

  return (
    <Card className={cn("h-full flex flex-col shadow-sm border border-border", className)}>
      <CardContent className="flex-1 flex flex-col p-6 space-y-4 overflow-hidden">
        {/* Search and controls */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <TableSearchInput
            ref={searchInputRef}
            value={displaySearchText}
            onChange={(value) => {
              console.log("[OrderList] Search input changed to:", value);
              setSearch(value);
            }}
            placeholder="Buscar por código, fornecedor..."
            isPending={displaySearchText !== searchingFor}
          />
          <div className="flex gap-2">
            <ShowSelectedToggle showSelectedOnly={showSelectedOnly} onToggle={toggleShowSelectedOnly} selectionCount={selectionCount} />
            <Button
              variant={hasActiveFilters ? "default" : "outline"}
              size="default"
              onClick={() => setShowFilterModal(true)}
              className="group"
            >
              <IconFilter className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              <span className="text-foreground">
                {hasActiveFilters ? `Filtros (${activeFilters.length})` : "Filtros"}
              </span>
            </Button>
            <ColumnVisibilityManager columns={allColumns} visibleColumns={visibleColumns} onVisibilityChange={setVisibleColumns} />
            <OrderExport currentItems={tableData.orders} totalRecords={tableData.totalRecords} filters={queryFilters} visibleColumns={visibleColumns} />
          </div>
        </div>

        {/* Active Filter Indicators */}
        {activeFilters.length > 0 && <FilterIndicators filters={activeFilters} onClearAll={clearAllFilters} className="px-1 py-1" />}

        {/* Paginated table */}
        <div className="flex-1 min-h-0">
          <OrderTable
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
      <OrderFilters open={showFilterModal} onOpenChange={setShowFilterModal} filters={filters} onFilterChange={handleFilterChange} />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteDialog} onOpenChange={(open) => !open && setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteDialog?.isBulk
                ? `Tem certeza que deseja deletar ${deleteDialog.items.length} pedidos? Esta ação não pode ser desfeita.`
                : `Tem certeza que deseja deletar o pedido ${deleteDialog?.items[0]?.id.slice(-8)}? Esta ação não pode ser desfeita.`}
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
