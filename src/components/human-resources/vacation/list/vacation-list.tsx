import { useState, useCallback, useMemo } from "react";
import { IconFilter } from "@tabler/icons-react";

import type { Vacation, VacationGetManyResponse } from "../../../../types";
import type { VacationGetManyFormData } from "../../../../schemas";
import { VACATION_STATUS, VACATION_TYPE, VACATION_STATUS_LABELS, VACATION_TYPE_LABELS } from "../../../../constants";
import { cn } from "@/lib/utils";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { ShowSelectedToggle } from "@/components/ui/show-selected-toggle";
import { FilterIndicators } from "@/components/ui/filter-indicator";
import { useTableState } from "@/hooks/common/use-table-state";
import { useTableFilters } from "@/hooks/common/use-table-filters";
import { useColumnVisibility } from "@/hooks/common/use-column-visibility";
import { VacationTable } from "./vacation-table";
import { VacationFilters } from "./vacation-filters";
import { VacationExport } from "./vacation-export";

type VacationListMode = 'hr' | 'personal' | 'team';

interface VacationListProps {
  selectedStatus?: VACATION_STATUS;
  userId?: string;
  onDataUpdate?: (data: Vacation[], meta?: VacationGetManyResponse["meta"]) => void;
  className?: string;
  /**
   * Mode determines which API endpoint to use:
   * - 'hr': /vacations (requires HR privileges) - default
   * - 'personal': /vacations/my-vacations (current user's vacations)
   * - 'team': /vacations/team-vacations (team leader's team vacations)
   */
  mode?: VacationListMode;
}

const DEFAULT_PAGE_SIZE = 40;

export function VacationList({ selectedStatus, userId, onDataUpdate, className, mode = 'hr' }: VacationListProps) {
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [tableData, setTableData] = useState<{ vacations: Vacation[]; totalRecords: number }>({ vacations: [], totalRecords: 0 });

  // Use the standardized table state hook
  const { showSelectedOnly, toggleShowSelectedOnly, selectionCount, selectedIds } = useTableState({
    defaultPageSize: DEFAULT_PAGE_SIZE,
    defaultSort: [{ column: "createdAt", direction: "desc" }],
  });

  // Custom deserializer for vacation filters
  const deserializeVacationFilters = useCallback((params: URLSearchParams): Partial<VacationGetManyFormData> => {
    const filters: Partial<VacationGetManyFormData> = {
      where: {},
    };

    // Parse status filter
    const status = params.get("status") as VACATION_STATUS | undefined;
    if (status) {
      filters.where = { ...filters.where, status };
    }

    // Parse type filter
    const type = params.get("type") as VACATION_TYPE | undefined;
    if (type) {
      filters.where = { ...filters.where, type };
    }

    // Parse collective filter
    const collective = params.get("collective");
    if (collective === "true") {
      filters.where = { ...filters.where, isCollective: true };
    }

    // Parse year filter
    const year = params.get("year");
    if (year) {
      const yearNum = parseInt(year);
      if (!isNaN(yearNum)) {
        const startOfYear = new Date(yearNum, 0, 1);
        const endOfYear = new Date(yearNum, 11, 31, 23, 59, 59);
        filters.where = {
          ...filters.where,
          startAt: {
            gte: startOfYear,
            lte: endOfYear,
          },
        };
      }
    }

    return filters;
  }, []);

  // Custom serializer for vacation filters
  const serializeVacationFilters = useCallback((filters: Partial<VacationGetManyFormData>): Record<string, string> => {
    const params: Record<string, string> = {};

    if (filters.where?.status) {
      params.status = filters.where.status;
    }

    if (filters.where?.type) {
      params.type = filters.where.type;
    }

    if (filters.where?.isCollective) {
      params.collective = "true";
    }

    // Extract year from date range
    if (filters.where?.startAt?.gte) {
      const year = new Date(filters.where.startAt.gte).getFullYear();
      params.year = year.toString();
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
  } = useTableFilters<VacationGetManyFormData>({
    defaultFilters: {
      limit: DEFAULT_PAGE_SIZE,
    },
    searchDebounceMs: 500,
    searchParamName: "searchingFor",
    serializeToUrl: serializeVacationFilters,
    deserializeFromUrl: deserializeVacationFilters,
    excludeFromUrl: ["limit", "orderBy"],
  });

  // Query filters to pass to the paginated table
  const queryFilters = useMemo(() => {
    const { orderBy: _, ...filterWithoutOrderBy } = baseQueryFilters;

    // Build where clause
    const where = filterWithoutOrderBy.where || {};

    // Apply prop-based filters
    if (selectedStatus) {
      where.status = selectedStatus;
    }

    if (userId) {
      where.userId = userId;
    }

    const result = {
      ...filterWithoutOrderBy,
      where: Object.keys(where).length > 0 ? where : undefined,
      limit: DEFAULT_PAGE_SIZE,
    };

    return result;
  }, [baseQueryFilters, selectedStatus, userId]);

  // Handle filter changes
  const handleFilterChange = useCallback(
    (newFilters: Partial<VacationGetManyFormData>) => {
      // Remove orderBy from filters to avoid conflicts with sort management
      const { orderBy: _, ...filtersWithoutOrderBy } = newFilters;
      setFilters(filtersWithoutOrderBy);
    },
    [setFilters],
  );

  const handleFiltersApply = (newFilters: { status?: VACATION_STATUS; type?: VACATION_TYPE; isCollective?: boolean; year?: number }) => {
    const updateData: Partial<VacationGetManyFormData> = {
      where: {},
    };

    if (newFilters.status) {
      updateData.where!.status = newFilters.status;
    }

    if (newFilters.type) {
      updateData.where!.type = newFilters.type;
    }

    if (newFilters.isCollective) {
      updateData.where!.isCollective = true;
    }

    if (newFilters.year) {
      const startOfYear = new Date(newFilters.year, 0, 1);
      const endOfYear = new Date(newFilters.year, 11, 31, 23, 59, 59);
      updateData.where!.startAt = {
        gte: startOfYear,
        lte: endOfYear,
      };
    }

    handleFilterChange(updateData);
    setIsFilterModalOpen(false);
  };

  const clearFilter = (filterKey: string) => {
    if (filterKey === "searchingFor") {
      setSearch("");
    } else {
      const newFilters = { ...filters };
      if (newFilters.where) {
        delete newFilters.where[filterKey as keyof typeof newFilters.where];
        if (Object.keys(newFilters.where).length === 0) {
          delete newFilters.where;
        }
      }
      handleFilterChange(newFilters);
    }
  };

  // Build active filters array
  const activeFilters = useMemo(() => {
    const result = [];

    if (searchingFor) {
      result.push({
        key: "searchingFor",
        label: "Busca",
        value: searchingFor,
        onRemove: () => clearFilter("searchingFor"),
      });
    }

    if (filters.where?.status || selectedStatus) {
      const status = filters.where?.status || selectedStatus;
      result.push({
        key: "status",
        label: "Status",
        value: status ? VACATION_STATUS_LABELS[status] || status : "",
        onRemove: () => clearFilter("status"),
      });
    }

    if (filters.where?.type) {
      result.push({
        key: "type",
        label: "Tipo",
        value: VACATION_TYPE_LABELS[filters.where.type] || filters.where.type,
        onRemove: () => clearFilter("type"),
      });
    }

    if (filters.where?.isCollective) {
      result.push({
        key: "collective",
        label: "Coletivas",
        value: "Sim",
        onRemove: () => clearFilter("collective"),
      });
    }

    if (filters.where?.startAt?.gte) {
      const year = new Date(filters.where.startAt.gte).getFullYear();
      result.push({
        key: "year",
        label: "Ano",
        value: year.toString(),
        onRemove: () => clearFilter("year"),
      });
    }

    return result;
  }, [searchingFor, filters, selectedStatus, clearFilter]);

  // Handle data update
  const handleDataChange = useCallback(
    (data: { vacations: Vacation[]; totalRecords: number }) => {
      setTableData(data);
      if (onDataUpdate) {
        onDataUpdate(data.vacations, {
          totalRecords: data.totalRecords,
          page: 1,
          take: data.vacations.length,
          totalPages: Math.ceil(data.totalRecords / (data.vacations.length || 1)),
          hasNextPage: false,
          hasPreviousPage: false,
        });
      }
    },
    [onDataUpdate],
  );

  return (
    <Card className={cn("flex flex-col shadow-sm border border-border", className)}>
      <CardContent className="flex-1 flex flex-col p-4 space-y-4 overflow-hidden">
        {/* Search and Controls */}
        <div className="flex flex-col sm:flex-row gap-3">
          <TableSearchInput value={displaySearchText} onChange={setSearch} placeholder="Buscar férias..." isPending={displaySearchText !== searchingFor} />
          <div className="flex gap-2">
            <ShowSelectedToggle showSelectedOnly={showSelectedOnly} onToggle={toggleShowSelectedOnly} selectionCount={selectionCount} />
            <Button variant={hasActiveFilters ? "default" : "outline"} size="default" onClick={() => setIsFilterModalOpen(true)}>
              <IconFilter className="h-4 w-4 mr-2" />
              {hasActiveFilters ? `Filtros (${activeFilters.length})` : "Filtros"}
            </Button>
            <VacationExport
              filters={queryFilters}
              currentVacations={tableData.vacations}
              totalRecords={tableData.totalRecords}
              selectedVacations={selectionCount > 0 ? new Set(selectedIds.map(String)) : undefined}
            />
          </div>
        </div>

        {/* Active Filters */}
        {activeFilters.length > 0 && <FilterIndicators filters={activeFilters} onClearAll={activeFilters.length > 1 ? clearAllFilters : undefined} />}

        {/* Table with integrated pagination */}
        <div className="flex-1 min-h-0 overflow-auto">
          <VacationTable filters={queryFilters} onDataChange={handleDataChange} className="h-full" mode={mode} />
        </div>
      </CardContent>

      {/* Filters Modal */}
      <VacationFilters
        open={isFilterModalOpen}
        onOpenChange={setIsFilterModalOpen}
        onApply={handleFiltersApply}
        currentStatus={filters.where?.status}
        currentType={filters.where?.type}
        currentIsCollective={filters.where?.isCollective}
        currentYear={filters.where?.startAt?.gte ? new Date(filters.where.startAt.gte).getFullYear() : undefined}
      />
    </Card>
  );
}
