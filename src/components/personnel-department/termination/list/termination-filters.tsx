import { useState, useEffect } from "react";
import { FilterDrawer } from "@/components/common/filters/ui/FilterDrawer";
import { Label } from "@/components/ui/label";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { TERMINATION_TYPE_LABELS, TERMINATION_STATUS_LABELS } from "../../../../constants";
import { Combobox } from "@/components/ui/combobox";
import { IconFilter, IconTag, IconProgress, IconCalendar } from "@tabler/icons-react";
import type { TerminationGetManyFormData } from "../../../../schemas/termination";
import { getTerminationDateRange } from "./filter-utils";

interface TerminationFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: Partial<TerminationGetManyFormData>;
  onFilterChange: (filters: Partial<TerminationGetManyFormData>) => void;
}

export function TerminationFilters({ open, onOpenChange, filters, onFilterChange }: TerminationFiltersProps) {
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
  const selectedStatuses = localFilters.statuses || [];
  const dateRange = getTerminationDateRange(localFilters);

  const handleApplyFilters = () => {
    onFilterChange(localFilters);
    onOpenChange(false);
  };

  const handleResetFilters = () => {
    onFilterChange({});
    setLocalFilters({});
    onOpenChange(false);
  };

  const handleTypesChange = (types: string[]) => {
    setLocalFilters({ ...localFilters, types: types.length > 0 ? types : undefined });
  };

  const handleStatusesChange = (statuses: string[]) => {
    setLocalFilters({ ...localFilters, statuses: statuses.length > 0 ? statuses : undefined });
  };

  const setDateRange = (range: { gte?: Date; lte?: Date } | undefined) => {
    const where = { ...((localFilters.where as any) || {}) };
    if (range && (range.gte || range.lte)) {
      where.terminationDate = range;
    } else {
      delete where.terminationDate;
    }
    setLocalFilters({
      ...localFilters,
      where: Object.keys(where).length > 0 ? where : undefined,
    });
  };

  // Static options
  const typeOptions = Object.entries(TERMINATION_TYPE_LABELS).map(([value, label]) => ({ value, label }));
  const statusOptions = Object.entries(TERMINATION_STATUS_LABELS).map(([value, label]) => ({ value, label }));

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
      description="Filtre as rescisões por tipo, status e data da rescisão"
      activeFilterCount={activeFilterCount}
      onApply={handleApplyFilters}
      onReset={handleResetFilters}
      applyLabel="Aplicar Filtros"
      resetLabel="Limpar Filtros"
    >
      <div>
        <Label className="flex items-center gap-2 mb-2">
          <IconTag className="h-4 w-4" />
          Tipo de Rescisão
        </Label>
        <Combobox
          mode="multiple"
          options={typeOptions}
          value={selectedTypes}
          onValueChange={(value) => {
            const arr = Array.isArray(value) ? value : value ? [value] : [];
            handleTypesChange(arr);
          }}
          placeholder="Selecione os tipos de rescisão"
          searchable={true}
          minSearchLength={0}
        />
      </div>

      <div>
        <Label className="flex items-center gap-2 mb-2">
          <IconProgress className="h-4 w-4" />
          Status
        </Label>
        <Combobox
          mode="multiple"
          options={statusOptions}
          value={selectedStatuses}
          onValueChange={(value) => {
            const arr = Array.isArray(value) ? value : value ? [value] : [];
            handleStatusesChange(arr);
          }}
          placeholder="Selecione os status"
          searchable={true}
          minSearchLength={0}
        />
      </div>

      {/* Termination Date Range */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <IconCalendar className="h-4 w-4" />
          Data da Rescisão
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">De</Label>
            <DateTimeInput
              mode="date"
              value={dateRange?.gte}
              onChange={(date) => {
                const dateValue = date instanceof Date ? date : null;
                setDateRange({
                  ...(dateValue && { gte: dateValue }),
                  ...(dateRange?.lte && { lte: dateRange.lte }),
                });
              }}
              hideLabel
              placeholder="Selecionar data inicial..."
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Até</Label>
            <DateTimeInput
              mode="date"
              value={dateRange?.lte}
              onChange={(date) => {
                const dateValue = date instanceof Date ? date : null;
                setDateRange({
                  ...(dateRange?.gte && { gte: dateRange.gte }),
                  ...(dateValue && { lte: dateValue }),
                });
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
