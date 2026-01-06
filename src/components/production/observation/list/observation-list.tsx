import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useObservations, useTasks } from "../../../../hooks";
import type { Observation } from "../../../../types";
import type { ObservationGetManyFormData } from "../../../../schemas";
import { routes } from "../../../../constants";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ObservationTable } from "./observation-table";
import { IconSearch, IconFilter } from "@tabler/icons-react";
import { ObservationFilters } from "./observation-filters";
import { FilterIndicators } from "./filter-indicator";
import { extractActiveFilters, createFilterRemover } from "./filter-utils";
import { cn } from "@/lib/utils";
import { ShowSelectedToggle } from "@/components/ui/show-selected-toggle";
import { useTableState } from "@/hooks/use-table-state";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/ui/loading";
import { createObservationColumns, getDefaultVisibleColumns } from "./observation-table-columns";
import { ColumnVisibilityManager } from "./column-visibility-manager";
import { useColumnVisibility } from "@/hooks/use-column-visibility";

interface ObservationListProps {
  className?: string;
}

const DEFAULT_PAGE_SIZE = 40;

// Simple debounce utility
function debounce<T extends (...args: any[]) => any>(func: T, wait: number) {
  let timeout: NodeJS.Timeout | null = null;
  const debounced = (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
  debounced.cancel = () => {
    if (timeout) clearTimeout(timeout);
  };
  return debounced;
}

export function ObservationList({ className }: ObservationListProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Load entity data for filter labels
  const { data: tasksData } = useTasks({ orderBy: { name: "asc" }, limit: 100 });

  // Get table state for selected items functionality
  const { selectionCount, showSelectedOnly, toggleShowSelectedOnly } = useTableState({
    defaultPageSize: 40,
    resetSelectionOnPageChange: false,
  });

  // Column visibility state with localStorage persistence
  const { visibleColumns, setVisibleColumns } = useColumnVisibility(
    "observation-list-visible-columns",
    getDefaultVisibleColumns()
  );

  // Create columns for visibility manager (without handlers since they're not needed for column visibility)
  const columnsForVisibility = useMemo(() => {
    return createObservationColumns({
      selection: {},
      onRowSelection: () => {},
      onEdit: () => {},
      onDelete: () => {},
      onView: () => {},
    });
  }, []);

  // State from URL params
  const [searchingFor, setSearchingFor] = useState(() => searchParams.get("search") || "");
  const [displaySearchText, setDisplaySearchText] = useState(() => searchParams.get("search") || "");
  const [showFilterModal, setShowFilterModal] = useState(false);

  // Keep focus on search input after search changes
  useEffect(() => {
    // Only restore focus if the search input was already focused
    if (searchInputRef.current && document.activeElement === searchInputRef.current) {
      // Use requestAnimationFrame to ensure DOM is updated
      requestAnimationFrame(() => {
        if (searchInputRef.current) {
          const length = searchInputRef.current.value.length;
          searchInputRef.current.setSelectionRange(length, length);
        }
      });
    }
  }, [searchingFor]); // Only depend on search text to maintain focus during typing

  // Track if filters are being initialized to prevent loops
  const [filtersInitialized, setFiltersInitialized] = useState(false);

  // Parse filters from URL
  const getFiltersFromUrl = useCallback((): Partial<ObservationGetManyFormData> => {
    const filters: Partial<ObservationGetManyFormData> = {
      limit: DEFAULT_PAGE_SIZE,
    };

    // Parse task IDs
    const taskIds = searchParams.get("taskIds");
    if (taskIds) {
      filters.taskIds = taskIds.split(",");
    }

    // Parse has files filter
    const hasFiles = searchParams.get("hasFiles");
    if (hasFiles === "true") {
      filters.hasFiles = true;
    } else if (hasFiles === "false") {
      filters.hasFiles = false;
    }

    // Parse date range
    const createdAfter = searchParams.get("createdAfter");
    const createdBefore = searchParams.get("createdBefore");
    if (createdAfter || createdBefore) {
      filters.createdAt = {};
      if (createdAfter) filters.createdAt.gte = new Date(createdAfter);
      if (createdBefore) filters.createdAt.lte = new Date(createdBefore);
    }

    return filters;
  }, [searchParams]);

  // State for filters
  const [filters, setFilters] = useState<Partial<ObservationGetManyFormData>>(() => getFiltersFromUrl());

  // Initialize filters from URL on mount
  useEffect(() => {
    if (!filtersInitialized) {
      const urlFilters = getFiltersFromUrl();
      setFilters(urlFilters);
      setFiltersInitialized(true);
    }
  }, [getFiltersFromUrl, filtersInitialized]);

  // Create a debounced version of search update
  const debouncedSetSearchingFor = useMemo(
    () =>
      debounce((value: string) => {
        setSearchingFor(value);
      }, 300),
    [],
  );

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setDisplaySearchText(value);
    debouncedSetSearchingFor(value);
  };

  // Update URL when search or filters change
  useEffect(() => {
    const params = new URLSearchParams();

    if (searchingFor) {
      params.set("search", searchingFor);
    }

    if (filters.taskIds && filters.taskIds.length > 0) {
      params.set("taskIds", filters.taskIds.join(","));
    }

    if (filters.hasFiles !== undefined) {
      params.set("hasFiles", filters.hasFiles.toString());
    }

    if (filters.createdAt?.gte) {
      params.set("createdAfter", filters.createdAt.gte.toISOString());
    }

    if (filters.createdAt?.lte) {
      params.set("createdBefore", filters.createdAt.lte.toISOString());
    }

    // Only update URL if there are actual changes to avoid infinite loops
    const currentParamsString = searchParams.toString();
    const newParamsString = params.toString();

    if (currentParamsString !== newParamsString) {
      setSearchParams(params, { replace: true });
    }
  }, [searchingFor, filters, setSearchParams, searchParams]);

  // Query for observations
  const observationQuery: ObservationGetManyFormData = useMemo(
    () => ({
      ...filters,
      searchingFor: searchingFor || undefined,
      include: {
        task: {
          include: {
            customer: true,
            sector: true,
            user: true,
          },
        },
        files: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    [filters, searchingFor],
  );

  const { data: _observationsResponse, isLoading, error } = useObservations(observationQuery);

  // Extract active filters for display
  const activeFilters = useMemo(() => {
    return extractActiveFilters(filters, {
      tasks: tasksData?.data || [],
    });
  }, [filters, tasksData?.data]);

  // Handle filter changes
  const handleFilterChange = useCallback((newFilters: Partial<ObservationGetManyFormData>) => {
    setFilters((prevFilters) => ({ ...prevFilters, ...newFilters }));
  }, []);

  // Handle clear all filters
  const handleClearAllFilters = useCallback(() => {
    setFilters({ limit: DEFAULT_PAGE_SIZE });
    setSearchingFor("");
    setDisplaySearchText("");
    if (searchInputRef.current) {
      searchInputRef.current.value = "";
    }
  }, []);

  // Create filter remover functions
  const filterRemovers = useMemo(() => {
    return createFilterRemover(filters, handleFilterChange);
  }, [filters, handleFilterChange]);

  // Handle clear individual filter
  const handleClearFilter = useCallback(
    (filterKey: string) => {
      const remover = filterRemovers[filterKey as keyof typeof filterRemovers];
      if (remover) {
        remover();
      }
    },
    [filterRemovers],
  );

  // Handle row click to navigate to details
  const handleRowClick = (observation: Observation) => {
    navigate(routes.production.observations.details(observation.id));
  };

  return (
    <Card className={cn("flex flex-col shadow-sm border border-border", className)}>
      <CardContent className="flex-1 flex flex-col p-4 space-y-4 overflow-hidden">
        {/* Search and Controls */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex-1 relative">
            <IconSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input ref={searchInputRef} placeholder="Buscar observações..." value={displaySearchText} onChange={handleSearchChange} transparent={true} className="pl-9" />
          </div>
          <div className="flex gap-2">
            {selectionCount > 0 && <ShowSelectedToggle showSelectedOnly={showSelectedOnly} onToggle={toggleShowSelectedOnly} selectionCount={selectionCount} />}
            <Button variant={activeFilters.length > 0 ? "default" : "outline"} onClick={() => setShowFilterModal(true)}>
              <IconFilter className="h-4 w-4 mr-2" />
              Filtros{activeFilters.length > 0 ? ` (${activeFilters.length})` : ""}
            </Button>
            <ColumnVisibilityManager columns={columnsForVisibility} visibleColumns={visibleColumns} onVisibilityChange={setVisibleColumns} />
          </div>
        </div>

        {/* Filter Indicators */}
        {activeFilters.length > 0 && <FilterIndicators filters={activeFilters} onClearFilter={handleClearFilter} onClearAll={handleClearAllFilters} />}

        {/* Table */}
        <div className="flex-1 min-h-0 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <LoadingSpinner />
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full text-destructive">Erro ao carregar observações</div>
          ) : (
            <ObservationTable className="h-full" onRowClick={handleRowClick} showSelectedOnly={showSelectedOnly} visibleColumns={visibleColumns} query={observationQuery} />
          )}
        </div>

        {/* Filter Modal */}
        <ObservationFilters open={showFilterModal} onOpenChange={setShowFilterModal} filters={filters} onFilterChange={handleFilterChange} tasks={tasksData?.data || []} />
      </CardContent>
    </Card>
  );
}
