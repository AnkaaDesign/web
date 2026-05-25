import React from "react";
import { formatCurrency } from "../../../../utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { IconCurrencyReal, IconPercentage } from "@tabler/icons-react";
import type { OrderItem as OrderItemType } from "../../../../types";

interface OrderTotalCalculatorProps {
  orderItems?: OrderItemType[]; // Pass actual OrderItem objects from the order
  discount?: number; // Percentage discount applied to the goods subtotal
  className?: string;
  showItemBreakdown?: boolean;
  showTaxBreakdown?: boolean;
}

const OrderTotalCalculatorComponent: React.FC<OrderTotalCalculatorProps> = ({ orderItems = [], discount = 0, className, showItemBreakdown = false, showTaxBreakdown = false }) => {
  // Calculate individual item totals, taxes, and grand total
  const itemCalculations = React.useMemo(() => {
    return orderItems.map((orderItem) => {
      const quantity = orderItem.orderedQuantity;
      const unitPrice = orderItem.price;
      const subtotal = quantity * unitPrice;
      const icms = orderItem.icms;
      const ipi = orderItem.ipi;
      const icmsAmount = subtotal * (icms / 100);
      const ipiAmount = subtotal * (ipi / 100);
      const taxAmount = icmsAmount + ipiAmount;
      const total = subtotal + taxAmount;

      return {
        orderItem,
        quantity,
        unitPrice,
        subtotal,
        icms,
        ipi,
        icmsAmount,
        ipiAmount,
        taxAmount,
        total,
      };
    });
  }, [orderItems]);

  const totals = React.useMemo(() => {
    const base = itemCalculations.reduce(
      (acc, calc) => ({
        subtotal: acc.subtotal + calc.subtotal,
        taxAmount: acc.taxAmount + calc.taxAmount,
        grandTotal: acc.grandTotal + calc.total,
      }),
      { subtotal: 0, taxAmount: 0, grandTotal: 0 },
    );
    const discountAmount = discount > 0 ? base.subtotal * (discount / 100) : 0;
    return { ...base, discountAmount, grandTotal: base.grandTotal - discountAmount };
  }, [itemCalculations, discount]);

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
                {itemCalculations.map(({ orderItem, quantity, unitPrice, icms, ipi, total }) => (
                  <div key={orderItem.id} className="flex items-center justify-between text-sm">
                    <div className="flex-1 min-w-0">
                      <div className="truncate font-medium">{orderItem.item?.name ?? `Item ${orderItem.itemId?.slice(0, 8) ?? 'Unknown'}...`}</div>
                      <div className="text-xs text-muted-foreground">
                        {quantity} × {formatCurrency(unitPrice)}
                        {(icms > 0 || ipi > 0) && ` + ${icms}% ICMS + ${ipi}% IPI`}
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

        {/* Discount line (only when a discount is applied) */}
        {totals.discountAmount > 0 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground flex items-center">
              <IconPercentage className="w-3 h-3 mr-1" />
              Desconto ({discount}%):
            </span>
            <span className="font-medium text-red-600 dark:text-red-400">- {formatCurrency(totals.discountAmount)}</span>
          </div>
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
  discount?: number;
}> = ({ orderItems = [], discount = 0 }) => {
  const grandTotal = React.useMemo(() => {
    let goodsSubtotal = 0;
    const total = orderItems.reduce((acc, orderItem) => {
      const quantity = orderItem.orderedQuantity;
      const unitPrice = orderItem.price;
      const subtotal = quantity * unitPrice;
      const icmsAmount = subtotal * (orderItem.icms / 100);
      const ipiAmount = subtotal * (orderItem.ipi / 100);
      const taxAmount = icmsAmount + ipiAmount;
      goodsSubtotal += subtotal;
      return acc + subtotal + taxAmount;
    }, 0);
    const discountAmount = discount > 0 ? goodsSubtotal * (discount / 100) : 0;
    return total - discountAmount;
  }, [orderItems, discount]);

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
  icmses?: Record<string, number>;
  ipis?: Record<string, number>;
  items?: OrderFormItem[];
  discount?: number; // Percentage discount applied to the goods subtotal
  className?: string;
  showItemBreakdown?: boolean;
  showTaxBreakdown?: boolean;
}

const OrderFormTotalCalculatorComponent: React.FC<OrderFormTotalCalculatorProps> = ({
  selectedItems,
  quantities,
  prices,
  icmses = {},
  ipis = {},
  items = [],
  discount = 0,
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
      const icms = icmses[itemId] || 0;
      const ipi = ipis[itemId] || 0;
      const icmsAmount = subtotal * (icms / 100);
      const ipiAmount = subtotal * (ipi / 100);
      const taxAmount = icmsAmount + ipiAmount;
      const total = subtotal + taxAmount;

      return {
        itemId,
        item,
        quantity,
        unitPrice,
        subtotal,
        icms,
        ipi,
        icmsAmount,
        ipiAmount,
        taxAmount,
        total,
      };
    });
  }, [selectedItems, quantities, prices, icmses, ipis, items]);

  const totals = React.useMemo(() => {
    const base = itemCalculations.reduce(
      (acc, calc) => ({
        subtotal: acc.subtotal + calc.subtotal,
        taxAmount: acc.taxAmount + calc.taxAmount,
        grandTotal: acc.grandTotal + calc.total,
      }),
      { subtotal: 0, taxAmount: 0, grandTotal: 0 },
    );
    const discountAmount = discount > 0 ? base.subtotal * (discount / 100) : 0;
    return { ...base, discountAmount, grandTotal: base.grandTotal - discountAmount };
  }, [itemCalculations, discount]);

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
                {itemCalculations.map(({ itemId, item, quantity, unitPrice, icms, ipi, total }) => (
                  <div key={itemId} className="flex items-center justify-between text-sm">
                    <div className="flex-1 min-w-0">
                      <div className="truncate font-medium">{item?.name ?? `Item ${itemId.slice(0, 8)}...`}</div>
                      <div className="text-xs text-muted-foreground">
                        {quantity} × {formatCurrency(unitPrice)}
                        {(icms > 0 || ipi > 0) && ` + ${icms}% ICMS + ${ipi}% IPI`}
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

        {/* Discount line (only when a discount is applied) */}
        {totals.discountAmount > 0 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground flex items-center">
              <IconPercentage className="w-3 h-3 mr-1" />
              Desconto ({discount}%):
            </span>
            <span className="font-medium text-red-600 dark:text-red-400">- {formatCurrency(totals.discountAmount)}</span>
          </div>
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
  icmses?: Record<string, number>;
  ipis?: Record<string, number>;
  items?: OrderFormItem[];
  discount?: number;
}> = ({ selectedItems, quantities, prices, icmses = {}, ipis = {}, items = [], discount = 0 }) => {
  const grandTotal = React.useMemo(() => {
    const itemsArray = Array.isArray(selectedItems) ? selectedItems : Array.from(selectedItems);
    let goodsSubtotal = 0;
    const total = itemsArray.reduce((acc, itemId) => {
      const item = items.find((i) => i.id === itemId);
      const quantity = quantities[itemId] || 1;
      const unitPrice = prices[itemId] || item?.prices?.[0]?.value || 0;
      const subtotal = quantity * unitPrice;
      const icmsAmount = subtotal * ((icmses[itemId] || 0) / 100);
      const ipiAmount = subtotal * ((ipis[itemId] || 0) / 100);
      const taxAmount = icmsAmount + ipiAmount;
      goodsSubtotal += subtotal;
      return acc + subtotal + taxAmount;
    }, 0);
    const discountAmount = discount > 0 ? goodsSubtotal * (discount / 100) : 0;
    return total - discountAmount;
  }, [selectedItems, quantities, prices, icmses, ipis, items, discount]);

  return (
    <Badge variant={grandTotal > 0 ? "default" : "outline"} className="text-sm">
      Total: {formatCurrency(grandTotal)}
    </Badge>
  );
};

// Export memoized version
export const OrderFormTotalBadge = React.memo(OrderFormTotalBadgeComponent);
