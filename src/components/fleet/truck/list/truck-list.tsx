import React, { useState, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTruckMutations, useTruckBatchMutations, useTasks, useGarages } from "../../../../hooks";
import type { Truck } from "../../../../types";
import type { TruckGetManyFormData } from "../../../../schemas";
import { routes } from "../../../../constants";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { TruckTable } from "./truck-table";
import { IconFilter } from "@tabler/icons-react";
import { TruckFilters } from "./truck-filters";
import { ColumnVisibilityManager } from "./column-visibility-manager";
import { createTruckColumns } from "./truck-table-columns";
import { extractActiveFilters, createFilterRemover } from "./filter-utils";
import { FilterIndicators } from "./filter-indicators";
import { cn } from "@/lib/utils";
import { useTableState } from "@/hooks/use-table-state";
import { ShowSelectedToggle } from "@/components/ui/show-selected-toggle";
import { useTableFilters } from "@/hooks/use-table-filters";
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

interface TruckListProps {
  className?: string;
}

const DEFAULT_PAGE_SIZE = 40;

export function TruckList({ className }: TruckListProps) {
  const navigate = useNavigate();
  const { update } = useTruckMutations();
  const { batchDelete, batchUpdate } = useTruckBatchMutations();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // State to hold current page trucks and total count from the table
  const [tableData, setTableData] = useState<{ trucks: Truck[]; totalRecords: number }>({ trucks: [], totalRecords: 0 });
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<{ items: Truck[]; isBulk: boolean } | null>(null);

  // Stable callback for table data updates
  const handleTableDataChange = useCallback((data: { trucks: Truck[]; totalRecords: number }) => {
    setTableData(data);
  }, []);

  // Load entity data for filter labels
  const { data: tasksData } = useTasks({
    include: { customer: true },
    orderBy: { createdAt: "desc" },
    limit: 100,
  });
  const { data: garagesData } = useGarages({ orderBy: { name: "asc" } });

  // Get table state for selected items functionality
  const { selectionCount, showSelectedOnly, toggleShowSelectedOnly } = useTableState({
    defaultPageSize: 40,
    resetSelectionOnPageChange: false,
  });

  // Custom deserializer for truck filters
  const deserializeTruckFilters = useCallback((params: URLSearchParams): Partial<TruckGetManyFormData> => {
    const filters: Partial<TruckGetManyFormData> = {};

    // Parse boolean filters
    const hasGarage = params.get("hasGarage");
    if (hasGarage !== null) {
      filters.hasGarage = hasGarage === "true";
    }

    const hasPosition = params.get("hasPosition");
    if (hasPosition !== null) {
      filters.hasPosition = hasPosition === "true";
    }

    const isParked = params.get("isParked");
    if (isParked !== null) {
      filters.isParked = isParked === "true";
    }

    // Parse array filters
    const taskIds = params.get("taskIds");
    if (taskIds) {
      filters.taskIds = taskIds.split(",");
    }

    const garageIds = params.get("garageIds");
    if (garageIds) {
      filters.garageIds = garageIds.split(",");
    }

    const manufacturers = params.get("manufacturers");
    if (manufacturers) {
      filters.manufacturers = manufacturers.split(",") as any;
    }

    const plates = params.get("plates");
    if (plates) {
      filters.plates = plates.split(",");
    }

    const models = params.get("models");
    if (models) {
      filters.models = models.split(",");
    }

    // Parse range filters

    const xPositionMin = params.get("xPositionMin");
    const xPositionMax = params.get("xPositionMax");
    if (xPositionMin || xPositionMax) {
      filters.xPositionRange = {
        ...(xPositionMin && { min: Number(xPositionMin) }),
        ...(xPositionMax && { max: Number(xPositionMax) }),
      };
    }

    const yPositionMin = params.get("yPositionMin");
    const yPositionMax = params.get("yPositionMax");
    if (yPositionMin || yPositionMax) {
      filters.yPositionRange = {
        ...(yPositionMin && { min: Number(yPositionMin) }),
        ...(yPositionMax && { max: Number(yPositionMax) }),
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

  // Custom serializer for truck filters
  const serializeTruckFilters = useCallback((filters: Partial<TruckGetManyFormData>): Record<string, string> => {
    const params: Record<string, string> = {};

    // Boolean filters
    if (typeof filters.hasGarage === "boolean") params.hasGarage = String(filters.hasGarage);
    if (typeof filters.hasPosition === "boolean") params.hasPosition = String(filters.hasPosition);
    if (typeof filters.isParked === "boolean") params.isParked = String(filters.isParked);

    // Array filters
    if (filters.taskIds?.length) params.taskIds = filters.taskIds.join(",");
    if (filters.garageIds?.length) params.garageIds = filters.garageIds.join(",");
    if (filters.manufacturers?.length) params.manufacturers = filters.manufacturers.join(",");
    if (filters.plates?.length) params.plates = filters.plates.join(",");
    if (filters.models?.length) params.models = filters.models.join(",");

    // Range filters
    if (filters.xPositionRange?.min !== undefined) params.xPositionMin = String(filters.xPositionRange.min);
    if (filters.xPositionRange?.max !== undefined) params.xPositionMax = String(filters.xPositionRange.max);
    if (filters.yPositionRange?.min !== undefined) params.yPositionMin = String(filters.yPositionRange.min);
    if (filters.yPositionRange?.max !== undefined) params.yPositionMax = String(filters.yPositionRange.max);

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
  } = useTableFilters<TruckGetManyFormData>({
    defaultFilters: {
      limit: DEFAULT_PAGE_SIZE,
    },
    searchDebounceMs: 300,
    searchParamName: "search",
    serializeToUrl: serializeTruckFilters,
    deserializeFromUrl: deserializeTruckFilters,
    excludeFromUrl: ["limit", "orderBy"],
  });

  // Visible columns state with localStorage persistence
  const { visibleColumns, setVisibleColumns } = useColumnVisibility(
    "truck-list-visible-columns",
    new Set(["plate", "task.serialNumber", "model", "manufacturer", "task.customer.fantasyName", "garage.name", "parkingStatus", "createdAt"])
  );

  // Get all available columns for column visibility manager
  const allColumns = useMemo(() => createTruckColumns(), []);

  // Query filters to pass to the paginated table
  const queryFilters = useMemo(() => {
    const { orderBy: _, ...filterWithoutOrderBy } = baseQueryFilters;

    console.log("[TruckList] baseQueryFilters:", baseQueryFilters);
    console.log("[TruckList] filterWithoutOrderBy:", filterWithoutOrderBy);

    const result = {
      ...filterWithoutOrderBy,
      limit: DEFAULT_PAGE_SIZE,
    };

    console.log("[TruckList] queryFilters result:", result);
    return result;
  }, [baseQueryFilters]);

  // Handle filter changes
  const handleFilterChange = useCallback(
    (newFilters: Partial<TruckGetManyFormData>) => {
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
    if (!tasksData?.data || !garagesData?.data) return [];

    // Include searchingFor in the filters object for extraction
    const filtersWithSearch = {
      ...filters,
      searchingFor: searchingFor || undefined,
    };

    return extractActiveFilters(filtersWithSearch, onRemoveFilter, {
      tasks: tasksData.data,
      garages: garagesData.data,
    });
  }, [filters, searchingFor, tasksData?.data, garagesData?.data, onRemoveFilter]);

  // Context menu handlers
  const handleBulkEdit = (trucks: Truck[]) => {
    if (trucks.length === 1) {
      // Single truck - navigate to edit page
      navigate(routes.production.trucks?.edit?.(trucks[0].id) || `/production/trucks/edit/${trucks[0].id}`);
    } else {
      // Multiple trucks - navigate to batch edit page (if implemented)
      const ids = trucks.map((truck) => truck.id).join(",");
      navigate(`${routes.production.trucks?.batchEdit || "/production/trucks/batch-edit"}?ids=${ids}`);
    }
  };

  const handleBulkDelete = (trucks: Truck[]) => {
    setDeleteDialog({
      items: trucks,
      isBulk: trucks.length > 1,
    });
  };

  const confirmDelete = async () => {
    if (!deleteDialog) return;

    try {
      const ids = deleteDialog.items.map((truck) => truck.id);
      await batchDelete({ truckIds: ids });

      // Selection is now managed by URL state and will be cleared automatically
    } catch (error) {
      // Error is handled by the API client with detailed message
      console.error("Error deleting truck(s):", error);
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
              console.log("[TruckList] Search input changed to:", value);
              setSearch(value);
            }}
            placeholder="Buscar por placa, modelo, cliente, garagem..."
            isPending={displaySearchText !== searchingFor}
          />
          <div className="flex gap-2">
            <ShowSelectedToggle showSelectedOnly={showSelectedOnly} onToggle={toggleShowSelectedOnly} selectionCount={selectionCount} />
            <Button variant={hasActiveFilters ? "default" : "outline"} size="default" onClick={() => setShowFilterModal(true)} className="group">
              <IconFilter className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              <span className="text-foreground">
                {hasActiveFilters ? `Filtros (${activeFilters.length})` : "Filtros"}
              </span>
            </Button>
            <ColumnVisibilityManager columns={allColumns} visibleColumns={visibleColumns} onVisibilityChange={setVisibleColumns} />
          </div>
        </div>

        {/* Active Filter Indicators */}
        {activeFilters.length > 0 && <FilterIndicators filters={activeFilters} onClearAll={clearAllFilters} className="px-1 py-1" />}

        {/* Paginated table */}
        <div className="flex-1 min-h-0">
          <TruckTable
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
      <TruckFilters open={showFilterModal} onOpenChange={setShowFilterModal} filters={filters} onFilterChange={handleFilterChange} />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteDialog} onOpenChange={(open) => !open && setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteDialog?.isBulk && deleteDialog.items.length > 1
                ? `Tem certeza que deseja deletar ${deleteDialog.items.length} caminhões? Esta ação não pode ser desfeita.`
                : `Tem certeza que deseja deletar o caminhão "${deleteDialog?.items[0]?.plate || deleteDialog?.items[0]?.task?.plate}"? Esta ação não pode ser desfeita.`}
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
