import { useRef, useMemo, useState, useCallback } from "react";
import { usePositions, useSectors } from "../../../../hooks";
import type { UserGetManyFormData } from "../../../../schemas";
import { USER_STATUS } from "../../../../constants";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { cn } from "@/lib/utils";
import { IconFilter } from "@tabler/icons-react";
import { PpeSizesTable, createPpeSizeColumns, DEFAULT_PPE_SIZE_VISIBLE_COLUMNS } from "./ppe-sizes-table";
import { PpeSizesFilters } from "./ppe-sizes-filters";
import { PpeSizesColumnVisibility } from "./ppe-sizes-column-visibility";
import { useTableFilters } from "@/hooks/common/use-table-filters";
import { useColumnVisibility } from "@/hooks/common/use-column-visibility";
import { FilterIndicators as StandardFilterIndicators } from "@/components/ui/filter-indicator";
import { USER_STATUS_LABELS } from "../../../../constants";
import {
  SHIRT_SIZE_LABELS,
  PANTS_SIZE_LABELS,
  BOOT_SIZE_LABELS,
  SLEEVES_SIZE_LABELS,
  MASK_SIZE_LABELS,
  GLOVES_SIZE_LABELS,
  RAIN_BOOTS_SIZE_LABELS,
} from "../../../../constants";

const SIZE_FIELD_LABELS: Record<string, string> = {
  shirts: "Camisa",
  pants: "Calça",
  boots: "Bota",
  sleeves: "Manguito",
  mask: "Máscara",
  gloves: "Luva",
  rainBoots: "Galocha",
};

const SIZE_LABEL_MAPS: Record<string, Record<string, string>> = {
  shirts: SHIRT_SIZE_LABELS,
  pants: PANTS_SIZE_LABELS,
  boots: BOOT_SIZE_LABELS,
  sleeves: SLEEVES_SIZE_LABELS,
  mask: MASK_SIZE_LABELS,
  gloves: GLOVES_SIZE_LABELS,
  rainBoots: RAIN_BOOTS_SIZE_LABELS,
};

interface PpeSizesListProps {
  className?: string;
}

const DEFAULT_PAGE_SIZE = 40;

// Custom serializer for PPE size filters to URL
const serializePpeSizeFilters = (filters: Partial<UserGetManyFormData>): Record<string, string> => {
  const params: Record<string, string> = {};

  if (filters.status?.length) params.statuses = filters.status.join(",");
  if (filters.positionId?.length) params.positions = filters.positionId.join(",");
  if (filters.sectorId?.length) params.sectors = filters.sectorId.join(",");

  // PPE size filters
  const ppeSizeFilters = (filters as any).ppeSizeFilters;
  if (ppeSizeFilters) {
    Object.entries(ppeSizeFilters).forEach(([key, values]) => {
      if (Array.isArray(values) && values.length > 0) {
        params[`ppe_${key}`] = (values as string[]).join(",");
      }
    });
  }

  return params;
};

// Custom deserializer from URL to filters
const deserializePpeSizeFilters = (params: URLSearchParams): Partial<UserGetManyFormData> => {
  const filters: any = {};

  const statuses = params.get("statuses");
  if (statuses) filters.status = statuses.split(",");

  const positions = params.get("positions");
  if (positions) filters.positionId = positions.split(",");

  const sectors = params.get("sectors");
  if (sectors) filters.sectorId = sectors.split(",");

  // PPE size filters
  const ppeSizeFilters: Record<string, string[]> = {};
  const ppeSizeKeys = ["shirts", "pants", "boots", "sleeves", "mask", "gloves", "rainBoots"];
  ppeSizeKeys.forEach((key) => {
    const value = params.get(`ppe_${key}`);
    if (value) ppeSizeFilters[key] = value.split(",");
  });
  if (Object.keys(ppeSizeFilters).length > 0) {
    filters.ppeSizeFilters = ppeSizeFilters;
  }

  return filters;
};

export function PpeSizesList({ className }: PpeSizesListProps) {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [showFilterModal, setShowFilterModal] = useState(false);

  // Load entity data for filter labels
  const { data: positionsData } = usePositions({ orderBy: { name: "asc" } });
  const { data: sectorsData } = useSectors({ orderBy: { name: "asc" } });

  const {
    filters,
    setFilters,
    searchingFor,
    displaySearchText,
    setSearch,
    clearAllFilters,
    hasActiveFilters,
  } = useTableFilters<UserGetManyFormData>({
    defaultFilters: {
      limit: DEFAULT_PAGE_SIZE,
    },
    searchDebounceMs: 500,
    searchParamName: "search",
    serializeToUrl: serializePpeSizeFilters,
    deserializeFromUrl: deserializePpeSizeFilters,
    excludeFromUrl: ["limit", "orderBy"],
  });

  const { visibleColumns, setVisibleColumns } = useColumnVisibility(
    "ppe-sizes-visible-columns",
    DEFAULT_PPE_SIZE_VISIBLE_COLUMNS,
  );

  const allColumns = useMemo(() => createPpeSizeColumns(), []);

  const handleFilterChange = useCallback(
    (newFilters: Partial<UserGetManyFormData>) => {
      const { orderBy: _, ...filtersWithoutOrderBy } = newFilters;
      setFilters(filtersWithoutOrderBy);
    },
    [setFilters],
  );

  // Build query filters for the table
  const queryFilters = useMemo(() => {
    const result: Partial<UserGetManyFormData> = {
      ...filters,
      limit: DEFAULT_PAGE_SIZE,
      searchingFor: searchingFor || undefined,
    };

    // Only show users where the actual isActive DB field is true,
    // regardless of status (dismissed users with isActive=true should appear).
    // Do NOT use the convenience `isActive` filter — it translates to
    // `status: { not: DISMISSED }` which would hide dismissed-but-active users.
    result.where = {
      ...result.where,
      isActive: true,
    };

    // Convert status array to API format
    if (result.status && Array.isArray(result.status) && result.status.length > 0) {
      result.statuses = [...result.status];
      delete result.status;
    }

    // Convert frontend filter names to API schema
    if (result.positionId) {
      result.positionIds = result.positionId;
      delete result.positionId;
    }
    if (result.sectorId) {
      result.sectorIds = result.sectorId;
      delete result.sectorId;
    }

    // Handle PPE size filters - build where clause for ppeSize relation
    const ppeSizeFilters = (result as any).ppeSizeFilters;
    if (ppeSizeFilters && Object.keys(ppeSizeFilters).length > 0) {
      const ppeSizeWhere: Record<string, any> = {};
      Object.entries(ppeSizeFilters).forEach(([key, values]) => {
        if (Array.isArray(values) && values.length > 0) {
          ppeSizeWhere[key] = { in: values };
        }
      });
      if (Object.keys(ppeSizeWhere).length > 0) {
        result.where = {
          ...result.where,
          ppeSize: ppeSizeWhere,
        };
      }
      delete (result as any).ppeSizeFilters;
    }

    return result;
  }, [filters, searchingFor]);

  // Count active filters
  const activeFilterCount = useMemo(() => {
    return Object.entries(filters).filter(([key, value]) => {
      if (key === "page" || key === "limit" || key === "itemsPerPage" || key === "orderBy" || key === "sortOrder") return false;
      if (Array.isArray(value)) return value.length > 0;
      if (typeof value === "object" && value !== null) return Object.keys(value).length > 0;
      return value !== undefined && value !== null && value !== "";
    }).length;
  }, [filters]);

  // Extract active filters for indicators
  const activeFilterIndicators = useMemo(() => {
    const indicators: Array<{ key: string; label: string; value: string; onRemove: () => void }> = [];
    const positions = positionsData?.data || [];
    const sectors = sectorsData?.data || [];

    if (searchingFor) {
      indicators.push({
        key: "search",
        label: "Buscar",
        value: searchingFor,
        onRemove: () => setSearch(""),
      });
    }

    if (filters.status && Array.isArray(filters.status)) {
      filters.status.forEach((status: string) => {
        indicators.push({
          key: `status-${status}`,
          label: "Status",
          value: USER_STATUS_LABELS[status as USER_STATUS] || status,
          onRemove: () => {
            const newStatuses = (filters.status || []).filter((s) => s !== status);
            handleFilterChange({ ...filters, status: newStatuses.length > 0 ? newStatuses : undefined });
          },
        });
      });
    }

    if (filters.positionId && Array.isArray(filters.positionId)) {
      filters.positionId.forEach((id: string) => {
        const pos = positions.find((p) => p.id === id);
        if (pos) {
          indicators.push({
            key: `pos-${id}`,
            label: "Cargo",
            value: pos.name,
            onRemove: () => {
              const newPositions = (filters.positionId || []).filter((p) => p !== id);
              handleFilterChange({ ...filters, positionId: newPositions.length > 0 ? newPositions : undefined });
            },
          });
        }
      });
    }

    if (filters.sectorId && Array.isArray(filters.sectorId)) {
      filters.sectorId.forEach((id: string) => {
        const sec = sectors.find((s) => s.id === id);
        if (sec) {
          indicators.push({
            key: `sec-${id}`,
            label: "Setor",
            value: sec.name,
            onRemove: () => {
              const newSectors = (filters.sectorId || []).filter((s) => s !== id);
              handleFilterChange({ ...filters, sectorId: newSectors.length > 0 ? newSectors : undefined });
            },
          });
        }
      });
    }

    // PPE size filter indicators
    const ppeSizeFilters = (filters as any).ppeSizeFilters;
    if (ppeSizeFilters) {
      Object.entries(ppeSizeFilters).forEach(([field, values]) => {
        if (Array.isArray(values)) {
          const fieldLabel = SIZE_FIELD_LABELS[field] || field;
          const labelMap = SIZE_LABEL_MAPS[field] || {};
          (values as string[]).forEach((val) => {
            indicators.push({
              key: `ppe-${field}-${val}`,
              label: fieldLabel,
              value: labelMap[val] || val,
              onRemove: () => {
                const newValues = (values as string[]).filter((v) => v !== val);
                const newPpeSizeFilters = { ...ppeSizeFilters };
                if (newValues.length > 0) {
                  newPpeSizeFilters[field] = newValues;
                } else {
                  delete newPpeSizeFilters[field];
                }
                const hasAny = Object.keys(newPpeSizeFilters).length > 0;
                handleFilterChange({ ...filters, ppeSizeFilters: hasAny ? newPpeSizeFilters : undefined } as any);
              },
            });
          });
        }
      });
    }

    return indicators;
  }, [filters, searchingFor, positionsData?.data, sectorsData?.data, handleFilterChange, setSearch]);

  return (
    <Card className={cn("flex flex-col shadow-sm border border-border", className)}>
      <CardContent className="flex-1 flex flex-col p-4 space-y-4 overflow-hidden">
        {/* Search and controls */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <TableSearchInput
            ref={searchInputRef}
            value={displaySearchText}
            onChange={(value) => setSearch(value)}
            placeholder="Buscar por nome do colaborador..."
            isPending={displaySearchText !== searchingFor}
          />
          <div className="flex gap-2">
            <Button
              variant={hasActiveFilters ? "default" : "outline"}
              size="default"
              onClick={() => setShowFilterModal(true)}
            >
              <IconFilter className="h-4 w-4" />
              <span>
                Filtros
                {hasActiveFilters ? ` (${activeFilterCount})` : ""}
              </span>
            </Button>
            <PpeSizesColumnVisibility
              columns={allColumns}
              visibleColumns={visibleColumns}
              onVisibilityChange={setVisibleColumns}
            />
          </div>
        </div>

        {/* Active Filter Indicators */}
        {activeFilterIndicators.length > 0 && (
          <StandardFilterIndicators filters={activeFilterIndicators} onClearAll={clearAllFilters} className="px-1 py-1" />
        )}

        {/* Table */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <PpeSizesTable
            visibleColumns={visibleColumns}
            filters={queryFilters}
            className="h-full"
          />
        </div>
      </CardContent>

      {/* Filter Modal */}
      <PpeSizesFilters
        open={showFilterModal}
        onOpenChange={setShowFilterModal}
        filters={filters}
        onFilterChange={handleFilterChange}
      />
    </Card>
  );
}
