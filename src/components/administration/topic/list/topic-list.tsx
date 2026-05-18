import { useState, useCallback, useMemo } from "react";
import { IconFilter } from "@tabler/icons-react";

import type { Topic, TopicGetManyFormData } from "../../../../types";
import { useSkills } from "../../../../hooks";
import { cn } from "@/lib/utils";
import { useTableState } from "@/hooks/common/use-table-state";
import { useTableFilters } from "@/hooks/common/use-table-filters";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { ShowSelectedToggle } from "@/components/ui/show-selected-toggle";
import { FilterIndicators } from "@/components/ui/filter-indicator";
import { TopicTable } from "./topic-table";
import { TopicFilters, type TopicFiltersValue } from "./topic-filters";

interface TopicListProps {
  className?: string;
  onDataUpdate?: (data: { topics: Topic[]; totalRecords: number }) => void;
}

const DEFAULT_PAGE_SIZE = 40;

export function TopicList({ onDataUpdate, className }: TopicListProps) {
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [_tableData, setTableData] = useState<{ topics: Topic[]; totalRecords: number }>({
    topics: [],
    totalRecords: 0,
  });

  // Fetch skills once for the chip label
  const { data: skillsData } = useSkills({ limit: 200, orderBy: { order: "asc" } });

  const skillNameById = useMemo(() => {
    const map = new Map<string, string>();
    (skillsData?.data ?? []).forEach((s) => {
      map.set(s.id, s.name);
    });
    return map;
  }, [skillsData]);

  const { showSelectedOnly, toggleShowSelectedOnly, selectionCount } = useTableState({
    defaultPageSize: DEFAULT_PAGE_SIZE,
  });

  const handleTableDataChange = useCallback(
    (data: { topics: Topic[]; totalRecords: number }) => {
      setTableData(data);
      onDataUpdate?.(data);
    },
    [onDataUpdate],
  );

  const serializeTopicFilters = useCallback((filters: Partial<TopicGetManyFormData>): Record<string, string> => {
    const params: Record<string, string> = {};
    if (filters.skillId) params.skillId = filters.skillId;
    if (filters.isActive !== undefined) params.isActive = String(filters.isActive);
    return params;
  }, []);

  const deserializeTopicFilters = useCallback(
    (search: URLSearchParams): Partial<TopicGetManyFormData> => {
      const out: Partial<TopicGetManyFormData> = {};
      const skillId = search.get("skillId");
      if (skillId) out.skillId = skillId;
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
  } = useTableFilters<TopicGetManyFormData>({
    defaultFilters: { limit: DEFAULT_PAGE_SIZE },
    searchDebounceMs: 500,
    searchParamName: "search",
    serializeToUrl: serializeTopicFilters,
    deserializeFromUrl: deserializeTopicFilters,
    excludeFromUrl: ["limit", "orderBy"],
  });

  const queryFilters = useMemo(() => {
    const { orderBy: _, ...rest } = baseQueryFilters;
    return { ...rest, limit: DEFAULT_PAGE_SIZE };
  }, [baseQueryFilters]);

  const handleFiltersApply = (newFilters: TopicFiltersValue) => {
    setFilters({
      ...filters,
      skillId: newFilters.skillId,
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

    if (filters.skillId) {
      out.push({
        key: "skillId",
        label: "Competência",
        value: skillNameById.get(filters.skillId) ?? filters.skillId,
        onRemove: () => setFilters({ ...filters, skillId: undefined }),
      });
    }

    if (filters.isActive === true) {
      out.push({
        key: "isActive",
        label: "Status",
        value: "Somente ativos",
        onRemove: () => setFilters({ ...filters, isActive: undefined }),
      });
    } else if (filters.isActive === false) {
      out.push({
        key: "isActive",
        label: "Status",
        value: "Somente inativos",
        onRemove: () => setFilters({ ...filters, isActive: undefined }),
      });
    }

    return out;
  }, [searchingFor, filters, setSearch, setFilters, skillNameById]);

  return (
    <Card className={cn("flex flex-col shadow-sm border border-border", className)}>
      <CardContent className="flex-1 flex flex-col p-4 space-y-4 overflow-hidden">
        <div className="flex flex-col sm:flex-row gap-3">
          <TableSearchInput
            value={displaySearchText}
            onChange={setSearch}
            placeholder="Buscar tópicos..."
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

        {activeFilters.length > 0 && (
          <FilterIndicators
            filters={activeFilters}
            onClearAll={activeFilters.length > 1 ? clearAllFilters : undefined}
          />
        )}

        <div className="flex-1 min-h-0 overflow-auto">
          <TopicTable filters={queryFilters} onDataChange={handleTableDataChange} className="h-full" />
        </div>
      </CardContent>

      <TopicFilters
        open={isFilterModalOpen}
        onOpenChange={setIsFilterModalOpen}
        onApply={handleFiltersApply}
        current={{ skillId: filters.skillId, isActive: filters.isActive }}
      />
    </Card>
  );
}
