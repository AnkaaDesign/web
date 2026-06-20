import { useState, useEffect, useMemo } from "react";
import type { WarehouseLocationGetManyInput } from "../../../../schemas";
import { WAREHOUSE_LOCATION_TYPE, WAREHOUSE_LOCATION_TYPE_LABELS } from "../../../../constants";
import { FilterDrawer } from "@/components/common/filters/ui/FilterDrawer";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { IconFilter, IconCircleCheck, IconCategory } from "@tabler/icons-react";

interface WarehouseLocationFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: Partial<WarehouseLocationGetManyInput>;
  onFilterChange: (filters: Partial<WarehouseLocationGetManyInput>) => void;
}

interface LocalFilterState {
  isActive?: boolean;
  types?: WAREHOUSE_LOCATION_TYPE[];
  sections?: string[];
}

const STATUS_OPTIONS = [
  { value: "all", label: "Todos" },
  { value: "active", label: "Ativos" },
  { value: "inactive", label: "Inativos" },
];

export function WarehouseLocationFilters({ open, onOpenChange, filters, onFilterChange }: WarehouseLocationFiltersProps) {
  const [localState, setLocalState] = useState<LocalFilterState>({});
  const [sectionInput, setSectionInput] = useState("");

  const typeOptions = useMemo(
    () => Object.values(WAREHOUSE_LOCATION_TYPE).map((type) => ({ value: type, label: WAREHOUSE_LOCATION_TYPE_LABELS[type] })),
    [],
  );

  useEffect(() => {
    if (open) {
      setLocalState({
        isActive: filters.isActive,
        types: filters.types as WAREHOUSE_LOCATION_TYPE[] | undefined,
        sections: filters.sections,
      });
      setSectionInput((filters.sections ?? []).join(", "));
    }
  }, [open, filters]);

  const localActiveFilterCount = useMemo(() => {
    let count = 0;
    if (localState.isActive !== undefined) count++;
    if (localState.types && localState.types.length > 0) count++;
    if (localState.sections && localState.sections.length > 0) count++;
    return count;
  }, [localState]);

  const statusValue = localState.isActive === undefined ? "all" : localState.isActive ? "active" : "inactive";

  const handleApply = () => {
    const sections = sectionInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const filtersToApply: Partial<WarehouseLocationGetManyInput> = {};
    if (localState.isActive !== undefined) filtersToApply.isActive = localState.isActive;
    if (localState.types && localState.types.length > 0) filtersToApply.types = localState.types;
    if (sections.length > 0) filtersToApply.sections = sections;

    onFilterChange(filtersToApply);
    setTimeout(() => onOpenChange(false), 50);
  };

  const handleReset = () => {
    setLocalState({});
    setSectionInput("");
    onFilterChange({});
    setTimeout(() => onOpenChange(false), 50);
  };

  return (
    <FilterDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Filtros"
      titleIcon={<IconFilter className="h-5 w-5" />}
      description="Configure filtros para refinar a pesquisa de localizações"
      activeFilterCount={localActiveFilterCount}
      onApply={handleApply}
      onReset={handleReset}
      applyLabel="Aplicar Filtros"
      resetLabel="Limpar Filtros"
    >
      {/* Status */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <IconCircleCheck className="h-4 w-4" />
          Status
        </Label>
        <Combobox
          options={STATUS_OPTIONS}
          value={statusValue}
          onValueChange={(value) => {
            const v = Array.isArray(value) ? value[0] : value;
            setLocalState((prev) => ({
              ...prev,
              isActive: v === "all" || !v ? undefined : v === "active",
            }));
          }}
          placeholder="Selecione o status..."
          clearable={false}
        />
      </div>

      {/* Type */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <IconCategory className="h-4 w-4" />
          Tipo
        </Label>
        <Combobox
          mode="multiple"
          options={typeOptions}
          value={localState.types || []}
          onValueChange={(value) => {
            const arr = Array.isArray(value) ? value : value ? [value] : [];
            setLocalState((prev) => ({ ...prev, types: arr.length > 0 ? (arr as WAREHOUSE_LOCATION_TYPE[]) : undefined }));
          }}
          placeholder="Selecione tipos..."
          emptyText="Nenhum tipo encontrado"
          searchPlaceholder="Buscar tipos..."
        />
      </div>

      {/* Sections (comma-separated) */}
      <div className="space-y-2">
        <Label htmlFor="section-filter">Setores</Label>
        <Input
          id="section-filter"
          placeholder="Ex: Setor 1, Setor 2"
          value={sectionInput}
          onChange={(value) => setSectionInput(String(value ?? ""))}
        />
        <p className="text-xs text-muted-foreground">Separe múltiplos setores por vírgula.</p>
      </div>
    </FilterDrawer>
  );
}
