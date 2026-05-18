import { useState, useEffect } from "react";
import { IconFilter, IconX } from "@tabler/icons-react";

import { ASSESSMENT_STATUS, ASSESSMENT_STATUS_LABELS } from "../../../../constants";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <IconFilter className="h-5 w-5" />
            Filtrar Avaliações
          </SheetTitle>
          <SheetDescription>Filtre as campanhas de avaliação por status</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
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

          <div className="flex gap-2 mt-6 pt-4 border-t">
            <Button variant="outline" onClick={handleClear} className="flex-1">
              <IconX className="h-4 w-4 mr-2" />
              Limpar Filtros
            </Button>
            <Button onClick={handleApply} className="flex-1">
              Aplicar Filtros
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
