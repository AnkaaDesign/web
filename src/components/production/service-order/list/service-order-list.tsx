import React, { useState, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useServiceOrderMutations, useServiceOrderBatchMutations, useServices, useTasks } from "../../../../hooks";
import type { ServiceOrder } from "../../../../types";
import type { ServiceOrderGetManyFormData } from "../../../../schemas";
import { routes, SERVICE_ORDER_STATUS } from "../../../../constants";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { ServiceOrderTable } from "./service-order-table";
import { IconFilter } from "@tabler/icons-react";
import { ServiceOrderFilters } from "./service-order-filters";
import { ServiceOrderExport } from "./service-order-export";
import { cn } from "@/lib/utils";
import { useTableState } from "@/hooks/use-table-state";
import { ShowSelectedToggle } from "@/components/ui/show-selected-toggle";
import { useTableFilters } from "@/hooks/use-table-filters";
import { extractActiveFilters, createFilterRemover } from "./filter-utils";
import { FilterIndicators } from "./filter-indicator";
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

interface ServiceOrderListProps {
  className?: string;
}

const DEFAULT_PAGE_SIZE = 40;

export function ServiceOrderList({ className }: ServiceOrderListProps) {
  const navigate = useNavigate();
  const { update } = useServiceOrderMutations();
  const { batchDelete, batchUpdate } = useServiceOrderBatchMutations();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // State to hold current page items and total count from the table
  const [tableData, setTableData] = useState<{ items: ServiceOrder[]; totalRecords: number }>({
    items: [],
    totalRecords: 0,
  });
  const [showFilterModal, setShowFilterModal] = useState(false);

  // Delete/Cancel confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    type: "cancel" | "delete";
    items: ServiceOrder[];
  } | null>(null);

  // Stable callback for table data updates
  const handleTableDataChange = useCallback((data: { items: ServiceOrder[]; totalRecords: number }) => {
    setTableData(data);
  }, []);

  // Load entity data for filter labels
  const { data: servicesData } = useServices({ orderBy: { description: "asc" } });
  const { data: tasksData } = useTasks({ orderBy: { name: "asc" } });

  // Get table state for selected items functionality
  const { selectionCount, showSelectedOnly, toggleShowSelectedOnly } = useTableState({
    defaultPageSize: 40,
    resetSelectionOnPageChange: false,
  });

  // Custom deserializer for service order filters
  const deserializeServiceOrderFilters = useCallback((params: URLSearchParams): Partial<ServiceOrderGetManyFormData> => {
    const filters: Partial<ServiceOrderGetManyFormData> = {};

    // Parse status filters
    const status = params.get("status");
    if (status) {
      filters.status = status.split(",") as any[];
    }

    // Parse entity filters
    const services = params.get("services");
    if (services) {
      filters.serviceIds = services.split(",");
    }

    const tasks = params.get("tasks");
    if (tasks) {
      filters.taskIds = tasks.split(",");
    }

    // Parse date range filters
    const startedFrom = params.get("startedFrom");
    const startedTo = params.get("startedTo");
    if (startedFrom || startedTo) {
      filters.startedAt = {
        ...(startedFrom && { from: new Date(startedFrom) }),
        ...(startedTo && { to: new Date(startedTo) }),
      };
    }

    const finishedFrom = params.get("finishedFrom");
    const finishedTo = params.get("finishedTo");
    if (finishedFrom || finishedTo) {
      filters.finishedAt = {
        ...(finishedFrom && { from: new Date(finishedFrom) }),
        ...(finishedTo && { to: new Date(finishedTo) }),
      };
    }

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

  // Custom serializer for service order filters
  const serializeServiceOrderFilters = useCallback((filters: Partial<ServiceOrderGetManyFormData>): Record<string, string> => {
    const params: Record<string, string> = {};

    // Status filters
    if (filters.status?.length) params.status = filters.status.join(",");

    // Entity filters
    if (filters.serviceIds?.length) params.services = filters.serviceIds.join(",");
    if (filters.taskIds?.length) params.tasks = filters.taskIds.join(",");

    // Date filters
    if (filters.startedAt?.from) params.startedFrom = filters.startedAt.from.toISOString();
    if (filters.startedAt?.to) params.startedTo = filters.startedAt.to.toISOString();
    if (filters.finishedAt?.from) params.finishedFrom = filters.finishedAt.from.toISOString();
    if (filters.finishedAt?.to) params.finishedTo = filters.finishedAt.to.toISOString();
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
  } = useTableFilters<ServiceOrderGetManyFormData>({
    defaultFilters: {
      limit: DEFAULT_PAGE_SIZE,
    },
    searchDebounceMs: 300,
    searchParamName: "search",
    serializeToUrl: serializeServiceOrderFilters,
    deserializeFromUrl: deserializeServiceOrderFilters,
    excludeFromUrl: ["limit", "orderBy"],
  });

  // Query filters to pass to the paginated table
  const queryFilters = useMemo(() => {
    const { orderBy: _, ...filterWithoutOrderBy } = baseQueryFilters;

    return {
      ...filterWithoutOrderBy,
      limit: DEFAULT_PAGE_SIZE,
    };
  }, [baseQueryFilters]);

  // Handle filter changes
  const handleFilterChange = useCallback(
    (newFilters: Partial<ServiceOrderGetManyFormData>) => {
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
    if (!servicesData?.data || !tasksData?.data) return [];

    // Include searchingFor in the filters object for extraction
    const filtersWithSearch = {
      ...filters,
      searchingFor: searchingFor || undefined,
    };

    return extractActiveFilters(filtersWithSearch, onRemoveFilter, {
      services: servicesData.data,
      tasks: tasksData.data,
    });
  }, [filters, searchingFor, servicesData?.data, tasksData?.data, onRemoveFilter]);

  // Context menu handlers
  const handleBulkEdit = (items: ServiceOrder[]) => {
    if (items.length === 1) {
      // Single item - navigate to edit page
      navigate(routes.production.serviceOrders.edit(items[0].id));
    } else {
      // Multiple items - batch edit not implemented yet
    }
  };

  const handleBulkStart = async (items: ServiceOrder[]) => {
    const pendingOrders = items.filter((order) => order.status === SERVICE_ORDER_STATUS.PENDING);

    if (pendingOrders.length === 0) {
      return;
    }

    try {
      const updates = pendingOrders.map((order) => ({
        id: order.id,
        data: { status: SERVICE_ORDER_STATUS.IN_PROGRESS, startedAt: new Date() },
      }));

      if (updates.length === 1) {
        await update(updates[0]);
      } else {
        await batchUpdate({ serviceOrders: updates });
      }
    } catch (error) {
      console.error("Error starting service orders:", error);
    }
  };

  const handleBulkFinish = async (items: ServiceOrder[]) => {
    const inProgressOrders = items.filter((order) => order.status === SERVICE_ORDER_STATUS.IN_PROGRESS);

    if (inProgressOrders.length === 0) {
      return;
    }

    try {
      const updates = inProgressOrders.map((order) => ({
        id: order.id,
        data: { status: SERVICE_ORDER_STATUS.COMPLETED, finishedAt: new Date() },
      }));

      if (updates.length === 1) {
        await update(updates[0]);
      } else {
        await batchUpdate({ serviceOrders: updates });
      }
    } catch (error) {
      console.error("Error finishing service orders:", error);
    }
  };

  const handleBulkCancel = (items: ServiceOrder[]) => {
    const cancellableOrders = items.filter((order) => order.status !== SERVICE_ORDER_STATUS.COMPLETED && order.status !== SERVICE_ORDER_STATUS.CANCELLED);

    if (cancellableOrders.length === 0) {
      return;
    }

    setConfirmDialog({
      type: "cancel",
      items: cancellableOrders,
    });
  };

  const handleBulkDelete = (items: ServiceOrder[]) => {
    setConfirmDialog({
      type: "delete",
      items,
    });
  };

  // Confirm action
  const confirmAction = async () => {
    if (!confirmDialog) return;

    try {
      if (confirmDialog.type === "cancel") {
        const updates = confirmDialog.items.map((order) => ({
          id: order.id,
          data: { status: SERVICE_ORDER_STATUS.CANCELLED },
        }));

        if (updates.length === 1) {
          await update(updates[0]);
        } else {
          await batchUpdate({ serviceOrders: updates });
        }
      } else if (confirmDialog.type === "delete") {
        const ids = confirmDialog.items.map((item) => item.id);
        await batchDelete({ serviceOrderIds: ids });
      }
    } catch (error) {
      console.error(`Error ${confirmDialog.type}ing service orders:`, error);
    } finally {
      setConfirmDialog(null);
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
            onChange={setSearch}
            placeholder="Buscar por descrição, serviço, tarefa..."
            isPending={displaySearchText !== searchingFor}
          />
          <div className="flex gap-2">
            <ShowSelectedToggle showSelectedOnly={showSelectedOnly} onToggle={toggleShowSelectedOnly} selectionCount={selectionCount} />
            <Button variant="outline" size="default" onClick={() => setShowFilterModal(true)} className="group">
              <IconFilter className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              <span className="text-foreground">Filtros</span>
            </Button>
            <ServiceOrderExport filters={filters} currentItems={tableData.items} totalRecords={tableData.totalRecords} />
          </div>
        </div>

        {/* Active Filter Indicators */}
        {activeFilters.length > 0 && <FilterIndicators filters={activeFilters} onClearAll={clearAllFilters} className="px-1 py-1" />}

        {/* Paginated table */}
        <div className="flex-1 min-h-0">
          <ServiceOrderTable
            onEdit={handleBulkEdit}
            onStart={handleBulkStart}
            onFinish={handleBulkFinish}
            onCancel={handleBulkCancel}
            onDelete={handleBulkDelete}
            filters={queryFilters}
            className="h-full"
            onDataChange={handleTableDataChange}
          />
        </div>
      </CardContent>

      {/* Enhanced Filter Modal */}
      <ServiceOrderFilters open={showFilterModal} onOpenChange={setShowFilterModal} filters={filters} onFilterChange={handleFilterChange} />

      {/* Confirmation Dialog */}
      <AlertDialog open={!!confirmDialog} onOpenChange={(open) => !open && setConfirmDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmDialog?.type === "cancel" ? "Cancelar ordens de serviço" : "Excluir ordens de serviço"}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog?.type === "cancel"
                ? `Tem certeza que deseja cancelar ${confirmDialog.items.length} ordem${confirmDialog.items.length > 1 ? "ns" : ""} de serviço? Esta ação não pode ser desfeita.`
                : `Tem certeza que deseja excluir ${confirmDialog.items.length} ordem${confirmDialog.items.length > 1 ? "ns" : ""} de serviço? Esta ação não pode ser desfeita.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmAction} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {confirmDialog?.type === "cancel" ? "Cancelar Ordens" : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
