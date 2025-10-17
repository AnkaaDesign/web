import React, { useState, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useExternalWithdrawalBatchMutations } from "../../../../hooks";
import type { ExternalWithdrawal } from "../../../../types";
import type { ExternalWithdrawalGetManyFormData } from "../../../../schemas";
import { routes, EXTERNAL_WITHDRAWAL_STATUS } from "../../../../constants";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { ExternalWithdrawalTable, getDefaultVisibleColumns, getAllColumns } from "./external-withdrawal-table";
import { IconFilter } from "@tabler/icons-react";
import { ExternalWithdrawalFilters } from "./external-withdrawal-filters";
import { FilterIndicators } from "./filter-indicator";
import { extractActiveFilters, createFilterRemover } from "./filter-utils";
import { cn } from "@/lib/utils";
import { ShowSelectedToggle } from "@/components/ui/show-selected-toggle";
import { useTableState } from "@/hooks/use-table-state";
import { useTableFilters } from "@/hooks/use-table-filters";
import { ExternalWithdrawalExport } from "./external-withdrawal-export";
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

interface ExternalWithdrawalListProps {
  className?: string;
}

const DEFAULT_PAGE_SIZE = 40;

export function ExternalWithdrawalList({ className }: ExternalWithdrawalListProps) {
  const navigate = useNavigate();
  const { batchDelete } = useExternalWithdrawalBatchMutations();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // State to hold current page items and total count from the table
  const [tableData, setTableData] = useState<{ externalWithdrawals: ExternalWithdrawal[]; totalRecords: number }>({
    externalWithdrawals: [],
    totalRecords: 0,
  });
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<{
    items: ExternalWithdrawal[];
    isBulk: boolean;
  } | null>(null);

  // Stable callback for table data updates
  const handleTableDataChange = useCallback((data: { externalWithdrawals: ExternalWithdrawal[]; totalRecords: number }) => {
    setTableData(data);
  }, []);

  // Get table state for selected items functionality
  const { selectionCount, showSelectedOnly, toggleShowSelectedOnly, selectedIds } = useTableState({
    defaultPageSize: DEFAULT_PAGE_SIZE,
    resetSelectionOnPageChange: false,
  });

  // Column visibility state with localStorage persistence
  const { visibleColumns, setVisibleColumns } = useColumnVisibility("external-withdrawal-list-visible-columns", getDefaultVisibleColumns());

  // Get all available columns for column visibility manager
  const allColumns = useMemo(() => getAllColumns(), []);

  // Custom deserializer for external withdrawal filters
  const deserializeExternalWithdrawalFilters = useCallback((params: URLSearchParams): Partial<ExternalWithdrawalGetManyFormData> => {
    const filters: Partial<ExternalWithdrawalGetManyFormData> = {};

    // Parse status filter
    const statuses = params.get("statuses");
    if (statuses) {
      filters.statuses = statuses.split(",") as EXTERNAL_WITHDRAWAL_STATUS[];
    }

    // Parse boolean filters
    const willReturn = params.get("willReturn");
    if (willReturn !== null) {
      filters.willReturn = willReturn === "true";
    }

    const hasNfe = params.get("hasNfe");
    if (hasNfe !== null) {
      filters.hasNfe = hasNfe === "true";
    }

    const hasReceipt = params.get("hasReceipt");
    if (hasReceipt !== null) {
      filters.hasReceipt = hasReceipt === "true";
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

  // Custom serializer for external withdrawal filters
  const serializeExternalWithdrawalFilters = useCallback((filters: Partial<ExternalWithdrawalGetManyFormData>): Record<string, string> => {
    const params: Record<string, string> = {};

    // Status filters
    if (filters.statuses?.length) params.statuses = filters.statuses.join(",");

    // Boolean filters
    if (typeof filters.willReturn === "boolean") params.willReturn = String(filters.willReturn);
    if (typeof filters.hasNfe === "boolean") params.hasNfe = String(filters.hasNfe);
    if (typeof filters.hasReceipt === "boolean") params.hasReceipt = String(filters.hasReceipt);

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
  } = useTableFilters<ExternalWithdrawalGetManyFormData>({
    defaultFilters: {
      limit: DEFAULT_PAGE_SIZE,
    },
    searchDebounceMs: 300,
    searchParamName: "search", // Use "search" for URL compatibility
    serializeToUrl: serializeExternalWithdrawalFilters,
    deserializeFromUrl: deserializeExternalWithdrawalFilters,
    excludeFromUrl: ["limit", "orderBy"],
  });

  // Query filters to pass to the paginated table
  const queryFilters = useMemo(() => {
    const { orderBy: _, ...filterWithoutOrderBy } = baseQueryFilters;

    console.log("[ExternalWithdrawalList] baseQueryFilters:", baseQueryFilters);
    console.log("[ExternalWithdrawalList] filterWithoutOrderBy:", filterWithoutOrderBy);

    // Build where clause
    const where = filterWithoutOrderBy.where || {};

    const result = {
      ...filterWithoutOrderBy,
      where: Object.keys(where).length > 0 ? where : undefined,
      limit: DEFAULT_PAGE_SIZE,
    };

    console.log("[ExternalWithdrawalList] queryFilters result:", result);
    return result;
  }, [baseQueryFilters]);

  // Handle filter changes
  const handleFilterChange = useCallback(
    (newFilters: Partial<ExternalWithdrawalGetManyFormData>) => {
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
  const handleBulkEdit = (withdrawals: ExternalWithdrawal[]) => {
    if (withdrawals.length === 1) {
      // Single withdrawal - navigate to edit page
      navigate(routes.inventory.externalWithdrawals?.edit?.(withdrawals[0].id) || `/inventory/external-withdrawals/edit/${withdrawals[0].id}`);
    } else {
      // Multiple withdrawals - navigate to batch edit page
      const ids = withdrawals.map((w) => w.id).join(",");
      navigate(`/estoque/retiradas-externas/editar-lote?ids=${ids}`);
    }
  };

  const handleBulkDelete = async (withdrawals: ExternalWithdrawal[]) => {
    setDeleteDialog({
      items: withdrawals,
      isBulk: withdrawals.length > 1,
    });
  };

  const confirmDelete = async () => {
    if (!deleteDialog) return;

    try {
      const ids = deleteDialog.items.map((w) => w.id);
      await batchDelete({ externalWithdrawalIds: ids });
      setDeleteDialog(null);
    } catch (error) {
      // Error is handled by the API client with detailed message
      console.error(`Error deleting withdrawal${deleteDialog.items.length > 1 ? "s" : ""}:`, error);
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
              console.log("[ExternalWithdrawalList] Search input changed to:", value);
              setSearch(value);
            }}
            placeholder="Buscar por nome do retirador, observações..."
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
            <ExternalWithdrawalExport
              currentItems={tableData.externalWithdrawals}
              totalRecords={tableData.totalRecords}
              selectedItems={new Set(selectedIds)}
              visibleColumns={visibleColumns}
              filters={queryFilters}
            />
          </div>
        </div>

        {/* Active Filter Indicators */}
        {activeFilters.length > 0 && <FilterIndicators filters={activeFilters} onClearAll={clearAllFilters} className="px-1 py-1" />}

        {/* Paginated table */}
        <div className="flex-1 min-h-0">
          <ExternalWithdrawalTable
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
      <ExternalWithdrawalFilters open={showFilterModal} onOpenChange={setShowFilterModal} filters={filters} onFilterChange={handleFilterChange} />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteDialog} onOpenChange={(open) => !open && setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteDialog?.isBulk
                ? `Tem certeza que deseja deletar ${deleteDialog.items.length} retiradas? Esta ação não pode ser desfeita.`
                : `Tem certeza que deseja deletar a retirada de "${deleteDialog?.items[0]?.withdrawerName}"? Esta ação não pode ser desfeita.`}
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
