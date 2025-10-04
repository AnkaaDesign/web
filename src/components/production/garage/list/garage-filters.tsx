import { useState } from "react";
import { GARAGE_STATUS, GARAGE_STATUS_LABELS } from "../../../../constants";
import type { GarageGetManyFormData } from "../../../../types";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Combobox } from "@/components/ui/combobox";
import { Label } from "@/components/ui/label";

interface GarageFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (filters: Partial<GarageGetManyFormData>) => void;
  filters: Partial<GarageGetManyFormData>;
}

export function GarageFilters({ open, onOpenChange, onApply, filters }: GarageFiltersProps) {
  const [status, setStatus] = useState<string>(filters.where?.status || "");

  const handleReset = () => {
    setStatus("");
  };

  const handleApply = () => {
    const newFilters: Partial<GarageGetManyFormData> = {};

    if (status) {
      newFilters.where = { status };
    }

    onApply(newFilters);
  };

  const hasFilters = status;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Filtros de Garagem</DialogTitle>
          <DialogDescription>Defina os filtros para refinar a busca de garagens.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Combobox
              value={status}
              onValueChange={setStatus}
              options={[
                { value: "", label: "Todos os status" },
                ...Object.entries(GARAGE_STATUS_LABELS).map(([value, label]) => ({
                  value,
                  label,
                })),
              ]}
              placeholder="Selecione um status"
            />
          </div>
        </div>

        <DialogFooter className="flex-col space-y-2 sm:flex-row sm:space-y-0">
          <Button type="button" variant="outline" onClick={handleReset} disabled={!hasFilters} className="w-full sm:w-auto">
            Limpar
          </Button>
          <Button type="button" onClick={handleApply} className="w-full sm:w-auto">
            Aplicar Filtros
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
