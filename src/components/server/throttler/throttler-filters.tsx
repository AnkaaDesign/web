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
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

export interface ThrottlerFiltersData {
  controllers?: string[];
  identifiers?: string[];
  throttlerNames?: string[];
  onlyBlocked?: boolean;
}

interface ThrottlerFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: ThrottlerFiltersData;
  onFilterChange: (filters: ThrottlerFiltersData) => void;
  availableControllers: string[];
  availableIdentifiers: string[];
  availableThrottlers: string[];
}

export function ThrottlerFilters({
  open,
  onOpenChange,
  filters,
  onFilterChange,
  availableControllers,
  availableIdentifiers,
  availableThrottlers,
}: ThrottlerFiltersProps) {
  const [localFilters, setLocalFilters] = useState<ThrottlerFiltersData>(filters);

  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  const handleApply = () => {
    onFilterChange(localFilters);
    onOpenChange(false);
  };

  const handleClear = () => {
    const clearedFilters: ThrottlerFiltersData = {
      controllers: [],
      identifiers: [],
      throttlerNames: [],
      onlyBlocked: false,
    };
    setLocalFilters(clearedFilters);
    onFilterChange(clearedFilters);
  };

  const toggleArrayFilter = (
    field: "controllers" | "identifiers" | "throttlerNames",
    value: string
  ) => {
    const current = localFilters[field] || [];
    const updated = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    setLocalFilters({ ...localFilters, [field]: updated });
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
            Filtre as chaves de throttler por endpoint, usuário/IP ou tipo de throttler
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Only Blocked Toggle */}
          <div className="space-y-2">
            <Label>Status</Label>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="onlyBlocked"
                checked={localFilters.onlyBlocked || false}
                onCheckedChange={(checked) =>
                  setLocalFilters({ ...localFilters, onlyBlocked: !!checked })
                }
              />
              <label
                htmlFor="onlyBlocked"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Apenas chaves bloqueadas
              </label>
            </div>
          </div>

          {/* Controllers Filter */}
          {availableControllers?.length > 0 && (
            <div className="space-y-2">
              <Label>Endpoints (Controllers)</Label>
              <div className="max-h-48 overflow-y-auto space-y-2 border rounded-md p-3">
                {availableControllers
                  .filter((controller) => controller != null && controller !== "")
                  .map((controller, index) => (
                    <div key={`controller-${controller}-${index}`} className="flex items-center space-x-2">
                      <Checkbox
                        id={`controller-${controller}`}
                        checked={localFilters.controllers?.includes(controller) || false}
                        onCheckedChange={() => toggleArrayFilter("controllers", controller)}
                      />
                      <label
                        htmlFor={`controller-${controller}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 font-mono"
                      >
                        {controller}
                      </label>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Identifiers Filter */}
          {availableIdentifiers?.length > 0 && (
            <div className="space-y-2">
              <Label>Usuários/IPs</Label>
              <div className="max-h-48 overflow-y-auto space-y-2 border rounded-md p-3">
                {availableIdentifiers
                  .filter((identifier) => identifier != null && identifier !== "")
                  .map((identifier, index) => (
                    <div key={`identifier-${identifier}-${index}`} className="flex items-center space-x-2">
                      <Checkbox
                        id={`identifier-${identifier}`}
                        checked={localFilters.identifiers?.includes(identifier) || false}
                        onCheckedChange={() => toggleArrayFilter("identifiers", identifier)}
                      />
                      <label
                        htmlFor={`identifier-${identifier}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 font-mono"
                      >
                        {identifier}
                      </label>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Throttler Names Filter */}
          {availableThrottlers?.length > 0 && (
            <div className="space-y-2">
              <Label>Tipo de Throttler</Label>
              <div className="max-h-48 overflow-y-auto space-y-2 border rounded-md p-3">
                {availableThrottlers
                  .filter((throttler) => throttler != null && throttler !== "")
                  .map((throttler, index) => (
                    <div key={`throttler-${throttler}-${index}`} className="flex items-center space-x-2">
                      <Checkbox
                        id={`throttler-${throttler}`}
                        checked={localFilters.throttlerNames?.includes(throttler) || false}
                        onCheckedChange={() => toggleArrayFilter("throttlerNames", throttler)}
                      />
                      <label
                        htmlFor={`throttler-${throttler}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 font-mono"
                      >
                        {throttler}
                      </label>
                    </div>
                  ))}
              </div>
            </div>
          )}

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
