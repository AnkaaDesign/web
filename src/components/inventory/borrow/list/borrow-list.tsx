import React, { useState, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useBorrowMutations, useBorrowBatchMutations, useItems, useUsers } from "../../../../hooks";
import type { Borrow } from "../../../../types";
import type { BorrowGetManyFormData } from "../../../../schemas";
import { routes, BORROW_STATUS } from "../../../../constants";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { BorrowTable } from "./borrow-table";
import { IconFilter } from "@tabler/icons-react";
import { BorrowFilters } from "./borrow-filters";
import { BorrowExport } from "./borrow-export";
import { ColumnVisibilityManager } from "./column-visibility-manager";
import { FilterIndicators } from "./filter-indicator";
import { extractActiveFilters, createFilterRemover } from "./filter-utils";
import { cn } from "@/lib/utils";
import { ShowSelectedToggle } from "@/components/ui/show-selected-toggle";
import { useTableState } from "@/hooks/common/use-table-state";
import { useTableFilters } from "@/hooks/common/use-table-filters";
import { Badge } from "@/components/ui/badge";
import { useColumnVisibility } from "@/hooks/common/use-column-visibility";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface BorrowListProps {
  className?: string;
}

const DEFAULT_PAGE_SIZE = 40;

export function BorrowList({ className }: BorrowListProps) {
  const navigate = useNavigate();
  const { update } = useBorrowMutations();
  const { batchDelete, batchUpdate } = useBorrowBatchMutations();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // State to hold current page items and total count from the table
  const [tableData, setTableData] = useState<{ items: Borrow[]; totalRecords: number }>({ items: [], totalRecords: 0 });
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<{ items: Borrow[]; isBulk: boolean } | null>(null);

  // Stable callback for table data updates
  const handleTableDataChange = useCallback((data: { items: Borrow[]; totalRecords: number }) => {
    setTableData(data);
  }, []);

  // Load entity data for filter labels
  const { data: itemsData } = useItems({ orderBy: { name: "asc" } });
  const { data: usersData } = useUsers({ orderBy: { name: "asc" } });

  // Get table state for selected items functionality
  const { selectionCount, showSelectedOnly, toggleShowSelectedOnly, selectedIds } = useTableState({
    defaultPageSize: 40,
    resetSelectionOnPageChange: false,
  });

  // Visible columns state with localStorage persistence
  const { visibleColumns, setVisibleColumns } = useColumnVisibility(
    "borrow-list-visible-columns",
    new Set(["item.uniCode", "item.name", "user.name", "quantity", "status", "createdAt", "returnedAt"])
  );

  // Custom deserializer for borrow filters
  const deserializeBorrowFilters = useCallback((params: URLSearchParams): Partial<BorrowGetManyFormData> => {
    const filters: Partial<BorrowGetManyFormData> = {};

    // Parse entity filters (support both single and multiple selections)
    const itemId = params.get("itemId");
    const itemIds = params.get("itemIds");
    if (itemIds) {
      filters.itemIds = itemIds.split(",");
    } else if (itemId) {
      filters.where = { ...filters.where, itemId };
    }

    const userId = params.get("userId");
    const userIds = params.get("userIds");
    if (userIds) {
      filters.userIds = userIds.split(",");
    } else if (userId) {
      filters.where = { ...filters.where, userId };
    }

    // Parse category and brand filters
    const categoryIds = params.get("categoryIds");
    if (categoryIds) {
      filters.categoryIds = categoryIds.split(",");
    }

    const brandIds = params.get("brandIds");
    if (brandIds) {
      filters.brandIds = brandIds.split(",");
    }

    // Parse status filter
    const status = params.get("status");
    if (status && Object.values(BORROW_STATUS).includes(status as BORROW_STATUS)) {
      filters.where = { ...filters.where, status: status as BORROW_STATUS };
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

    const returnedAfter = params.get("returnedAfter");
    const returnedBefore = params.get("returnedBefore");
    if (returnedAfter || returnedBefore) {
      filters.returnedAt = {
        ...(returnedAfter && { gte: new Date(returnedAfter) }),
        ...(returnedBefore && { lte: new Date(returnedBefore) }),
      };
    }

    return filters;
  }, []);

  // Custom serializer for borrow filters
  const serializeBorrowFilters = useCallback((filters: Partial<BorrowGetManyFormData>): Record<string, string> => {
    const params: Record<string, string> = {};

    // Entity filters
    if (filters.itemIds?.length) params.itemIds = filters.itemIds.join(",");
    else if (filters.where?.itemId) params.itemId = filters.where.itemId as string;

    if (filters.userIds?.length) params.userIds = filters.userIds.join(",");
    else if (filters.where?.userId) params.userId = filters.where.userId as string;

    if (filters.categoryIds?.length) params.categoryIds = filters.categoryIds.join(",");
    if (filters.brandIds?.length) params.brandIds = filters.brandIds.join(",");

    // Status filter
    if (filters.where?.status) params.status = filters.where.status as string;

    // Date filters
    if (filters.createdAt?.gte) params.createdAfter = filters.createdAt.gte.toISOString();
    if (filters.createdAt?.lte) params.createdBefore = filters.createdAt.lte.toISOString();
    if (filters.returnedAt?.gte) params.returnedAfter = filters.returnedAt.gte.toISOString();
    if (filters.returnedAt?.lte) params.returnedBefore = filters.returnedAt.lte.toISOString();

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
  } = useTableFilters<BorrowGetManyFormData>({
    defaultFilters: {
      limit: DEFAULT_PAGE_SIZE,
    },
    searchDebounceMs: 500,
    searchParamName: "search", // Use "search" for URL compatibility
    serializeToUrl: serializeBorrowFilters,
    deserializeFromUrl: deserializeBorrowFilters,
    excludeFromUrl: ["limit", "orderBy"],
  });

  // Query filters to pass to the paginated table
  const queryFilters = useMemo(() => {
    const { orderBy: _, ...filterWithoutOrderBy } = baseQueryFilters;

    // Build where clause
    const where = filterWithoutOrderBy.where || {};

    const result = {
      ...filterWithoutOrderBy,
      where: Object.keys(where).length > 0 ? where : undefined,
      limit: DEFAULT_PAGE_SIZE,
    };

    return result;
  }, [baseQueryFilters]);

  // Handle filter changes
  const handleFilterChange = useCallback(
    (newFilters: Partial<BorrowGetManyFormData>) => {
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
    (key: string, _value?: any) => {
      if (key === "searchingFor") {
        setSearch("");
      } else {
        baseOnRemoveFilter(key);
      }
    },
    [baseOnRemoveFilter, setSearch],
  );

  // Extract active filters for display
  const activeFilters = useMemo(() => {
    if (!itemsData?.data || !usersData?.data) return [];

    // Include searchingFor in the filters object for extraction
    const filtersWithSearch = {
      ...filters,
      searchingFor: searchingFor || undefined,
    };

    return extractActiveFilters(filtersWithSearch, onRemoveFilter, {
      items: itemsData.data,
      users: usersData.data,
    });
  }, [filters, searchingFor, itemsData?.data, usersData?.data, onRemoveFilter]);

  // Context menu handlers
  const handleBulkEdit = (items: Borrow[]) => {
    // Always use batch edit (even for single items since single edit page was removed)
    const ids = items.map((item) => item.id).join(",");
    navigate(`${routes.inventory.loans.batchEdit}?ids=${ids}`);
  };

  const handleReturn = async (items: Borrow[]) => {
    try {
      // Only allow return for ACTIVE borrows
      const activeItems = items.filter((item) => item.status === BORROW_STATUS.ACTIVE);

      if (activeItems.length === 0) {
        return;
      }

      if (activeItems.length === 1) {
        // Single item update
        const updateData = {
          id: activeItems[0].id,
          data: {
            status: BORROW_STATUS.RETURNED,
            returnedAt: new Date(),
          },
        };

        await update(updateData);
      } else {
        // Batch update
        const updateItems = activeItems.map((item) => ({
          id: item.id,
          data: {
            status: BORROW_STATUS.RETURNED,
            returnedAt: new Date(),
          },
        }));
        const batchData = { borrows: updateItems };

        await batchUpdate(batchData);
      }
    } catch (error: any) {
      // Error is handled by the API client with detailed message
      if (process.env.NODE_ENV !== 'production') {
        console.error(`Error returning borrow${items.length > 1 ? "s" : ""}:`, error);
      }
    }
  };

  const handleBulkDelete = (items: Borrow[]) => {
    setDeleteDialog({ items, isBulk: items.length > 1 });
  };

  const confirmDelete = async () => {
    if (!deleteDialog) return;

    try {
      const ids = deleteDialog.items.map((item) => item.id);
      await batchDelete({ borrowIds: ids });
      setDeleteDialog(null);
    } catch (error) {
      // Error is handled by the API client with detailed message
      if (process.env.NODE_ENV !== 'production') {
        console.error(`Error deleting borrow${deleteDialog.items.length > 1 ? "s" : ""}:`, error);
      }
    }
  };

  return (
    <Card className={cn("flex flex-col shadow-sm border border-border", className)}>
      <CardContent className="flex-1 flex flex-col p-4 space-y-4 min-h-0">
        {/* Search and controls */}
        <div className="flex flex-col gap-3 sm:flex-row flex-shrink-0">
          <TableSearchInput
            ref={searchInputRef}
            value={displaySearchText}
            onChange={(value) => {
              setSearch(value);
            }}
            placeholder="Buscar por item, usuário..."
            isPending={displaySearchText !== searchingFor}
          />
          <div className="flex gap-2">
            <ShowSelectedToggle showSelectedOnly={showSelectedOnly} onToggle={toggleShowSelectedOnly} selectionCount={selectionCount} />
            <Button variant={hasActiveFilters ? "default" : "outline"} size="default" onClick={() => setShowFilterModal(true)} className="group">
              <IconFilter className="h-4 w-4" />
              <span>Filtros{hasActiveFilters ? ` (${activeFilters.length})` : ""}</span>
            </Button>
            <ColumnVisibilityManager visibleColumns={visibleColumns} onVisibilityChange={setVisibleColumns} />
            <BorrowExport filters={queryFilters} currentItems={tableData.items} totalRecords={tableData.totalRecords} visibleColumns={visibleColumns} />
          </div>
        </div>

        {/* Active Filter Indicators */}
        {activeFilters.length > 0 && <FilterIndicators filters={activeFilters} onClearAll={clearAllFilters} className="px-1 py-1 flex-shrink-0" />}

        {/* Paginated table */}
        <div className="flex-1 min-h-0 overflow-auto">
          <BorrowTable
            visibleColumns={visibleColumns}
            onEdit={handleBulkEdit}
            onReturn={handleReturn}
            onDelete={handleBulkDelete}
            filters={queryFilters}
            className="h-full"
            onDataChange={handleTableDataChange}
          />
        </div>
      </CardContent>

      {/* Enhanced Filter Modal */}
      <BorrowFilters open={showFilterModal} onOpenChange={setShowFilterModal} filters={filters} onFilterChange={handleFilterChange} />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteDialog} onOpenChange={(open) => !open && setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteDialog && (
                <>
                  Tem certeza que deseja deletar {deleteDialog.isBulk ? `${deleteDialog.items.length} empréstimos` : "este empréstimo"}?
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
