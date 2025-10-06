import type { ActivityGetManyFormData } from "../../../../../schemas";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface ActivityRangeFiltersProps {
  filters: Partial<ActivityGetManyFormData>;
  updateFilter: <K extends keyof ActivityGetManyFormData>(key: K, value: ActivityGetManyFormData[K] | undefined) => void;
}

export const ActivityRangeFilters = ({ filters, updateFilter }: ActivityRangeFiltersProps) => {
  const handleQuantityRangeChange = (type: "min" | "max", value: string) => {
    const numValue = value ? parseFloat(value) : undefined;
    const currentRange = filters.quantityRange || {};

    const newRange = {
      ...currentRange,
      [type]: numValue,
    };

    if (newRange.min === undefined && newRange.max === undefined) {
      updateFilter("quantityRange", undefined);
    } else {
      updateFilter("quantityRange", newRange);
    }
  };

  return (
    <div>
      <Label className="text-base font-medium mb-3 block">Quantidade</Label>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="quantityMin" className="text-sm mb-1 block">
            Mínimo
          </Label>
          <Input
            id="quantityMin"
            type="number"
            min="0"
            step="0.01"
            placeholder="Quantidade mínima"
            value={filters.quantityRange?.min || ""}
            onChange={(value) => handleQuantityRangeChange("min", value as string)}
          />
        </div>
        <div>
          <Label htmlFor="quantityMax" className="text-sm mb-1 block">
            Máximo
          </Label>
          <Input
            id="quantityMax"
            type="number"
            min="0"
            step="0.01"
            placeholder="Quantidade máxima"
            value={filters.quantityRange?.max || ""}
            onChange={(value) => handleQuantityRangeChange("max", value as string)}
          />
        </div>
      </div>
    </div>
  );
};
