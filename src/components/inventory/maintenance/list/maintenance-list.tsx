import React, { useState, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useMaintenanceBatchMutations, useItems, useSectors } from "../../../../hooks";
import type { Maintenance } from "../../../../types";
import type { MaintenanceGetManyFormData } from "../../../../schemas";
import { routes, MAINTENANCE_STATUS } from "../../../../constants";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { MaintenanceTable } from "./maintenance-table";
import { IconFilter } from "@tabler/icons-react";
import { MaintenanceFilters } from "./maintenance-filters";
import { MaintenanceExport } from "./maintenance-export";
import { FilterIndicators } from "./filter-indicators";
import { extractActiveFilters, createFilterRemover } from "./filter-utils";
import { cn } from "@/lib/utils";
import { ShowSelectedToggle } from "@/components/ui/show-selected-toggle";
import { useTableState } from "@/hooks/use-table-state";
import { useTableFilters } from "@/hooks/use-table-filters";
import { Badge } from "@/components/ui/badge";
import { useColumnVisibility } from "@/hooks/use-column-visibility";
import { getDefaultVisibleColumns, createMaintenanceColumns } from "./maintenance-table-columns";
import { ColumnVisibilityManager } from "./column-visibility-manager";
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

interface MaintenanceListProps {
  className?: string;
}

const DEFAULT_PAGE_SIZE = 40;

export function MaintenanceList({ className }: MaintenanceListProps) {
  const navigate = useNavigate();
  const { batchDelete } = useMaintenanceBatchMutations();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // State to hold current page items and total count from the table
  const [tableData, setTableData] = useState<{ items: Maintenance[]; totalRecords: number }>({ items: [], totalRecords: 0 });
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<{
    items: Maintenance[];
    isBulk: boolean;
  } | null>(null);

  // Stable callback for table data updates
  const handleTableDataChange = useCallback((data: { items: Maintenance[]; totalRecords: number }) => {
    setTableData(data);
  }, []);

  // Load entity data for filter labels
  const { data: itemsData } = useItems({ orderBy: { name: "asc" } });
  const { data: sectorsData } = useSectors({ orderBy: { name: "asc" } });

  // Get table state for selected items functionality
  const { selectionCount, showSelectedOnly, toggleShowSelectedOnly, selectedIds } = useTableState({
    defaultPageSize: 40,
    resetSelectionOnPageChange: false,
  });

  // Column visibility state with localStorage persistence
  const { visibleColumns, setVisibleColumns } = useColumnVisibility("maintenance-list-visible-columns", getDefaultVisibleColumns());

  // Create columns for visibility manager
  const columns = useMemo(() => createMaintenanceColumns(), []);

  // Custom deserializer for maintenance filters
  const deserializeMaintenanceFilters = useCallback((params: URLSearchParams): Partial<MaintenanceGetManyFormData> => {
    const filters: Partial<MaintenanceGetManyFormData> = {};

    // Parse entity filters (support both single and multiple selections)
    const itemId = params.get("itemId");
    const itemIds = params.get("itemIds");
    if (itemIds) {
      filters.itemIds = itemIds.split(",");
    } else if (itemId) {
      filters.where = { ...filters.where, itemId };
    }

    const sectorId = params.get("sectorId");
    const sectorIds = params.get("sectorIds");
    if (sectorIds) {
      filters.sectorIds = sectorIds.split(",");
    } else if (sectorId) {
      filters.where = { ...filters.where, sectorId };
    }

    // Parse status filter
    const status = params.get("status");
    if (status) {
      filters.status = status.split(",") as MAINTENANCE_STATUS[];
    }

    // Parse priority filter
    const priority = params.get("priority");
    if (priority) {
      filters.priority = priority.split(",");
    }

    // Parse date range filters
    const nextMaintenanceAfter = params.get("nextMaintenanceAfter");
    const nextMaintenanceBefore = params.get("nextMaintenanceBefore");
    if (nextMaintenanceAfter || nextMaintenanceBefore) {
      filters.nextMaintenanceDate = {
        ...(nextMaintenanceAfter && { gte: new Date(nextMaintenanceAfter) }),
        ...(nextMaintenanceBefore && { lte: new Date(nextMaintenanceBefore) }),
      };
    }

    const lastMaintenanceAfter = params.get("lastMaintenanceAfter");
    const lastMaintenanceBefore = params.get("lastMaintenanceBefore");
    if (lastMaintenanceAfter || lastMaintenanceBefore) {
      filters.lastMaintenanceDate = {
        ...(lastMaintenanceAfter && { gte: new Date(lastMaintenanceAfter) }),
        ...(lastMaintenanceBefore && { lte: new Date(lastMaintenanceBefore) }),
      };
    }

    return filters;
  }, []);

  // Custom serializer for maintenance filters
  const serializeMaintenanceFilters = useCallback((filters: Partial<MaintenanceGetManyFormData>): Record<string, string> => {
    const params: Record<string, string> = {};

    // Entity filters
    if (filters.itemIds?.length) params.itemIds = filters.itemIds.join(",");
    else if (filters.where?.itemId) params.itemId = filters.where.itemId as string;

    if (filters.sectorIds?.length) params.sectorIds = filters.sectorIds.join(",");
    else if (filters.where?.sectorId) params.sectorId = filters.where.sectorId as string;

    // Status and priority filters
    if (filters.status?.length) params.status = filters.status.join(",");
    if (filters.priority?.length) params.priority = filters.priority.join(",");

    // Date filters
    if (filters.nextMaintenanceDate?.gte) params.nextMaintenanceAfter = filters.nextMaintenanceDate.gte.toISOString();
    if (filters.nextMaintenanceDate?.lte) params.nextMaintenanceBefore = filters.nextMaintenanceDate.lte.toISOString();
    if (filters.lastMaintenanceDate?.gte) params.lastMaintenanceAfter = filters.lastMaintenanceDate.gte.toISOString();
    if (filters.lastMaintenanceDate?.lte) params.lastMaintenanceBefore = filters.lastMaintenanceDate.lte.toISOString();

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
  } = useTableFilters<MaintenanceGetManyFormData>({
    defaultFilters: {
      limit: DEFAULT_PAGE_SIZE,
    },
    searchDebounceMs: 300,
    searchParamName: "search", // Use "search" for URL compatibility
    serializeToUrl: serializeMaintenanceFilters,
    deserializeFromUrl: deserializeMaintenanceFilters,
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
    (newFilters: Partial<MaintenanceGetManyFormData>) => {
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
    if (!itemsData?.data || !sectorsData?.data) return [];

    // Include searchingFor in the filters object for extraction
    const filtersWithSearch = {
      ...filters,
      searchingFor: searchingFor || undefined,
    };

    return extractActiveFilters(filtersWithSearch, onRemoveFilter, {
      items: itemsData.data,
      sectors: sectorsData.data,
    });
  }, [filters, searchingFor, itemsData?.data, sectorsData?.data, onRemoveFilter]);

  // Context menu handlers
  const handleBulkEdit = (maintenances: Maintenance[]) => {
    if (maintenances.length === 1) {
      // Single maintenance - navigate to edit page
      navigate(routes.inventory.maintenance.edit(maintenances[0].id));
    } else {
      // Multiple maintenances - navigate to batch edit page
      const ids = maintenances.map((m) => m.id).join(",");
      navigate(`${routes.inventory.maintenance.root}/editar-em-lote?ids=${ids}`);
    }
  };

  const handleBulkMarkAsFinished = async (maintenances: Maintenance[]) => {
    // TODO: Implement batch finish logic
    console.log("Batch mark as finished:", maintenances);
  };

  const handleBulkDelete = async (maintenances: Maintenance[]) => {
    setDeleteDialog({
      items: maintenances,
      isBulk: maintenances.length > 1,
    });
  };

  const confirmDelete = async () => {
    if (!deleteDialog) return;

    try {
      const ids = deleteDialog.items.map((m) => m.id);
      await batchDelete({ maintenanceIds: ids });
      setDeleteDialog(null);
    } catch (error) {
      // Error is handled by the API client with detailed message
      console.error(`Error deleting maintenance${deleteDialog.items.length > 1 ? "s" : ""}:`, error);
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
            placeholder="Buscar por nome, item, setor..."
            isPending={displaySearchText !== searchingFor}
          />
          <div className="flex gap-2">
            <ShowSelectedToggle showSelectedOnly={showSelectedOnly} onToggle={toggleShowSelectedOnly} selectionCount={selectionCount} />
            <Button
              variant={activeFilters.length > 0 ? "default" : "outline"}
              size="default"
              onClick={() => setShowFilterModal(true)}
            >
              <IconFilter className="h-4 w-4" />
              <span>
                Filtros
                {activeFilters.length > 0 ? ` (${activeFilters.length})` : ""}
              </span>
            </Button>
            <ColumnVisibilityManager columns={columns} visibleColumns={visibleColumns} onVisibilityChange={setVisibleColumns} />
            <MaintenanceExport
              filters={queryFilters}
              currentMaintenance={tableData.items}
              totalRecords={tableData.totalRecords}
              selectedMaintenance={selectionCount > 0 ? new Set(selectedIds.map(String)) : undefined}
            />
          </div>
        </div>

        {/* Active Filter Indicators */}
        {activeFilters.length > 0 && <FilterIndicators filters={activeFilters} onClearAll={clearAllFilters} className="px-1 py-1" />}

        {/* Paginated table */}
        <div className="flex-1 min-h-0">
          <MaintenanceTable
            visibleColumns={visibleColumns}
            onEdit={handleBulkEdit}
            onMarkAsFinished={handleBulkMarkAsFinished}
            onDelete={handleBulkDelete}
            filters={queryFilters}
            className="h-full"
            onDataChange={handleTableDataChange}
          />
        </div>
      </CardContent>

      {/* Enhanced Filter Modal */}
      <MaintenanceFilters open={showFilterModal} onOpenChange={setShowFilterModal} filters={filters} onFilterChange={handleFilterChange} />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteDialog} onOpenChange={(open) => !open && setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteDialog?.isBulk
                ? `Tem certeza que deseja deletar ${deleteDialog.items.length} manutenções? Esta ação não pode ser desfeita.`
                : `Tem certeza que deseja deletar a manutenção "${deleteDialog?.items[0]?.name}"? Esta ação não pode ser desfeita.`}
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
