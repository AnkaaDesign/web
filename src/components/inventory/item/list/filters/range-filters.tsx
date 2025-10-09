import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { IconNumber, IconPercentage, IconCurrencyDollar, IconChartLine } from "@tabler/icons-react";

interface RangeFiltersProps {
  quantityRange?: { min?: number; max?: number };
  onQuantityRangeChange: (range?: { min?: number; max?: number }) => void;
  totalPriceRange?: { min?: number; max?: number };
  onTotalPriceRangeChange: (range?: { min?: number; max?: number }) => void;
  taxRange?: { min?: number; max?: number };
  onTaxRangeChange: (range?: { min?: number; max?: number }) => void;
  monthlyConsumptionRange?: { min?: number; max?: number };
  onMonthlyConsumptionRangeChange: (range?: { min?: number; max?: number }) => void;
}

export function RangeFilters({
  quantityRange,
  onQuantityRangeChange,
  totalPriceRange,
  onTotalPriceRangeChange,
  taxRange,
  onTaxRangeChange,
  monthlyConsumptionRange,
  onMonthlyConsumptionRangeChange,
}: RangeFiltersProps) {
  const handleQuantityMinChange = (value: string) => {
    const min = value ? parseFloat(value) : undefined;
    onQuantityRangeChange({ ...quantityRange, min });
  };

  const handleQuantityMaxChange = (value: string) => {
    const max = value ? parseFloat(value) : undefined;
    onQuantityRangeChange({ ...quantityRange, max });
  };

  const handleTaxMinChange = (value: string | number | null) => {
    const min = typeof value === "number" ? value : undefined;
    onTaxRangeChange({ ...taxRange, min });
  };

  const handleTaxMaxChange = (value: string | number | null) => {
    const max = typeof value === "number" ? value : undefined;
    onTaxRangeChange({ ...taxRange, max });
  };

  const handleMonthlyConsumptionMinChange = (value: string) => {
    const min = value ? parseFloat(value) : undefined;
    onMonthlyConsumptionRangeChange({ ...monthlyConsumptionRange, min });
  };

  const handleMonthlyConsumptionMaxChange = (value: string) => {
    const max = value ? parseFloat(value) : undefined;
    onMonthlyConsumptionRangeChange({ ...monthlyConsumptionRange, max });
  };

  const handleTotalPriceMinChange = (value: string | number | null) => {
    const min = typeof value === "number" ? value : undefined;
    onTotalPriceRangeChange({ ...totalPriceRange, min });
  };

  const handleTotalPriceMaxChange = (value: string | number | null) => {
    const max = typeof value === "number" ? value : undefined;
    onTotalPriceRangeChange({ ...totalPriceRange, max });
  };

  return (
    <div className="space-y-4">
      {/* Quantity Range */}
      <div className="space-y-2">
        <Label className="text-sm font-medium flex items-center gap-2">
          <IconNumber className="h-4 w-4" />
          Faixa de Quantidade
        </Label>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor="quantityMin" className="text-xs text-muted-foreground">
              Mínimo
            </Label>
            <Input id="quantityMin" type="number" min="0" step="0.01" placeholder="0" value={quantityRange?.min || ""} onChange={(value) => handleQuantityMinChange(value as string)} />
          </div>
          <div>
            <Label htmlFor="quantityMax" className="text-xs text-muted-foreground">
              Máximo
            </Label>
            <Input id="quantityMax" type="number" min="0" step="0.01" placeholder="∞" value={quantityRange?.max || ""} onChange={(value) => handleQuantityMaxChange(value as string)} />
          </div>
        </div>
      </div>

      <Separator />

      {/* Tax Range */}
      <div className="space-y-2">
        <Label className="text-sm font-medium flex items-center gap-2">
          <IconPercentage className="h-4 w-4" />
          Faixa de Taxa (%)
        </Label>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor="taxMin" className="text-xs text-muted-foreground">
              Mínimo
            </Label>
            <Input id="taxMin" type="percentage" min={0} max={100} placeholder="0" value={taxRange?.min ?? undefined} onChange={handleTaxMinChange} decimals={2} />
          </div>
          <div>
            <Label htmlFor="taxMax" className="text-xs text-muted-foreground">
              Máximo
            </Label>
            <Input id="taxMax" type="percentage" min={0} max={100} placeholder="100" value={taxRange?.max ?? undefined} onChange={handleTaxMaxChange} decimals={2} />
          </div>
        </div>
      </div>

      <Separator />

      {/* Total Price Range */}
      <div className="space-y-2">
        <Label className="text-sm font-medium flex items-center gap-2">
          <IconCurrencyDollar className="h-4 w-4" />
          Faixa de Preço Total (R$)
        </Label>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor="totalPriceMin" className="text-xs text-muted-foreground">
              Mínimo
            </Label>
            <Input id="totalPriceMin" type="currency" placeholder="R$ 0,00" value={totalPriceRange?.min ?? undefined} onChange={handleTotalPriceMinChange} />
          </div>
          <div>
            <Label htmlFor="totalPriceMax" className="text-xs text-muted-foreground">
              Máximo
            </Label>
            <Input id="totalPriceMax" type="currency" placeholder="R$ ∞" value={totalPriceRange?.max ?? undefined} onChange={handleTotalPriceMaxChange} />
          </div>
        </div>
      </div>

      <Separator />

      {/* Monthly Consumption Range */}
      <div className="space-y-2">
        <Label className="text-sm font-medium flex items-center gap-2">
          <IconChartLine className="h-4 w-4" />
          Faixa de Consumo Mensal
        </Label>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor="monthlyConsumptionMin" className="text-xs text-muted-foreground">
              Mínimo
            </Label>
            <Input
              id="monthlyConsumptionMin"
              type="number"
              min="0"
              step="1"
              placeholder="0"
              value={monthlyConsumptionRange?.min || ""}
              onChange={(value) => handleMonthlyConsumptionMinChange(value as string)}
            />
          </div>
          <div>
            <Label htmlFor="monthlyConsumptionMax" className="text-xs text-muted-foreground">
              Máximo
            </Label>
            <Input
              id="monthlyConsumptionMax"
              type="number"
              min="0"
              step="1"
              placeholder="∞"
              value={monthlyConsumptionRange?.max || ""}
              onChange={(value) => handleMonthlyConsumptionMaxChange(value as string)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
