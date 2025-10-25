import { useState } from "react";
import { IconX, IconCurrencyReal, IconFilter } from "@tabler/icons-react";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

interface PositionFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (filters: { minRemuneration?: number; maxRemuneration?: number; bonifiable?: boolean; hasUsers?: boolean }) => void;
  currentMinRemuneration?: number;
  currentMaxRemuneration?: number;
  currentBonifiable?: boolean;
  currentHasUsers?: boolean;
}

export function PositionFilters({ open, onOpenChange, onApply, currentMinRemuneration, currentMaxRemuneration, currentBonifiable, currentHasUsers }: PositionFiltersProps) {
  const [minRemuneration, setMinRemuneration] = useState<number | undefined>(currentMinRemuneration);
  const [maxRemuneration, setMaxRemuneration] = useState<number | undefined>(currentMaxRemuneration);
  const [bonifiable, setBonifiable] = useState<boolean | undefined>(currentBonifiable);
  const [hasUsers, setHasUsers] = useState<boolean | undefined>(currentHasUsers);

  const handleApply = () => {
    onApply({
      minRemuneration: minRemuneration || undefined,
      maxRemuneration: maxRemuneration || undefined,
      bonifiable: bonifiable || undefined,
      hasUsers: hasUsers || undefined,
    });
  };

  const handleClear = () => {
    setMinRemuneration(undefined);
    setMaxRemuneration(undefined);
    setBonifiable(undefined);
    setHasUsers(undefined);
    onApply({});
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <IconFilter className="h-5 w-5" />
            Filtrar Cargos
          </SheetTitle>
          <SheetDescription>
            Filtre os cargos por características e faixa de remuneração
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Characteristics Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Características</h3>

            <div className="flex items-center justify-between">
              <Label htmlFor="bonifiable">Apenas bonificáveis</Label>
              <Switch
                id="bonifiable"
                checked={!!bonifiable}
                onCheckedChange={(checked) => setBonifiable(checked || undefined)}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="hasUsers">Apenas com usuários</Label>
              <Switch
                id="hasUsers"
                checked={!!hasUsers}
                onCheckedChange={(checked) => setHasUsers(checked || undefined)}
              />
            </div>
          </div>

          {/* Remuneration Range Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <IconCurrencyReal className="h-4 w-4" />
              Faixa de Remuneração
            </h3>

            <div className="space-y-2">
              <Label htmlFor="minRemuneration">Valor Mínimo</Label>
              <Input
                id="minRemuneration"
                type="currency"
                value={minRemuneration}
                onChange={(value) => setMinRemuneration(typeof value === "number" ? value : undefined)}
                placeholder="R$ 0,00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxRemuneration">Valor Máximo</Label>
              <Input
                id="maxRemuneration"
                type="currency"
                value={maxRemuneration}
                onChange={(value) => setMaxRemuneration(typeof value === "number" ? value : undefined)}
                placeholder="R$ 0,00"
              />
            </div>
          </div>

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
