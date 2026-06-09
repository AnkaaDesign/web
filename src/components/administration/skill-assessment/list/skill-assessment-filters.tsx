import { useState, useEffect } from "react";
import { IconFilter } from "@tabler/icons-react";

import { ASSESSMENT_STATUS, ASSESSMENT_STATUS_LABELS } from "../../../../constants";

import { FilterDrawer } from "@/components/common/filters/ui/FilterDrawer";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";

export interface SkillAssessmentFiltersValue {
  status?: ASSESSMENT_STATUS;
}

interface SkillAssessmentFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (filters: SkillAssessmentFiltersValue) => void;
  current: SkillAssessmentFiltersValue;
}

export function SkillAssessmentFilters({
  open,
  onOpenChange,
  onApply,
  current,
}: SkillAssessmentFiltersProps) {
  const [status, setStatus] = useState<ASSESSMENT_STATUS | undefined>(current.status);

  useEffect(() => {
    if (open) {
      setStatus(current.status);
    }
  }, [open, current.status]);

  const handleApply = () => {
    onApply({ status });
    setTimeout(() => onOpenChange(false), 0);
  };

  const handleClear = () => {
    setStatus(undefined);
    onApply({});
    setTimeout(() => onOpenChange(false), 0);
  };

  return (
    <FilterDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Filtrar Avaliações"
      titleIcon={<IconFilter className="h-5 w-5" />}
      description="Filtre as campanhas de avaliação por status"
      onApply={handleApply}
      onReset={handleClear}
      applyLabel="Aplicar Filtros"
      resetLabel="Limpar Filtros"
    >
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Combobox
              value={status || "all"}
              onValueChange={(value) =>
                setStatus(value === "all" ? undefined : (value as ASSESSMENT_STATUS))
              }
              options={[
                { value: "all", label: "Todos os status" },
                ...Object.entries(ASSESSMENT_STATUS_LABELS).map(([key, label]) => ({
                  value: key,
                  label,
                })),
              ]}
              placeholder="Selecione um status"
              searchable={true}
              clearable={false}
              minSearchLength={0}
              name="status"
            />
          </div>
    </FilterDrawer>
  );
}
