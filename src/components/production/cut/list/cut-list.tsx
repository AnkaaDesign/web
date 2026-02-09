import { useState, useCallback, useMemo, useRef } from "react";
import type { Cut } from "../../../../types";
import type { CutGetManyFormData } from "../../../../schemas";
import { CUT_STATUS } from "../../../../constants";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { CutItemTable } from "./cut-item-table";
import { IconFilter } from "@tabler/icons-react";
import { CutItemFilters } from "./cut-item-filters";
import { cn } from "@/lib/utils";
import { useTableState } from "@/hooks/common/use-table-state";
import { ShowSelectedToggle } from "@/components/ui/show-selected-toggle";
import { FilterIndicators } from "./filter-indicator";
import { buildFilterTags } from "./filter-utils";
import { useTableFilters } from "@/hooks/common/use-table-filters";
import { ColumnVisibilityManager } from "./column-visibility-manager";
import { createCutColumns } from "./cut-item-table-columns";
import { useColumnVisibility } from "@/hooks/common/use-column-visibility";

interface CutListProps {
  className?: string;
}

const DEFAULT_PAGE_SIZE = 40;

export function CutList({ className }: CutListProps) {
  const searchInputRef = useRef<HTMLInputElement>(null);

  // State to hold current page items and total count from the table
  const [, setTableData] = useState<{ items: Cut[]; totalRecords: number }>({
    items: [],
    totalRecords: 0,
  });
  const [showFilterModal, setShowFilterModal] = useState(false);

  // Stable callback for table data updates
  const handleTableDataChange = useCallback((data: { items: Cut[]; totalRecords: number }) => {
    setTableData(data);
  }, []);

  // Get table state for selected items functionality
  const { selectionCount, showSelectedOnly, toggleShowSelectedOnly } = useTableState({
    defaultPageSize: DEFAULT_PAGE_SIZE,
    resetSelectionOnPageChange: false,
  });

  // Visible columns state with localStorage persistence
  // By default, all columns are visible except "reason"
  const { visibleColumns, setVisibleColumns } = useColumnVisibility(
    "cut-list-visible-columns",
    new Set(["filePreview", "fileName", "task.name", "status", "type", "origin", "startedAt", "completedAt"])
  );

  // Get all available columns for column visibility manager
  const allColumns = useMemo(() => createCutColumns(), []);

  // Custom deserializer for cut filters
  const deserializeCutFilters = useCallback((params: URLSearchParams): Partial<CutGetManyFormData> => {
    const filters: Partial<CutGetManyFormData> = {};

    // Parse status filter
    const status = params.get("status");
    if (status) {
      filters.where = { ...filters.where, status: status as CUT_STATUS };
    }

    // Parse date filters
    const startedAfter = params.get("startedAfter");
    const startedBefore = params.get("startedBefore");
    if (startedAfter || startedBefore) {
      filters.where = {
        ...filters.where,
        startedAt: {
          ...(startedAfter && { gte: new Date(startedAfter) }),
          ...(startedBefore && { lte: new Date(startedBefore) }),
        },
      };
    }

    const completedAfter = params.get("completedAfter");
    const completedBefore = params.get("completedBefore");
    if (completedAfter || completedBefore) {
      filters.where = {
        ...filters.where,
        completedAt: {
          ...(completedAfter && { gte: new Date(completedAfter) }),
          ...(completedBefore && { lte: new Date(completedBefore) }),
        },
      };
    }

    return filters;
  }, []);

  // Custom serializer for cut filters
  const serializeCutFilters = useCallback((filters: Partial<CutGetManyFormData>): Record<string, string> => {
    const params: Record<string, string> = {};

    // Status filter
    if (filters.where?.status) {
      params.status = filters.where.status;
    }

    // Date filters
    if (filters.where?.startedAt?.gte) {
      params.startedAfter = filters.where.startedAt.gte.toISOString();
    }
    if (filters.where?.startedAt?.lte) {
      params.startedBefore = filters.where.startedAt.lte.toISOString();
    }
    if (filters.where?.completedAt?.gte) {
      params.completedAfter = filters.where.completedAt.gte.toISOString();
    }
    if (filters.where?.completedAt?.lte) {
      params.completedBefore = filters.where.completedAt.lte.toISOString();
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
  } = useTableFilters<CutGetManyFormData>({
    defaultFilters: {
      limit: DEFAULT_PAGE_SIZE,
    },
    searchDebounceMs: 500,
    searchParamName: "search",
    serializeToUrl: serializeCutFilters,
    deserializeFromUrl: deserializeCutFilters,
    excludeFromUrl: ["limit", "orderBy"],
  });

  // Query filters to pass to the paginated table
  const queryFilters = useMemo(() => {
    const { orderBy: _, ...filterWithoutOrderBy } = baseQueryFilters;

    return {
      ...filterWithoutOrderBy,
      limit: DEFAULT_PAGE_SIZE,
      include: {
        task: {
          include: {
            customer: true,
          },
        },
        file: true,
        parentCut: {
          include: {
            file: true,
          },
        },
      },
    };
  }, [baseQueryFilters]);

  // Handle filter changes
  const handleFilterChange = useCallback(
    (newFilters: Partial<CutGetManyFormData>) => {
      // Remove orderBy from filters to avoid conflicts with sort management
      const { orderBy: _, ...filtersWithoutOrderBy } = newFilters;
      setFilters(filtersWithoutOrderBy);
    },
    [setFilters],
  );

  // Build filter tags from current filters (excluding search)
  const filterTags = useMemo(() => {
    return buildFilterTags(filters, handleFilterChange);
  }, [filters, handleFilterChange]);

  // Combine search and other filters for display
  const allFilterTags = useMemo(() => {
    const tags = [...filterTags];
    if (searchingFor) {
      tags.unshift({
        key: "searchingFor",
        label: "Busca",
        value: searchingFor,
        displayValue: searchingFor,
        onRemove: () => setSearch(""),
      });
    }
    return tags;
  }, [filterTags, searchingFor, setSearch]);

  return (
    <Card className={cn("flex flex-col shadow-sm border border-border", className)}>
      <CardContent className="flex-1 flex flex-col p-4 space-y-4 overflow-hidden">
        {/* Search and controls */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <TableSearchInput
            ref={searchInputRef}
            value={displaySearchText}
            onChange={(value) => {
              setSearch(value);
            }}
            placeholder="Buscar por tarefa ou cliente..."
            isPending={displaySearchText !== searchingFor}
          />
          <div className="flex gap-2">
            <ShowSelectedToggle showSelectedOnly={showSelectedOnly} onToggle={toggleShowSelectedOnly} selectionCount={selectionCount} />
            <Button variant={hasActiveFilters ? "default" : "outline"} size="default" onClick={() => setShowFilterModal(true)}>
              <IconFilter className="h-4 w-4" />
              <span>
                Filtros{hasActiveFilters ? ` (${Object.keys(filters.where || {}).length + (filters.createdAt ? 1 : 0)})` : ""}
              </span>
            </Button>
            <ColumnVisibilityManager columns={allColumns} visibleColumns={visibleColumns} onVisibilityChange={setVisibleColumns} />
          </div>
        </div>

        {/* Active Filter Indicators */}
        {allFilterTags.length > 0 && <FilterIndicators filters={allFilterTags} onClearAll={clearAllFilters} />}

        {/* Paginated table */}
        <div className="flex-1 min-h-0 overflow-auto">
          <CutItemTable filters={queryFilters} className="h-full" onDataChange={handleTableDataChange} visibleColumns={visibleColumns} />
        </div>
      </CardContent>

      {/* Filter Modal */}
      <CutItemFilters open={showFilterModal} onOpenChange={setShowFilterModal} filters={filters} onFilterChange={handleFilterChange} />
    </Card>
  );
}
