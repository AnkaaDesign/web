import { useState, useEffect } from "react";
import { FilterDrawer } from "@/components/common/filters/ui/FilterDrawer";
import { Label } from "@/components/ui/label";
import { BENEFIT_KIND_LABELS } from "../../../../constants";
import { Combobox } from "@/components/ui/combobox";
import { IconFilter, IconTag, IconToggleLeft } from "@tabler/icons-react";
import type { BenefitGetManyFormData } from "../../../../schemas/benefit";

interface BenefitFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: Partial<BenefitGetManyFormData>;
  onFilterChange: (filters: Partial<BenefitGetManyFormData>) => void;
}

const STATUS_OPTIONS = [
  { value: "all", label: "Todos" },
  { value: "true", label: "Ativos" },
  { value: "false", label: "Inativos" },
];

export function BenefitFilters({ open, onOpenChange, filters, onFilterChange }: BenefitFiltersProps) {
  // Local state for immediate UI updates
  const [localFilters, setLocalFilters] = useState(filters);

  // Sync local state with URL filters when modal opens
  useEffect(() => {
    if (open) {
      setLocalFilters(filters);
    }
  }, [open, filters]);

  const selectedKinds = localFilters.kinds || [];
  const isActiveValue = typeof localFilters.isActive === "boolean" ? String(localFilters.isActive) : "all";

  const handleApplyFilters = () => {
    onFilterChange(localFilters);
    onOpenChange(false);
  };

  const handleResetFilters = () => {
    onFilterChange({});
    setLocalFilters({});
    onOpenChange(false);
  };

  const handleKindChange = (kinds: string[]) => {
    setLocalFilters({ ...localFilters, kinds: kinds.length > 0 ? kinds : undefined });
  };

  const handleIsActiveChange = (value: string) => {
    setLocalFilters({
      ...localFilters,
      isActive: value === "all" || !value ? undefined : value === "true",
    });
  };

  // Kind options (static, no async needed)
  const kindOptions = Object.entries(BENEFIT_KIND_LABELS).map(([value, label]) => ({
    value,
    label,
  }));

  // Count active filters
  const activeFilterCount = Object.entries(localFilters).filter(([key, value]) => {
    if (key === "page" || key === "limit" || key === "itemsPerPage" || key === "orderBy" || key === "sortOrder") return false;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === "boolean") return true;
    if (typeof value === "object" && value !== null) return Object.keys(value).length > 0;
    return value !== undefined && value !== null && value !== "";
  }).length;

  return (
    <FilterDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Filtros Avançados"
      titleIcon={<IconFilter className="h-5 w-5" />}
      description="Filtre os benefícios por tipo e status"
      activeFilterCount={activeFilterCount}
      onApply={handleApplyFilters}
      onReset={handleResetFilters}
      applyLabel="Aplicar Filtros"
      resetLabel="Limpar Filtros"
    >
      <div>
        <Label className="flex items-center gap-2 mb-2">
          <IconTag className="h-4 w-4" />
          Tipo de Benefício
        </Label>
        <Combobox
          mode="multiple"
          options={kindOptions}
          value={selectedKinds}
          onValueChange={(value) => {
            const arr = Array.isArray(value) ? value : value ? [value] : [];
            handleKindChange(arr);
          }}
          placeholder="Selecione os tipos de benefício"
          searchable={true}
          minSearchLength={0}
        />
      </div>

      <div>
        <Label className="flex items-center gap-2 mb-2">
          <IconToggleLeft className="h-4 w-4" />
          Status
        </Label>
        <Combobox
          options={STATUS_OPTIONS}
          value={isActiveValue}
          onValueChange={(value) => handleIsActiveChange(typeof value === "string" ? value : "all")}
          placeholder="Todos"
          searchable={false}
        />
      </div>
    </FilterDrawer>
  );
}
