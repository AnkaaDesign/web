import { useState, useMemo, useCallback, useRef, forwardRef, useImperativeHandle } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { ShowSelectedToggle } from "@/components/ui/show-selected-toggle";
import { GenericColumnVisibilityManager } from "@/components/ui/generic-column-visibility-manager";
import { FilterIndicators } from "@/components/ui/filter-indicator";
import { PerformanceLevelTable, type PerformanceLevelTableRef } from "./performance-level-table";
import { PerformanceLevelExport } from "./performance-level-export";
import { PerformanceLevelFilters } from "./performance-level-filters";
import { useUsers, useSectors } from "../../../hooks";
import { useTableFilters } from "@/hooks/common/use-table-filters";
import { useTableState, convertSortConfigsToOrderBy } from "@/hooks/common/use-table-state";
import { useColumnVisibility } from "@/hooks/common/use-column-visibility";
import { IconFilter } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { USER_STATUS } from "../../../constants";
import type { UserGetManyFormData } from "../../../schemas";

const DEFAULT_PAGE_SIZE = 40;

const DEFAULT_VISIBLE_COLUMNS = new Set([
  "payrollNumber",
  "name",
  "position",
  "sector",
  "performanceLevel",
  "bonus"
]);

const ALL_COLUMNS = [
  { key: "payrollNumber", header: "Nº Folha" },
  { key: "name", header: "Nome" },
  { key: "email", header: "Email" },
  { key: "phone", header: "Telefone" },
  { key: "position", header: "Cargo" },
  { key: "sector", header: "Setor" },
  { key: "performanceLevel", header: "Desempenho" },
  { key: "bonus", header: "Bonificação" }
];

interface PerformanceLevelListProps {
  className?: string;
  onPendingChangesUpdate?: (changes: Map<string, number>, modified: Set<string>) => void;
}

export interface PerformanceLevelListRef {
  saveAllChanges: () => void;
  revertAllChanges: () => void;
}

export const PerformanceLevelList = forwardRef<PerformanceLevelListRef, PerformanceLevelListProps>(({
  className,
  onPendingChangesUpdate
}, ref) => {
  const { visibleColumns, setVisibleColumns } = useColumnVisibility(
    "performance-level-list-visible-columns",
    DEFAULT_VISIBLE_COLUMNS
  );
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const tableRef = useRef<PerformanceLevelTableRef>(null);

  // Load sectors for filter modal
  const { data: _sectorsData } = useSectors({
    orderBy: { name: "asc" },
    limit: 100,
  });

  // Use table state hook for sorting
  const {
    sortConfigs,
    toggleSort,
    getSortDirection,
    getSortOrder,
  } = useTableState({
    defaultSort: [{ column: "name", direction: "asc" }]
  });

  const {
    filters,
    setFilters,
    searchingFor,
    displaySearchText,
    setSearch,
    clearAllFilters,
    queryFilters,
    hasActiveFilters,
  } = useTableFilters<UserGetManyFormData>({
    defaultFilters: {
      limit: DEFAULT_PAGE_SIZE,
      where: {
        status: USER_STATUS.EFFECTED,  // Only EFFECTED users (not dismissed, not inactive)
        position: {
          is: {
            bonifiable: true  // Only users with bonifiable positions
          }
        }
      }
    },
    searchDebounceMs: 500, // Increased debounce for better performance
    searchParamName: "search",
  });

  // Convert sort configs to orderBy format
  const orderBy = useMemo(() => {
    const converted = convertSortConfigsToOrderBy(sortConfigs);
    // If no sort is set, default to name ascending
    return converted && converted.length > 0 ? converted : [{ name: "asc" }];
  }, [sortConfigs]);

  // Memoize query params to prevent unnecessary refetches
  const userQueryParams = useMemo(() => {
    return {
      ...queryFilters,
      include: {
        position: true,
        sector: true,
      },
      orderBy,
    };
  }, [queryFilters, orderBy]);

  const { data: response, isLoading, error, refetch } = useUsers(userQueryParams);

  const users = response?.data || [];
  const totalRecords = response?.meta?.totalRecords || 0;

  // Filter users based on selection toggle
  const displayUsers = useMemo(() => {
    if (!showSelectedOnly) return users;
    return users.filter(user => selectedUserIds.has(user.id));
  }, [users, selectedUserIds, showSelectedOnly]);

  // Handle table data changes - memoized to prevent re-renders
  const handleTableDataChange = useCallback((_data: any) => {
    // Handle pagination, sorting, etc.
    // Currently not implemented
  }, []);

  const handleColumnVisibilityChange = useCallback((columns: Set<string>) => {
    setVisibleColumns(columns);
  }, []);

  const toggleShowSelectedOnly = useCallback((show: boolean) => {
    setShowSelectedOnly(show);
  }, []);

  const handleSelectionChange = useCallback((selectedIds: Set<string>) => {
    setSelectedUserIds(selectedIds);
  }, []);

  // Handle pending changes from the table
  const handlePendingChangesUpdate = useCallback((changes: Map<string, number>, modified: Set<string>) => {
    if (onPendingChangesUpdate) {
      onPendingChangesUpdate(changes, modified);
    }
  }, [onPendingChangesUpdate]);

  // Expose methods to parent
  useImperativeHandle(ref, () => ({
    saveAllChanges: () => {
      if (tableRef.current?.saveAllChanges) {
        tableRef.current.saveAllChanges();
      }
    },
    revertAllChanges: () => {
      if (tableRef.current?.revertAllChanges) {
        tableRef.current.revertAllChanges();
      }
    }
  }), []);

  // Extract active filters for indicators
  const activeFilters = useMemo(() => {
    const result = [];

    // Add search filter
    if (searchingFor) {
      result.push({
        key: 'search',
        value: searchingFor,
        label: `Busca: ${searchingFor}`
      });
    }

    // Add other filters from where clause
    if (filters.where) {
      const where = filters.where;

      if (where.positionId?.in && where.positionId.in.length > 0) {
        result.push({
          key: 'position',
          value: where.positionId.in.join(', '),
          label: `Cargos: ${where.positionId.in.length} selecionado(s)`
        });
      }

      if (where.sectorId?.in && where.sectorId.in.length > 0) {
        result.push({
          key: 'sector',
          value: where.sectorId.in.join(', '),
          label: `Setores: ${where.sectorId.in.length} selecionado(s)`
        });
      }

      if (where.performanceLevel) {
        const perf = where.performanceLevel;
        const min = perf.gte ?? 0;
        const max = perf.lte ?? 5;
        result.push({
          key: 'performanceLevel',
          value: `${min}-${max}`,
          label: `Desempenho: ${min} a ${max}`
        });
      }
    }

    return result;
  }, [filters.where, searchingFor]);

  // Handle removing individual filters with stable updates
  const handleRemoveFilter = useCallback((key: string) => {
    if (key === 'search') {
      setSearch("");
    } else if (key === 'position') {
      setFilters(prev => {
        const { positionId, ...restWhere } = prev.where || {};
        return { ...prev, where: restWhere };
      });
    } else if (key === 'sector') {
      setFilters(prev => {
        const { sectorId, ...restWhere } = prev.where || {};
        return { ...prev, where: restWhere };
      });
    } else if (key === 'performanceLevel') {
      setFilters(prev => {
        const { performanceLevel, ...restWhere } = prev.where || {};
        return { ...prev, where: restWhere };
      });
    }
  }, [setSearch, setFilters]);

  const handleClearAllFilters = () => {
    clearAllFilters();
    setSearch("");
  };

  const handleFilterChange = useCallback((newFilters: any) => {
    // The setFilters function already handles deep comparison internally
    setFilters(newFilters);
  }, [setFilters]);

  return (
    <Card className={cn("flex flex-col shadow-sm border border-border", className)}>
      <CardContent className="flex-1 flex flex-col p-4 space-y-4 overflow-hidden">
        {/* Search and Controls Row */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <TableSearchInput
            value={displaySearchText}
            onChange={setSearch}
            placeholder="Buscar por nome, email, nº folha..."
            isPending={displaySearchText !== searchingFor}
          />

          <div className="flex gap-2">
            <ShowSelectedToggle
              showSelectedOnly={showSelectedOnly}
              onToggle={toggleShowSelectedOnly}
              selectionCount={selectedUserIds.size}
            />

            <Button
              variant={hasActiveFilters ? "default" : "outline"}
              size="default"
              onClick={() => setShowFilterModal(true)}
              className="group"
            >
              <IconFilter className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              <span className="text-foreground">
                {hasActiveFilters ? `Filtros (${activeFilters.length})` : "Filtros"}
              </span>
            </Button>

            <GenericColumnVisibilityManager
              columns={ALL_COLUMNS}
              visibleColumns={visibleColumns}
              onVisibilityChange={handleColumnVisibilityChange}
              getDefaultVisibleColumns={() => DEFAULT_VISIBLE_COLUMNS}
            />

            <PerformanceLevelExport
              filters={queryFilters}
              currentUsers={displayUsers}
              totalRecords={totalRecords}
              visibleColumns={visibleColumns}
              selectedUsers={Array.from(selectedUserIds).map(id => users.find(u => u.id === id)).filter(Boolean)}
            />
          </div>
        </div>

        {/* Active Filter Indicators */}
        {activeFilters.length > 0 && (
          <FilterIndicators
            filters={activeFilters.map(filter => ({
              ...filter,
              onRemove: () => handleRemoveFilter(filter.key)
            }))}
            onClearAll={handleClearAllFilters}
            className="flex-shrink-0"
          />
        )}

        {/* Table Content */}
        <div className="flex-1 min-h-0 overflow-auto">
          <PerformanceLevelTable
            ref={tableRef}
            users={displayUsers}
            isLoading={isLoading}
            error={error}
            visibleColumns={visibleColumns}
            selectedUserIds={selectedUserIds}
            onSelectionChange={handleSelectionChange}
            onDataChange={handleTableDataChange}
            onRefresh={refetch}
            onPendingChangesUpdate={handlePendingChangesUpdate}
            className="h-full"
            onSort={toggleSort}
            getSortDirection={getSortDirection}
            getSortOrder={getSortOrder}
          />
        </div>
      </CardContent>

      {/* Filter Modal */}
      <PerformanceLevelFilters
        open={showFilterModal}
        onOpenChange={setShowFilterModal}
        filters={filters}
        onFilterChange={handleFilterChange}
      />
    </Card>
  );
});

PerformanceLevelList.displayName = 'PerformanceLevelList';
