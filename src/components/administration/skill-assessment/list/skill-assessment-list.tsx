import { useState, useCallback, useMemo } from "react";
import { IconFilter } from "@tabler/icons-react";

import type { Assessment, AssessmentGetManyFormData } from "../../../../types";
import { ASSESSMENT_STATUS, ASSESSMENT_STATUS_LABELS } from "../../../../constants";
import { cn } from "@/lib/utils";
import { useTableState } from "@/hooks/common/use-table-state";
import { useTableFilters } from "@/hooks/common/use-table-filters";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { ShowSelectedToggle } from "@/components/ui/show-selected-toggle";
import { FilterIndicators } from "@/components/ui/filter-indicator";
import { SkillAssessmentTable } from "./skill-assessment-table";
import {
  SkillAssessmentFilters,
  type SkillAssessmentFiltersValue,
} from "./skill-assessment-filters";

interface SkillAssessmentListProps {
  className?: string;
  onDataUpdate?: (data: { assessments: Assessment[]; totalRecords: number }) => void;
}

const DEFAULT_PAGE_SIZE = 40;

export function SkillAssessmentList({ onDataUpdate, className }: SkillAssessmentListProps) {
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [_tableData, setTableData] = useState<{ assessments: Assessment[]; totalRecords: number }>({
    assessments: [],
    totalRecords: 0,
  });

  const { showSelectedOnly, toggleShowSelectedOnly, selectionCount } = useTableState({
    defaultPageSize: DEFAULT_PAGE_SIZE,
  });

  const handleTableDataChange = useCallback(
    (data: { assessments: Assessment[]; totalRecords: number }) => {
      setTableData(data);
      onDataUpdate?.(data);
    },
    [onDataUpdate],
  );

  const serialize = useCallback((filters: Partial<AssessmentGetManyFormData>): Record<string, string> => {
    const params: Record<string, string> = {};
    if (filters.status) params.status = filters.status as string;
    return params;
  }, []);

  const deserialize = useCallback((search: URLSearchParams): Partial<AssessmentGetManyFormData> => {
    const out: Partial<AssessmentGetManyFormData> = {};
    const status = search.get("status");
    if (status) out.status = status as ASSESSMENT_STATUS;
    return out;
  }, []);

  const {
    filters,
    setFilters,
    searchingFor,
    displaySearchText,
    setSearch,
    clearAllFilters,
    queryFilters: baseQueryFilters,
    hasActiveFilters,
  } = useTableFilters<AssessmentGetManyFormData>({
    defaultFilters: { limit: DEFAULT_PAGE_SIZE },
    searchDebounceMs: 500,
    searchParamName: "search",
    serializeToUrl: serialize,
    deserializeFromUrl: deserialize,
    excludeFromUrl: ["limit", "orderBy"],
  });

  const queryFilters = useMemo(() => {
    const { orderBy: _, ...rest } = baseQueryFilters;
    return { ...rest, limit: DEFAULT_PAGE_SIZE };
  }, [baseQueryFilters]);

  const handleFiltersApply = (newFilters: SkillAssessmentFiltersValue) => {
    setFilters({ ...filters, status: newFilters.status });
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

    if (filters.status) {
      out.push({
        key: "status",
        label: "Status",
        value:
          ASSESSMENT_STATUS_LABELS[filters.status as ASSESSMENT_STATUS] ?? String(filters.status),
        onRemove: () => setFilters({ ...filters, status: undefined }),
      });
    }

    return out;
  }, [searchingFor, filters, setSearch, setFilters]);

  return (
    <Card className={cn("flex flex-col shadow-sm border border-border", className)}>
      <CardContent className="flex-1 flex flex-col p-4 space-y-4 overflow-hidden">
        <div className="flex flex-col sm:flex-row gap-3">
          <TableSearchInput
            value={displaySearchText}
            onChange={setSearch}
            placeholder="Buscar avaliações..."
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
          <SkillAssessmentTable
            filters={queryFilters}
            onDataChange={handleTableDataChange}
            className="h-full"
          />
        </div>
      </CardContent>

      <SkillAssessmentFilters
        open={isFilterModalOpen}
        onOpenChange={setIsFilterModalOpen}
        onApply={handleFiltersApply}
        current={{ status: filters.status as ASSESSMENT_STATUS | undefined }}
      />
    </Card>
  );
}
