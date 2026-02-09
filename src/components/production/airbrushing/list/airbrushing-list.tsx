import React, { useState, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTasks } from "../../../../hooks";
import type { Airbrushing } from "../../../../types";
import type { AirbrushingGetManyFormData } from "../../../../schemas";
import { routes } from "../../../../constants";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { AirbrushingTable } from "./airbrushing-table";
import { IconFilter } from "@tabler/icons-react";
import { AirbrushingFilters } from "./airbrushing-filters";
import { ColumnVisibilityManager } from "./column-visibility-manager";
import { getAirbrushingTableColumns, getDefaultVisibleColumns } from "./airbrushing-table-columns";
import { FilterIndicators } from "./filter-indicator";
import { extractActiveFilters, createFilterRemover } from "./filter-utils";
import { cn } from "@/lib/utils";
import { ShowSelectedToggle } from "@/components/ui/show-selected-toggle";
import { useTableState } from "@/hooks/common/use-table-state";
import { useTableFilters } from "@/hooks/common/use-table-filters";
import { useColumnVisibility } from "@/hooks/common/use-column-visibility";

interface AirbrushingListProps {
  className?: string;
}

const DEFAULT_PAGE_SIZE = 40;

export function AirbrushingList({ className }: AirbrushingListProps) {
  const navigate = useNavigate();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [showFilterModal, setShowFilterModal] = useState(false);

  // State to hold current page items and total count from the table
  const [, setTableData] = useState<{ items: Airbrushing[]; totalRecords: number }>({ items: [], totalRecords: 0 });

  // Stable callback for table data updates
  const handleTableDataChange = useCallback((data: { items: Airbrushing[]; totalRecords: number }) => {
    setTableData(data);
  }, []);

  // Load entity data for filter labels
  const { data: tasksData } = useTasks({ orderBy: { name: "asc" }, limit: 100 });

  // Get table state for selected items functionality
  const { selectionCount, showSelectedOnly, toggleShowSelectedOnly } = useTableState({
    defaultPageSize: 40,
    resetSelectionOnPageChange: false,
  });

  // Visible columns state with localStorage persistence
  const { visibleColumns, setVisibleColumns } = useColumnVisibility("airbrushing-list-visible-columns", getDefaultVisibleColumns());

  // Handle column visibility changes
  const handleColumnVisibilityChange = useCallback(
    (columns: Set<string>) => {
      setVisibleColumns(columns);
    },
    [setVisibleColumns],
  );

  // Get all available columns for column visibility manager
  const allColumns = useMemo(
    () =>
      getAirbrushingTableColumns({
        selection: {},
        onRowSelection: (_airbrushingId: string, _selected: boolean) => {},
        onView: (_airbrushing: Airbrushing, _event?: React.MouseEvent) => {},
        onEdit: (_airbrushing: Airbrushing, _event?: React.MouseEvent) => {},
        onDelete: (_airbrushing: Airbrushing, _event?: React.MouseEvent) => {},
      }),
    [],
  );

  // Custom deserializer for airbrushing filters
  const deserializeAirbrushingFilters = useCallback((params: URLSearchParams): Partial<AirbrushingGetManyFormData> => {
    const filters: Partial<AirbrushingGetManyFormData> = {};

    // Parse task IDs
    const taskIds = params.get("taskIds");
    if (taskIds) {
      filters.taskIds = taskIds.split(",");
    }

    // Parse status filter
    const status = params.get("status");
    if (status) {
      filters.status = status.split(",") as any[];
    }

    // Parse price range
    const minPrice = params.get("minPrice");
    const maxPrice = params.get("maxPrice");
    if (minPrice || maxPrice) {
      filters.priceRange = {};
      if (minPrice) filters.priceRange.min = parseFloat(minPrice);
      if (maxPrice) filters.priceRange.max = parseFloat(maxPrice);
    }

    // Parse has dates filters
    const hasStartDate = params.get("hasStartDate");
    if (hasStartDate === "true") {
      filters.hasStartDate = true;
    } else if (hasStartDate === "false") {
      filters.hasStartDate = false;
    }

    const hasFinishDate = params.get("hasFinishDate");
    if (hasFinishDate === "true") {
      filters.hasFinishDate = true;
    } else if (hasFinishDate === "false") {
      filters.hasFinishDate = false;
    }

    // Parse date range
    const createdAfter = params.get("createdAfter");
    const createdBefore = params.get("createdBefore");
    if (createdAfter || createdBefore) {
      filters.createdAt = {};
      if (createdAfter) filters.createdAt.gte = new Date(createdAfter);
      if (createdBefore) filters.createdAt.lte = new Date(createdBefore);
    }

    return filters;
  }, []);

  // Custom serializer for airbrushing filters
  const serializeAirbrushingFilters = useCallback((filters: Partial<AirbrushingGetManyFormData>): Record<string, string> => {
    const params: Record<string, string> = {};

    // Task IDs
    if (filters.taskIds?.length) params.taskIds = filters.taskIds.join(",");

    // Status filter
    if (filters.status?.length) params.status = filters.status.join(",");

    // Price range
    if (filters.priceRange?.min !== undefined) params.minPrice = filters.priceRange.min.toString();
    if (filters.priceRange?.max !== undefined) params.maxPrice = filters.priceRange.max.toString();

    // Has dates filters
    if (filters.hasStartDate !== undefined) params.hasStartDate = filters.hasStartDate.toString();
    if (filters.hasFinishDate !== undefined) params.hasFinishDate = filters.hasFinishDate.toString();

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
  } = useTableFilters<AirbrushingGetManyFormData>({
    defaultFilters: {
      limit: DEFAULT_PAGE_SIZE,
    },
    searchDebounceMs: 500,
    searchParamName: "search",
    serializeToUrl: serializeAirbrushingFilters,
    deserializeFromUrl: deserializeAirbrushingFilters,
    excludeFromUrl: ["limit", "orderBy"],
  });

  // Query filters to pass to the table
  const queryFilters = useMemo(() => {
    const { orderBy: _, ...filterWithoutOrderBy } = baseQueryFilters;

    const result = {
      ...filterWithoutOrderBy,
      include: {
        task: {
          include: {
            customer: true,
            sector: true,
            user: true,
          },
        },
        receipts: true,
        invoices: true,
      },
      orderBy: { createdAt: "desc" },
      limit: DEFAULT_PAGE_SIZE,
    };

    return result;
  }, [baseQueryFilters]);

  // Handle filter changes
  const handleFilterChange = useCallback(
    (newFilters: Partial<AirbrushingGetManyFormData>) => {
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
    if (!tasksData?.data) return [];

    // Include searchingFor in the filters object for extraction
    const filtersWithSearch = {
      ...filters,
      searchingFor: searchingFor || undefined,
    };

    return extractActiveFilters(filtersWithSearch, onRemoveFilter, {
      tasks: tasksData.data,
    });
  }, [filters, searchingFor, tasksData?.data, onRemoveFilter]);

  // Handle row click to navigate to details
  const handleRowClick = (airbrushing: Airbrushing) => {
    navigate(routes.production.airbrushings.details(airbrushing.id));
  };

  return (
    <Card className={cn("flex flex-col shadow-sm border border-border", className)}>
      <CardContent className="flex-1 flex flex-col p-4 space-y-4 overflow-hidden">
        {/* Search and Controls */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <TableSearchInput
            ref={searchInputRef}
            value={displaySearchText}
            onChange={(value) => {
              setSearch(value);
            }}
            placeholder="Buscar airbrushings..."
            isPending={displaySearchText !== searchingFor}
          />
          <div className="flex gap-2">
            {selectionCount > 0 && <ShowSelectedToggle showSelectedOnly={showSelectedOnly} onToggle={toggleShowSelectedOnly} selectionCount={selectionCount} />}
            <Button variant={hasActiveFilters ? "default" : "outline"} onClick={() => setShowFilterModal(true)}>
              <IconFilter className="h-4 w-4 mr-2" />
              {hasActiveFilters ? `Filtros (${activeFilters.length})` : "Filtros"}
            </Button>
            <ColumnVisibilityManager columns={allColumns} visibleColumns={visibleColumns} onVisibilityChange={handleColumnVisibilityChange} />
          </div>
        </div>

        {/* Active Filter Indicators */}
        {activeFilters.length > 0 && <FilterIndicators filters={activeFilters} onClearAll={clearAllFilters} className="px-1 py-1" />}

        {/* Table */}
        <div className="flex-1 min-h-0 overflow-auto">
          <AirbrushingTable
            className="h-full"
            onRowClick={handleRowClick}
            showSelectedOnly={showSelectedOnly}
            visibleColumns={visibleColumns}
            filters={queryFilters}
            onDataChange={handleTableDataChange}
          />
        </div>

        {/* Filter Modal */}
        <AirbrushingFilters open={showFilterModal} onOpenChange={setShowFilterModal} filters={filters} onFilterChange={handleFilterChange} tasks={tasksData?.data || []} />
      </CardContent>
    </Card>
  );
}
