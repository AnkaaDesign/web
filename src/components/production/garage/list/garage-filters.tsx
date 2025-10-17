import { useState } from "react";
import { IconFilter, IconX } from "@tabler/icons-react";
import { GARAGE_STATUS, GARAGE_STATUS_LABELS } from "../../../../constants";
import type { GarageGetManyFormData } from "../../../../types";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <IconFilter className="h-5 w-5" />
            Filtros de Garagem
          </SheetTitle>
          <SheetDescription>Defina os filtros para refinar a busca de garagens.</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
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
              emptyText="Nenhum status encontrado"
              searchable={true}
              clearable={true}
            />
          </div>

          <div className="flex gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={handleReset} disabled={!hasFilters} className="flex-1">
              <IconX className="h-4 w-4 mr-2" />
              Limpar
            </Button>
            <Button type="button" onClick={handleApply} className="flex-1">
              Aplicar Filtros
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
