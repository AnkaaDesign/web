import { useEffect, useMemo, useState } from "react";
import { IconCheck, IconFilter, IconX } from "@tabler/icons-react";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <IconFilter className="h-5 w-5" />
            Filtrar Competências
            {activeCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {activeCount}
              </Badge>
            )}
          </SheetTitle>
          <SheetDescription>Refine a lista pela situação.</SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-6 py-4">
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
