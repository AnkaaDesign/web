import { useEffect, useMemo, useState } from "react";
import { IconCategory, IconCheck, IconFilter, IconX } from "@tabler/icons-react";

import { useSkills } from "../../../../hooks";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

export interface TopicFiltersValue {
  skillId?: string;
  isActive?: boolean;
}

interface TopicFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (filters: TopicFiltersValue) => void;
  current: TopicFiltersValue;
}

const STATUS_OPTIONS = [
  { value: "all", label: "Todos" },
  { value: "active", label: "Apenas ativos" },
  { value: "inactive", label: "Apenas inativos" },
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

export function TopicFilters({ open, onOpenChange, onApply, current }: TopicFiltersProps) {
  const [skillId, setSkillId] = useState<string | undefined>(current.skillId);
  const [isActive, setIsActive] = useState<boolean | undefined>(current.isActive);

  useEffect(() => {
    if (open) {
      setSkillId(current.skillId);
      setIsActive(current.isActive);
    }
  }, [open, current.skillId, current.isActive]);

  const { data: skillsData } = useSkills({ limit: 200, orderBy: { order: "asc" } });

  const skillOptions = useMemo(
    () => [
      { value: "all", label: "Todas as competências" },
      ...(skillsData?.data ?? []).map((s) => ({ value: s.id, label: s.name })),
    ],
    [skillsData],
  );

  const activeCount = useMemo(() => {
    let n = 0;
    if (skillId) n += 1;
    if (isActive !== undefined) n += 1;
    return n;
  }, [skillId, isActive]);

  const handleApply = () => {
    onApply({ skillId, isActive });
    setTimeout(() => onOpenChange(false), 0);
  };

  const handleClear = () => {
    setSkillId(undefined);
    setIsActive(undefined);
    onApply({});
    setTimeout(() => onOpenChange(false), 0);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <IconFilter className="h-5 w-5" />
            Filtrar Tópicos
            {activeCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {activeCount}
              </Badge>
            )}
          </SheetTitle>
          <SheetDescription>Refine a lista por competência e situação.</SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <IconCategory className="h-4 w-4" />
                Competência
              </Label>
              <Combobox
                value={skillId || "all"}
                onValueChange={(v) => setSkillId(v === "all" ? undefined : (v as string))}
                options={skillOptions}
                placeholder="Selecione uma competência"
                searchable
                clearable={false}
                minSearchLength={0}
                name="skill"
              />
            </div>

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
          </div>
        </ScrollArea>

        <div className="flex gap-2 pt-4 border-t">
          <Button variant="outline" onClick={handleClear} className="flex-1">
            <IconX className="h-4 w-4 mr-2" />
            Limpar Filtros
          </Button>
          <Button onClick={handleApply} className="flex-1">
            Aplicar Filtros
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
