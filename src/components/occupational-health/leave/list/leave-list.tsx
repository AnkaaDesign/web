import { useState, useCallback, useMemo, useRef } from "react";
import { IconFilter } from "@tabler/icons-react";

import type { Leave } from "../../../../types/leave";
import { LEAVE_STATUS } from "../../../../constants";
import { useUsers } from "../../../../hooks";
import { useLeaveMutations, useLeaveBatchMutations } from "../../../../hooks/occupational-health/use-leaves";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { ShowSelectedToggle } from "@/components/ui/show-selected-toggle";
import { cn } from "@/lib/utils";
import { useTableState } from "@/hooks/common/use-table-state";
import { useTableFilters } from "@/hooks/common/use-table-filters";
import { useColumnVisibility } from "@/hooks/common/use-column-visibility";
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

import { LeaveTable } from "./leave-table";
import { LeaveFilters } from "./leave-filters";
import { ColumnVisibilityManager } from "./column-visibility-manager";
import { createLeaveColumns, DEFAULT_VISIBLE_COLUMNS } from "./leave-table-columns";
import { extractActiveFilters, createFilterRemover } from "./filter-utils";
import { FilterIndicators } from "./filter-indicator";
import { FinishLeaveDialog } from "../finish-leave-dialog";
import type { LeaveListFilters } from "./types";

interface LeaveListProps {
  className?: string;
}

const DEFAULT_PAGE_SIZE = 40;

export function LeaveList({ className }: LeaveListProps) {
  const { batchDeleteAsync, batchUpdateAsync } = useLeaveBatchMutations();
  const { updateAsync } = useLeaveMutations();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // State to hold current page leaves and total count from the table
  const [, setTableData] = useState<{ leaves: Leave[]; totalRecords: number }>({ leaves: [], totalRecords: 0 });
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [finishDialog, setFinishDialog] = useState<Leave | null>(null);
  const [cancelDialog, setCancelDialog] = useState<{ items: Leave[]; isBulk: boolean } | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ items: Leave[]; isBulk: boolean } | null>(null);

  // Stable callback for table data updates
  const handleTableDataChange = useCallback((data: { leaves: Leave[]; totalRecords: number }) => {
    setTableData(data);
  }, []);

  // Load users for filter indicator labels
  const { data: usersData } = useUsers({ orderBy: { name: "asc" } });

  // Get table state for selected leaves functionality
  const { selectionCount, showSelectedOnly, toggleShowSelectedOnly } = useTableState({
    defaultPageSize: DEFAULT_PAGE_SIZE,
    resetSelectionOnPageChange: false,
  });

  // Custom deserializer for leave filters
  const deserializeLeaveFilters = useCallback((params: URLSearchParams): Partial<LeaveListFilters> => {
    const filters: Partial<LeaveListFilters> = {};

    const types = params.get("types");
    if (types) {
      filters.types = types.split(",");
    }

    const statuses = params.get("statuses");
    if (statuses) {
      filters.statuses = statuses.split(",");
    }

    const users = params.get("users");
    if (users) {
      filters.userIds = users.split(",");
    }

    const returnExamRequired = params.get("returnExamRequired");
    if (returnExamRequired !== null) {
      filters.returnExamRequired = returnExamRequired === "true";
    }

    const startDateAfter = params.get("startDateAfter");
    const startDateBefore = params.get("startDateBefore");
    if (startDateAfter || startDateBefore) {
      filters.startDate = {
        ...(startDateAfter && { gte: new Date(startDateAfter) }),
        ...(startDateBefore && { lte: new Date(startDateBefore) }),
      };
    }

    return filters;
  }, []);

  // Custom serializer for leave filters
  const serializeLeaveFilters = useCallback((filters: Partial<LeaveListFilters>): Record<string, string> => {
    const params: Record<string, string> = {};

    if (filters.types?.length) params.types = filters.types.join(",");
    if (filters.statuses?.length) params.statuses = filters.statuses.join(",");
    if (filters.userIds?.length) params.users = filters.userIds.join(",");
    if (typeof filters.returnExamRequired === "boolean") params.returnExamRequired = String(filters.returnExamRequired);
    if (filters.startDate?.gte) params.startDateAfter = filters.startDate.gte.toISOString();
    if (filters.startDate?.lte) params.startDateBefore = filters.startDate.lte.toISOString();

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
  } = useTableFilters<LeaveListFilters>({
    defaultFilters: {
      limit: DEFAULT_PAGE_SIZE,
    },
    searchDebounceMs: 500,
    searchParamName: "search",
    serializeToUrl: serializeLeaveFilters,
    deserializeFromUrl: deserializeLeaveFilters,
    excludeFromUrl: ["limit", "orderBy"],
  });

  // Visible columns state with localStorage persistence.
  // -v2: COLABORADOR no longer stacks the position; SETOR + CARGO are now their
  // own columns. Bump the key so stale saved preferences reset to the new defaults.
  const { visibleColumns, setVisibleColumns } = useColumnVisibility("leave-list-visible-columns-v2", DEFAULT_VISIBLE_COLUMNS);

  // Get all available columns for column visibility manager
  const allColumns = useMemo(() => createLeaveColumns(), []);

  // Query filters to pass to the paginated table
  const queryFilters = useMemo(() => {
    const { orderBy: _, startDate, ...filterWithoutOrderBy } = baseQueryFilters;

    const result: Record<string, any> = {
      ...filterWithoutOrderBy,
      limit: DEFAULT_PAGE_SIZE,
      searchingFor: filterWithoutOrderBy.searchingFor,
    };

    // Map the start date range into the where clause (no convenience filter for it)
    if (startDate?.gte || startDate?.lte) {
      result.where = {
        ...result.where,
        startDate: {
          ...(startDate.gte && { gte: startDate.gte }),
          ...(startDate.lte && { lte: startDate.lte }),
        },
      };
    }

    return result;
  }, [baseQueryFilters]);

  // Handle filter changes
  const handleFilterChange = useCallback(
    (newFilters: Partial<LeaveListFilters>) => {
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
    const filtersWithSearch = {
      ...filters,
      searchingFor: searchingFor || undefined,
    };

    return extractActiveFilters(filtersWithSearch, onRemoveFilter, {
      users: usersData?.data || [],
    });
  }, [filters, searchingFor, usersData?.data, onRemoveFilter]);

  // Count active filters for the button
  const activeFilterCount = useMemo(() => {
    return Object.entries(filters).filter(([key, value]) => {
      if (key === "page" || key === "limit" || key === "itemsPerPage" || key === "orderBy" || key === "sortOrder") return false;
      if (Array.isArray(value)) return value.length > 0;
      if (typeof value === "object" && value !== null) return Object.keys(value).length > 0;
      return value !== undefined && value !== null && value !== "";
    }).length;
  }, [filters]);

  // Context menu handlers
  const handleCancel = (leaves: Leave[]) => {
    const cancellable = leaves.filter((leave) => leave.status === LEAVE_STATUS.SCHEDULED || leave.status === LEAVE_STATUS.ACTIVE);
    if (cancellable.length === 0) return;
    setCancelDialog({ items: cancellable, isBulk: cancellable.length > 1 });
  };

  const handleDelete = (leaves: Leave[]) => {
    setDeleteDialog({ items: leaves, isBulk: leaves.length > 1 });
  };

  const confirmCancel = async () => {
    if (!cancelDialog) return;

    try {
      if (cancelDialog.items.length === 1) {
        await updateAsync({
          id: cancelDialog.items[0].id,
          data: { status: LEAVE_STATUS.CANCELLED },
        });
      } else {
        await batchUpdateAsync({
          leaves: cancelDialog.items.map((leave) => ({
            id: leave.id,
            data: { status: LEAVE_STATUS.CANCELLED },
          })),
        });
      }
      setCancelDialog(null);
    } catch (error) {
      // Error is handled by the API client with detailed message
      if (process.env.NODE_ENV !== "production") {
        console.error("Error cancelling leave(s):", error);
      }
    }
  };

  const confirmDelete = async () => {
    if (!deleteDialog) return;

    try {
      await batchDeleteAsync({ leaveIds: deleteDialog.items.map((leave) => leave.id) });
      setDeleteDialog(null);
    } catch (error) {
      // Error is handled by the API client with detailed message
      if (process.env.NODE_ENV !== "production") {
        console.error("Error deleting leave(s):", error);
      }
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
            placeholder="Buscar: colaborador, nº benefício INSS ou observações"
            isPending={displaySearchText !== searchingFor}
          />
          <div className="flex gap-2">
            <ShowSelectedToggle showSelectedOnly={showSelectedOnly} onToggle={toggleShowSelectedOnly} selectionCount={selectionCount} />
            <ColumnVisibilityManager columns={allColumns} visibleColumns={visibleColumns} onVisibilityChange={setVisibleColumns} />
            <Button variant={hasActiveFilters ? "default" : "outline"} size="default" onClick={() => setShowFilterModal(true)}>
              <IconFilter className="h-4 w-4" />
              <span>
                Filtros
                {hasActiveFilters ? ` (${activeFilterCount})` : ""}
              </span>
            </Button>
          </div>
        </div>

        {/* Active Filter Indicators */}
        {activeFilters.length > 0 && <FilterIndicators filters={activeFilters} onClearAll={clearAllFilters} className="px-1 py-1" />}

        {/* Paginated table */}
        <div className="flex-1 min-h-0 overflow-auto">
          <LeaveTable
            visibleColumns={visibleColumns}
            onFinish={(leave) => setFinishDialog(leave)}
            onCancel={handleCancel}
            onDelete={handleDelete}
            filters={queryFilters}
            className="h-full"
            onDataChange={handleTableDataChange}
          />
        </div>
      </CardContent>

      {/* Enhanced Filter Modal */}
      <LeaveFilters open={showFilterModal} onOpenChange={setShowFilterModal} filters={filters} onFilterChange={handleFilterChange} />

      {/* Finish Leave Dialog */}
      <FinishLeaveDialog leave={finishDialog} open={!!finishDialog} onOpenChange={(open) => !open && setFinishDialog(null)} />

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={!!cancelDialog} onOpenChange={(open) => !open && setCancelDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar cancelamento</AlertDialogTitle>
            <AlertDialogDescription>
              {cancelDialog?.isBulk
                ? `Tem certeza que deseja cancelar ${cancelDialog.items.length} afastamentos?`
                : `Tem certeza que deseja cancelar o afastamento${cancelDialog?.items[0]?.user?.name ? ` do colaborador "${cancelDialog.items[0].user.name}"` : ""}?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmCancel}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteDialog} onOpenChange={(open) => !open && setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteDialog?.isBulk
                ? `Tem certeza que deseja excluir ${deleteDialog.items.length} afastamentos? Esta ação não pode ser desfeita.`
                : `Tem certeza que deseja excluir o afastamento${deleteDialog?.items[0]?.user?.name ? ` do colaborador "${deleteDialog.items[0].user.name}"` : ""}? Esta ação não pode ser desfeita.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
