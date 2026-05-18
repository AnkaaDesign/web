import { useMemo, useState, useEffect } from "react";
import { IconFilter, IconX } from "@tabler/icons-react";

import { useSkills } from "../../../../hooks";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import { Switch } from "@/components/ui/switch";

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
      ...(skillsData?.data ?? []).map((s) => ({
        value: s.id,
        label: s.name,
      })),
    ],
    [skillsData],
  );

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
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <IconFilter className="h-5 w-5" />
            Filtrar Tópicos
          </SheetTitle>
          <SheetDescription>Filtre os tópicos por competência e situação</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <div className="space-y-2">
            <Label htmlFor="skill">Competência</Label>
            <Combobox
              value={skillId || "all"}
              onValueChange={(value) => setSkillId(value === "all" ? undefined : (value as string))}
              options={skillOptions}
              placeholder="Selecione uma competência"
              searchable={true}
              clearable={false}
              minSearchLength={0}
              name="skill"
            />
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="onlyActive" className="cursor-pointer">
                Somente ativos
              </Label>
              <p className="text-xs text-muted-foreground">
                Oculta tópicos marcados como inativos
              </p>
            </div>
            <Switch
              id="onlyActive"
              checked={isActive === true}
              onCheckedChange={(checked) => setIsActive(checked ? true : undefined)}
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
