import { useState, useEffect } from "react";
import { IconFilter, IconX } from "@tabler/icons-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export interface FormulaFiltersData {
  paintNames?: string[];
  hasComponents?: "all" | "with" | "without";
}

interface FormulaFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: FormulaFiltersData;
  onFilterChange: (filters: FormulaFiltersData) => void;
  availablePaintNames: string[];
}

export function FormulaFilters({
  open,
  onOpenChange,
  filters,
  onFilterChange,
  availablePaintNames,
}: FormulaFiltersProps) {
  const [localFilters, setLocalFilters] = useState<FormulaFiltersData>(filters);

  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  const handleApply = () => {
    onFilterChange(localFilters);
    onOpenChange(false);
  };

  const handleClear = () => {
    const clearedFilters: FormulaFiltersData = {
      paintNames: [],
      hasComponents: "all",
    };
    setLocalFilters(clearedFilters);
    onFilterChange(clearedFilters);
  };

  const togglePaintName = (paintName: string) => {
    const current = localFilters.paintNames || [];
    const updated = current.includes(paintName)
      ? current.filter((v) => v !== paintName)
      : [...current, paintName];
    setLocalFilters({ ...localFilters, paintNames: updated });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <IconFilter className="h-5 w-5" />
            Filtros Avançados
          </SheetTitle>
          <SheetDescription>
            Filtre as fórmulas por tinta ou status dos componentes
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Components Status Filter */}
          <div className="space-y-2">
            <Label>Status dos Componentes</Label>
            <RadioGroup
              value={localFilters.hasComponents || "all"}
              onValueChange={(value) =>
                setLocalFilters({
                  ...localFilters,
                  hasComponents: value as "all" | "with" | "without",
                })
              }
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="all" id="all" />
                <label
                  htmlFor="all"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Todas as fórmulas
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="with" id="with" />
                <label
                  htmlFor="with"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Apenas com componentes
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="without" id="without" />
                <label
                  htmlFor="without"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Apenas sem componentes
                </label>
              </div>
            </RadioGroup>
          </div>

          {/* Paint Names Filter */}
          {availablePaintNames?.length > 0 && (
            <div className="space-y-2">
              <Label>Tintas</Label>
              <div className="max-h-48 overflow-y-auto space-y-2 border rounded-md p-3">
                {availablePaintNames
                  .filter((paintName) => paintName != null && paintName !== "")
                  .map((paintName, index) => (
                    <div key={`paint-${paintName}-${index}`} className="flex items-center space-x-2">
                      <Checkbox
                        id={`paint-${paintName}`}
                        checked={localFilters.paintNames?.includes(paintName) || false}
                        onCheckedChange={() => togglePaintName(paintName)}
                      />
                      <label
                        htmlFor={`paint-${paintName}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {paintName}
                      </label>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4 border-t">
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
