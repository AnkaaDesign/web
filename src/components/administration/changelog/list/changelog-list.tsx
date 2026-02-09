import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IconSearch, IconFilter, IconRefresh } from "@tabler/icons-react";
import { useChangeLogs } from "../../../../hooks";
import { useTableState } from "@/hooks/common/use-table-state";
import { useColumnVisibility } from "@/hooks/common/use-column-visibility";
import { debounce } from "lodash";
import { ChangelogTable } from "./changelog-table";
import { ChangelogFilters } from "./changelog-filters";
import { ColumnVisibilityManager } from "./column-visibility-manager";
import { FilterIndicators } from "./filter-indicators";
import { getDefaultVisibleColumns, createChangelogColumns } from "./changelog-table-columns";
import { cn } from "@/lib/utils";
import { type ChangeLogGetManyFormData } from "../../../../schemas";
import type { ChangeLog } from "../../../../types";

// Define props interface directly to avoid import issues
interface ChangelogListProps {
  className?: string;
  onDataChange?: (data: { items: ChangeLog[]; totalRecords: number }) => void;
}

export function ChangelogList({ className, onDataChange }: ChangelogListProps) {
  const [searchParams, setSearchParams] = useSearchParams();

  // State management
  const [displaySearchText, setDisplaySearchText] = useState(searchParams.get("search") || "");
  const [showFilterModal, setShowFilterModal] = useState(false);
  const { visibleColumns, setVisibleColumns } = useColumnVisibility(
    "changelog-list-visible-columns",
    getDefaultVisibleColumns()
  );

  const { page, pageSize, selectedIds, sortConfigs, showSelectedOnly } = useTableState({
    defaultPageSize: 40,
    resetSelectionOnPageChange: false,
  });

  // Parse filters from URL
  const getFiltersFromUrl = (): Partial<ChangeLogGetManyFormData> => {
    const filters: Partial<ChangeLogGetManyFormData> = {};

    const search = searchParams.get("search");
    if (search) filters.searchingFor = search;

    const entityTypes = searchParams.get("entityTypes");
    if (entityTypes) filters.entityTypes = entityTypes.split(",");

    const actions = searchParams.get("actions");
    if (actions) filters.actions = actions.split(",");

    const userIds = searchParams.get("userIds");
    if (userIds) filters.userIds = userIds.split(",");

    const hasUser = searchParams.get("hasUser");
    if (hasUser !== null) filters.hasUser = hasUser === "true";

    const hasField = searchParams.get("hasField");
    if (hasField !== null) filters.hasField = hasField === "true";

    const hasReason = searchParams.get("hasReason");
    if (hasReason !== null) filters.hasReason = hasReason === "true";

    const createdAtFrom = searchParams.get("createdAtFrom");
    const createdAtTo = searchParams.get("createdAtTo");
    if (createdAtFrom || createdAtTo) {
      filters.createdAt = {};
      if (createdAtFrom) filters.createdAt.gte = new Date(createdAtFrom);
      if (createdAtTo) filters.createdAt.lte = new Date(createdAtTo);
    }

    const triggeredBy = searchParams.get("triggeredBy");
    if (triggeredBy) filters.triggeredBy = triggeredBy.split(",");

    return filters;
  };

  const filters = useMemo(() => getFiltersFromUrl(), [searchParams]);

  // Update URL when filters change
  const updateUrlFilters = useCallback(
    (newFilters: Partial<ChangeLogGetManyFormData>) => {
      const params = new URLSearchParams();

      if (newFilters.searchingFor) params.set("search", newFilters.searchingFor);
      if (newFilters.entityTypes?.length) params.set("entityTypes", newFilters.entityTypes.join(","));
      if (newFilters.actions?.length) params.set("actions", newFilters.actions.join(","));
      if (newFilters.userIds?.length) params.set("userIds", newFilters.userIds.join(","));
      if (newFilters.hasUser !== undefined) params.set("hasUser", String(newFilters.hasUser));
      if (newFilters.hasField !== undefined) params.set("hasField", String(newFilters.hasField));
      if (newFilters.hasReason !== undefined) params.set("hasReason", String(newFilters.hasReason));
      if (newFilters.createdAt?.gte) params.set("createdAtFrom", newFilters.createdAt.gte.toISOString());
      if (newFilters.createdAt?.lte) params.set("createdAtTo", newFilters.createdAt.lte.toISOString());
      if (newFilters.triggeredBy?.length) params.set("triggeredBy", newFilters.triggeredBy.join(","));

      setSearchParams(params);
    },
    [setSearchParams],
  );

  // Debounced search
  const debouncedSearch = useMemo(
    () =>
      debounce((value: string) => {
        const newFilters = { ...filters };
        if (value) {
          newFilters.searchingFor = value;
        } else {
          delete newFilters.searchingFor;
        }
        updateUrlFilters(newFilters);
      }, 300),
    [filters, updateUrlFilters],
  );

  const handleSearch = useCallback(
    (value: string) => {
      setDisplaySearchText(value);
      debouncedSearch(value);
    },
    [debouncedSearch],
  );

  const handleFiltersChange = (newFilters: Record<string, any>) => {
    updateUrlFilters(newFilters);
  };

  const handleRemoveFilter = (key: string, value?: any) => {
    const newFilters = { ...filters };

    if (value !== undefined) {
      // Remove specific value from array
      if (Array.isArray(newFilters[key])) {
        newFilters[key] = newFilters[key].filter((v: any) => v !== value);
        if (newFilters[key].length === 0) {
          delete newFilters[key];
        }
      }
    } else {
      // Remove entire filter
      delete newFilters[key];
    }

    updateUrlFilters(newFilters);
  };

  const resetFilters = () => {
    setDisplaySearchText("");
    setSearchParams(new URLSearchParams());
  };

  // Build query parameters
  const queryParams = useMemo(() => {
    const params: ChangeLogGetManyFormData = {
      ...filters,
      page: page + 1, // Convert to 1-based for API
      limit: pageSize,
      orderBy:
        sortConfigs.length > 0
          ? sortConfigs.reduce(
              (acc, config) => {
                acc[config.column] = config.direction;
                return acc;
              },
              {} as Record<string, "asc" | "desc">,
            )
          : { createdAt: "desc" },
      include: {
        user: true,
      },
    };

    if (showSelectedOnly && selectedIds.length > 0) {
      params.where = {
        ...params.where,
        id: { in: selectedIds },
      };
    }

    return params;
  }, [filters, page, pageSize, sortConfigs, showSelectedOnly, selectedIds]);

  // Fetch data
  const { data: response, refetch } = useChangeLogs(queryParams);

  const changelogs = response?.data || [];
  const totalRecords = response?.meta?.totalRecords || 0;

  // Update parent component
  useEffect(() => {
    if (onDataChange && changelogs) {
      onDataChange({ items: changelogs, totalRecords });
    }
  }, [changelogs, totalRecords, onDataChange]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.searchingFor) count++;
    if (filters.entityTypes?.length) count += filters.entityTypes.length;
    if (filters.actions?.length) count += filters.actions.length;
    if (filters.userIds?.length) count += filters.userIds.length;
    if (filters.hasUser !== undefined) count++;
    if (filters.hasField !== undefined) count++;
    if (filters.hasReason !== undefined) count++;
    if (filters.createdAt) count++;
    if (filters.triggeredBy?.length) count += filters.triggeredBy.length;
    return count;
  }, [filters]);

  const hasActiveFilters = useMemo(() => {
    return activeFilterCount > 0;
  }, [activeFilterCount]);

  const columns = useMemo(() => createChangelogColumns(), []);

  return (
    <Card className={cn("flex flex-col shadow-sm border border-border", className)}>
      <CardContent className="flex-1 flex flex-col p-4 space-y-4 overflow-hidden pb-6">
        {/* Search and Controls */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex-1 relative">
            <IconSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              type="text"
              placeholder="Buscar por entidade, ação, campo, motivo ou usuário..."
              value={displaySearchText}
              onChange={(value: string | number | null) => handleSearch(value as string)}
              transparent={true}
              className="pl-10"
            />
          </div>

          <div className="flex gap-2">
            <Button variant={hasActiveFilters ? "default" : "outline"} size="default" onClick={() => setShowFilterModal(true)}>
              <IconFilter className="h-4 w-4" />
              <span>
                Filtros
                {hasActiveFilters ? ` (${activeFilterCount})` : ""}
              </span>
            </Button>

            <ColumnVisibilityManager columns={columns} visibleColumns={visibleColumns} onVisibilityChange={setVisibleColumns} />

            <Button variant="outline" size="icon" onClick={() => refetch()} title="Atualizar">
              <IconRefresh className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Active Filters */}
        {activeFilterCount > 0 && <FilterIndicators filters={filters} onRemoveFilter={handleRemoveFilter} onClearAll={resetFilters} />}

        {/* Table with integrated pagination */}
        <div className="flex-1 min-h-0 overflow-auto">
          <ChangelogTable
            visibleColumns={visibleColumns}
            className="h-full"
            filters={queryParams}
            onDataChange={({ items, totalRecords }) => {
              if (onDataChange) {
                onDataChange({ items, totalRecords });
              }
            }}
          />
        </div>
      </CardContent>

      {/* Modals */}
      <ChangelogFilters isOpen={showFilterModal} onClose={() => setShowFilterModal(false)} filters={filters} onFiltersChange={handleFiltersChange} onReset={resetFilters} />
    </Card>
  );
}
