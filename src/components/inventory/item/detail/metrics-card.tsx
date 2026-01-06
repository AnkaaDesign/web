import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IconChartBar, IconSquareArrowUpFilled, IconSquareArrowDownFilled, IconCurrencyDollar, IconActivity, IconAlertTriangle, IconTags } from "@tabler/icons-react";
import type { Item } from "../../../../types";
import { formatCurrency, determineStockLevel, getStockLevelMessage } from "../../../../utils";
import { STOCK_LEVEL_LABELS, ORDER_STATUS, ABC_CATEGORY_LABELS, XYZ_CATEGORY_LABELS, ACTIVITY_OPERATION, STOCK_LEVEL } from "../../../../constants";
import { useMemo } from "react";
import { cn } from "@/lib/utils";

interface MetricsCardProps {
  item: Item;
  className?: string;
}

export function MetricsCard({ item, className }: MetricsCardProps) {
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
    const stockLevel = determineStockLevel(item.quantity || 0, item.reorderPoint || null, item.maxQuantity || null, hasActiveOrder);

    const stockMessage = getStockLevelMessage(stockLevel, item.quantity || 0, item.reorderPoint || null);

    return {
      totalEntries,
      totalExits,
      stockValue,
      currentPrice,
      movementCount: recentActivities.length,
      stockLevel,
      stockMessage,
      stockLabel: STOCK_LEVEL_LABELS[stockLevel],
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
          <div className="p-4 rounded-xl bg-primary/5 border-0">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-3">
              <IconCurrencyDollar className="h-4 w-4 text-primary" />
              Preço Atual
            </div>
            <p className="text-3xl font-bold text-primary">{formatCurrency(metrics.currentPrice)}</p>
            <p className="text-sm text-muted-foreground mt-1">por unidade</p>
          </div>

          {/* Stock Value */}
          <div className="p-4 rounded-xl bg-primary/5 border-0">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-3">
              <IconCurrencyDollar className="h-4 w-4 text-primary" />
              Valor em Estoque
            </div>
            <p className="text-3xl font-bold text-primary">{formatCurrency(item.totalPrice || metrics.stockValue)}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {item.quantity} unidades × {formatCurrency(metrics.currentPrice)}
            </p>
          </div>

          {/* Movements */}
          <div className="p-4 rounded-xl bg-muted/50 border-0">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-4">
              <IconActivity className="h-4 w-4 text-muted-foreground" />
              Movimentações
            </div>

            {/* Entry/Exit Summary */}
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-green-700 dark:text-green-300 flex items-center gap-1">
                <IconSquareArrowUpFilled className="h-4 w-4" />
                {metrics.totalEntries} entradas
              </span>
              <span className="text-sm font-medium text-red-700 dark:text-red-300 flex items-center gap-1">
                <IconSquareArrowDownFilled className="h-4 w-4" />
                {metrics.totalExits} saídas
              </span>
            </div>
          </div>

          {/* Stock Status */}
          <div className="p-4 rounded-xl bg-muted/50 border-0">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-3">
              <IconAlertTriangle className="h-4 w-4 text-muted-foreground" />
              Status do Estoque
            </div>
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "h-3 w-3 rounded-full shadow-sm",
                  metrics.stockLevel === STOCK_LEVEL.NEGATIVE_STOCK && "bg-neutral-500 shadow-neutral-500/50",
                  metrics.stockLevel === STOCK_LEVEL.OUT_OF_STOCK && "bg-red-700 shadow-red-700/50",
                  metrics.stockLevel === STOCK_LEVEL.CRITICAL && "bg-orange-500 shadow-orange-500/50",
                  metrics.stockLevel === STOCK_LEVEL.LOW && "bg-yellow-400 shadow-yellow-400/50",
                  metrics.stockLevel === STOCK_LEVEL.OPTIMAL && "bg-green-700 shadow-green-700/50",
                  metrics.stockLevel === STOCK_LEVEL.OVERSTOCKED && "bg-purple-500 shadow-purple-500/50",
                )}
              />
              <span
                className={cn(
                  "text-base font-semibold",
                  metrics.stockLevel === STOCK_LEVEL.NEGATIVE_STOCK && "text-neutral-500",
                  metrics.stockLevel === STOCK_LEVEL.OUT_OF_STOCK && "text-red-700 dark:text-red-300",
                  metrics.stockLevel === STOCK_LEVEL.CRITICAL && "text-orange-500 dark:text-orange-400",
                  metrics.stockLevel === STOCK_LEVEL.LOW && "text-yellow-400",
                  metrics.stockLevel === STOCK_LEVEL.OPTIMAL && "text-green-700 dark:text-green-300",
                  metrics.stockLevel === STOCK_LEVEL.OVERSTOCKED && "text-purple-600 dark:text-purple-400",
                )}
              >
                {metrics.stockLabel}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-2">{metrics.stockMessage}</p>
          </div>
        </div>

        {/* Relation Counts */}
        <div className="mt-8 pt-8 border-t border-border/50">
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
            <div className="p-3 rounded-lg bg-muted/50 border-0 text-center">
              <div className="text-2xl font-bold text-primary mb-1">{(item as any)._count?.prices || 0}</div>
              <div className="text-xs text-muted-foreground">Histórico Preços</div>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 border-0 text-center">
              <div className="text-2xl font-bold text-primary mb-1">{(item as any)._count?.relatedItems || 0}</div>
              <div className="text-xs text-muted-foreground">Itens Relacionados</div>
            </div>
          </div>
        </div>

        {/* ABC/XYZ Categorization */}
        {(item.abcCategory || item.xyzCategory) && (
          <div className="mt-8 pt-8 border-t border-border/50">
            <h4 className="text-base font-semibold mb-4 text-foreground flex items-center gap-2">
              <IconTags className="h-4 w-4 text-primary" />
              Categorização ABC/XYZ
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {item.abcCategory && (
                <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500" />
                    <span className="font-semibold text-blue-800 dark:text-blue-200 text-sm">Análise ABC</span>
                  </div>
                  <p className="text-blue-700 dark:text-blue-300 font-medium">{ABC_CATEGORY_LABELS[item.abcCategory]}</p>
                </div>
              )}
              {item.xyzCategory && (
                <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-3 h-3 rounded-full bg-purple-500" />
                    <span className="font-semibold text-purple-800 dark:text-purple-200 text-sm">Análise XYZ</span>
                  </div>
                  <p className="text-purple-700 dark:text-purple-300 font-medium">{XYZ_CATEGORY_LABELS[item.xyzCategory]}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Stock Levels */}
        <div className="mt-8 pt-8 border-t border-border/50">
          <h4 className="text-base font-semibold mb-4 text-foreground">Níveis de Estoque</h4>
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-muted/50 rounded-lg px-4 py-3">
              <span className="text-sm font-medium text-muted-foreground">Quantidade Atual</span>
              <span className="font-semibold text-base text-foreground">{item.quantity}</span>
            </div>
            {item.maxQuantity !== null && (
              <div className="flex items-center justify-between bg-muted/50 rounded-lg px-4 py-3">
                <span className="text-sm font-medium text-muted-foreground">Máximo</span>
                <span className="font-semibold text-base text-foreground">{item.maxQuantity}</span>
              </div>
            )}
            {item.reorderPoint !== null && (
              <div className="flex items-center justify-between bg-muted/50 rounded-lg px-4 py-3">
                <span className="text-sm font-medium text-muted-foreground">Ponto de Reposição</span>
                <span className="font-semibold text-base text-foreground">{item.reorderPoint}</span>
              </div>
            )}
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
                    metrics.stockLevel === STOCK_LEVEL.OVERSTOCKED && "bg-blue-500",
                  )}
                  style={{
                    width: `${Math.min(100, (item.quantity / item.maxQuantity) * 100)}%`,
                  }}
                />
              </div>
              <div className="flex justify-between mt-2 text-xs font-medium text-muted-foreground">
                <span>0</span>
                <span>{item.maxQuantity}</span>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
