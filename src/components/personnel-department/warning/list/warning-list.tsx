import { useState, useCallback, useMemo } from "react";
import { IconFilter } from "@tabler/icons-react";

import type { Warning, WarningGetManyResponse } from "../../../../types";
import type { WarningGetManyFormData } from "../../../../schemas";
import { WARNING_SEVERITY, WARNING_CATEGORY, WARNING_SEVERITY_LABELS, WARNING_CATEGORY_LABELS } from "../../../../constants";
import { cn } from "@/lib/utils";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { ShowSelectedToggle } from "@/components/ui/show-selected-toggle";
import { FilterIndicators } from "@/components/ui/filter-indicator";
import { useTableState } from "@/hooks/common/use-table-state";
import { useTableFilters } from "@/hooks/common/use-table-filters";
import { WarningTable } from "./warning-table";
import { WarningFilters } from "./warning-filters";

interface WarningListProps {
  selectedSeverity?: WARNING_SEVERITY;
  onDataUpdate?: (data: Warning[], meta?: WarningGetManyResponse["meta"]) => void;
  className?: string;
  teamScope?: boolean;
}

const DEFAULT_PAGE_SIZE = 40;

// Normalize a where-clause string filter (string | { in: [...] }) to a string array
function whereToArray(value: unknown): string[] {
  if (!value) return [];
  if (typeof value === "string") return [value];
  if (typeof value === "object" && value !== null && Array.isArray((value as any).in)) {
    return (value as any).in as string[];
  }
  return [];
}

export function WarningList({ selectedSeverity, onDataUpdate, className, teamScope }: WarningListProps) {
  const [_tableData, setTableData] = useState<{ warnings: Warning[]; totalRecords: number }>({ warnings: [], totalRecords: 0 });
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

  // Use the standardized table state hook
  const { showSelectedOnly, toggleShowSelectedOnly, selectionCount } = useTableState({
    defaultPageSize: DEFAULT_PAGE_SIZE,
    defaultSort: [{ column: "followUpDate", direction: "desc" }],
  });

  // Stable callback for table data updates
  const handleTableDataChange = useCallback((data: { warnings: Warning[]; totalRecords: number }) => {
    setTableData(data);
  }, []);

  // Custom deserializer for warning filters
  const deserializeWarningFilters = useCallback((params: URLSearchParams): Partial<WarningGetManyFormData> => {
    const filters: Partial<WarningGetManyFormData> = {};

    // Parse severity filter (comma-separated multi-select)
    const severity = params.get("severity");
    if (severity) {
      const severities = severity.split(",").filter(Boolean);
      if (severities.length > 0) {
        filters.where = { ...filters.where, severity: { in: severities as WARNING_SEVERITY[] } };
      }
    }

    // Parse category filter (comma-separated multi-select)
    const category = params.get("category");
    if (category) {
      const categories = category.split(",").filter(Boolean);
      if (categories.length > 0) {
        filters.where = { ...filters.where, category: { in: categories as WARNING_CATEGORY[] } };
      }
    }

    // Parse isActive filter
    const isActive = params.get("isActive");
    if (isActive !== null) {
      filters.where = { ...filters.where, isActive: isActive === "true" };
    }

    return filters;
  }, []);

  // Custom serializer for warning filters
  const serializeWarningFilters = useCallback((filters: Partial<WarningGetManyFormData>): Record<string, string> => {
    const params: Record<string, string> = {};

    // Severity filter (multi-select serialized as comma-separated)
    const severityValues = whereToArray(filters.where?.severity);
    if (severityValues.length > 0) {
      params.severity = severityValues.join(",");
    }

    // Category filter (multi-select serialized as comma-separated)
    const categoryValues = whereToArray(filters.where?.category);
    if (categoryValues.length > 0) {
      params.category = categoryValues.join(",");
    }

    // IsActive filter
    if (typeof filters.where?.isActive === "boolean") {
      params.isActive = String(filters.where.isActive);
    }

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
  } = useTableFilters<WarningGetManyFormData>({
    defaultFilters: {
      limit: DEFAULT_PAGE_SIZE,
      ...(selectedSeverity && {
        where: { severity: selectedSeverity },
      }),
    },
    searchDebounceMs: 500,
    searchParamName: "searchingFor",
    serializeToUrl: serializeWarningFilters,
    deserializeFromUrl: deserializeWarningFilters,
    excludeFromUrl: ["limit", "orderBy"],
  });

  // Query filters to pass to the table
  const queryFilters = useMemo(() => {
    const { orderBy: _, ...filterWithoutOrderBy } = baseQueryFilters;

    return {
      ...filterWithoutOrderBy,
      limit: DEFAULT_PAGE_SIZE,
      ...(teamScope && { _useTeamStaffEndpoint: true }),
    };
  }, [baseQueryFilters, teamScope]);

  // Handle filter changes
  const handleFilterChange = useCallback(
    (newFilters: Partial<WarningGetManyFormData>) => {
      // Remove orderBy from filters to avoid conflicts with sort management
      const { orderBy: _, ...filtersWithoutOrderBy } = newFilters;
      setFilters(filtersWithoutOrderBy);
    },
    [setFilters],
  );

  const handleFiltersApply = useCallback(
    (newFilters: {
      severities?: WARNING_SEVERITY[];
      categories?: WARNING_CATEGORY[];
      isActive?: boolean;
      collaboratorIds?: string[];
      supervisorIds?: string[];
      witnessIds?: string[];
    }) => {
      const hasSeverities = !!newFilters.severities && newFilters.severities.length > 0;
      const hasCategories = !!newFilters.categories && newFilters.categories.length > 0;

      const updatedFilters: Partial<WarningGetManyFormData> = {
        ...filters,
        where: {
          ...filters.where,
          ...(hasSeverities && { severity: { in: newFilters.severities } }),
          ...(hasCategories && { category: { in: newFilters.categories } }),
          ...(typeof newFilters.isActive === "boolean" && { isActive: newFilters.isActive }),
        },
        // Add array filters at the top level (schema transforms them to where clauses)
        collaboratorIds: newFilters.collaboratorIds,
        supervisorIds: newFilters.supervisorIds,
        witnessIds: newFilters.witnessIds,
      };

      // Remove undefined values from where clause
      if (updatedFilters.where) {
        if (!hasSeverities) {
          delete updatedFilters.where.severity;
        }
        if (!hasCategories) {
          delete updatedFilters.where.category;
        }
        if (typeof newFilters.isActive !== "boolean") {
          delete updatedFilters.where.isActive;
        }

        // Remove empty where clause
        if (Object.keys(updatedFilters.where).length === 0) {
          delete updatedFilters.where;
        }
      }

      handleFilterChange(updatedFilters);
      setIsFilterModalOpen(false);
    },
    [filters, handleFilterChange],
  );

  const onRemoveFilter = useCallback(
    (key: string) => {
      if (key === "searchingFor") {
        setSearch("");
      } else if (key === "collaboratorIds" || key === "supervisorIds" || key === "witnessIds") {
        // Handle array filters at top level
        const updatedFilters = { ...filters };
        delete updatedFilters[key as keyof typeof updatedFilters];
        handleFilterChange(updatedFilters);
      } else {
        const updatedFilters = { ...filters };
        if (updatedFilters.where) {
          delete updatedFilters.where[key as keyof typeof updatedFilters.where];

          // Remove empty where clause
          if (Object.keys(updatedFilters.where).length === 0) {
            delete updatedFilters.where;
          }
        }
        handleFilterChange(updatedFilters);
      }
    },
    [filters, handleFilterChange, setSearch],
  );

  // Build active filters array
  const activeFilters = useMemo(() => {
    const activeFiltersArray = [];

    if (searchingFor) {
      activeFiltersArray.push({
        key: "searchingFor",
        label: "Busca",
        value: searchingFor,
        onRemove: () => onRemoveFilter("searchingFor"),
      });
    }

    const severityValues = whereToArray(filters.where?.severity);
    if (severityValues.length > 0) {
      activeFiltersArray.push({
        key: "severity",
        label: "Severidade",
        value: severityValues.map((s) => WARNING_SEVERITY_LABELS[s as WARNING_SEVERITY] || s).join(", "),
        onRemove: () => onRemoveFilter("severity"),
      });
    }

    const categoryValues = whereToArray(filters.where?.category);
    if (categoryValues.length > 0) {
      activeFiltersArray.push({
        key: "category",
        label: "Categoria",
        value: categoryValues.map((c) => WARNING_CATEGORY_LABELS[c as WARNING_CATEGORY] || c).join(", "),
        onRemove: () => onRemoveFilter("category"),
      });
    }

    if (typeof filters.where?.isActive === "boolean") {
      activeFiltersArray.push({
        key: "isActive",
        label: "Status",
        value: filters.where.isActive ? "Ativas" : "Resolvidas",
        onRemove: () => onRemoveFilter("isActive"),
      });
    }

    if (filters.collaboratorIds && filters.collaboratorIds.length > 0) {
      activeFiltersArray.push({
        key: "collaboratorIds",
        label: "Colaboradores",
        value: `${filters.collaboratorIds.length} selecionado${filters.collaboratorIds.length > 1 ? "s" : ""}`,
        onRemove: () => onRemoveFilter("collaboratorIds"),
      });
    }

    if (filters.supervisorIds && filters.supervisorIds.length > 0) {
      activeFiltersArray.push({
        key: "supervisorIds",
        label: "Supervisores",
        value: `${filters.supervisorIds.length} selecionado${filters.supervisorIds.length > 1 ? "s" : ""}`,
        onRemove: () => onRemoveFilter("supervisorIds"),
      });
    }

    if (filters.witnessIds && filters.witnessIds.length > 0) {
      activeFiltersArray.push({
        key: "witnessIds",
        label: "Testemunhas",
        value: `${filters.witnessIds.length} selecionada${filters.witnessIds.length > 1 ? "s" : ""}`,
        onRemove: () => onRemoveFilter("witnessIds"),
      });
    }

    return activeFiltersArray;
  }, [searchingFor, filters.where, filters.collaboratorIds, filters.supervisorIds, filters.witnessIds, onRemoveFilter]);

  // Handle data update
  const handleDataChange = useCallback(
    (data: { warnings: Warning[]; totalRecords: number }) => {
      handleTableDataChange(data);
      if (onDataUpdate) {
        const meta = {
          totalRecords: data.totalRecords,
          page: 1,
          take: DEFAULT_PAGE_SIZE,
          totalPages: Math.ceil(data.totalRecords / DEFAULT_PAGE_SIZE),
          hasNextPage: false,
          hasPreviousPage: false,
        };
        onDataUpdate(data.warnings, meta);
      }
    },
    [handleTableDataChange, onDataUpdate],
  );

  return (
    <Card className={cn("flex flex-col shadow-sm border border-border", className)}>
      <CardContent className="flex-1 flex flex-col p-4 space-y-4 overflow-hidden">
        {/* Search and Controls */}
        <div className="flex flex-col sm:flex-row gap-3">
          <TableSearchInput value={displaySearchText} onChange={setSearch} placeholder="Buscar advertências..." isPending={displaySearchText !== searchingFor} />
          <div className="flex gap-2">
            <ShowSelectedToggle showSelectedOnly={showSelectedOnly} onToggle={toggleShowSelectedOnly} selectionCount={selectionCount} />
            <Button
              variant={hasActiveFilters ? "default" : "outline"}
              size="default"
              onClick={() => setIsFilterModalOpen(true)}
              className="group"
            >
              <IconFilter className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              <span className="text-foreground">
                Filtros
                {hasActiveFilters ? ` (${activeFilters.length})` : ""}
              </span>
            </Button>
          </div>
        </div>

        {/* Active Filters */}
        {activeFilters.length > 0 && <FilterIndicators filters={activeFilters} onClearAll={activeFilters.length > 1 ? clearAllFilters : undefined} />}

        {/* Table with integrated pagination */}
        <div className="flex-1 min-h-0 overflow-auto">
          <WarningTable filters={queryFilters} onDataChange={handleDataChange} className="h-full" />
        </div>
      </CardContent>

      {/* Filters Modal */}
      <WarningFilters
        open={isFilterModalOpen}
        onOpenChange={setIsFilterModalOpen}
        onApply={handleFiltersApply}
        currentSeverities={whereToArray(filters.where?.severity) as WARNING_SEVERITY[]}
        currentCategories={whereToArray(filters.where?.category) as WARNING_CATEGORY[]}
        currentIsActive={filters.where?.isActive}
        currentCollaboratorIds={filters.collaboratorIds}
        currentSupervisorIds={filters.supervisorIds}
        currentWitnessIds={filters.witnessIds}
      />
    </Card>
  );
}
