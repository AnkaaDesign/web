import { useState } from "react";
import { IconX, IconCurrencyReal, IconFilter } from "@tabler/icons-react";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface PositionFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (filters: { minRemuneration?: number; maxRemuneration?: number }) => void;
  currentMinRemuneration?: number;
  currentMaxRemuneration?: number;
}

export function PositionFilters({ open, onOpenChange, onApply, currentMinRemuneration, currentMaxRemuneration }: PositionFiltersProps) {
  const [minRemuneration, setMinRemuneration] = useState<number | undefined>(currentMinRemuneration);
  const [maxRemuneration, setMaxRemuneration] = useState<number | undefined>(currentMaxRemuneration);

  const handleApply = () => {
    onApply({
      minRemuneration: minRemuneration || undefined,
      maxRemuneration: maxRemuneration || undefined,
    });
  };

  const handleClear = () => {
    setMinRemuneration(undefined);
    setMaxRemuneration(undefined);
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
            Filtre os cargos por faixa de remuneração
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
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
