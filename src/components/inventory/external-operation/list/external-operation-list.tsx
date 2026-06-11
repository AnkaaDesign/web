import { useState, useCallback, useMemo, useRef } from "react";
import { useCanViewPrices } from "../../../../hooks";
import type { ExternalOperation } from "../../../../types";
import type { ExternalOperationGetManyFormData } from "../../../../schemas";
import { EXTERNAL_OPERATION_STATUS } from "../../../../constants";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { ExternalOperationTable, getDefaultVisibleColumns, getAllColumns } from "./external-operation-table";
import { IconFilter } from "@tabler/icons-react";
import { ExternalOperationFilters } from "./external-operation-filters";
import { FilterIndicators } from "./filter-indicator";
import { extractActiveFilters, createFilterRemover } from "./filter-utils";
import { cn } from "@/lib/utils";
import { ShowSelectedToggle } from "@/components/ui/show-selected-toggle";
import { useTableState } from "@/hooks/common/use-table-state";
import { useTableFilters } from "@/hooks/common/use-table-filters";
import { ExternalOperationExport } from "./external-operation-export";
import { ColumnVisibilityManager } from "./column-visibility-manager";
import { useColumnVisibility } from "@/hooks/common/use-column-visibility";

interface ExternalOperationListProps {
  className?: string;
}

const DEFAULT_PAGE_SIZE = 40;

export function ExternalOperationList({ className }: ExternalOperationListProps) {
  const canViewPrices = useCanViewPrices();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // State to hold current page items and total count from the table
  const [tableData, setTableData] = useState<{ externalOperations: ExternalOperation[]; totalRecords: number }>({
    externalOperations: [],
    totalRecords: 0,
  });
  const [showFilterModal, setShowFilterModal] = useState(false);

  // Stable callback for table data updates
  const handleTableDataChange = useCallback((data: { externalOperations: ExternalOperation[]; totalRecords: number }) => {
    setTableData(data);
  }, []);

  // Get table state for selected items functionality
  const { selectionCount, showSelectedOnly, toggleShowSelectedOnly, selectedIds } = useTableState({
    defaultPageSize: DEFAULT_PAGE_SIZE,
    resetSelectionOnPageChange: false,
  });

  // Column visibility state with localStorage persistence
  const { visibleColumns, setVisibleColumns } = useColumnVisibility("external-operation-list-visible-columns", getDefaultVisibleColumns(canViewPrices));

  // Get all available columns for column visibility manager
  const allColumns = useMemo(() => getAllColumns(canViewPrices), [canViewPrices]);

  // Custom deserializer for external withdrawal filters
  const deserializeExternalOperationFilters = useCallback((params: URLSearchParams): Partial<ExternalOperationGetManyFormData> => {
    const filters: Partial<ExternalOperationGetManyFormData> = {};

    // Parse status filter
    const statuses = params.get("statuses");
    if (statuses) {
      filters.statuses = statuses.split(",") as EXTERNAL_OPERATION_STATUS[];
    }

    // Parse boolean filters
    const willReturn = params.get("willReturn");
    if (willReturn !== null) {
      filters.willReturn = willReturn === "true";
    }

    const hasInvoice = params.get("hasInvoice");
    if (hasInvoice !== null) {
      filters.hasInvoice = hasInvoice === "true";
    }

    const hasReceipt = params.get("hasReceipt");
    if (hasReceipt !== null) {
      filters.hasReceipt = hasReceipt === "true";
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

    return filters;
  }, []);

  // Custom serializer for external withdrawal filters
  const serializeExternalOperationFilters = useCallback((filters: Partial<ExternalOperationGetManyFormData>): Record<string, string> => {
    const params: Record<string, string> = {};

    // Status filters
    if (filters.statuses?.length) params.statuses = filters.statuses.join(",");

    // Boolean filters
    if (typeof filters.willReturn === "boolean") params.willReturn = String(filters.willReturn);
    if (typeof filters.hasInvoice === "boolean") params.hasInvoice = String(filters.hasInvoice);
    if (typeof filters.hasReceipt === "boolean") params.hasReceipt = String(filters.hasReceipt);

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
  } = useTableFilters<ExternalOperationGetManyFormData>({
    defaultFilters: {
      limit: DEFAULT_PAGE_SIZE,
    },
    searchDebounceMs: 500,
    searchParamName: "search", // Use "search" for URL compatibility
    serializeToUrl: serializeExternalOperationFilters,
    deserializeFromUrl: deserializeExternalOperationFilters,
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
    (newFilters: Partial<ExternalOperationGetManyFormData>) => {
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
    (key: string) => {
      if (key === "searchingFor") {
        setSearch("");
      } else {
        baseOnRemoveFilter(key);
      }
    },
    [baseOnRemoveFilter, setSearch],
  );

  // Extract active filters for display
  const activeFilters = useMemo(() => {
    // Include searchingFor in the filters object for extraction
    const filtersWithSearch = {
      ...filters,
      searchingFor: searchingFor || undefined,
    };

    return extractActiveFilters(filtersWithSearch, onRemoveFilter);
  }, [filters, searchingFor, onRemoveFilter]);

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
            placeholder="Buscar por responsável, observações..."
            isPending={displaySearchText !== searchingFor}
          />
          <div className="flex gap-2">
            <ShowSelectedToggle showSelectedOnly={showSelectedOnly} onToggle={toggleShowSelectedOnly} selectionCount={selectionCount} />
            <ColumnVisibilityManager columns={allColumns} visibleColumns={visibleColumns} onVisibilityChange={setVisibleColumns} />
            <Button
              variant={hasActiveFilters ? "default" : "outline"}
              size="default"
              onClick={() => setShowFilterModal(true)}
            >
              <IconFilter className="h-4 w-4" />
              <span>
                Filtros
                {hasActiveFilters ? ` (${activeFilters.length})` : ""}
              </span>
            </Button>
            <ExternalOperationExport
              currentItems={tableData.externalOperations}
              totalRecords={tableData.totalRecords}
              selectedItems={new Set(selectedIds)}
              visibleColumns={visibleColumns}
              filters={queryFilters}
            />
          </div>
        </div>

        {/* Active Filter Indicators */}
        {activeFilters.length > 0 && <FilterIndicators filters={activeFilters} onClearAll={clearAllFilters} className="px-1 py-1" />}

        {/* Paginated table */}
        <div className="flex-1 min-h-0 overflow-auto">
          <ExternalOperationTable visibleColumns={visibleColumns} filters={queryFilters} className="h-full" onDataChange={handleTableDataChange} />
        </div>
      </CardContent>

      {/* Enhanced Filter Modal */}
      <ExternalOperationFilters open={showFilterModal} onOpenChange={setShowFilterModal} filters={filters} onFilterChange={handleFilterChange} />
    </Card>
  );
}
