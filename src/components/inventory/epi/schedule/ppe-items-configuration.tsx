import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { IconPlus, IconTrash, IconShield, IconAlertCircle, IconInfoCircle } from "@tabler/icons-react";
import { PPE_TYPE, PPE_TYPE_LABELS, PPE_TYPE_ORDER } from "../../../../constants";
import type { PpeScheduleItem } from "../../../../schemas";
import { useMemo } from "react";
import { cn } from "@/lib/utils";

interface PpeItemsConfigurationProps {
  value: PpeScheduleItem[];
  onChange: (value: PpeScheduleItem[]) => void;
  className?: string;
}

// Group PPE types by category for better organization
const PPE_CATEGORIES = {
  clothing: [PPE_TYPE.SHIRT, PPE_TYPE.PANTS],
  footwear: [PPE_TYPE.BOOTS, PPE_TYPE.RAIN_BOOTS],
  protection: [PPE_TYPE.SLEEVES, PPE_TYPE.MASK, PPE_TYPE.GLOVES],
} as const;

const PPE_CATEGORY_LABELS = {
  clothing: "Vestuário",
  footwear: "Calçados",
  protection: "Proteção Individual",
};

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

  // Calculate available types grouped by category
  const availableTypesByCategory = useMemo(() => {
    const usedTypes = new Set(value.map((item) => item.ppeType));
    const available: Record<string, PPE_TYPE[]> = {};

    Object.entries(PPE_CATEGORIES).forEach(([category, types]) => {
      const categoryAvailable = types.filter((type) => !usedTypes.has(type));
      if (categoryAvailable.length > 0) {
        available[category] = categoryAvailable;
      }
    });

    return available;
  }, [value]);

  // Get total quantity for summary
  const totalQuantity = useMemo(() => {
    return value.reduce((sum, item) => sum + item.quantity, 0);
  }, [value]);

  const addPpeItem = (ppeType: PPE_TYPE) => {
    const newItem: PpeScheduleItem = {
      ppeType,
      quantity: DEFAULT_QUANTITIES[ppeType] || 1,
    };
    onChange([...value, newItem]);
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

  // Quick add buttons for common PPE sets
  const addCommonSet = (setName: "basic" | "complete") => {
    const sets = {
      basic: [PPE_TYPE.SHIRT, PPE_TYPE.PANTS, PPE_TYPE.BOOTS],
      complete: Object.values(PPE_TYPE),
    };

    const typesToAdd = sets[setName];
    const usedTypes = new Set(value.map((item) => item.ppeType));
    const newItems = typesToAdd
      .filter((type) => !usedTypes.has(type))
      .map((type) => ({
        ppeType: type,
        quantity: DEFAULT_QUANTITIES[type] || 1,
      }));

    if (newItems.length > 0) {
      onChange([...value, ...newItems]);
    }
  };

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
      <CardContent className="space-y-4">
        {value.length === 0 ? (
          <div className="text-center py-8 space-y-4">
            <IconAlertCircle className="h-12 w-12 mx-auto text-muted-foreground/50" />
            <div className="space-y-2">
              <p className="text-muted-foreground">Nenhum EPI configurado ainda.</p>
              <p className="text-sm text-muted-foreground">Adicione individualmente ou use os conjuntos pré-definidos:</p>
            </div>
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <Button type="button" variant="outline" size="sm" onClick={() => addCommonSet("basic")}>
                <IconPlus className="h-3 w-3 mr-1" />
                Conjunto Básico
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => addCommonSet("complete")}>
                <IconPlus className="h-3 w-3 mr-1" />
                Todos os EPIs
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Items grouped by category */}
            {Object.entries(PPE_CATEGORIES).map(([category, categoryTypes]) => {
              const categoryItems = sortedItems.filter((item) => categoryTypes.includes(item.ppeType));
              if (categoryItems.length === 0) return null;

              return (
                <div key={category} className="space-y-2">
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{PPE_CATEGORY_LABELS[category as keyof typeof PPE_CATEGORY_LABELS]}</h4>
                  {categoryItems.map((item, index) => {
                    const originalIndex = value.findIndex((v) => v.ppeType === item.ppeType);
                    return (
                      <div key={item.ppeType} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                        <div className="flex-[2] min-w-0">
                          <Combobox
                            value={item.ppeType}
                            onValueChange={(newType) => updatePpeItem(originalIndex, "ppeType", newType)}
                            options={getAvailableTypes(originalIndex).map((type) => ({
                              label: PPE_TYPE_LABELS[type],
                              value: type,
                            }))}
                            placeholder="Tipo de EPI"
                            searchPlaceholder="Buscar..."
                            className="border-0 bg-transparent"
                          />
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => {
                                const currentQty = item.quantity;
                                if (currentQty > 1) updatePpeItem(originalIndex, "quantity", currentQty - 1);
                              }}
                              disabled={item.quantity <= 1}
                            >
                              -
                            </Button>
                            <Input
                              type="number"
                              min="1"
                              max="99"
                              value={item.quantity}
                              onChange={(e) => {
                                const value = parseInt(e.target.value) || 1;
                                updatePpeItem(originalIndex, "quantity", Math.max(1, Math.min(99, value)));
                              }}
                              className="w-16 text-center h-8"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => {
                                const currentQty = item.quantity;
                                if (currentQty < 99) updatePpeItem(originalIndex, "quantity", currentQty + 1);
                              }}
                              disabled={item.quantity >= 99}
                            >
                              +
                            </Button>
                          </div>

                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removePpeItem(originalIndex)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8 w-8 p-0"
                          >
                            <IconTrash className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}

        {/* Add individual PPE dropdown */}
        {Object.keys(availableTypesByCategory).length > 0 && (
          <div className="pt-2 border-t">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-muted-foreground">Adicionar:</span>
              {Object.entries(availableTypesByCategory).map(([category, types]) => (
                <div key={category} className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">{PPE_CATEGORY_LABELS[category as keyof typeof PPE_CATEGORY_LABELS]}:</span>
                  {types.map((type) => (
                    <Button key={type} type="button" variant="outline" size="sm" onClick={() => addPpeItem(type)} className="h-7 text-xs">
                      <IconPlus className="h-3 w-3 mr-1" />
                      {PPE_TYPE_LABELS[type]}
                    </Button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick actions when items exist */}
        {value.length > 0 && value.length < Object.values(PPE_TYPE).length && (
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => addCommonSet("complete")} className="text-xs">
              Adicionar Todos os Restantes
            </Button>
          </div>
        )}

        {/* Info message when all types are added */}
        {value.length === Object.values(PPE_TYPE).length && (
          <div className="bg-blue-50 border border-blue-200 rounded-md p-3 flex items-start gap-2">
            <IconInfoCircle className="h-4 w-4 text-blue-600 mt-0.5" />
            <div className="text-sm">
              <p className="text-blue-800 font-medium">Configuração completa</p>
              <p className="text-blue-700">Todos os tipos de EPI disponíveis foram adicionados.</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
