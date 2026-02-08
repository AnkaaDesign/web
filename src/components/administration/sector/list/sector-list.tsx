import React, { useState, useCallback, useMemo } from "react";
import { IconFilter } from "@tabler/icons-react";

import type { Sector, SectorGetManyFormData } from "../../../../types";
import { SECTOR_PRIVILEGES, SECTOR_PRIVILEGES_LABELS } from "../../../../constants";
import { cn } from "@/lib/utils";
import { useTableState } from "@/hooks/common/use-table-state";
import { useTableFilters } from "@/hooks/common/use-table-filters";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { ShowSelectedToggle } from "@/components/ui/show-selected-toggle";
import { FilterIndicators } from "@/components/ui/filter-indicator";
import { SectorTable } from "./sector-table";
import { SectorFilters } from "./sector-filters";
import { SectorExport } from "./sector-export";

interface SectorListProps {
  selectedPrivilege?: SECTOR_PRIVILEGES;
  onDataUpdate?: (data: { sectors: Sector[]; totalRecords: number }) => void;
  className?: string;
}

const DEFAULT_PAGE_SIZE = 40;

export function SectorList({ selectedPrivilege, onDataUpdate, className }: SectorListProps) {
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [tableData, setTableData] = useState<{ sectors: Sector[]; totalRecords: number }>({ sectors: [], totalRecords: 0 });

  // Use the standardized table state hook for selection
  const { showSelectedOnly, toggleShowSelectedOnly, selectionCount, selectedIds } = useTableState({
    defaultPageSize: DEFAULT_PAGE_SIZE,
  });

  // Stable callback for table data updates
  const handleTableDataChange = useCallback(
    (data: { sectors: Sector[]; totalRecords: number }) => {
      setTableData(data);
      if (onDataUpdate) {
        onDataUpdate(data);
      }
    },
    [onDataUpdate],
  );

  // Custom deserializer for sector filters
  const deserializeSectorFilters = useCallback(
    (params: URLSearchParams): Partial<SectorGetManyFormData> => {
      const filters: Partial<SectorGetManyFormData> = {};

      const privileges = params.get("privileges") || selectedPrivilege;
      if (privileges) {
        filters.where = {
          ...filters.where,
          privileges: privileges as SECTOR_PRIVILEGES,
        };
      }

      return filters;
    },
    [selectedPrivilege],
  );

  // Custom serializer for sector filters
  const serializeSectorFilters = useCallback((filters: Partial<SectorGetManyFormData>): Record<string, string> => {
    const params: Record<string, string> = {};

    if (filters.where?.privileges) {
      params.privileges = filters.where.privileges as string;
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
  } = useTableFilters<SectorGetManyFormData>({
    defaultFilters: {
      limit: DEFAULT_PAGE_SIZE,
    },
    searchDebounceMs: 500,
    searchParamName: "search",
    serializeToUrl: serializeSectorFilters,
    deserializeFromUrl: deserializeSectorFilters,
    excludeFromUrl: ["limit", "orderBy"],
  });

  // Query filters to pass to the table
  const queryFilters = useMemo(() => {
    const { orderBy: _, ...filterWithoutOrderBy } = baseQueryFilters;

    return {
      ...filterWithoutOrderBy,
      limit: DEFAULT_PAGE_SIZE,
    };
  }, [baseQueryFilters]);

  const handleFiltersApply = (newFilters: { privileges?: SECTOR_PRIVILEGES }) => {
    const updatedFilters: Partial<SectorGetManyFormData> = {
      ...filters,
      where: {
        ...filters.where,
        ...(newFilters.privileges && { privileges: newFilters.privileges }),
      },
    };

    // Remove privileges if not provided
    if (!newFilters.privileges && updatedFilters.where?.privileges) {
      const { privileges: _, ...restWhere } = updatedFilters.where;
      updatedFilters.where = Object.keys(restWhere).length > 0 ? restWhere : undefined;
    }

    setFilters(updatedFilters);
    setIsFilterModalOpen(false);
  };

  // Build active filters array
  const activeFilters = useMemo(() => {
    const filtersArray = [];

    if (searchingFor) {
      filtersArray.push({
        key: "searchingFor",
        label: "Busca",
        value: searchingFor,
        onRemove: () => setSearch(""),
      });
    }

    if (filters.where?.privileges) {
      filtersArray.push({
        key: "privileges",
        label: "Privilégio",
        value: SECTOR_PRIVILEGES_LABELS[filters.where.privileges] || filters.where.privileges,
        onRemove: () => {
          const { privileges: _, ...restWhere } = filters.where || {};
          setFilters({
            ...filters,
            where: Object.keys(restWhere).length > 0 ? restWhere : undefined,
          });
        },
      });
    }

    return filtersArray;
  }, [searchingFor, filters, setSearch, setFilters]);

  return (
    <Card className={cn("flex flex-col shadow-sm border border-border", className)}>
      <CardContent className="flex-1 flex flex-col p-4 space-y-4 overflow-hidden">
        {/* Search and Controls */}
        <div className="flex flex-col sm:flex-row gap-3">
          <TableSearchInput value={displaySearchText} onChange={setSearch} placeholder="Buscar setores..." isPending={displaySearchText !== searchingFor} />
          <div className="flex gap-2">
            <ShowSelectedToggle showSelectedOnly={showSelectedOnly} onToggle={toggleShowSelectedOnly} selectionCount={selectionCount} />
            <Button variant={hasActiveFilters ? "default" : "outline"} size="default" onClick={() => setIsFilterModalOpen(true)}>
              <IconFilter className="h-4 w-4 mr-2" />
              {hasActiveFilters ? `Filtros (${activeFilters.length})` : "Filtros"}
            </Button>
            <SectorExport
              filters={queryFilters}
              currentSectors={tableData.sectors}
              totalRecords={tableData.totalRecords}
              selectedSectors={selectionCount > 0 ? new Set(selectedIds.map(String)) : undefined}
            />
          </div>
        </div>

        {/* Active Filters */}
        {activeFilters.length > 0 && <FilterIndicators filters={activeFilters} onClearAll={activeFilters.length > 1 ? clearAllFilters : undefined} />}

        {/* Table with integrated pagination */}
        <div className="flex-1 min-h-0 overflow-auto">
          <SectorTable filters={queryFilters} onDataChange={handleTableDataChange} className="h-full" />
        </div>
      </CardContent>

      {/* Filters Modal */}
      <SectorFilters open={isFilterModalOpen} onOpenChange={setIsFilterModalOpen} onApply={handleFiltersApply} currentPrivilege={filters.where?.privileges} />
    </Card>
  );
}
