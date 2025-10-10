import React, { useState, useCallback, useMemo, useRef } from "react";
import { IconFilter } from "@tabler/icons-react";

import type { Position } from "../../../../types";
import type { PositionGetManyFormData } from "../../../../schemas";
import { formatCurrency } from "../../../../utils";
import { cn } from "@/lib/utils";
import { useTableState } from "@/hooks/use-table-state";
import { useTableFilters } from "@/hooks/use-table-filters";
import { useColumnVisibility } from "@/hooks/use-column-visibility";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { ShowSelectedToggle } from "@/components/ui/show-selected-toggle";
import { FilterIndicators } from "@/components/ui/filter-indicator";
import { PositionTable } from "./position-table";
import { PositionFilters } from "./position-filters";
import { PositionExport } from "./position-export";

interface PositionListProps {
  onDataUpdate?: (data: { positions: Position[]; totalRecords: number }) => void;
  className?: string;
}

const DEFAULT_PAGE_SIZE = 40;

export function PositionList({ onDataUpdate, className }: PositionListProps) {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [tableData, setTableData] = useState<{ positions: Position[]; totalRecords: number }>({ positions: [], totalRecords: 0 });

  // Stable callback for table data updates
  const handleTableDataChange = useCallback(
    (data: { positions: Position[]; totalRecords: number }) => {
      setTableData(data);
      if (onDataUpdate) {
        onDataUpdate(data);
      }
    },
    [onDataUpdate],
  );

  // Get table state for selected items functionality
  const { selectionCount, selectedIds, showSelectedOnly, toggleShowSelectedOnly } = useTableState({
    defaultPageSize: DEFAULT_PAGE_SIZE,
    resetSelectionOnPageChange: false,
  });

  // Custom deserializer for position filters
  const deserializePositionFilters = useCallback((params: URLSearchParams): Partial<PositionGetManyFormData> => {
    const filters: Partial<PositionGetManyFormData> = {};

    // Parse remuneration range filters
    const minRemuneration = params.get("minRemuneration");
    const maxRemuneration = params.get("maxRemuneration");
    if (minRemuneration || maxRemuneration) {
      filters.where = {
        ...filters.where,
        remunerations: {
          some: {
            AND: [minRemuneration ? { value: { gte: Number(minRemuneration) } } : {}, maxRemuneration ? { value: { lte: Number(maxRemuneration) } } : {}],
          },
        },
      };
    }

    return filters;
  }, []);

  // Custom serializer for position filters
  const serializePositionFilters = useCallback((filters: Partial<PositionGetManyFormData>): Record<string, string> => {
    const params: Record<string, string> = {};

    // Handle remuneration filters from where clause
    if (filters.where?.remunerations?.some?.AND) {
      const conditions = filters.where.remunerations.some.AND;
      conditions.forEach((condition: any) => {
        if (condition.value?.gte) {
          params.minRemuneration = String(condition.value.gte);
        }
        if (condition.value?.lte) {
          params.maxRemuneration = String(condition.value.lte);
        }
      });
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
  } = useTableFilters<PositionGetManyFormData>({
    defaultFilters: {
      limit: DEFAULT_PAGE_SIZE,
    },
    searchDebounceMs: 300,
    searchParamName: "search", // Use "search" for URL compatibility
    serializeToUrl: serializePositionFilters,
    deserializeFromUrl: deserializePositionFilters,
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

  // Handle filter changes
  const handleFilterChange = useCallback(
    (newFilters: Partial<PositionGetManyFormData>) => {
      // Remove orderBy from filters to avoid conflicts with sort management
      const { orderBy: _, ...filtersWithoutOrderBy } = newFilters;
      setFilters(filtersWithoutOrderBy);
    },
    [setFilters],
  );

  // Handle filter removal for remuneration filters
  const onRemoveFilter = useCallback(
    (key: string, value?: any) => {
      if (key === "searchingFor") {
        setSearch("");
      } else if (key === "minRemuneration" || key === "maxRemuneration") {
        // Handle remuneration filter removal
        const currentFilters = { ...filters };
        if (currentFilters.where?.remunerations?.some?.AND) {
          const conditions = currentFilters.where.remunerations.some.AND;
          const newConditions = conditions.filter((condition: any) => {
            if (key === "minRemuneration" && condition.value?.gte) return false;
            if (key === "maxRemuneration" && condition.value?.lte) return false;
            return true;
          });

          if (newConditions.length === 0) {
            // Remove the entire remuneration filter
            const { remunerations, ...restWhere } = currentFilters.where;
            currentFilters.where = Object.keys(restWhere).length > 0 ? restWhere : undefined;
          } else {
            currentFilters.where.remunerations.some.AND = newConditions;
          }

          setFilters(currentFilters);
        }
      }
    },
    [filters, setFilters, setSearch],
  );

  // Extract current filter values for display
  const currentMinRemuneration = useMemo(() => {
    if (filters.where?.remunerations?.some?.AND) {
      const conditions = filters.where.remunerations.some.AND;
      const minCondition = conditions.find((c: any) => c.value?.gte);
      return minCondition?.value?.gte;
    }
    return undefined;
  }, [filters]);

  const currentMaxRemuneration = useMemo(() => {
    if (filters.where?.remunerations?.some?.AND) {
      const conditions = filters.where.remunerations.some.AND;
      const maxCondition = conditions.find((c: any) => c.value?.lte);
      return maxCondition?.value?.lte;
    }
    return undefined;
  }, [filters]);

  // Build active filters array for display
  const activeFilters = useMemo(() => {
    const filterArray = [];

    if (searchingFor) {
      filterArray.push({
        key: "searchingFor",
        label: "Busca",
        value: searchingFor,
        onRemove: () => onRemoveFilter("searchingFor"),
      });
    }

    if (currentMinRemuneration) {
      filterArray.push({
        key: "minRemuneration",
        label: "Remuneração mínima",
        value: formatCurrency(currentMinRemuneration),
        onRemove: () => onRemoveFilter("minRemuneration"),
      });
    }

    if (currentMaxRemuneration) {
      filterArray.push({
        key: "maxRemuneration",
        label: "Remuneração máxima",
        value: formatCurrency(currentMaxRemuneration),
        onRemove: () => onRemoveFilter("maxRemuneration"),
      });
    }

    return filterArray;
  }, [searchingFor, currentMinRemuneration, currentMaxRemuneration, onRemoveFilter]);

  // Handle filters apply from modal
  const handleFiltersApply = useCallback(
    (filterValues: { minRemuneration?: number; maxRemuneration?: number }) => {
      const newFilters: Partial<PositionGetManyFormData> = { ...filters };

      // Build the remuneration filter
      const conditions: any[] = [];
      if (filterValues.minRemuneration) {
        conditions.push({ value: { gte: filterValues.minRemuneration } });
      }
      if (filterValues.maxRemuneration) {
        conditions.push({ value: { lte: filterValues.maxRemuneration } });
      }

      if (conditions.length > 0) {
        newFilters.where = {
          ...newFilters.where,
          remunerations: {
            some: {
              AND: conditions,
            },
          },
        };
      } else {
        // Remove remuneration filter if no values
        if (newFilters.where?.remunerations) {
          const { remunerations, ...restWhere } = newFilters.where;
          newFilters.where = Object.keys(restWhere).length > 0 ? restWhere : undefined;
        }
      }

      setFilters(newFilters);
      setShowFilterModal(false);
    },
    [filters, setFilters],
  );

  return (
    <Card className={cn("h-full flex flex-col shadow-sm border border-border", className)}>
      <CardContent className="flex-1 flex flex-col p-6 space-y-4 overflow-hidden">
        {/* Search and controls */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <TableSearchInput ref={searchInputRef} value={displaySearchText} onChange={setSearch} placeholder="Buscar cargos..." isPending={displaySearchText !== searchingFor} />
          <div className="flex gap-2">
            <ShowSelectedToggle showSelectedOnly={showSelectedOnly} onToggle={toggleShowSelectedOnly} selectionCount={selectionCount} />
            <Button variant={hasActiveFilters ? "default" : "outline"} size="default" onClick={() => setShowFilterModal(true)}>
              <IconFilter className="h-4 w-4 mr-2" />
              Filtros{hasActiveFilters ? ` (${activeFilters.length})` : ""}
            </Button>
            <PositionExport
              filters={filters}
              currentPositions={tableData.positions}
              totalRecords={tableData.totalRecords}
              selectedPositions={selectionCount > 0 ? new Set(selectedIds) : undefined}
            />
          </div>
        </div>

        {/* Active Filter Indicators */}
        {activeFilters.length > 0 && <FilterIndicators filters={activeFilters} onClearAll={clearAllFilters} className="px-1 py-1" />}

        {/* Paginated table */}
        <div className="flex-1 min-h-0">
          <PositionTable filters={queryFilters} className="h-full" onDataChange={handleTableDataChange} />
        </div>
      </CardContent>

      {/* Enhanced Filter Modal */}
      <PositionFilters
        open={showFilterModal}
        onOpenChange={setShowFilterModal}
        onApply={handleFiltersApply}
        currentMinRemuneration={currentMinRemuneration}
        currentMaxRemuneration={currentMaxRemuneration}
      />
    </Card>
  );
}
