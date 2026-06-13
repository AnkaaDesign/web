import { useState, useCallback, useMemo, useRef } from "react";
import { useUsers, usePositions } from "../../../../hooks";
import { formatDate } from "../../../../utils";
import type { UserPositionHistory } from "../../../../types/user-position-history";
import type { UserPositionHistoryGetManyFormData } from "../../../../schemas/user-position-history";
import { POSITION_CHANGE_REASON_LABELS, type POSITION_CHANGE_REASON } from "../../../../constants";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { UserPositionHistoryTable } from "./user-position-history-table";
import { IconFilter } from "@tabler/icons-react";
import { UserPositionHistoryFilters } from "./user-position-history-filters";
import { UserPositionHistoryDetailDialog } from "../detail/user-position-history-detail-dialog";
import { GenericColumnVisibilityManager } from "@/components/ui/generic-column-visibility-manager";
import { FilterIndicators } from "@/components/ui/filter-indicator";
import { createUserPositionHistoryColumns, DEFAULT_USER_POSITION_HISTORY_VISIBLE_COLUMNS } from "./user-position-history-table-columns";
import { cn } from "@/lib/utils";
import { useTableFilters } from "@/hooks/common/use-table-filters";
import { useColumnVisibility } from "@/hooks/common/use-column-visibility";

interface UserPositionHistoryListProps {
  className?: string;
}

const DEFAULT_PAGE_SIZE = 40;

export function UserPositionHistoryList({ className }: UserPositionHistoryListProps) {
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [showFilterModal, setShowFilterModal] = useState(false);
  const [detailDialog, setDetailDialog] = useState<UserPositionHistory | null>(null);

  // Load entity data for filter labels
  const { data: usersData } = useUsers({ orderBy: { name: "asc" } });
  const { data: positionsData } = usePositions({ orderBy: { name: "asc" } });

  // Custom deserializer for user position history filters
  const deserializeFilters = useCallback((params: URLSearchParams): Partial<UserPositionHistoryGetManyFormData> => {
    const filters: Partial<UserPositionHistoryGetManyFormData> = {};

    const users = params.get("users");
    if (users) {
      filters.userIds = users.split(",");
    }

    const positions = params.get("positions");
    if (positions) {
      filters.positionIds = positions.split(",");
    }

    const reasons = params.get("reasons");
    if (reasons) {
      filters.reasons = reasons.split(",");
    }

    const isCurrent = params.get("isCurrent");
    if (isCurrent !== null) {
      filters.isCurrent = isCurrent === "true";
    }

    const startedAfter = params.get("startedAfter");
    const startedBefore = params.get("startedBefore");
    if (startedAfter || startedBefore) {
      filters.startedAtRange = {
        ...(startedAfter && { gte: new Date(startedAfter) }),
        ...(startedBefore && { lte: new Date(startedBefore) }),
      };
    }

    return filters;
  }, []);

  // Custom serializer for user position history filters
  const serializeFilters = useCallback((filters: Partial<UserPositionHistoryGetManyFormData>): Record<string, string> => {
    const params: Record<string, string> = {};

    if (filters.userIds?.length) params.users = filters.userIds.join(",");
    if (filters.positionIds?.length) params.positions = filters.positionIds.join(",");
    if (filters.reasons?.length) params.reasons = filters.reasons.join(",");
    if (typeof filters.isCurrent === "boolean") params.isCurrent = String(filters.isCurrent);
    if (filters.startedAtRange?.gte) params.startedAfter = new Date(filters.startedAtRange.gte).toISOString();
    if (filters.startedAtRange?.lte) params.startedBefore = new Date(filters.startedAtRange.lte).toISOString();

    return params;
  }, []);

  // Use the unified table filters hook
  const { filters, setFilters, searchingFor, displaySearchText, setSearch, clearAllFilters, queryFilters: baseQueryFilters, hasActiveFilters } = useTableFilters<
    UserPositionHistoryGetManyFormData
  >({
    defaultFilters: {
      limit: DEFAULT_PAGE_SIZE,
    },
    searchDebounceMs: 500,
    searchParamName: "search",
    serializeToUrl: serializeFilters,
    deserializeFromUrl: deserializeFilters,
    excludeFromUrl: ["limit", "orderBy"],
  });

  // Visible columns state with localStorage persistence
  const { visibleColumns, setVisibleColumns } = useColumnVisibility("user-position-history-list-visible-columns", DEFAULT_USER_POSITION_HISTORY_VISIBLE_COLUMNS);

  // Get all available columns for column visibility manager
  const allColumns = useMemo(() => createUserPositionHistoryColumns(), []);

  // Query filters to pass to the paginated table
  const queryFilters = useMemo(() => {
    const { orderBy: _, ...filterWithoutOrderBy } = baseQueryFilters;

    return {
      ...filterWithoutOrderBy,
      limit: DEFAULT_PAGE_SIZE,
    } as Partial<UserPositionHistoryGetManyFormData>;
  }, [baseQueryFilters]);

  // Handle filter changes
  const handleFilterChange = useCallback(
    (newFilters: Partial<UserPositionHistoryGetManyFormData>) => {
      const { orderBy: _, ...filtersWithoutOrderBy } = newFilters;
      setFilters(filtersWithoutOrderBy);
    },
    [setFilters],
  );

  // Extract active filters for display
  const activeFilters = useMemo(() => {
    const indicators: Array<{ key: string; label: string; value: string; onRemove: () => void }> = [];

    if (searchingFor) {
      indicators.push({
        key: "searchingFor",
        label: "Buscar",
        value: searchingFor,
        onRemove: () => setSearch(""),
      });
    }

    (filters.userIds || []).forEach((userId: string) => {
      const user = usersData?.data?.find((u) => u.id === userId);
      indicators.push({
        key: `user-${userId}`,
        label: "Colaborador",
        value: user?.name || userId,
        onRemove: () => handleFilterChange({ ...filters, userIds: (filters.userIds || []).filter((id: string) => id !== userId) }),
      });
    });

    (filters.positionIds || []).forEach((positionId: string) => {
      const position = positionsData?.data?.find((p) => p.id === positionId);
      indicators.push({
        key: `position-${positionId}`,
        label: "Cargo",
        value: position?.name || positionId,
        onRemove: () => handleFilterChange({ ...filters, positionIds: (filters.positionIds || []).filter((id: string) => id !== positionId) }),
      });
    });

    (filters.reasons || []).forEach((reason: string) => {
      indicators.push({
        key: `reason-${reason}`,
        label: "Motivo",
        value: POSITION_CHANGE_REASON_LABELS[reason as POSITION_CHANGE_REASON] || reason,
        onRemove: () => handleFilterChange({ ...filters, reasons: (filters.reasons || []).filter((r: string) => r !== reason) }),
      });
    });

    if (typeof filters.isCurrent === "boolean") {
      indicators.push({
        key: "isCurrent",
        label: "Vigência",
        value: filters.isCurrent ? "Apenas vigentes" : "Apenas encerrados",
        onRemove: () => handleFilterChange({ ...filters, isCurrent: undefined }),
      });
    }

    if (filters.startedAtRange?.gte || filters.startedAtRange?.lte) {
      const gte = filters.startedAtRange?.gte ? formatDate(new Date(filters.startedAtRange.gte)) : null;
      const lte = filters.startedAtRange?.lte ? formatDate(new Date(filters.startedAtRange.lte)) : null;
      indicators.push({
        key: "startedAtRange",
        label: "Período (início)",
        value: gte && lte ? `${gte} – ${lte}` : gte ? `a partir de ${gte}` : `até ${lte}`,
        onRemove: () => handleFilterChange({ ...filters, startedAtRange: undefined }),
      });
    }

    return indicators;
  }, [filters, searchingFor, usersData?.data, positionsData?.data, handleFilterChange, setSearch]);

  // Count active filters for the button
  const activeFilterCount = useMemo(() => {
    return Object.entries(filters).filter(([key, value]) => {
      if (key === "page" || key === "limit" || key === "itemsPerPage" || key === "orderBy" || key === "sortOrder") return false;
      if (Array.isArray(value)) return value.length > 0;
      if (typeof value === "object" && value !== null) return Object.keys(value).length > 0;
      return value !== undefined && value !== null && value !== "";
    }).length;
  }, [filters]);

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
            placeholder="Buscar por colaborador, cargo ou observação"
            isPending={displaySearchText !== searchingFor}
          />
          <div className="flex gap-2">
            <GenericColumnVisibilityManager
              columns={allColumns.map((col) => ({ key: col.key, header: col.header }))}
              visibleColumns={visibleColumns}
              onVisibilityChange={setVisibleColumns}
              getDefaultVisibleColumns={() => DEFAULT_USER_POSITION_HISTORY_VISIBLE_COLUMNS}
            />
            <Button variant={hasActiveFilters ? "default" : "outline"} size="default" onClick={() => setShowFilterModal(true)}>
              <IconFilter className="h-4 w-4" />
              <span>
                Filtros
                {hasActiveFilters ? ` (${activeFilterCount})` : ""}
              </span>
            </Button>
          </div>
        </div>

        {/* Active Filter Indicators */}
        {activeFilters.length > 0 && <FilterIndicators filters={activeFilters} onClearAll={clearAllFilters} className="px-1 py-1" />}

        {/* Paginated table */}
        <div className="flex-1 min-h-0 overflow-auto">
          <UserPositionHistoryTable visibleColumns={visibleColumns} onViewDetails={setDetailDialog} filters={queryFilters} className="h-full" />
        </div>
      </CardContent>

      {/* Enhanced Filter Modal */}
      <UserPositionHistoryFilters open={showFilterModal} onOpenChange={setShowFilterModal} filters={filters} onFilterChange={handleFilterChange} />

      {/* Detail Dialog */}
      <UserPositionHistoryDetailDialog history={detailDialog} onOpenChange={(open) => !open && setDetailDialog(null)} />
    </Card>
  );
}
