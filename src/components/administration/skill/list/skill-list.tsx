import { useState, useCallback, useMemo } from "react";
import { IconFilter } from "@tabler/icons-react";

import type { Skill, SkillGetManyFormData } from "../../../../types";
import { cn } from "@/lib/utils";
import { useTableState } from "@/hooks/common/use-table-state";
import { useTableFilters } from "@/hooks/common/use-table-filters";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { ShowSelectedToggle } from "@/components/ui/show-selected-toggle";
import { FilterIndicators } from "@/components/ui/filter-indicator";
import { SkillTable } from "./skill-table";
import { SkillFilters, type SkillFiltersValue } from "./skill-filters";

interface SkillListProps {
  className?: string;
  onDataUpdate?: (data: { skills: Skill[]; totalRecords: number }) => void;
}

const DEFAULT_PAGE_SIZE = 40;

export function SkillList({ onDataUpdate, className }: SkillListProps) {
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [_tableData, setTableData] = useState<{ skills: Skill[]; totalRecords: number }>({
    skills: [],
    totalRecords: 0,
  });

  const { showSelectedOnly, toggleShowSelectedOnly, selectionCount } = useTableState({
    defaultPageSize: DEFAULT_PAGE_SIZE,
  });

  const handleTableDataChange = useCallback(
    (data: { skills: Skill[]; totalRecords: number }) => {
      setTableData(data);
      onDataUpdate?.(data);
    },
    [onDataUpdate],
  );

  // URL serializer / deserializer for the skill-specific filters
  const serializeSkillFilters = useCallback((filters: Partial<SkillGetManyFormData>): Record<string, string> => {
    const params: Record<string, string> = {};
    if (filters.isActive !== undefined) params.isActive = String(filters.isActive);
    return params;
  }, []);

  const deserializeSkillFilters = useCallback(
    (search: URLSearchParams): Partial<SkillGetManyFormData> => {
      const out: Partial<SkillGetManyFormData> = {};
      const isActive = search.get("isActive");
      if (isActive === "true") out.isActive = true;
      else if (isActive === "false") out.isActive = false;
      return out;
    },
    [],
  );

  const {
    filters,
    setFilters,
    searchingFor,
    displaySearchText,
    setSearch,
    clearAllFilters,
    queryFilters: baseQueryFilters,
    hasActiveFilters,
  } = useTableFilters<SkillGetManyFormData>({
    defaultFilters: { limit: DEFAULT_PAGE_SIZE },
    searchDebounceMs: 500,
    searchParamName: "search",
    serializeToUrl: serializeSkillFilters,
    deserializeFromUrl: deserializeSkillFilters,
    excludeFromUrl: ["limit", "orderBy"],
  });

  const queryFilters = useMemo(() => {
    const { orderBy: _, ...rest } = baseQueryFilters;
    return { ...rest, limit: DEFAULT_PAGE_SIZE };
  }, [baseQueryFilters]);

  const handleFiltersApply = (newFilters: SkillFiltersValue) => {
    setFilters({
      ...filters,
      isActive: newFilters.isActive,
    });
    setIsFilterModalOpen(false);
  };

  const activeFilters = useMemo(() => {
    const out: Array<{ key: string; label: string; value: string; onRemove: () => void }> = [];

    if (searchingFor) {
      out.push({
        key: "searchingFor",
        label: "Busca",
        value: searchingFor,
        onRemove: () => setSearch(""),
      });
    }

    if (filters.isActive === true) {
      out.push({
        key: "isActive",
        label: "Status",
        value: "Somente ativas",
        onRemove: () => setFilters({ ...filters, isActive: undefined }),
      });
    } else if (filters.isActive === false) {
      out.push({
        key: "isActive",
        label: "Status",
        value: "Somente inativas",
        onRemove: () => setFilters({ ...filters, isActive: undefined }),
      });
    }

    return out;
  }, [searchingFor, filters, setSearch, setFilters]);

  return (
    <Card className={cn("flex flex-col shadow-sm border border-border", className)}>
      <CardContent className="flex-1 flex flex-col p-4 space-y-4 overflow-hidden">
        {/* Search and Controls */}
        <div className="flex flex-col sm:flex-row gap-3">
          <TableSearchInput
            value={displaySearchText}
            onChange={setSearch}
            placeholder="Buscar competências..."
            isPending={displaySearchText !== searchingFor}
          />
          <div className="flex gap-2">
            <ShowSelectedToggle
              showSelectedOnly={showSelectedOnly}
              onToggle={toggleShowSelectedOnly}
              selectionCount={selectionCount}
            />
            <Button
              variant={hasActiveFilters ? "default" : "outline"}
              size="default"
              onClick={() => setIsFilterModalOpen(true)}
            >
              <IconFilter className="h-4 w-4 mr-2" />
              {hasActiveFilters ? `Filtros (${activeFilters.length})` : "Filtros"}
            </Button>
          </div>
        </div>

        {/* Active Filters */}
        {activeFilters.length > 0 && (
          <FilterIndicators
            filters={activeFilters}
            onClearAll={activeFilters.length > 1 ? clearAllFilters : undefined}
          />
        )}

        {/* Table */}
        <div className="flex-1 min-h-0 overflow-auto">
          <SkillTable filters={queryFilters} onDataChange={handleTableDataChange} className="h-full" />
        </div>
      </CardContent>

      <SkillFilters
        open={isFilterModalOpen}
        onOpenChange={setIsFilterModalOpen}
        onApply={handleFiltersApply}
        current={{ isActive: filters.isActive }}
      />
    </Card>
  );
}
