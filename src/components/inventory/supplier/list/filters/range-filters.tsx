import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { IconPackages, IconShoppingCart } from "@tabler/icons-react";

interface RangeFiltersProps {
  itemCount?: { min?: number; max?: number };
  onItemCountChange: (range?: { min?: number; max?: number }) => void;
  orderCount?: { min?: number; max?: number };
  onOrderCountChange: (range?: { min?: number; max?: number }) => void;
}

export function RangeFilters({ itemCount, onItemCountChange, orderCount, onOrderCountChange }: RangeFiltersProps) {
  const handleItemCountMinChange = (value: string) => {
    const min = value ? parseInt(value, 10) : undefined;
    if (min !== undefined && isNaN(min)) return;

    onItemCountChange({
      ...itemCount,
      min: min,
    });
  };

  const handleItemCountMaxChange = (value: string) => {
    const max = value ? parseInt(value, 10) : undefined;
    if (max !== undefined && isNaN(max)) return;

    onItemCountChange({
      ...itemCount,
      max: max,
    });
  };

  const handleOrderCountMinChange = (value: string) => {
    const min = value ? parseInt(value, 10) : undefined;
    if (min !== undefined && isNaN(min)) return;

    onOrderCountChange({
      ...orderCount,
      min: min,
    });
  };

  const handleOrderCountMaxChange = (value: string) => {
    const max = value ? parseInt(value, 10) : undefined;
    if (max !== undefined && isNaN(max)) return;

    onOrderCountChange({
      ...orderCount,
      max: max,
    });
  };

  return (
    <div className="space-y-4">
      {/* Item Count Range */}
      <div className="space-y-2">
        <Label className="text-sm font-medium flex items-center gap-2">
          <IconPackages className="h-4 w-4" />
          Quantidade de Itens
        </Label>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor="itemCountMin" className="text-xs text-muted-foreground">
              Mínimo
            </Label>
            <Input
              id="itemCountMin"
              type="number"
              min={0}
              placeholder="Valor mínimo"
              value={itemCount?.min?.toString() || ""}
              onChange={(value) => handleItemCountMinChange(value as string)}
            />
          </div>
          <div>
            <Label htmlFor="itemCountMax" className="text-xs text-muted-foreground">
              Máximo
            </Label>
            <Input
              id="itemCountMax"
              type="number"
              min={0}
              placeholder="Sem limite"
              value={itemCount?.max?.toString() || ""}
              onChange={(value) => handleItemCountMaxChange(value as string)}
            />
          </div>
        </div>
        {(itemCount?.min || itemCount?.max) && (
          <div className="text-xs text-muted-foreground">
            {itemCount?.min && itemCount?.max
              ? `Entre ${itemCount.min} e ${itemCount.max} itens`
              : itemCount?.min
                ? `Pelo menos ${itemCount.min} itens`
                : `Até ${itemCount.max} itens`}
          </div>
        )}
      </div>

      <Separator />

      {/* Order Count Range */}
      <div className="space-y-2">
        <Label className="text-sm font-medium flex items-center gap-2">
          <IconShoppingCart className="h-4 w-4" />
          Quantidade de Pedidos
        </Label>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor="orderCountMin" className="text-xs text-muted-foreground">
              Mínimo
            </Label>
            <Input
              id="orderCountMin"
              type="number"
              min={0}
              placeholder="Valor mínimo"
              value={orderCount?.min?.toString() || ""}
              onChange={(value) => handleOrderCountMinChange(value as string)}
            />
          </div>
          <div>
            <Label htmlFor="orderCountMax" className="text-xs text-muted-foreground">
              Máximo
            </Label>
            <Input
              id="orderCountMax"
              type="number"
              min={0}
              placeholder="Sem limite"
              value={orderCount?.max?.toString() || ""}
              onChange={(value) => handleOrderCountMaxChange(value as string)}
            />
          </div>
        </div>
        {(orderCount?.min || orderCount?.max) && (
          <div className="text-xs text-muted-foreground">
            {orderCount?.min && orderCount?.max
              ? `Entre ${orderCount.min} e ${orderCount.max} pedidos`
              : orderCount?.min
                ? `Pelo menos ${orderCount.min} pedidos`
                : `Até ${orderCount.max} pedidos`}
          </div>
        )}
      </div>
    </div>
  );
}
