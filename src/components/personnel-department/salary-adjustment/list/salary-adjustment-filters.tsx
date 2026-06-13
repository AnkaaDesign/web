import { useState, useEffect, useCallback, useRef } from "react";
import { FilterDrawer } from "@/components/common/filters/ui/FilterDrawer";
import { Label } from "@/components/ui/label";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { getPositions } from "../../../../api-client";
import { SALARY_ADJUSTMENT_TYPE_LABELS } from "../../../../constants";
import { Combobox } from "@/components/ui/combobox";
import { IconFilter, IconTag, IconBriefcase, IconCalendar } from "@tabler/icons-react";
import type { SalaryAdjustmentGetManyFormData } from "../../../../schemas/salary-adjustment";

interface SalaryAdjustmentFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: Partial<SalaryAdjustmentGetManyFormData>;
  onFilterChange: (filters: Partial<SalaryAdjustmentGetManyFormData>) => void;
}

export function SalaryAdjustmentFilters({ open, onOpenChange, filters, onFilterChange }: SalaryAdjustmentFiltersProps) {
  // Cache ref for selected positions in multiple mode
  const positionCacheRef = useRef<Map<string, { label: string; value: string }>>(new Map());

  // Local state for immediate UI updates
  const [localFilters, setLocalFilters] = useState(filters);

  // Sync local state with URL filters when modal opens
  useEffect(() => {
    if (open) {
      setLocalFilters(filters);
    }
  }, [open, filters]);

  // Get current values for multi-select components
  const selectedTypes = localFilters.types || [];
  const selectedPositions = localFilters.positionIds || [];

  const handleApplyFilters = () => {
    onFilterChange(localFilters);
    onOpenChange(false);
  };

  const handleResetFilters = () => {
    onFilterChange({});
    setLocalFilters({});
    onOpenChange(false);
  };

  const handleTypeChange = (types: string[]) => {
    setLocalFilters({ ...localFilters, types: types.length > 0 ? types : undefined });
  };

  const handlePositionChange = (positions: string[]) => {
    setLocalFilters({ ...localFilters, positionIds: positions.length > 0 ? positions : undefined });
  };

  // Type options (static, no async needed)
  const typeOptions = Object.entries(SALARY_ADJUSTMENT_TYPE_LABELS).map(([value, label]) => ({
    value,
    label,
  }));

  // Async query function for positions
  const queryPositions = useCallback(async (searchTerm: string, page = 1) => {
    try {
      const queryParams: any = {
        orderBy: { name: "asc" },
        page: page,
        take: 50,
      };

      if (searchTerm && searchTerm.trim()) {
        queryParams.searchingFor = searchTerm.trim();
      }

      const response = await getPositions(queryParams);
      const positions = response.data || [];
      const hasMore = response.meta?.hasNextPage || false;

      const options = positions.map((position) => {
        const option = {
          value: position.id,
          label: position.name,
        };
        // Add to cache for multiple mode
        positionCacheRef.current.set(position.id, option);
        return option;
      });

      return {
        data: options,
        hasMore: hasMore,
      };
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error("Error fetching positions:", error);
      }
      return {
        data: [],
        hasMore: false,
      };
    }
  }, []);

  // Count active filters
  const activeFilterCount = Object.entries(localFilters).filter(([key, value]) => {
    if (key === "page" || key === "limit" || key === "itemsPerPage" || key === "orderBy" || key === "sortOrder") return false;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === "object" && value !== null) return Object.keys(value).length > 0;
    return value !== undefined && value !== null && value !== "";
  }).length;

  return (
    <FilterDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Filtros Avançados"
      titleIcon={<IconFilter className="h-5 w-5" />}
      description="Filtre os reajustes por tipo, cargo e período de vigência"
      activeFilterCount={activeFilterCount}
      onApply={handleApplyFilters}
      onReset={handleResetFilters}
      applyLabel="Aplicar Filtros"
      resetLabel="Limpar Filtros"
    >
      <div>
        <Label className="flex items-center gap-2 mb-2">
          <IconTag className="h-4 w-4" />
          Tipo de Reajuste
        </Label>
        <Combobox
          mode="multiple"
          options={typeOptions}
          value={selectedTypes}
          onValueChange={(value) => {
            const arr = Array.isArray(value) ? value : value ? [value] : [];
            handleTypeChange(arr);
          }}
          placeholder="Selecione os tipos de reajuste"
          searchable={true}
          minSearchLength={0}
        />
      </div>

      <div>
        <Label className="flex items-center gap-2 mb-2">
          <IconBriefcase className="h-4 w-4" />
          Cargo
        </Label>
        <Combobox
          async={true}
          mode="multiple"
          queryKey={["positions"]}
          queryFn={queryPositions}
          initialOptions={[]}
          value={selectedPositions}
          onValueChange={(value) => {
            const arr = Array.isArray(value) ? value : value ? [value] : [];
            handlePositionChange(arr);
          }}
          placeholder="Selecione os cargos"
          searchable={true}
          minSearchLength={0}
          pageSize={50}
          debounceMs={300}
        />
      </div>

      {/* Effective Date Range */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <IconCalendar className="h-4 w-4" />
          Data de Vigência
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">De</Label>
            <DateTimeInput
              mode="date"
              value={localFilters.effectiveDateRange?.gte}
              onChange={(date) => {
                const dateValue = date instanceof Date ? date : null;
                if (!dateValue && !localFilters.effectiveDateRange?.lte) {
                  setLocalFilters({ ...localFilters, effectiveDateRange: undefined });
                } else {
                  setLocalFilters({
                    ...localFilters,
                    effectiveDateRange: {
                      ...(dateValue && { gte: dateValue }),
                      ...(localFilters.effectiveDateRange?.lte && { lte: localFilters.effectiveDateRange.lte }),
                    },
                  });
                }
              }}
              hideLabel
              placeholder="Selecionar data inicial..."
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Até</Label>
            <DateTimeInput
              mode="date"
              value={localFilters.effectiveDateRange?.lte}
              onChange={(date) => {
                const dateValue = date instanceof Date ? date : null;
                if (!dateValue && !localFilters.effectiveDateRange?.gte) {
                  setLocalFilters({ ...localFilters, effectiveDateRange: undefined });
                } else {
                  setLocalFilters({
                    ...localFilters,
                    effectiveDateRange: {
                      ...(localFilters.effectiveDateRange?.gte && { gte: localFilters.effectiveDateRange.gte }),
                      ...(dateValue && { lte: dateValue }),
                    },
                  });
                }
              }}
              hideLabel
              placeholder="Selecionar data final..."
            />
          </div>
        </div>
      </div>
    </FilterDrawer>
  );
}
