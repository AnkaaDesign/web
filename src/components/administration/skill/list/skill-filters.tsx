import { useState, useEffect } from "react";
import { IconFilter, IconX } from "@tabler/icons-react";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export interface SkillFiltersValue {
  isActive?: boolean;
}

interface SkillFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (filters: SkillFiltersValue) => void;
  current: SkillFiltersValue;
}

export function SkillFilters({ open, onOpenChange, onApply, current }: SkillFiltersProps) {
  const [isActive, setIsActive] = useState<boolean | undefined>(current.isActive);

  // Reset state when sheet opens
  useEffect(() => {
    if (open) {
      setIsActive(current.isActive);
    }
  }, [open, current.isActive]);

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
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <IconFilter className="h-5 w-5" />
            Filtrar Competências
          </SheetTitle>
          <SheetDescription>Filtre as competências pela situação</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <div className="flex items-center justify-between rounded-md border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="onlyActive" className="cursor-pointer">
                Somente ativas
              </Label>
              <p className="text-xs text-muted-foreground">
                Oculta competências marcadas como inativas
              </p>
            </div>
            <Switch
              id="onlyActive"
              checked={isActive === true}
              onCheckedChange={(checked) => setIsActive(checked ? true : undefined)}
            />
          </div>

          {/* Action Buttons */}
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
