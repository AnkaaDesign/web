import { useState } from "react";
import { IconCurrencyReal, IconFilter } from "@tabler/icons-react";

import { FilterDrawer } from "@/components/common/filters/ui/FilterDrawer";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";

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
    <FilterDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Filtrar Cargos"
      titleIcon={<IconFilter className="h-5 w-5" />}
      description="Filtre os cargos por características e faixa de remuneração"
      onApply={handleApply}
      onReset={handleClear}
      applyLabel="Aplicar Filtros"
      resetLabel="Limpar Filtros"
    >
          {/* Characteristics Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Características</h3>

            <div className="space-y-2">
              <Label>Características</Label>
              <Combobox
                mode="multiple"
                value={[...(bonifiable ? ["bonifiable"] : []), ...(hasUsers ? ["hasUsers"] : [])]}
                onValueChange={(v) => {
                  const arr = Array.isArray(v) ? v : [];
                  setBonifiable(arr.includes("bonifiable") || undefined);
                  setHasUsers(arr.includes("hasUsers") || undefined);
                }}
                options={[
                  { value: "bonifiable", label: "Bonificáveis" },
                  { value: "hasUsers", label: "Com usuários" },
                ]}
                placeholder="Selecione características"
                searchable={false}
                clearable
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
    </FilterDrawer>
  );
}
