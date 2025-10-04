import { useState } from "react";
import { IconX } from "@tabler/icons-react";

import { WARNING_SEVERITY, WARNING_SEVERITY_LABELS, WARNING_CATEGORY, WARNING_CATEGORY_LABELS } from "../../../../constants";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Filtrar Advertências</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
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

        <DialogFooter className="flex justify-between sm:justify-between">
          <Button variant="ghost" onClick={handleClear}>
            <IconX className="h-4 w-4 mr-2" />
            Limpar
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleApply}>Aplicar</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
