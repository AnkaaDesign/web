import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useItems, useMaintenanceScheduleMutations } from "../../../../hooks";
import type { MaintenanceSchedule } from "../../../../types";
import type { MaintenanceScheduleGetManyFormData } from "../../../../schemas";
import { routes } from "../../../../constants";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MaintenanceScheduleTable } from "./maintenance-schedule-table";
import { IconSearch, IconFilter } from "@tabler/icons-react";
import { MaintenanceScheduleFilters } from "./maintenance-schedule-filters";
import { FilterIndicators } from "./filter-indicators";
import { ColumnVisibilityManager } from "./column-visibility-manager";
import { extractActiveFilters, createFilterRemover } from "./filter-utils";
import { getDefaultVisibleColumns, createMaintenanceScheduleColumns } from "./maintenance-schedule-table-columns";
import { cn } from "@/lib/utils";
import { ShowSelectedToggle } from "@/components/ui/show-selected-toggle";
import { useTableState } from "@/hooks/use-table-state";
import { useColumnVisibility } from "@/hooks/use-column-visibility";
import { toast } from "sonner";

interface MaintenanceScheduleListProps {
  className?: string;
}

const DEFAULT_PAGE_SIZE = 40;

// Simple debounce utility - moved outside component to avoid initialization issues
function createDebounce<T extends (...args: any[]) => any>(func: T, wait: number) {
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

export function MaintenanceScheduleList({ className }: MaintenanceScheduleListProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { updateMutation, deleteMutation } = useMaintenanceScheduleMutations();

  // State to hold current page items and total count from the table
  const [tableData, setTableData] = useState<{ items: MaintenanceSchedule[]; totalRecords: number }>({
    items: [],
    totalRecords: 0,
  });

  // Stable callback for table data updates
  const handleTableDataChange = useCallback((data: { items: MaintenanceSchedule[]; totalRecords: number }) => {
    setTableData(data);
  }, []);

  // Track cursor position to maintain it during search operations
  const cursorPositionRef = useRef<number>(0);

  // State from URL params - must be declared before debounced search
  const [searchingFor, setSearchingFor] = useState(() => searchParams.get("search") || "");
  const [displaySearchText, setDisplaySearchText] = useState(() => searchParams.get("search") || "");

  // Debounced search function - defined after state declarations
  const debouncedSearch = useCallback(
    createDebounce((value: string) => {
      // Only update if value actually changed
      setSearchingFor((prev) => {
        if (prev !== value) {
          return value;
        }
        return prev;
      });
    }, 300), // 300ms delay
    [setSearchingFor]
  );

  // Update cursor position when user interacts with search input
  const handleSearchInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const target = e.target;
      cursorPositionRef.current = target.selectionStart || 0;
      setDisplaySearchText(target.value); // Immediate UI update
      debouncedSearch(target.value); // Debounced API call
    },
    [debouncedSearch]
  );

  // Keep focus and cursor position stable during search operations
  useEffect(() => {
    // Only restore cursor position if the search input is currently focused
    if (searchInputRef.current && document.activeElement === searchInputRef.current) {
      // Use requestAnimationFrame to ensure DOM updates are complete
      requestAnimationFrame(() => {
        if (searchInputRef.current && document.activeElement === searchInputRef.current) {
          const input = searchInputRef.current;
          const savedPosition = cursorPositionRef.current;
          // Restore cursor position to where the user was typing
          input.setSelectionRange(savedPosition, savedPosition);
        }
      });
    }
  }, [displaySearchText]); // Depend on display text changes, not table data

  // Load entity data for filter labels
  const { data: itemsData } = useItems({
    orderBy: { name: "asc" },
  });

  // Get table state for selected items functionality
  const { selectionCount, showSelectedOnly, toggleShowSelectedOnly } = useTableState({
    defaultPageSize: 40,
    resetSelectionOnPageChange: false,
  });

  // Column visibility state with localStorage persistence
  const { visibleColumns, setVisibleColumns } = useColumnVisibility(
    "maintenance-schedule-list-visible-columns",
    getDefaultVisibleColumns()
  );

  const [showFilterModal, setShowFilterModal] = useState(false);

  // Track if filters are being initialized to prevent loops
  const [filtersInitialized, setFiltersInitialized] = useState(false);

  // Parse filters from URL
  const getFiltersFromUrl = useCallback((): Partial<MaintenanceScheduleGetManyFormData> => {
    const filters: Partial<MaintenanceScheduleGetManyFormData> = {
      limit: DEFAULT_PAGE_SIZE,
    };

    // Parse entity filters
    const itemId = searchParams.get("itemId");
    const itemIds = searchParams.get("itemIds");
    if (itemIds) {
      filters.itemIds = itemIds.split(",");
    } else if (itemId) {
      filters.where = { ...filters.where, itemId };
    }

    // Parse frequency filter
    const frequency = searchParams.get("frequency");
    if (frequency) {
      filters.frequency = frequency.split(",") as any[];
    }

    // Parse active filter
    const isActive = searchParams.get("isActive");
    if (isActive) {
      filters.isActive = isActive === "true";
    }

    // Parse date range filters
    const nextRunAfter = searchParams.get("nextRunAfter");
    const nextRunBefore = searchParams.get("nextRunBefore");
    if (nextRunAfter || nextRunBefore) {
      filters.nextRunRange = {
        ...(nextRunAfter && { gte: new Date(nextRunAfter) }),
        ...(nextRunBefore && { lte: new Date(nextRunBefore) }),
      };
    }

    return filters;
  }, [searchParams]);

  // Current filters state
  const [filters, setFilters] = useState<Partial<MaintenanceScheduleGetManyFormData>>(() =>
    getFiltersFromUrl()
  );

  // Initialize filters from URL on mount
  useEffect(() => {
    if (!filtersInitialized) {
      const urlFilters = getFiltersFromUrl();
      setFilters(urlFilters);
      setFiltersInitialized(true);
    }
  }, [getFiltersFromUrl, filtersInitialized]);

  // Update URL when filters or search change
  useEffect(() => {
    if (!filtersInitialized) return;

    const newParams = new URLSearchParams();

    // Add search parameter
    if (searchingFor) {
      newParams.set("search", searchingFor);
    }

    // Add filter parameters
    if (filters.itemIds?.length) {
      newParams.set("itemIds", filters.itemIds.join(","));
    } else if (filters.where?.itemId) {
      newParams.set("itemId", filters.where.itemId);
    }

    if (filters.frequency?.length) {
      newParams.set("frequency", filters.frequency.join(","));
    }

    if (filters.isActive !== undefined) {
      newParams.set("isActive", filters.isActive.toString());
    }

    if (filters.nextRunRange?.gte) {
      newParams.set("nextRunAfter", filters.nextRunRange.gte.toISOString());
    }
    if (filters.nextRunRange?.lte) {
      newParams.set("nextRunBefore", filters.nextRunRange.lte.toISOString());
    }

    setSearchParams(newParams, { replace: true });
  }, [filters, searchingFor, setSearchParams, filtersInitialized]);

  // Query filters to send to API
  const queryFilters = useMemo(() => {
    return {
      ...filters,
      searchingFor: searchingFor || undefined,
    };
  }, [filters, searchingFor]);

  // Handler for filter changes
  const handleFilterChange = useCallback((newFilters: Partial<MaintenanceScheduleGetManyFormData>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  }, []);

  // Handler to remove specific filter
  const onRemoveFilter = useCallback((filterKey: string, filterValue?: any) => {
    // If removing search filter, also clear the search input states
    if (filterKey === "searchingFor") {
      setSearchingFor("");
      setDisplaySearchText("");
    }
    createFilterRemover(setFilters)(filterKey, filterValue);
  }, []);

  // Handler to clear all filters but keep search
  const handleClearAllFilters = useCallback(() => {
    setFilters({
      limit: DEFAULT_PAGE_SIZE,
    });
  }, []);

  // Compute active filters for UI indicators
  const activeFilters = useMemo(() => {
    const filtersWithSearch = {
      ...filters,
      searchingFor: searchingFor || undefined,
    };

    return extractActiveFilters(filtersWithSearch, onRemoveFilter, {
      items: itemsData?.data,
    });
  }, [filters, searchingFor, itemsData?.data, onRemoveFilter]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debouncedSearch && typeof debouncedSearch.cancel === "function") {
        debouncedSearch.cancel();
      }
    };
  }, [debouncedSearch]);

  // Handle search
  const handleSearch = useCallback(
    (value: string) => {
      setDisplaySearchText(value); // Immediate UI update
      debouncedSearch(value); // Debounced API call
    },
    [debouncedSearch]
  );

  // Context menu handlers
  const handleBulkEdit = (schedules: MaintenanceSchedule[]) => {
    if (schedules.length === 1) {
      // Single schedule - navigate to edit page
      navigate(routes.inventory.maintenance.schedules.edit(schedules[0].id));
    } else {
      // Multiple schedules - navigate to batch edit page
      const ids = schedules.map((schedule) => schedule.id).join(",");
      navigate(`/estoque/manutencao/agendamentos/editar-lote?ids=${ids}`);
    }
  };

  const handleBulkActivate = async (schedules: MaintenanceSchedule[]) => {
    const schedulesToActivate = schedules.filter((s) => !s.isActive);
    if (schedulesToActivate.length === 0) {
      toast.error("Todos os agendamentos selecionados já estão ativos");
      return;
    }

    try {
      await Promise.all(
        schedulesToActivate.map((schedule) =>
          updateMutation.mutateAsync({
            id: schedule.id,
            data: { isActive: true },
          })
        )
      );

      const count = schedulesToActivate.length;
      toast.success(
        count === 1
          ? "Agendamento ativado com sucesso"
          : `${count} agendamentos ativados com sucesso`
      );
    } catch (error) {
      console.error("Error activating schedules:", error);
      toast.error("Erro ao ativar agendamentos");
    }
  };

  const handleBulkDeactivate = async (schedules: MaintenanceSchedule[]) => {
    const schedulesToDeactivate = schedules.filter((s) => s.isActive);
    if (schedulesToDeactivate.length === 0) {
      toast.error("Todos os agendamentos selecionados já estão inativos");
      return;
    }

    try {
      await Promise.all(
        schedulesToDeactivate.map((schedule) =>
          updateMutation.mutateAsync({
            id: schedule.id,
            data: { isActive: false },
          })
        )
      );

      const count = schedulesToDeactivate.length;
      toast.success(
        count === 1
          ? "Agendamento desativado com sucesso"
          : `${count} agendamentos desativados com sucesso`
      );
    } catch (error) {
      console.error("Error deactivating schedules:", error);
      toast.error("Erro ao desativar agendamentos");
    }
  };

  const handleBulkDelete = async (schedules: MaintenanceSchedule[]) => {
    const count = schedules.length;
    const message =
      count === 1
        ? `Tem certeza que deseja excluir o agendamento "${schedules[0].name}"?`
        : `Tem certeza que deseja excluir ${count} agendamentos?`;

    if (!window.confirm(message)) return;

    try {
      await Promise.all(schedules.map((schedule) => deleteMutation.mutateAsync(schedule.id)));

      toast.success(
        count === 1 ? "Agendamento excluído com sucesso" : `${count} agendamentos excluídos com sucesso`
      );
    } catch (error) {
      console.error("Error deleting schedules:", error);
      toast.error("Erro ao excluir agendamentos");
    }
  };

  return (
    <Card className={cn("h-full flex flex-col shadow-sm border border-border", className)}>
      <CardContent className="flex-1 flex flex-col p-6 space-y-4 overflow-hidden">
        {/* Search and controls */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex-1 relative">
            <IconSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              ref={searchInputRef}
              type="text"
              placeholder="Buscar por nome, item, descrição..."
              value={displaySearchText}
              onChange={handleSearchInputChange}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            <ShowSelectedToggle
              showSelectedOnly={showSelectedOnly}
              onToggle={toggleShowSelectedOnly}
              selectionCount={selectionCount}
            />
            <Button
              variant={activeFilters.length > 0 ? "default" : "outline"}
              size="default"
              onClick={() => setShowFilterModal(true)}
              className="group"
            >
              <IconFilter className="h-4 w-4" />
              <span>{activeFilters.length > 0 ? `Filtros (${activeFilters.length})` : "Filtros"}</span>
            </Button>
            <ColumnVisibilityManager
              columns={createMaintenanceScheduleColumns()}
              visibleColumns={visibleColumns}
              onVisibilityChange={setVisibleColumns}
            />
          </div>
        </div>

        {/* Active Filter Indicators */}
        {activeFilters.length > 0 && (
          <FilterIndicators filters={activeFilters} onClearAll={handleClearAllFilters} className="px-1 py-1" />
        )}

        {/* Paginated table */}
        <div className="flex-1 min-h-0">
          <MaintenanceScheduleTable
            visibleColumns={visibleColumns}
            onEdit={handleBulkEdit}
            onActivate={handleBulkActivate}
            onDeactivate={handleBulkDeactivate}
            onDelete={handleBulkDelete}
            filters={queryFilters}
            className="h-full"
            onDataChange={handleTableDataChange}
          />
        </div>
      </CardContent>

      {/* Enhanced Filter Modal */}
      <MaintenanceScheduleFilters
        open={showFilterModal}
        onOpenChange={setShowFilterModal}
        filters={filters}
        onFilterChange={handleFilterChange}
      />
    </Card>
  );
}
