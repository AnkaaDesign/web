import { useEffect, useMemo, useState } from "react";
import { IconCheck, IconFilter } from "@tabler/icons-react";

import { FilterDrawer } from "@/components/common/filters/ui/FilterDrawer";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";

export interface SkillFiltersValue {
  isActive?: boolean;
}

interface SkillFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (filters: SkillFiltersValue) => void;
  current: SkillFiltersValue;
}

const STATUS_OPTIONS = [
  { value: "all", label: "Todas" },
  { value: "active", label: "Apenas ativas" },
  { value: "inactive", label: "Apenas inativas" },
];

function statusValue(v: boolean | undefined): string {
  if (v === true) return "active";
  if (v === false) return "inactive";
  return "all";
}
function statusFromValue(v: string): boolean | undefined {
  if (v === "active") return true;
  if (v === "inactive") return false;
  return undefined;
}

export function SkillFilters({ open, onOpenChange, onApply, current }: SkillFiltersProps) {
  const [isActive, setIsActive] = useState<boolean | undefined>(current.isActive);

  useEffect(() => {
    if (open) {
      setIsActive(current.isActive);
    }
  }, [open, current.isActive]);

  const activeCount = useMemo(() => (isActive !== undefined ? 1 : 0), [isActive]);

  const handleApply = () => {
    onApply({ isActive });
    setTimeout(() => onOpenChange(false), 0);
  };

  const handleClear = () => {
    setIsActive(undefined);
    onApply({});
    setTimeout(() => onOpenChange(false), 0);
  };

  return (
    <FilterDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Filtrar Competências"
      titleIcon={<IconFilter className="h-5 w-5" />}
      description="Refine a lista pela situação."
      activeFilterCount={activeCount}
      onApply={handleApply}
      onReset={handleClear}
      applyLabel="Aplicar Filtros"
      resetLabel="Limpar Filtros"
    >
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <IconCheck className="h-4 w-4" />
          Situação
        </Label>
        <Combobox
          value={statusValue(isActive)}
          onValueChange={(v) => setIsActive(statusFromValue(v as string))}
          options={STATUS_OPTIONS}
          searchable={false}
          clearable={false}
        />
      </div>
    </FilterDrawer>
  );
}
