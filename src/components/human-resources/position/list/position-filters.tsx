import { useState } from "react";
import { IconX, IconCurrencyReal } from "@tabler/icons-react";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Filtrar Cargos</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
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
