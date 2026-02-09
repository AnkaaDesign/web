import { useState, useCallback, useMemo, useRef } from "react";
import type { Activity } from "../../../../types";
import type { ActivityGetManyFormData } from "../../../../schemas";
import { ACTIVITY_REASON, ACTIVITY_OPERATION } from "../../../../constants";
import { useItems, useUsers } from "../../../../hooks";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { ActivityTable } from "./activity-table";
import { IconFilter } from "@tabler/icons-react";
import { ActivityFilters } from "./activity-filters";
import { ActivityExport } from "./activity-export";
import { FilterIndicators } from "./filter-indicator";
import { extractActiveFilters, createFilterRemover } from "./filter-utils";
import { cn } from "@/lib/utils";
import { ShowSelectedToggle } from "@/components/ui/show-selected-toggle";
import { useTableState } from "@/hooks/common/use-table-state";
import { useTableFilters } from "@/hooks/common/use-table-filters";
import { ColumnVisibilityManager } from "./column-visibility-manager";
import { getActivityColumns, getDefaultVisibleColumns } from "./activity-table-columns";
import { useColumnVisibility } from "@/hooks/common/use-column-visibility";

interface ActivityListProps {
  className?: string;
}

const DEFAULT_PAGE_SIZE = 40;

export function ActivityList({ className }: ActivityListProps) {
  const searchInputRef = useRef<HTMLInputElement>(null);

  // State to hold current page items and total count from the table
  const [tableData, setTableData] = useState<{ activities: Activity[]; totalRecords: number }>({ activities: [], totalRecords: 0 });
  const [showFilterModal, setShowFilterModal] = useState(false);

  // Stable callback for table data updates
  const handleTableDataChange = useCallback((data: { activities: Activity[]; totalRecords: number }) => {
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

  // Custom deserializer for activity filters
  const deserializeActivityFilters = useCallback((params: URLSearchParams): Partial<ActivityGetManyFormData> => {
    const filters: Partial<ActivityGetManyFormData> = {};

    // Parse operation types
    const operations = params.get("operations");
    if (operations) {
      filters.operations = operations.split(",") as ACTIVITY_OPERATION[];
    }

    // Parse reasons
    const reasons = params.get("reasons");
    if (reasons) {
      filters.reasons = reasons.split(",") as ACTIVITY_REASON[];
    }

    // Parse entity filters
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

    // Parse quantity range
    const quantityMin = params.get("quantityMin");
    const quantityMax = params.get("quantityMax");
    if (quantityMin || quantityMax) {
      filters.quantityRange = {
        ...(quantityMin && { min: Number(quantityMin) }),
        ...(quantityMax && { max: Number(quantityMax) }),
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

    // Parse showPaintProduction filter
    const showPaintProduction = params.get("showPaintProduction");
    if (showPaintProduction === "true") {
      filters.showPaintProduction = true;
    }

    return filters;
  }, []);

  // Custom serializer for activity filters
  const serializeActivityFilters = useCallback((filters: Partial<ActivityGetManyFormData>): Record<string, string> => {
    const params: Record<string, string> = {};

    // Operation types
    if (filters.operations?.length) params.operations = filters.operations.join(",");

    // Reasons
    if (filters.reasons?.length) params.reasons = filters.reasons.join(",");

    // Entity filters
    if (filters.itemIds?.length) params.itemIds = filters.itemIds.join(",");
    else if (filters.where?.itemId) params.itemId = filters.where.itemId as string;

    if (filters.userIds?.length) params.userIds = filters.userIds.join(",");
    else if (filters.where?.userId) params.userId = filters.where.userId as string;

    // Range filters
    if (filters.quantityRange?.min !== undefined) params.quantityMin = String(filters.quantityRange.min);
    if (filters.quantityRange?.max !== undefined) params.quantityMax = String(filters.quantityRange.max);

    // Date filters
    if (filters.createdAt?.gte) params.createdAfter = filters.createdAt.gte.toISOString();
    if (filters.createdAt?.lte) params.createdBefore = filters.createdAt.lte.toISOString();

    // Paint production filter
    if (filters.showPaintProduction) params.showPaintProduction = "true";

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
  } = useTableFilters<ActivityGetManyFormData>({
    defaultFilters: {
      limit: DEFAULT_PAGE_SIZE,
    },
    searchDebounceMs: 500,
    searchParamName: "search",
    serializeToUrl: serializeActivityFilters,
    deserializeFromUrl: deserializeActivityFilters,
    excludeFromUrl: ["limit", "orderBy"],
  });

  // Visible columns state with localStorage persistence
  const { visibleColumns, setVisibleColumns } = useColumnVisibility("activity-list-visible-columns", getDefaultVisibleColumns());

  // Get columns for the visibility manager
  const allColumns = useMemo(() => getActivityColumns(), []);

  // Create filter remover function
  const handleRemoveFilter = useCallback(
    (key: string, value?: any) => {
      if (key === "searchingFor") {
        setSearch("");
      } else {
        const remover = createFilterRemover(filters, setFilters);
        remover(key, value);
      }
    },
    [filters, setFilters, setSearch],
  );

  // Extract active filters for display
  const activeFilters = useMemo(() => {
    // Include searchingFor in the filters object for extraction
    const filtersWithSearch = {
      ...filters,
      searchingFor: searchingFor || undefined,
    };

    return extractActiveFilters(filtersWithSearch, handleRemoveFilter, {
      items: itemsData?.data,
      users: usersData?.data,
    });
  }, [filters, searchingFor, handleRemoveFilter, itemsData?.data, usersData?.data]);

  // Handle filter change from modal
  const handleFilterChange = useCallback(
    (newFilters: Partial<ActivityGetManyFormData>) => {
      setFilters(newFilters);
    },
    [setFilters],
  );

  // Build query filters with search
  const queryFilters = useMemo(() => {
    return {
      ...baseQueryFilters,
      ...(searchingFor && { searchingFor }),
    };
  }, [baseQueryFilters, searchingFor]);

  return (
    <Card className={cn("flex flex-col shadow-sm border border-border", className)}>
      <CardContent className="flex-1 flex flex-col p-4 space-y-4 overflow-hidden">
        {/* Search and controls */}
        <div className="flex flex-col gap-3 sm:flex-row flex-shrink-0">
          <TableSearchInput
            ref={searchInputRef}
            value={displaySearchText}
            onChange={(value) => {
              
              setSearch(value);
            }}
            placeholder="Buscar por item, usuário, descrição..."
            isPending={displaySearchText !== searchingFor}
          />
          <div className="flex gap-2">
            <ShowSelectedToggle showSelectedOnly={showSelectedOnly} onToggle={toggleShowSelectedOnly} selectionCount={selectionCount} />
            <Button variant={hasActiveFilters ? "default" : "outline"} size="default" onClick={() => setShowFilterModal(true)} className="group">
              <IconFilter className="h-4 w-4" />
              <span>Filtros{activeFilters.length > 0 ? ` (${activeFilters.length})` : ""}</span>
            </Button>
            <ColumnVisibilityManager columns={allColumns} visibleColumns={visibleColumns} onVisibilityChange={setVisibleColumns} />
            <ActivityExport
              filters={queryFilters}
              currentActivities={tableData.activities}
              totalRecords={tableData.totalRecords}
              visibleColumns={visibleColumns}
              selectedActivities={selectionCount > 0 ? new Set(selectedIds.map(String)) : undefined}
            />
          </div>
        </div>

        {/* Active Filter Indicators */}
        {activeFilters.length > 0 && <FilterIndicators filters={activeFilters} onClearAll={clearAllFilters} className="px-1 py-1 flex-shrink-0" />}

        {/* Paginated table */}
        <div className="flex-1 min-h-0">
          <ActivityTable visibleColumns={visibleColumns} filters={queryFilters} className="h-full" onDataChange={handleTableDataChange} />
        </div>
      </CardContent>

      {/* Enhanced Filter Modal */}
      <ActivityFilters open={showFilterModal} onOpenChange={setShowFilterModal} filters={filters} onApply={handleFilterChange} onReset={clearAllFilters} />
    </Card>
  );
}
