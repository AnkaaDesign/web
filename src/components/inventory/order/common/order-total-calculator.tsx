import React from "react";
import { formatCurrency } from "../../../../utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { IconCurrencyReal, IconPercentage } from "@tabler/icons-react";
import type { OrderItem as OrderItemType } from "../../../../types";

interface OrderTotalCalculatorProps {
  orderItems?: OrderItemType[]; // Pass actual OrderItem objects from the order
  className?: string;
  showItemBreakdown?: boolean;
  showTaxBreakdown?: boolean;
}

const OrderTotalCalculatorComponent: React.FC<OrderTotalCalculatorProps> = ({ orderItems = [], className, showItemBreakdown = false, showTaxBreakdown = false }) => {
  // Calculate individual item totals, taxes, and grand total
  const itemCalculations = React.useMemo(() => {
    return orderItems.map((orderItem) => {
      const quantity = orderItem.orderedQuantity;
      const unitPrice = orderItem.price;
      const subtotal = quantity * unitPrice;
      const taxRate = orderItem.tax;
      const taxAmount = subtotal * (taxRate / 100);
      const total = subtotal + taxAmount;

      return {
        orderItem,
        quantity,
        unitPrice,
        subtotal,
        taxRate,
        taxAmount,
        total,
      };
    });
  }, [orderItems]);

  const totals = React.useMemo(() => {
    return itemCalculations.reduce(
      (acc, calc) => ({
        subtotal: acc.subtotal + calc.subtotal,
        taxAmount: acc.taxAmount + calc.taxAmount,
        grandTotal: acc.grandTotal + calc.total,
      }),
      { subtotal: 0, taxAmount: 0, grandTotal: 0 },
    );
  }, [itemCalculations]);

  const totalItems = orderItems.length;
  const totalQuantity = React.useMemo(() => {
    return orderItems.reduce((total, orderItem) => {
      return total + orderItem.orderedQuantity;
    }, 0);
  }, [orderItems]);

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
            <div className="text-2xl font-bold text-green-600">{formatCurrency(totals.grandTotal)}</div>
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
                {itemCalculations.map(({ orderItem, quantity, unitPrice, taxRate, total }) => (
                  <div key={orderItem.id} className="flex items-center justify-between text-sm">
                    <div className="flex-1 min-w-0">
                      <div className="truncate font-medium">{orderItem.item?.name || `Item ${orderItem.itemId.slice(0, 8)}...`}</div>
                      <div className="text-xs text-muted-foreground">
                        {quantity} × {formatCurrency(unitPrice)}
                        {taxRate > 0 && ` + ${taxRate}% imposto`}
                      </div>
                    </div>
                    <div className="flex-shrink-0 font-medium">{formatCurrency(total)}</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Tax breakdown (if enabled and has taxes) */}
        {showTaxBreakdown && totals.taxAmount > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Subtotal:</span>
                <span className="font-medium">{formatCurrency(totals.subtotal)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center">
                  <IconPercentage className="w-3 h-3 mr-1" />
                  Impostos:
                </span>
                <span className="font-medium">{formatCurrency(totals.taxAmount)}</span>
              </div>
            </div>
          </>
        )}

        {/* Grand total highlight */}
        <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-green-800 dark:text-green-200">Total do Pedido:</span>
            <span className="text-xl font-bold text-green-600 dark:text-green-400">{formatCurrency(totals.grandTotal)}</span>
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
export const OrderTotalCalculator = React.memo(OrderTotalCalculatorComponent);

// Compact version for header display
const OrderTotalBadgeComponent: React.FC<{
  orderItems?: OrderItemType[];
}> = ({ orderItems = [] }) => {
  const grandTotal = React.useMemo(() => {
    return orderItems.reduce((total, orderItem) => {
      const quantity = orderItem.orderedQuantity;
      const unitPrice = orderItem.price;
      const subtotal = quantity * unitPrice;
      const taxRate = orderItem.tax;
      const taxAmount = subtotal * (taxRate / 100);
      return total + subtotal + taxAmount;
    }, 0);
  }, [orderItems]);

  return (
    <Badge variant={grandTotal > 0 ? "default" : "outline"} className="text-sm">
      Total: {formatCurrency(grandTotal)}
    </Badge>
  );
};

// Export memoized version
export const OrderTotalBadge = React.memo(OrderTotalBadgeComponent);

// =====================================================
// Form version - for creating/editing orders
// =====================================================

export interface OrderFormItem {
  id: string;
  name: string;
  code: string;
  category?: { name: string };
  brand?: { name: string };
  prices?: { value: number }[];
}

interface OrderFormTotalCalculatorProps {
  selectedItems: string[] | Set<string>;
  quantities: Record<string, number>;
  prices: Record<string, number>;
  taxes?: Record<string, number>;
  items?: OrderFormItem[];
  className?: string;
  showItemBreakdown?: boolean;
  showTaxBreakdown?: boolean;
}

const OrderFormTotalCalculatorComponent: React.FC<OrderFormTotalCalculatorProps> = ({
  selectedItems,
  quantities,
  prices,
  taxes = {},
  items = [],
  className,
  showItemBreakdown = false,
  showTaxBreakdown = false,
}) => {
  // Calculate individual item totals, taxes, and grand total
  const itemCalculations = React.useMemo(() => {
    const itemsArray = Array.isArray(selectedItems) ? selectedItems : Array.from(selectedItems);
    return itemsArray.map((itemId) => {
      const item = items.find((i) => i.id === itemId);
      const quantity = quantities[itemId] || 1;
      const unitPrice = prices[itemId] || item?.prices?.[0]?.value || 0;
      const subtotal = quantity * unitPrice;
      const taxRate = taxes[itemId] || 0;
      const taxAmount = subtotal * (taxRate / 100);
      const total = subtotal + taxAmount;

      return {
        itemId,
        item,
        quantity,
        unitPrice,
        subtotal,
        taxRate,
        taxAmount,
        total,
      };
    });
  }, [selectedItems, quantities, prices, taxes, items]);

  const totals = React.useMemo(() => {
    return itemCalculations.reduce(
      (acc, calc) => ({
        subtotal: acc.subtotal + calc.subtotal,
        taxAmount: acc.taxAmount + calc.taxAmount,
        grandTotal: acc.grandTotal + calc.total,
      }),
      { subtotal: 0, taxAmount: 0, grandTotal: 0 },
    );
  }, [itemCalculations]);

  const itemsArray = Array.isArray(selectedItems) ? selectedItems : Array.from(selectedItems);
  const totalItems = itemsArray.length;
  const totalQuantity = React.useMemo(() => {
    const itemsArray = Array.isArray(selectedItems) ? selectedItems : Array.from(selectedItems);
    return itemsArray.reduce((total, itemId) => {
      return total + (quantities[itemId] || 1);
    }, 0);
  }, [selectedItems, quantities]);

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
            <div className="text-2xl font-bold text-green-600">{formatCurrency(totals.grandTotal)}</div>
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
                {itemCalculations.map(({ itemId, item, quantity, unitPrice, taxRate, total }) => (
                  <div key={itemId} className="flex items-center justify-between text-sm">
                    <div className="flex-1 min-w-0">
                      <div className="truncate font-medium">{item?.name || `Item ${itemId.slice(0, 8)}...`}</div>
                      <div className="text-xs text-muted-foreground">
                        {quantity} × {formatCurrency(unitPrice)}
                        {taxRate > 0 && ` + ${taxRate}% imposto`}
                      </div>
                    </div>
                    <div className="flex-shrink-0 font-medium">{formatCurrency(total)}</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Tax breakdown (if enabled and has taxes) */}
        {showTaxBreakdown && totals.taxAmount > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Subtotal:</span>
                <span className="font-medium">{formatCurrency(totals.subtotal)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center">
                  <IconPercentage className="w-3 h-3 mr-1" />
                  Impostos:
                </span>
                <span className="font-medium">{formatCurrency(totals.taxAmount)}</span>
              </div>
            </div>
          </>
        )}

        {/* Grand total highlight */}
        <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-green-800 dark:text-green-200">Total do Pedido:</span>
            <span className="text-xl font-bold text-green-600 dark:text-green-400">{formatCurrency(totals.grandTotal)}</span>
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

// Export memoized version of form calculator
export const OrderFormTotalCalculator = React.memo(OrderFormTotalCalculatorComponent);

// Compact form version for header display
const OrderFormTotalBadgeComponent: React.FC<{
  selectedItems: string[] | Set<string>;
  quantities: Record<string, number>;
  prices: Record<string, number>;
  taxes?: Record<string, number>;
  items?: OrderFormItem[];
}> = ({ selectedItems, quantities, prices, taxes = {}, items = [] }) => {
  const grandTotal = React.useMemo(() => {
    const itemsArray = Array.isArray(selectedItems) ? selectedItems : Array.from(selectedItems);
    return itemsArray.reduce((total, itemId) => {
      const item = items.find((i) => i.id === itemId);
      const quantity = quantities[itemId] || 1;
      const unitPrice = prices[itemId] || item?.prices?.[0]?.value || 0;
      const subtotal = quantity * unitPrice;
      const taxRate = taxes[itemId] || 0;
      const taxAmount = subtotal * (taxRate / 100);
      return total + subtotal + taxAmount;
    }, 0);
  }, [selectedItems, quantities, prices, taxes, items]);

  return (
    <Badge variant={grandTotal > 0 ? "default" : "outline"} className="text-sm">
      Total: {formatCurrency(grandTotal)}
    </Badge>
  );
};

// Export memoized version
export const OrderFormTotalBadge = React.memo(OrderFormTotalBadgeComponent);
