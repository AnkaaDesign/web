import React from "react";
import type { Task } from "../../../../types";
import type { TaskGetManyFormData } from "../../../../schemas";
import { useSectors, useCustomers, useUsers } from "../../../../hooks";
import { TASK_STATUS } from "../../../../constants";
import { useTableFilters } from "@/hooks/use-table-filters";
import { useTableState } from "@/hooks/use-table-state";
import { Card, CardContent } from "@/components/ui/card";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FilterIndicators } from "@/components/ui/filter-indicator";
import { ShowSelectedToggle } from "@/components/ui/show-selected-toggle";
import { TaskHistoryTable } from "./task-history-table";
import { TaskHistoryFilters } from "./task-history-filters";
import { TaskExport } from "./task-export";
import { ColumnVisibilityManager } from "./column-visibility-manager";
import { createTaskHistoryColumns } from "./task-history-columns";
import { extractActiveFilters, createFilterRemover } from "./filter-utils";
import { IconFilter } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { useColumnVisibility } from "@/hooks/use-column-visibility";

interface TaskHistoryListProps {
  className?: string;
  statusFilter?: TASK_STATUS[];
  storageKey?: string;
  searchPlaceholder?: string;
  navigationRoute?: 'history' | 'onHold' | 'schedule';
}

const DEFAULT_PAGE_SIZE = 40;

export function TaskHistoryList({
  className,
  statusFilter = [TASK_STATUS.COMPLETED],
  storageKey = "task-history-visible-columns",
  searchPlaceholder = "Buscar por nome, cliente, setor...",
  navigationRoute = 'history',
}: TaskHistoryListProps) {
  // Load entity data for filter labels
  const { data: sectorsData } = useSectors({ orderBy: { name: "asc" } });
  const { data: customersData } = useCustomers({ orderBy: { fantasyName: "asc" } });
  const { data: usersData } = useUsers({ orderBy: { name: "asc" } });

  // Get table state for selected tasks functionality
  const { selectionCount, showSelectedOnly, toggleShowSelectedOnly } = useTableState({
    defaultPageSize: 40,
    resetSelectionOnPageChange: false,
  });



  // Custom deserializer for task filters
  const deserializeTaskFilters = React.useCallback(
    (params: URLSearchParams): Partial<TaskGetManyFormData> => {
      const filters: Partial<TaskGetManyFormData> = {};

      // Entity filters
      const sectors = params.get("sectors");
      if (sectors) filters.sectorIds = sectors.split(",");

      const customers = params.get("customers");
      if (customers) filters.customerIds = customers.split(",");

      const users = params.get("users");
      if (users) filters.assigneeIds = users.split(",");

      // Status filter
      const includeInProgress = params.get("includeInProgress");
      if (includeInProgress === "true") {
        filters.status = [TASK_STATUS.COMPLETED, TASK_STATUS.PENDING, TASK_STATUS.IN_PRODUCTION, TASK_STATUS.ON_HOLD];
      } else {
        filters.status = statusFilter;
      }

      // Date ranges
      const finishedFrom = params.get("finishedFrom");
      const finishedTo = params.get("finishedTo");
      if (finishedFrom || finishedTo) {
        filters.finishedDateRange = {
          ...(finishedFrom && { from: new Date(finishedFrom) }),
          ...(finishedTo && { to: new Date(finishedTo) }),
        };
      }

      const entryFrom = params.get("entryFrom");
      const entryTo = params.get("entryTo");
      if (entryFrom || entryTo) {
        filters.entryDateRange = {
          ...(entryFrom && { from: new Date(entryFrom) }),
          ...(entryTo && { to: new Date(entryTo) }),
        };
      }

      const termFrom = params.get("termFrom");
      const termTo = params.get("termTo");
      if (termFrom || termTo) {
        filters.termRange = {
          ...(termFrom && { from: new Date(termFrom) }),
          ...(termTo && { to: new Date(termTo) }),
        };
      }

      const startedFrom = params.get("startedFrom");
      const startedTo = params.get("startedTo");
      if (startedFrom || startedTo) {
        filters.startedDateRange = {
          ...(startedFrom && { from: new Date(startedFrom) }),
          ...(startedTo && { to: new Date(startedTo) }),
        };
      }

      // Price range
      const priceMin = params.get("priceMin");
      const priceMax = params.get("priceMax");
      if (priceMin || priceMax) {
        filters.priceRange = {
          ...(priceMin && { from: Number(priceMin) }),
          ...(priceMax && { to: Number(priceMax) }),
        };
      }

      // Boolean filters
      if (params.get("hasCustomer") === "true") filters.hasCustomer = true;
      if (params.get("hasSector") === "true") filters.hasSector = true;
      if (params.get("hasAssignee") === "true") filters.hasAssignee = true;
      if (params.get("hasTruck") === "true") filters.hasTruck = true;
      if (params.get("hasObservation") === "true") filters.hasObservation = true;
      if (params.get("hasArtworks") === "true") filters.hasArtworks = true;
      if (params.get("hasPaints") === "true") filters.hasPaints = true;
      if (params.get("hasCommissions") === "true") filters.hasCommissions = true;
      if (params.get("hasServices") === "true") filters.hasServices = true;

      return filters;
    },
    [statusFilter],
  );

  // Custom serializer for task filters
  const serializeTaskFilters = React.useCallback((filters: Partial<TaskGetManyFormData>): Record<string, string> => {
    const params: Record<string, string> = {};

    // Entity filters
    if (filters.sectorIds?.length) params.sectors = filters.sectorIds.join(",");
    if (filters.customerIds?.length) params.customers = filters.customerIds.join(",");
    if (filters.assigneeIds?.length) params.users = filters.assigneeIds.join(",");

    // Status filter
    const includesInProgress = filters.status?.some(s =>
      s === TASK_STATUS.PENDING || s === TASK_STATUS.IN_PRODUCTION || s === TASK_STATUS.ON_HOLD
    );
    if (includesInProgress) params.includeInProgress = "true";

    // Date filters
    if (filters.finishedDateRange?.from) params.finishedFrom = filters.finishedDateRange.from.toISOString();
    if (filters.finishedDateRange?.to) params.finishedTo = filters.finishedDateRange.to.toISOString();
    if (filters.entryDateRange?.from) params.entryFrom = filters.entryDateRange.from.toISOString();
    if (filters.entryDateRange?.to) params.entryTo = filters.entryDateRange.to.toISOString();
    if (filters.termRange?.from) params.termFrom = filters.termRange.from.toISOString();
    if (filters.termRange?.to) params.termTo = filters.termRange.to.toISOString();
    if (filters.startedDateRange?.from) params.startedFrom = filters.startedDateRange.from.toISOString();
    if (filters.startedDateRange?.to) params.startedTo = filters.startedDateRange.to.toISOString();

    // Price range
    if (filters.priceRange?.from !== undefined) params.priceMin = String(filters.priceRange.from);
    if (filters.priceRange?.to !== undefined) params.priceMax = String(filters.priceRange.to);

    // Boolean filters
    if (filters.hasCustomer) params.hasCustomer = "true";
    if (filters.hasSector) params.hasSector = "true";
    if (filters.hasAssignee) params.hasAssignee = "true";
    if (filters.hasTruck) params.hasTruck = "true";
    if (filters.hasObservation) params.hasObservation = "true";
    if (filters.hasArtworks) params.hasArtworks = "true";
    if (filters.hasPaints) params.hasPaints = "true";
    if (filters.hasCommissions) params.hasCommissions = "true";
    if (filters.hasServices) params.hasServices = "true";

    return params;
  }, []);

  // Filter state management
  const {
    filters,
    setFilters,
    searchingFor,
    displaySearchText,
    setSearch,
    clearAllFilters,
    queryFilters: baseQueryFilters,
  } = useTableFilters<TaskGetManyFormData>({
    defaultFilters: {
      status: statusFilter,
    },
    searchDebounceMs: 300,
    searchParamName: "search", // Use "search" for URL compatibility
    serializeToUrl: serializeTaskFilters,
    deserializeFromUrl: deserializeTaskFilters,
    excludeFromUrl: ["limit", "orderBy"],
  });

  // Default visible columns
  const defaultVisibleColumns = React.useMemo(
    () =>
      new Set([
        "name",
        "customer.fantasyName",
        "generalPainting",
        "sector.name",
        "serialNumber",
        "finishedAt",
      ]),
    []
  );

  // Column visibility state with localStorage persistence
  const { visibleColumns, setVisibleColumns } = useColumnVisibility(storageKey, defaultVisibleColumns);

  // Filter modal state
  const [showFilterModal, setShowFilterModal] = React.useState(false);

  // Table data for export
  const [tableData, setTableData] = React.useState<{ items: Task[]; totalRecords: number }>({
    items: [],
    totalRecords: 0,
  });

  // Get all columns for visibility manager
  const allColumns = React.useMemo(() => createTaskHistoryColumns(), []);

  // Prepare final query filters
  const queryFilters = React.useMemo(() => {
    const { orderBy: _, ...filterWithoutOrderBy } = baseQueryFilters;
    const result = {
      ...filterWithoutOrderBy,
      status: filterWithoutOrderBy.status || statusFilter,
    };

    console.log("[TaskHistoryList] Query filters prepared:", {
      baseQueryFilters,
      filterWithoutOrderBy,
      result,
      hasFinishedDateRange: !!result.finishedDateRange,
      finishedDateRange: result.finishedDateRange,
    });

    return result;
  }, [baseQueryFilters, statusFilter]);

  // Handle filter changes
  const handleFilterChange = React.useCallback(
    (newFilters: Partial<TaskGetManyFormData>) => {
      const { orderBy: _, ...filtersWithoutOrderBy } = newFilters;
      setFilters(filtersWithoutOrderBy);
    },
    [setFilters],
  );

  // Create filter remover
  const baseOnRemoveFilter = createFilterRemover(filters, handleFilterChange);

  // Wrap to handle search removal
  const onRemoveFilter = React.useCallback(
    (key: string, value?: any) => {
      if (key === "search" || key === "searchingFor") {
        setSearch("");
      } else {
        baseOnRemoveFilter(key, value);
      }
    },
    [baseOnRemoveFilter, setSearch],
  );

  // Extract active filters for display
  const activeFilters = React.useMemo(() => {
    const filtersWithSearch = {
      ...filters,
      search: searchingFor || undefined,
    };

    return extractActiveFilters(filtersWithSearch, onRemoveFilter, {
      sectors: sectorsData?.data || [],
      customers: customersData?.data || [],
      users: usersData?.data || [],
    });
  }, [filters, searchingFor, sectorsData?.data, customersData?.data, usersData?.data, onRemoveFilter]);

  // Handle table data changes
  const handleTableDataChange = React.useCallback((data: { items: Task[]; totalRecords: number }) => {
    setTableData(data);
  }, []);

  return (
    <Card className={cn("h-full flex flex-col shadow-sm border border-border", className)}>
      <CardContent className="flex-1 flex flex-col p-6 space-y-4 overflow-hidden">
        {/* Search and controls */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <TableSearchInput
            value={displaySearchText}
            onChange={setSearch}
            placeholder="Buscar por nome, número de série, placa..."
            isPending={displaySearchText !== searchingFor}
          />
          <div className="flex gap-2">
            <ShowSelectedToggle showSelectedOnly={showSelectedOnly} onToggle={toggleShowSelectedOnly} selectionCount={selectionCount} />
            <Button variant="outline" size="default" onClick={() => setShowFilterModal(!showFilterModal)} className="group">
              <IconFilter className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              <span className="text-foreground">Filtros</span>
              {activeFilters.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {activeFilters.length}
                </Badge>
              )}
            </Button>
            <ColumnVisibilityManager columns={allColumns} visibleColumns={visibleColumns} onVisibilityChange={setVisibleColumns} />
            <TaskExport filters={queryFilters} currentItems={tableData.items} totalRecords={tableData.totalRecords} visibleColumns={visibleColumns} />
          </div>
        </div>

        {/* Active Filter Indicators */}
        {activeFilters.length > 0 && <FilterIndicators filters={activeFilters} onClearAll={clearAllFilters} className="px-1 py-1" />}

        {/* Table */}
        <div className="flex-1 min-h-0">
          <TaskHistoryTable
            filters={queryFilters}
            visibleColumns={visibleColumns}
            onDataChange={handleTableDataChange}
            className="h-full"
            navigationRoute={navigationRoute}
          />
        </div>

        {/* Filter Modal */}
        <TaskHistoryFilters
          open={showFilterModal}
          onOpenChange={setShowFilterModal}
          filters={filters}
          onFilterChange={handleFilterChange}
        />
      </CardContent>
    </Card>
  );
}