import { useCallback, useMemo, useState } from "react";
import { IconFilter } from "@tabler/icons-react";

import type { Garage, GarageGetManyFormData } from "../../../../types";
import { cn } from "@/lib/utils";
import { useTableState } from "@/hooks/use-table-state";
import { useTableFilters } from "@/hooks/use-table-filters";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { ShowSelectedToggle } from "@/components/ui/show-selected-toggle";
import { FilterIndicators } from "@/components/ui/filter-indicator";
import { GarageTable } from "./garage-table";
import { GarageFilters } from "./garage-filters";
import { GarageExport } from "./garage-export";

interface GarageListProps {
  onDataUpdate?: (data: { garages: Garage[]; totalRecords: number }) => void;
  className?: string;
}

const DEFAULT_PAGE_SIZE = 40;

export function GarageList({ onDataUpdate, className }: GarageListProps) {
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [tableData, setTableData] = useState<{ garages: Garage[]; totalRecords: number }>({ garages: [], totalRecords: 0 });

  // Get table state for selected items functionality
  const { selectionCount, showSelectedOnly, toggleShowSelectedOnly } = useTableState({
    defaultPageSize: DEFAULT_PAGE_SIZE,
    resetSelectionOnPageChange: false,
  });

  // Custom deserializer for garage filters
  const deserializeGarageFilters = useCallback((params: URLSearchParams): Partial<GarageGetManyFormData> => {
    const filters: Partial<GarageGetManyFormData> = {};

    // Parse status filter
    const status = params.get("status");
    if (status) {
      filters.where = { ...filters.where, status };
    }

    return filters;
  }, []);

  // Custom serializer for garage filters
  const serializeGarageFilters = useCallback((filters: Partial<GarageGetManyFormData>): Record<string, string> => {
    const params: Record<string, string> = {};

    // Status filter
    if (filters.where?.status) {
      params.status = filters.where.status as string;
    }

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
  } = useTableFilters<GarageGetManyFormData>({
    defaultFilters: {
      limit: DEFAULT_PAGE_SIZE,
    },
    searchDebounceMs: 300,
    searchParamName: "search",
    serializeToUrl: serializeGarageFilters,
    deserializeFromUrl: deserializeGarageFilters,
    excludeFromUrl: ["limit", "orderBy"],
  });

  // Query filters to pass to the paginated table
  const queryFilters = useMemo(() => {
    const { orderBy: _, ...filterWithoutOrderBy } = baseQueryFilters;

    const result = {
      ...filterWithoutOrderBy,
      limit: DEFAULT_PAGE_SIZE,
    };

    return result;
  }, [baseQueryFilters]);

  // Stable callback for table data updates
  const handleTableDataChange = useCallback(
    (data: { garages: Garage[]; totalRecords: number }) => {
      setTableData(data);
      if (onDataUpdate) {
        onDataUpdate(data);
      }
    },
    [onDataUpdate],
  );

  // Handle filter changes
  const handleFilterChange = useCallback(
    (newFilters: Partial<GarageGetManyFormData>) => {
      // Remove orderBy from filters to avoid conflicts with sort management
      const { orderBy: _, ...filtersWithoutOrderBy } = newFilters;
      setFilters(filtersWithoutOrderBy);
    },
    [setFilters],
  );

  const handleFiltersApply = (appliedFilters: Partial<GarageGetManyFormData>) => {
    handleFilterChange(appliedFilters);
    setIsFilterModalOpen(false);
  };

  // Extract active filters for display
  const activeFilters = useMemo(() => {
    const filters: Array<{
      key: string;
      label: string;
      value: string;
      onRemove: () => void;
    }> = [];

    // Search filter
    if (searchingFor) {
      filters.push({
        key: "searchingFor",
        label: "Busca",
        value: searchingFor,
        onRemove: () => setSearch(""),
      });
    }

    // Status filter
    if (queryFilters.where?.status) {
      const statusLabels = {
        ACTIVE: "Ativo",
        INACTIVE: "Inativo",
        MAINTENANCE: "Manutenção",
      };
      filters.push({
        key: "status",
        label: "Status",
        value: statusLabels[queryFilters.where.status as keyof typeof statusLabels] || queryFilters.where.status,
        onRemove: () => setFilters((prev) => ({ ...prev, where: { ...prev.where, status: undefined } })),
      });
    }

    return filters;
  }, [searchingFor, queryFilters, setSearch, setFilters]);

  return (
    <Card className={cn("h-full flex flex-col shadow-sm border border-border", className)}>
      <CardContent className="flex-1 flex flex-col p-6 space-y-4 overflow-hidden">
        {/* Search and Controls */}
        <div className="flex flex-col sm:flex-row gap-3">
          <TableSearchInput value={displaySearchText} onChange={setSearch} placeholder="Buscar garagens..." isPending={displaySearchText !== searchingFor} />
          <div className="flex gap-2">
            <ShowSelectedToggle showSelectedOnly={showSelectedOnly} onToggle={toggleShowSelectedOnly} selectionCount={selectionCount} />
            <Button variant={hasActiveFilters ? "default" : "outline"} size="default" onClick={() => setIsFilterModalOpen(true)}>
              <IconFilter className="h-4 w-4 mr-2" />
              {hasActiveFilters ? `Filtros (${activeFilters.length})` : "Filtros"}
            </Button>
            <GarageExport
              filters={queryFilters}
              currentGarages={tableData.garages}
              totalRecords={tableData.totalRecords}
              selectedGarages={selectionCount > 0 ? new Set() : undefined}
            />
          </div>
        </div>

        {/* Active Filters */}
        {activeFilters.length > 0 && <FilterIndicators filters={activeFilters} onClearAll={activeFilters.length > 1 ? clearAllFilters : undefined} />}

        {/* Table with integrated pagination */}
        <GarageTable filters={queryFilters} onDataChange={handleTableDataChange} className="flex-1 min-h-0" />
      </CardContent>

      {/* Filters Modal */}
      <GarageFilters open={isFilterModalOpen} onOpenChange={setIsFilterModalOpen} filters={filters} onApply={handleFiltersApply} />
    </Card>
  );
}
