import React, { useState, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTaskMutations, useTaskBatchMutations, useSectors, useCustomers } from "../../../../hooks";
import type { Task } from "../../../../types";
import type { TaskGetManyFormData } from "../../../../schemas";
import { routes, TASK_STATUS } from "../../../../constants";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { TaskTable } from "./task-table";
import { IconFilter } from "@tabler/icons-react";
import { TaskFilters } from "./task-filters";
import { TaskExport } from "./task-export";
import { ColumnVisibilityManager } from "./column-visibility-manager";
import { createTaskColumns, getDefaultVisibleColumns } from "./task-table-columns";
import { extractActiveFilters, createFilterRemover } from "./filter-utils";
import { FilterIndicators } from "./filter-indicator";
import { cn } from "@/lib/utils";
import { useTableState } from "@/hooks/use-table-state";
import { ShowSelectedToggle } from "@/components/ui/show-selected-toggle";
import { useTableFilters } from "@/hooks/use-table-filters";
import { useColumnVisibility } from "@/hooks/use-column-visibility";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface TaskListProps {
  className?: string;
}

const DEFAULT_PAGE_SIZE = 40;

export function TaskList({ className }: TaskListProps) {
  const navigate = useNavigate();
  const { update } = useTaskMutations();
  const { batchDelete, batchUpdate } = useTaskBatchMutations();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // State to hold current page items and total count from the table
  const [tableData, setTableData] = useState<{ items: Task[]; totalRecords: number }>({ items: [], totalRecords: 0 });
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<{
    items: Task[];
    isBulk: boolean;
  } | null>(null);
  const [cancelDialog, setCancelDialog] = useState<{
    items: Task[];
    isBulk: boolean;
  } | null>(null);

  // Stable callback for table data updates
  const handleTableDataChange = useCallback((data: { items: Task[]; totalRecords: number }) => {
    setTableData(data);
  }, []);

  // Load entity data for filter labels
  const { data: sectorsData } = useSectors({ orderBy: { name: "asc" } });
  const { data: customersData } = useCustomers({ orderBy: { fantasyName: "asc" } });

  // Get table state for selected items functionality
  const { selectionCount, showSelectedOnly, toggleShowSelectedOnly } = useTableState({
    defaultPageSize: 40,
    resetSelectionOnPageChange: false,
  });

  // Custom deserializer for task filters
  const deserializeTaskFilters = useCallback((params: URLSearchParams): Partial<TaskGetManyFormData> => {
    const filters: Partial<TaskGetManyFormData> = {};

    // Parse search filter (handled separately by useTableFilters, but included for completeness)
    const search = params.get("search");
    if (search) {
      filters.searchingFor = search;
    }

    // Parse status filters
    const status = params.get("status");
    if (status) {
      filters.status = status.split(",") as any[];
    }


    // Parse entity filters
    const sectors = params.get("sectors");
    if (sectors) {
      filters.sectorIds = sectors.split(",");
    }

    const customers = params.get("customers");
    if (customers) {
      filters.customerIds = customers.split(",");
    }

    // Parse boolean filters
    const isOverdue = params.get("isOverdue");
    if (isOverdue === "true") {
      filters.isOverdue = true;
    }

    const isActive = params.get("isActive");
    if (isActive !== null) {
      filters.isActive = isActive === "true";
    }

    const isCompleted = params.get("isCompleted");
    if (isCompleted !== null) {
      filters.isCompleted = isCompleted === "true";
    }

    // Parse has* filters
    const booleanFilters = ["hasSector", "hasCustomer", "hasTruck", "hasObservation", "hasArtworks", "hasPaints", "hasServices", "hasAirbrushing"];

    booleanFilters.forEach((key) => {
      const value = params.get(key);
      if (value !== null) {
        (filters as any)[key] = value === "true";
      }
    });

    // Parse range filters
    const priceMin = params.get("priceMin");
    const priceMax = params.get("priceMax");
    if (priceMin || priceMax) {
      filters.priceRange = {
        ...(priceMin && { from: Number(priceMin) }),
        ...(priceMax && { to: Number(priceMax) }),
      };
    }

    // Parse date range filters
    const dateRanges = [
      { key: "entryDateRange", fromParam: "entryDateFrom", toParam: "entryDateTo" },
      { key: "termRange", fromParam: "termFrom", toParam: "termTo" },
      { key: "startedDateRange", fromParam: "startedFrom", toParam: "startedTo" },
      { key: "finishedDateRange", fromParam: "finishedFrom", toParam: "finishedTo" },
      { key: "createdAt", fromParam: "createdAfter", toParam: "createdBefore" },
      { key: "updatedAt", fromParam: "updatedAfter", toParam: "updatedBefore" },
    ];

    dateRanges.forEach(({ key, fromParam, toParam }) => {
      const from = params.get(fromParam);
      const to = params.get(toParam);
      if (from || to) {
        (filters as any)[key] = {
          ...(from && { from: new Date(from) }),
          ...(to && { to: new Date(to) }),
        };
      }
    });

    return filters;
  }, []);

  // Custom serializer for task filters
  const serializeTaskFilters = useCallback((filters: Partial<TaskGetManyFormData>): Record<string, string> => {
    const params: Record<string, string> = {};

    // Status filters
    if (filters.status?.length) params.status = filters.status.join(",");

    // Entity filters
    if (filters.sectorIds?.length) params.sectors = filters.sectorIds.join(",");
    if (filters.customerIds?.length) params.customers = filters.customerIds.join(",");

    // Boolean filters
    if (filters.isOverdue) params.isOverdue = "true";
    if (typeof filters.isActive === "boolean") params.isActive = String(filters.isActive);
    if (typeof filters.isCompleted === "boolean") params.isCompleted = String(filters.isCompleted);

    // Has* filters
    const booleanFilters = ["hasSector", "hasCustomer", "hasTruck", "hasObservation", "hasArtworks", "hasPaints", "hasServices", "hasAirbrushing"];
    booleanFilters.forEach((key) => {
      const value = (filters as any)[key];
      if (typeof value === "boolean") {
        params[key] = String(value);
      }
    });

    // Range filters
    if (filters.priceRange?.from !== undefined) params.priceMin = String(filters.priceRange.from);
    if (filters.priceRange?.to !== undefined) params.priceMax = String(filters.priceRange.to);

    // Date filters
    const dateRanges = [
      { key: "entryDateRange", fromParam: "entryDateFrom", toParam: "entryDateTo" },
      { key: "termRange", fromParam: "termFrom", toParam: "termTo" },
      { key: "startedDateRange", fromParam: "startedFrom", toParam: "startedTo" },
      { key: "finishedDateRange", fromParam: "finishedFrom", toParam: "finishedTo" },
      { key: "createdAt", fromParam: "createdAfter", toParam: "createdBefore" },
      { key: "updatedAt", fromParam: "updatedAfter", toParam: "updatedBefore" },
    ];

    dateRanges.forEach(({ key, fromParam, toParam }) => {
      const range = (filters as any)[key];
      if (range?.from) params[fromParam] = range.from.toISOString();
      if (range?.to) params[toParam] = range.to.toISOString();
    });

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
  } = useTableFilters<TaskGetManyFormData>({
    defaultFilters: {
      limit: DEFAULT_PAGE_SIZE,
    },
    searchDebounceMs: 300,
    searchParamName: "search", // Use "search" for URL compatibility
    serializeToUrl: serializeTaskFilters,
    deserializeFromUrl: deserializeTaskFilters,
    excludeFromUrl: ["limit", "orderBy"],
  });

  // Create columns for column visibility manager
  const columns = useMemo(() => createTaskColumns(), []);

  // Get default visible columns
  const defaultVisibleColumns = useMemo(() => getDefaultVisibleColumns(columns), [columns]);

  // Visible columns state with localStorage persistence
  const { visibleColumns, setVisibleColumns } = useColumnVisibility("task-list-visible-columns", defaultVisibleColumns);

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
    (newFilters: Partial<TaskGetManyFormData>) => {
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
    if (!sectorsData?.data || !customersData?.data) return [];

    // Include searchingFor in the filters object for extraction
    const filtersWithSearch = {
      ...filters,
      searchingFor: searchingFor || undefined,
    };

    return extractActiveFilters(filtersWithSearch, onRemoveFilter, {
      sectors: sectorsData.data,
      customers: customersData.data,
    });
  }, [filters, searchingFor, sectorsData?.data, customersData?.data, onRemoveFilter]);

  // Context menu handlers
  const handleBulkEdit = (items: Task[]) => {
    if (items.length === 1) {
      // Single item - navigate to edit page
      navigate(routes.production.schedule.edit(items[0].id));
    } else {
      // Multiple items - batch edit not implemented yet
    }
  };

  const handleBulkStart = async (items: Task[]) => {
    const pendingTasks = items.filter((task) => task.status === TASK_STATUS.PENDING);

    if (pendingTasks.length === 0) {
      return;
    }

    try {
      const updates = pendingTasks.map((task) => ({
        id: task.id,
        data: { status: TASK_STATUS.IN_PRODUCTION, startedAt: new Date() },
      }));

      if (updates.length === 1) {
        await update(updates[0]);
      } else {
        await batchUpdate({ tasks: updates });
      }
    } catch (error) {
      console.error("Error starting tasks:", error);
    }
  };

  const handleBulkFinish = async (items: Task[]) => {
    const inProductionTasks = items.filter((task) => task.status === TASK_STATUS.IN_PRODUCTION);

    if (inProductionTasks.length === 0) {
      return;
    }

    try {
      const updates = inProductionTasks.map((task) => ({
        id: task.id,
        data: { status: TASK_STATUS.COMPLETED, finishedAt: new Date() },
      }));

      if (updates.length === 1) {
        await update(updates[0]);
      } else {
        await batchUpdate({ tasks: updates });
      }
    } catch (error) {
      console.error("Error finishing tasks:", error);
    }
  };

  const handleBulkHold = async (items: Task[]) => {
    const activeTasks = items.filter((task) => task.status === TASK_STATUS.IN_PRODUCTION);

    if (activeTasks.length === 0) {
      return;
    }

    try {
      const updates = activeTasks.map((task) => ({
        id: task.id,
        data: { status: TASK_STATUS.ON_HOLD },
      }));

      if (updates.length === 1) {
        await update(updates[0]);
      } else {
        await batchUpdate({ tasks: updates });
      }
    } catch (error) {
      console.error("Error putting tasks on hold:", error);
    }
  };

  const handleBulkCancel = async (items: Task[]) => {
    const cancellableTasks = items.filter((task) => task.status !== TASK_STATUS.COMPLETED && task.status !== TASK_STATUS.CANCELLED);

    if (cancellableTasks.length === 0) {
      return;
    }

    setCancelDialog({
      items: cancellableTasks,
      isBulk: cancellableTasks.length > 1,
    });
  };

  const confirmCancel = async () => {
    if (!cancelDialog) return;

    try {
      const updates = cancelDialog.items.map((task) => ({
        id: task.id,
        data: { status: TASK_STATUS.CANCELLED },
      }));

      if (updates.length === 1) {
        await update(updates[0]);
      } else {
        await batchUpdate({ tasks: updates });
      }
    } catch (error) {
      console.error("Error cancelling tasks:", error);
    } finally {
      setCancelDialog(null);
    }
  };

  const handleBulkDelete = async (items: Task[]) => {
    setDeleteDialog({
      items,
      isBulk: items.length > 1,
    });
  };

  const confirmDelete = async () => {
    if (!deleteDialog) return;

    try {
      const ids = deleteDialog.items.map((item) => item.id);
      await batchDelete({ taskIds: ids });
    } catch (error) {
      console.error("Error deleting tasks:", error);
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
            onChange={(value) => setSearch(value)}
            placeholder="Buscar por nome, número de série, placa, detalhes..."
            isPending={displaySearchText !== searchingFor}
          />
          <div className="flex gap-2">
            <ShowSelectedToggle showSelectedOnly={showSelectedOnly} onToggle={toggleShowSelectedOnly} selectionCount={selectionCount} />
            <Button variant="outline" size="default" onClick={() => setShowFilterModal(true)} className="group">
              <IconFilter className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              <span className="text-foreground">Filtros</span>
            </Button>
            <ColumnVisibilityManager columns={columns} visibleColumns={visibleColumns} onVisibilityChange={setVisibleColumns} />
            <TaskExport filters={filters} currentItems={tableData.items} totalRecords={tableData.totalRecords} visibleColumns={visibleColumns} />
          </div>
        </div>

        {/* Active Filter Indicators */}
        {activeFilters.length > 0 && <FilterIndicators filters={activeFilters} onClearAll={clearAllFilters} className="px-1 py-1" />}

        {/* Paginated table */}
        <div className="flex-1 min-h-0">
          <TaskTable
            visibleColumns={visibleColumns}
            onEdit={handleBulkEdit}
            onStart={handleBulkStart}
            onFinish={handleBulkFinish}
            onHold={handleBulkHold}
            onCancel={handleBulkCancel}
            onDelete={handleBulkDelete}
            filters={queryFilters}
            className="h-full"
            onDataChange={handleTableDataChange}
          />
        </div>
      </CardContent>

      {/* Enhanced Filter Modal */}
      <TaskFilters open={showFilterModal} onOpenChange={setShowFilterModal} filters={filters} onFilterChange={handleFilterChange} />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteDialog} onOpenChange={(open) => !open && setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja deletar {deleteDialog?.items.length} tarefa{deleteDialog?.items.length !== 1 ? "s" : ""}? Esta ação não pode ser desfeita.
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

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={!!cancelDialog} onOpenChange={(open) => !open && setCancelDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar cancelamento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja cancelar {cancelDialog?.items.length} tarefa{cancelDialog?.items.length !== 1 ? "s" : ""}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmCancel} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Cancelar tarefa{cancelDialog?.items.length !== 1 ? "s" : ""}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
