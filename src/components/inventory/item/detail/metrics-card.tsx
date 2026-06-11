import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IconChartBar, IconSquareArrowUpFilled, IconSquareArrowDownFilled, IconCurrencyDollar, IconActivity, IconAlertTriangle, IconAlertTriangleFilled, IconArrowsExchange } from "@tabler/icons-react";
import type { Item } from "../../../../types";
import { formatCurrency, determineStockLevel, getStockLevelMessage } from "../../../../utils";
import { STOCK_LEVEL_LABELS, ORDER_STATUS, ACTIVITY_OPERATION, STOCK_LEVEL } from "../../../../constants";
import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { useCanViewPrices } from "../../../../hooks";

interface MetricsCardProps {
  item: Item;
  className?: string;
}

// Round quantities for display — integers stay clean, fractions cap at 2 decimals.
const fmtQty = (value: number) => (value ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 });

// Stock-level colors, matched to the item table's StockStatusIndicator (spec §15).
const stockLevelColor = (level: STOCK_LEVEL): string => {
  switch (level) {
    case STOCK_LEVEL.NEGATIVE_STOCK:
      return "text-neutral-500";
    case STOCK_LEVEL.OUT_OF_STOCK:
      return "text-red-700";
    case STOCK_LEVEL.CRITICAL:
      return "text-orange-500";
    case STOCK_LEVEL.LOW:
      return "text-yellow-500";
    case STOCK_LEVEL.OPTIMAL:
      return "text-green-700";
    case STOCK_LEVEL.OVERSTOCKED:
      return "text-purple-600";
    default:
      return "text-neutral-500";
  }
};

export function MetricsCard({ item, className }: MetricsCardProps) {
  const canViewPrices = useCanViewPrices();
  const metrics = useMemo(() => {
    const activities = item.activities || [];
    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);

    const recentActivities = activities.filter((activity) => new Date(activity.createdAt) >= last30Days);

    const totalEntries = recentActivities.filter((a) => a.operation === ACTIVITY_OPERATION.INBOUND).reduce((sum, a) => sum + a.quantity, 0);

    const totalExits = recentActivities.filter((a) => a.operation === ACTIVITY_OPERATION.OUTBOUND).reduce((sum, a) => sum + Math.abs(a.quantity), 0);

    const currentPrice = item.prices && item.prices.length > 0 ? item.prices[0].value : 0;
    const stockValue = currentPrice * item.quantity;

    // Check if item has active orders
    const activeOrderStatuses = [ORDER_STATUS.CREATED, ORDER_STATUS.PARTIALLY_FULFILLED, ORDER_STATUS.FULFILLED, ORDER_STATUS.PARTIALLY_RECEIVED];

    const hasActiveOrder = item.orderItems?.some((orderItem) => orderItem.order && activeOrderStatuses.includes(orderItem.order.status)) || false;

    // Use unified stock level determination
    const stockLevel = determineStockLevel({
      quantity: item.quantity || 0,
      reorderPoint: item.reorderPoint || null,
      maxQuantity: item.maxQuantity || null,
      hasActiveOrder,
      stockModel: item.stockModel ?? null,
      fixedTargetQuantity: item.fixedTargetQuantity ?? null,
    });

    const stockMessage = getStockLevelMessage(stockLevel, item.quantity || 0, item.reorderPoint || null);

    // Borrowed quantity (algorithm-spec §13) — prefer summing open borrow quantities
    // when the borrows relation is included; fall back to the relation count.
    const openBorrows = (item.borrows || []).filter((b) => b.returnedAt == null);
    const hasBorrowsRelation = Array.isArray(item.borrows);
    const borrowedQuantity = hasBorrowsRelation
      ? openBorrows.reduce((sum, b) => sum + (b.quantity || 0), 0)
      : 0;
    const borrowedItemsCount = hasBorrowsRelation
      ? openBorrows.length
      : ((item as any)._count?.borrows || 0);

    return {
      totalEntries,
      totalExits,
      stockValue,
      currentPrice,
      movementCount: recentActivities.length,
      stockLevel,
      stockMessage,
      stockLabel: STOCK_LEVEL_LABELS[stockLevel],
      borrowedQuantity,
      borrowedItemsCount,
      hasBorrowsRelation,
    };
  }, [item]);

  return (
    <Card className={cn("shadow-sm border border-border flex flex-col", className)}>
      <CardHeader className="pb-6">
        <CardTitle className="flex items-center gap-2">
          <IconChartBar className="h-5 w-5 text-muted-foreground" />
          Métricas e Análises
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 flex-1">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Current Price */}
          {canViewPrices && (
            <div className="p-4 rounded-xl bg-primary/5 border-0">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-3">
                <IconCurrencyDollar className="h-4 w-4 text-primary" />
                Preço Atual
              </div>
              <p className="text-3xl font-bold text-primary">{formatCurrency(metrics.currentPrice)}</p>
              <p className="text-sm text-muted-foreground mt-1">por unidade</p>
            </div>
          )}

          {/* Stock Value */}
          {canViewPrices && (
            <div className="p-4 rounded-xl bg-primary/5 border-0">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-3">
                <IconCurrencyDollar className="h-4 w-4 text-primary" />
                Valor em Estoque
              </div>
              <p className="text-3xl font-bold text-primary">{formatCurrency(item.totalPrice || metrics.stockValue)}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {fmtQty(item.quantity)} unidades × {formatCurrency(metrics.currentPrice)}
              </p>
            </div>
          )}

          {/* Movements */}
          <div className="p-4 rounded-xl bg-muted/50 border-0">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-4">
              <IconActivity className="h-4 w-4 text-muted-foreground" />
              Movimentações
            </div>

            {/* Entry/Exit Summary */}
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-primary flex items-center gap-1">
                <IconSquareArrowUpFilled className="h-4 w-4" />
                {fmtQty(metrics.totalEntries)} entradas
              </span>
              <span className="text-sm font-medium text-destructive flex items-center gap-1">
                <IconSquareArrowDownFilled className="h-4 w-4" />
                {fmtQty(metrics.totalExits)} saídas
              </span>
            </div>
          </div>

          {/* Stock Status */}
          <div className="p-4 rounded-xl bg-muted/50 border-0">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-3">
              <IconAlertTriangle className="h-4 w-4 text-muted-foreground" />
              Status do Estoque
            </div>
            <div className="flex items-center gap-2">
              <IconAlertTriangleFilled className={cn("h-5 w-5 flex-shrink-0", stockLevelColor(metrics.stockLevel))} />
              <span className={cn("text-base font-semibold", stockLevelColor(metrics.stockLevel))}>{metrics.stockLabel}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-2">{metrics.stockMessage}</p>
            {/* Borrowed sub-indicator (algorithm-spec §13) */}
            {(metrics.hasBorrowsRelation
              ? metrics.borrowedQuantity > 0
              : metrics.borrowedItemsCount > 0) && (
              <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700">
                <IconArrowsExchange className="h-3.5 w-3.5 text-amber-700 dark:text-amber-300" />
                <span className="text-xs font-semibold text-amber-800 dark:text-amber-200">
                  {metrics.hasBorrowsRelation
                    ? `Emprestado: ${metrics.borrowedQuantity.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}`
                    : `Empréstimos abertos: ${metrics.borrowedItemsCount}`}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Relation Counts */}
        <div className="mt-8 pt-8 border-t border-border">
          <h4 className="text-base font-semibold mb-4 text-foreground flex items-center gap-2">
            <IconActivity className="h-4 w-4 text-primary" />
            Contadores de Relações
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 rounded-lg bg-muted/50 border-0 text-center">
              <div className="text-2xl font-bold text-primary mb-1">{(item as any)._count?.activities || 0}</div>
              <div className="text-xs text-muted-foreground">Atividades</div>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 border-0 text-center">
              <div className="text-2xl font-bold text-primary mb-1">{(item as any)._count?.borrows || 0}</div>
              <div className="text-xs text-muted-foreground">Empréstimos</div>
            </div>
            {canViewPrices && (
              <div className="p-3 rounded-lg bg-muted/50 border-0 text-center">
                <div className="text-2xl font-bold text-primary mb-1">{(item as any)._count?.prices || 0}</div>
                <div className="text-xs text-muted-foreground">Histórico Preços</div>
              </div>
            )}
            <div className="p-3 rounded-lg bg-muted/50 border-0 text-center">
              <div className="text-2xl font-bold text-primary mb-1">{(item as any)._count?.relatedItems || 0}</div>
              <div className="text-xs text-muted-foreground">Itens Relacionados</div>
            </div>
          </div>
        </div>

        {/* Stock Levels — current quantity + capacity bar. The exact
            reorder/max values and their formulas live in the "Cálculo de
            Estoque" card to avoid duplicating the same numbers across the page. */}
        <div className="mt-8 pt-8 border-t border-border">
          <h4 className="text-base font-semibold mb-4 text-foreground">Níveis de Estoque</h4>
          <div className="flex items-center justify-between bg-muted/50 rounded-lg px-4 py-3">
            <span className="text-sm font-medium text-muted-foreground">Quantidade Atual</span>
            <span className="font-semibold text-base text-foreground">{fmtQty(item.quantity)}</span>
          </div>

          {/* Visual Stock Level Indicator */}
          {item.maxQuantity !== null && (
            <div className="mt-6">
              <div className="h-3 bg-muted/50 rounded-full overflow-hidden shadow-inner">
                <div
                  className={cn(
                    "h-full transition-all duration-500 shadow-sm",
                    metrics.stockLevel === STOCK_LEVEL.NEGATIVE_STOCK && "bg-neutral-500",
                    metrics.stockLevel === STOCK_LEVEL.OUT_OF_STOCK && "bg-red-700",
                    metrics.stockLevel === STOCK_LEVEL.CRITICAL && "bg-orange-500",
                    metrics.stockLevel === STOCK_LEVEL.LOW && "bg-yellow-500",
                    metrics.stockLevel === STOCK_LEVEL.OPTIMAL && "bg-green-700",
                    metrics.stockLevel === STOCK_LEVEL.OVERSTOCKED && "bg-purple-600",
                  )}
                  style={{
                    width: `${Math.min(100, (item.quantity / item.maxQuantity) * 100)}%`,
                  }}
                />
              </div>
              <div className="flex justify-between mt-2 text-xs font-medium text-muted-foreground">
                <span>0</span>
                <span>{fmtQty(item.maxQuantity)}</span>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
