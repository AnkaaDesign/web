import { useMemo } from "react";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import { BRAZILIAN_STATES, BRAZILIAN_STATE_NAMES } from "../../../../../constants";
import { useSuppliers } from "../../../../../hooks";
import { IconMapPin, IconBuilding } from "@tabler/icons-react";

interface LocationFiltersProps {
  cities?: string[];
  onCitiesChange: (cities: string[]) => void;
  states?: string[];
  onStatesChange: (states: string[]) => void;
}

export function LocationFilters({ cities = [], onCitiesChange, states = [], onStatesChange }: LocationFiltersProps) {
  // Load suppliers to get available cities
  const { data: suppliers, isLoading: loadingSuppliers } = useSuppliers({
    orderBy: { city: "asc" },
    limit: 1000, // Get more suppliers to extract cities
  });

  // Create state options
  const stateOptions = useMemo(
    () =>
      BRAZILIAN_STATES.map((state) => ({
        value: state,
        label: BRAZILIAN_STATE_NAMES[state] || state,
      })),
    [],
  );

  // Extract unique cities from suppliers
  const cityOptions = useMemo(() => {
    if (!suppliers?.data) return [];

    const uniqueCities = new Set<string>();
    suppliers.data.forEach((supplier) => {
      if (supplier.city && supplier.city.trim()) {
        uniqueCities.add(supplier.city);
      }
    });

    return Array.from(uniqueCities)
      .sort()
      .map((city) => ({
        value: city,
        label: city,
      }));
  }, [suppliers?.data]);

  return (
    <div className="space-y-4">
      {/* States */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <IconMapPin className="h-4 w-4" />
          Estados
        </Label>
        <Combobox
          mode="multiple"
          options={stateOptions}
          value={states}
          onValueChange={(value) => {
            if (Array.isArray(value)) {
              onStatesChange(value);
            }
          }}
          placeholder="Selecione estados..."
          emptyText="Nenhum estado encontrado"
          searchPlaceholder="Buscar estados..."
        />
        {states.length > 0 && (
          <div className="text-xs text-muted-foreground">
            {states.length} estado{states.length !== 1 ? "s" : ""} selecionado{states.length !== 1 ? "s" : ""}
          </div>
        )}
      </div>

      {/* Cities */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <IconBuilding className="h-4 w-4" />
          Cidades
        </Label>
        <Combobox
          mode="multiple"
          options={cityOptions}
          value={cities}
          onValueChange={(value) => {
            if (Array.isArray(value)) {
              onCitiesChange(value);
            }
          }}
          placeholder="Selecione cidades..."
          emptyText="Nenhuma cidade encontrada"
          searchPlaceholder="Buscar cidades..."
          disabled={loadingSuppliers}
        />
        {cities.length > 0 && (
          <div className="text-xs text-muted-foreground">
            {cities.length} cidade{cities.length !== 1 ? "s" : ""} selecionada{cities.length !== 1 ? "s" : ""}
          </div>
        )}
      </div>
    </div>
  );
}
