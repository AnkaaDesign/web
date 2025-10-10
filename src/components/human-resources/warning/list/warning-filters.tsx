import { useState, useEffect } from "react";
import { IconFilter, IconX } from "@tabler/icons-react";

import { WARNING_SEVERITY, WARNING_SEVERITY_LABELS, WARNING_CATEGORY, WARNING_CATEGORY_LABELS } from "../../../../constants";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface WarningFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (filters: { severity?: WARNING_SEVERITY; category?: WARNING_CATEGORY; isActive?: boolean }) => void;
  currentSeverity?: WARNING_SEVERITY;
  currentCategory?: WARNING_CATEGORY;
  currentIsActive?: boolean;
}

export function WarningFilters({ open, onOpenChange, onApply, currentSeverity, currentCategory, currentIsActive }: WarningFiltersProps) {
  const [severity, setSeverity] = useState<WARNING_SEVERITY | "">(currentSeverity || "");
  const [category, setCategory] = useState<WARNING_CATEGORY | "">(currentCategory || "");
  const [isActive, setIsActive] = useState<string>(currentIsActive === undefined ? "all" : currentIsActive ? "active" : "resolved");

  useEffect(() => {
    setSeverity(currentSeverity || "");
    setCategory(currentCategory || "");
    setIsActive(currentIsActive === undefined ? "all" : currentIsActive ? "active" : "resolved");
  }, [currentSeverity, currentCategory, currentIsActive]);

  const handleApply = () => {
    onApply({
      severity: severity || undefined,
      category: category || undefined,
      isActive: isActive === "all" ? undefined : isActive === "active",
    });
  };

  const handleClear = () => {
    setSeverity("");
    setCategory("");
    setIsActive("all");
    onApply({});
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <IconFilter className="h-5 w-5" />
            Filtrar Advertências
          </SheetTitle>
          <SheetDescription>
            Filtre as advertências por severidade, categoria ou status
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <div className="space-y-2">
            <Label htmlFor="severity">Severidade</Label>
            <Combobox
              value={severity}
              onValueChange={(value) => setSeverity(value as WARNING_SEVERITY)}
              options={[
                { value: "", label: "Todas" },
                ...Object.entries(WARNING_SEVERITY_LABELS).map(([key, label]: [string, string]) => ({
                  value: key,
                  label: label,
                })),
              ]}
              placeholder="Todas as severidades"
              emptyText="Nenhuma severidade encontrada"
              searchPlaceholder="Buscar severidade..."
              searchable={false}
              clearable={false}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Categoria</Label>
            <Combobox
              value={category}
              onValueChange={(value) => setCategory(value as WARNING_CATEGORY)}
              options={[
                { value: "", label: "Todas" },
                ...Object.entries(WARNING_CATEGORY_LABELS).map(([key, label]: [string, string]) => ({
                  value: key,
                  label: label,
                })),
              ]}
              placeholder="Todas as categorias"
              emptyText="Nenhuma categoria encontrada"
              searchPlaceholder="Buscar categoria..."
              searchable={false}
              clearable={false}
            />
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <RadioGroup value={isActive} onValueChange={setIsActive}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="all" id="all" />
                <Label htmlFor="all" className="font-normal">
                  Todas
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="active" id="active" />
                <Label htmlFor="active" className="font-normal">
                  Ativas
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="resolved" id="resolved" />
                <Label htmlFor="resolved" className="font-normal">
                  Resolvidas
                </Label>
              </div>
            </RadioGroup>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-4 border-t mt-6">
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
