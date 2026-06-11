import React from "react";
import { formatCurrency } from "../../../../utils";
import { useCanViewPrices } from "../../../../hooks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { IconCalculator, IconCurrencyReal } from "@tabler/icons-react";
import { EXTERNAL_OPERATION_TYPE } from "../../../../constants";

export interface ExternalOperationItem {
  id: string;
  name: string;
  code: string;
  category?: { name: string };
  brand?: { name: string };
  prices?: { value: number }[];
}

export interface ExternalOperationCalculatorService {
  id?: string;
  description: string;
  amount: number;
}

interface ExternalOperationTotalCalculatorProps {
  selectedItems: string[] | Set<string>;
  quantities: Record<string, number>;
  prices: Record<string, number>;
  items?: ExternalOperationItem[];
  /** Ad-hoc billing services (CHARGEABLE only) — included in the grand total */
  services?: ExternalOperationCalculatorService[];
  type: EXTERNAL_OPERATION_TYPE;
  className?: string;
  showItemBreakdown?: boolean;
}

const ExternalOperationTotalCalculatorComponent: React.FC<ExternalOperationTotalCalculatorProps> = ({
  selectedItems,
  quantities,
  prices,
  items = [],
  services = [],
  type,
  className,
  showItemBreakdown = false,
}) => {
  const canViewPrices = useCanViewPrices();
  // Calculate individual item totals and grand total
  const itemCalculations = React.useMemo(() => {
    if (type !== EXTERNAL_OPERATION_TYPE.CHARGEABLE) return [];

    const itemsArray = Array.isArray(selectedItems) ? selectedItems : Array.from(selectedItems);
    return itemsArray.map((itemId) => {
      const item = items.find((i) => i.id === itemId);
      const quantity = quantities[itemId] || 1;
      const unitPrice = prices[itemId] || item?.prices?.[0]?.value || 0;
      const subtotal = quantity * unitPrice;

      return {
        itemId,
        item,
        quantity,
        unitPrice,
        subtotal,
      };
    });
  }, [selectedItems, quantities, prices, items, type]);

  const servicesTotal = React.useMemo(() => {
    if (type !== EXTERNAL_OPERATION_TYPE.CHARGEABLE) return 0;
    return services.reduce((total, service) => total + (Number(service.amount) || 0), 0);
  }, [services, type]);

  const grandTotal = React.useMemo(() => {
    if (type !== EXTERNAL_OPERATION_TYPE.CHARGEABLE) return 0;
    return itemCalculations.reduce((total, calc) => total + calc.subtotal, 0) + servicesTotal;
  }, [itemCalculations, servicesTotal, type]);

  const itemsArray = Array.isArray(selectedItems) ? selectedItems : Array.from(selectedItems);
  const totalItems = itemsArray.length;
  const totalQuantity = React.useMemo(() => {
    const itemsArray = Array.isArray(selectedItems) ? selectedItems : Array.from(selectedItems);
    return itemsArray.reduce((total, itemId) => {
      return total + (quantities[itemId] || 1);
    }, 0);
  }, [selectedItems, quantities]);

  // Warehouse users must not see any monetary values
  if (!canViewPrices) return null;

  // Don't render calculation if not chargeable
  if (type !== EXTERNAL_OPERATION_TYPE.CHARGEABLE) {
    return (
      <Card className={className}>
        <CardContent className="p-4">
          <div className="flex items-center justify-center text-muted-foreground">
            <IconCalculator className="w-5 h-5 mr-2" />
            <span className="text-sm">
              {type === EXTERNAL_OPERATION_TYPE.RETURNABLE ? "Sem cobrança - Itens serão devolvidos" : "Sem cobrança - Cortesia"}
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center">
          <IconCurrencyReal className="w-5 h-5 mr-2" />
          Cálculo do Total
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary statistics */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">{totalItems}</div>
            <div className="text-xs text-muted-foreground">{totalItems === 1 ? "Item" : "Itens"}</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">{totalQuantity.toLocaleString("pt-BR")}</div>
            <div className="text-xs text-muted-foreground">Quantidade Total</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{formatCurrency(grandTotal)}</div>
            <div className="text-xs text-muted-foreground">Total Geral</div>
          </div>
        </div>

        {/* Item breakdown (if enabled and has items) */}
        {showItemBreakdown && itemCalculations.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <div className="text-sm font-medium text-muted-foreground">Detalhamento por Item</div>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {itemCalculations.map(({ itemId, item, quantity, unitPrice, subtotal }) => (
                  <div key={itemId} className="flex items-center justify-between text-sm">
                    <div className="flex-1 min-w-0">
                      <div className="truncate font-medium">{item?.name || `Item ${itemId.slice(0, 8)}...`}</div>
                      <div className="text-xs text-muted-foreground">
                        {quantity} × {formatCurrency(unitPrice)}
                      </div>
                    </div>
                    <div className="flex-shrink-0 font-medium">{formatCurrency(subtotal)}</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Services breakdown */}
        {services.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <div className="text-sm font-medium text-muted-foreground">Serviços</div>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {services.map((service, index) => (
                  <div key={service.id ?? index} className="flex items-center justify-between text-sm">
                    <div className="flex-1 min-w-0">
                      <div className="truncate font-medium">{service.description || `Serviço ${index + 1}`}</div>
                    </div>
                    <div className="flex-shrink-0 font-medium">{formatCurrency(Number(service.amount) || 0)}</div>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between text-sm pt-1 border-t border-border">
                <span className="text-muted-foreground">Total de serviços</span>
                <span className="font-medium">{formatCurrency(servicesTotal)}</span>
              </div>
            </div>
          </>
        )}

        {/* Grand total highlight */}
        <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-green-800 dark:text-green-200">Total da Operação:</span>
            <span className="text-xl font-bold text-green-600 dark:text-green-400">{formatCurrency(grandTotal)}</span>
          </div>
        </div>

        {/* Warning if no price set */}
        {itemCalculations.some((calc) => calc.unitPrice <= 0) && (
          <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
            <div className="text-sm text-yellow-800 dark:text-yellow-200">
              <span className="font-enhanced-unicode">⚠️</span> Alguns itens não possuem preço definido
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Export memoized version of calculator
export const ExternalOperationTotalCalculator = React.memo(ExternalOperationTotalCalculatorComponent);

// Compact version for header display
const ExternalOperationTotalBadgeComponent: React.FC<{
  selectedItems: string[] | Set<string>;
  quantities: Record<string, number>;
  prices: Record<string, number>;
  items?: ExternalOperationItem[];
  services?: ExternalOperationCalculatorService[];
  type: EXTERNAL_OPERATION_TYPE;
}> = ({ selectedItems, quantities, prices, items = [], services = [], type }) => {
  const canViewPrices = useCanViewPrices();
  const grandTotal = React.useMemo(() => {
    if (type !== EXTERNAL_OPERATION_TYPE.CHARGEABLE) return 0;

    const itemsArray = Array.isArray(selectedItems) ? selectedItems : Array.from(selectedItems);
    const itemsTotal = itemsArray.reduce((total, itemId) => {
      const item = items.find((i) => i.id === itemId);
      const quantity = quantities[itemId] || 1;
      const unitPrice = prices[itemId] || item?.prices?.[0]?.value || 0;
      return total + quantity * unitPrice;
    }, 0);
    const servicesTotal = services.reduce((total, service) => total + (Number(service.amount) || 0), 0);
    return itemsTotal + servicesTotal;
  }, [selectedItems, quantities, prices, items, services, type]);

  if (!canViewPrices) return null;

  if (type !== EXTERNAL_OPERATION_TYPE.CHARGEABLE) {
    return (
      <Badge variant="outline" className="text-sm">
        Sem cobrança
      </Badge>
    );
  }

  return (
    <Badge variant={grandTotal > 0 ? "default" : "outline"} className="text-sm">
      Total: {formatCurrency(grandTotal)}
    </Badge>
  );
};

// Export memoized version
export const ExternalOperationTotalBadge = React.memo(ExternalOperationTotalBadgeComponent);
