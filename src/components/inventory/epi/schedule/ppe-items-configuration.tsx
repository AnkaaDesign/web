import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { IconPlus, IconTrash, IconShield, IconMinus } from "@tabler/icons-react";
import { PPE_TYPE, PPE_TYPE_LABELS, PPE_TYPE_ORDER } from "../../../../constants";
import type { PpeScheduleItem } from "../../../../schemas";
import { useMemo } from "react";
import { cn } from "@/lib/utils";

interface PpeItemsConfigurationProps {
  value: PpeScheduleItem[];
  onChange: (value: PpeScheduleItem[]) => void;
  className?: string;
}

// Default quantities based on PPE type characteristics
const DEFAULT_QUANTITIES: Partial<Record<PPE_TYPE, number>> = {
  [PPE_TYPE.SHIRT]: 2,
  [PPE_TYPE.PANTS]: 2,
  [PPE_TYPE.BOOTS]: 1,
  [PPE_TYPE.RAIN_BOOTS]: 1,
  [PPE_TYPE.SLEEVES]: 2,
  [PPE_TYPE.MASK]: 5,
  [PPE_TYPE.GLOVES]: 3,
};

export function PpeItemsConfiguration({ value = [], onChange, className }: PpeItemsConfigurationProps) {
  // Sort items by PPE_TYPE_ORDER for consistent display
  const sortedItems = useMemo(() => {
    return [...value].sort((a, b) => {
      const orderA = PPE_TYPE_ORDER[a.ppeType] || 999;
      const orderB = PPE_TYPE_ORDER[b.ppeType] || 999;
      return orderA - orderB;
    });
  }, [value]);

  // Get total quantity for summary
  const totalQuantity = useMemo(() => {
    return value.reduce((sum, item) => sum + item.quantity, 0);
  }, [value]);

  const addNewRow = () => {
    // Find first unused PPE type
    const usedTypes = new Set(value.map((item) => item.ppeType));
    const availableTypes = Object.values(PPE_TYPE).filter((type) => !usedTypes.has(type));

    if (availableTypes.length > 0) {
      const firstAvailable = availableTypes[0];
      const newItem: PpeScheduleItem = {
        ppeType: firstAvailable,
        quantity: DEFAULT_QUANTITIES[firstAvailable] || 1,
      };
      onChange([...value, newItem]);
    }
  };

  const removePpeItem = (index: number) => {
    const newValue = value.filter((_, i) => i !== index);
    onChange(newValue);
  };

  const updatePpeItem = (index: number, field: keyof PpeScheduleItem, newValue: any) => {
    const updatedValue = value.map((item, i) => (i === index ? { ...item, [field]: newValue } : item));
    onChange(updatedValue);
  };

  const getAvailableTypes = (currentIndex: number) => {
    const usedTypes = new Set(value.map((item, index) => (index !== currentIndex ? item.ppeType : null)).filter((type) => type !== null));
    return Object.values(PPE_TYPE).filter((type) => !usedTypes.has(type));
  };

  const incrementQuantity = (index: number) => {
    const currentQty = value[index].quantity;
    if (currentQty < 99) {
      updatePpeItem(index, "quantity", currentQty + 1);
    }
  };

  const decrementQuantity = (index: number) => {
    const currentQty = value[index].quantity;
    if (currentQty > 1) {
      updatePpeItem(index, "quantity", currentQty - 1);
    }
  };

  // Check if all types are used
  const allTypesUsed = value.length === Object.values(PPE_TYPE).length;

  return (
    <Card className={cn("transition-all duration-200", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <IconShield className="h-4 w-4" />
            Equipamentos de Proteção Individual
          </CardTitle>
          {value.length > 0 && (
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                {value.length} {value.length === 1 ? "tipo" : "tipos"}
              </Badge>
              <Badge variant="outline" className="text-xs">
                Total: {totalQuantity} {totalQuantity === 1 ? "unidade" : "unidades"}
              </Badge>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Items list */}
        {sortedItems.map((item, displayIndex) => {
          const originalIndex = value.findIndex((v) => v.ppeType === item.ppeType);
          return (
            <div key={item.ppeType} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
              {/* Vestuarios combobox */}
              <div className="flex-1 min-w-[200px]">
                <Combobox
                  value={item.ppeType}
                  onValueChange={(newType) => updatePpeItem(originalIndex, "ppeType", newType)}
                  options={getAvailableTypes(originalIndex).map((type) => ({
                    label: PPE_TYPE_LABELS[type],
                    value: type,
                  }))}
                  placeholder="Selecione o EPI"
                  searchPlaceholder="Buscar..."
                  className="border-0 bg-transparent"
                />
              </div>

              {/* - button */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 w-9 p-0 shrink-0"
                onClick={() => decrementQuantity(originalIndex)}
                disabled={item.quantity <= 1}
              >
                <IconMinus className="h-4 w-4" />
              </Button>

              {/* quantity input */}
              <Input
                type="number"
                min="1"
                max="99"
                value={item.quantity}
                onChange={(e) => {
                  const value = parseInt(e.target.value) || 1;
                  updatePpeItem(originalIndex, "quantity", Math.max(1, Math.min(99, value)));
                }}
                className="w-16 text-center h-9 shrink-0"
              />

              {/* + button */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 w-9 p-0 shrink-0"
                onClick={() => incrementQuantity(originalIndex)}
                disabled={item.quantity >= 99}
              >
                <IconPlus className="h-4 w-4" />
              </Button>

              {/* delete icon */}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removePpeItem(originalIndex)}
                className="text-destructive hover:text-destructive hover:bg-destructive/10 h-9 w-9 p-0 shrink-0"
              >
                <IconTrash className="h-4 w-4" />
              </Button>
            </div>
          );
        })}

        {/* Add button */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addNewRow}
          disabled={allTypesUsed}
          className="w-full"
        >
          <IconPlus className="h-4 w-4 mr-2" />
          Adicionar EPI
        </Button>

        {allTypesUsed && (
          <p className="text-xs text-muted-foreground text-center">Todos os tipos de EPI foram adicionados</p>
        )}
      </CardContent>
    </Card>
  );
}
