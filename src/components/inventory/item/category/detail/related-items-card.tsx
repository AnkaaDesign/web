import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { IconPackage, IconAlertCircle, IconAlertTriangleFilled } from "@tabler/icons-react";
import type { ItemCategory } from "../../../../../types";
import { formatCurrency, determineStockLevel, getStockLevelTextColor, getStockLevelMessage } from "../../../../../utils";
import { STOCK_LEVEL_LABELS, ORDER_STATUS, STOCK_LEVEL } from "../../../../../constants";
import { cn } from "@/lib/utils";
import { Link, useNavigate } from "react-router-dom";
import { routes } from "../../../../../constants";

interface RelatedItemsCardProps {
  category?: ItemCategory;
  className?: string;
  maxHeight?: string;
}

export function RelatedItemsCard({ category, className, maxHeight }: RelatedItemsCardProps) {
  const navigate = useNavigate();
  const items = category?.items || [];

  // Sort items by quantity (low stock first) and name
  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      // Check if items have active orders
      const activeOrderStatuses = [ORDER_STATUS.CREATED, ORDER_STATUS.PARTIALLY_FULFILLED, ORDER_STATUS.FULFILLED, ORDER_STATUS.PARTIALLY_RECEIVED];

      const aHasActiveOrder = a.orderItems?.some((orderItem) => orderItem.order && activeOrderStatuses.includes(orderItem.order.status)) || false;

      const bHasActiveOrder = b.orderItems?.some((orderItem) => orderItem.order && activeOrderStatuses.includes(orderItem.order.status)) || false;

      // First sort by stock level priority (critical items first)
      const aLevel = determineStockLevel(a.quantity || 0, a.reorderPoint || null, a.maxQuantity || null, aHasActiveOrder);
      const bLevel = determineStockLevel(b.quantity || 0, b.reorderPoint || null, b.maxQuantity || null, bHasActiveOrder);

      const levelPriority = { NEGATIVE_STOCK: 0, OUT_OF_STOCK: 1, CRITICAL: 2, LOW: 3, OPTIMAL: 4, OVERSTOCKED: 5 };
      const aPriority = levelPriority[aLevel] ?? 6;
      const bPriority = levelPriority[bLevel] ?? 6;

      if (aPriority !== bPriority) return aPriority - bPriority;

      // Then sort by name
      return a.name.localeCompare(b.name);
    });
  }, [items]);

  // Calculate statistics
  const statistics = useMemo(() => {
    const totalItems = items.length;
    const activeItems = items.filter((item) => item.isActive).length;
    const inactiveItems = totalItems - activeItems;
    const totalValue = items.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
    const ppeItems = items.filter((item) => item.ppeCA).length;

    const stockLevels = items.reduce(
      (acc, item) => {
        // Check if item has active orders
        const activeOrderStatuses = [ORDER_STATUS.CREATED, ORDER_STATUS.PARTIALLY_FULFILLED, ORDER_STATUS.FULFILLED, ORDER_STATUS.PARTIALLY_RECEIVED];

        const hasActiveOrder = item.orderItems?.some((orderItem) => orderItem.order && activeOrderStatuses.includes(orderItem.order.status)) || false;

        const level = determineStockLevel(item.quantity || 0, item.reorderPoint || null, item.maxQuantity || null, hasActiveOrder);
        acc[level] = (acc[level] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      totalItems,
      activeItems,
      inactiveItems,
      totalValue,
      ppeItems,
      stockLevels,
    };
  }, [items]);

  if (items.length === 0) {
    return (
      <Card className={cn("shadow-sm border border-border", className)} level={1}>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-3 text-xl">
              <div className="p-2 rounded-lg bg-primary/10">
                <IconPackage className="h-5 w-5 text-primary" />
              </div>
              Produtos Relacionados
            </CardTitle>
            {category?.id && (
              <Button variant="outline" size="sm" onClick={() => navigate(`${routes.inventory.products.list}?categories=${category.id}`)}>
                Ver no estoque
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="text-center py-12">
            <IconAlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Nenhum produto associado a esta categoria.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("shadow-sm border border-border", className)} level={1}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-3 text-xl">
            <div className="p-2 rounded-lg bg-primary/10">
              <IconPackage className="h-5 w-5 text-primary" />
            </div>
            Produtos Relacionados
          </CardTitle>
          {category?.id && (
            <Button variant="outline" size="sm" onClick={() => navigate(`${routes.inventory.products.list}?categories=${category.id}`)}>
              Ver no estoque
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0 flex-grow flex flex-col min-h-0">
        {/* Statistics Summary */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-card-nested rounded-lg p-3 border border-border">
            <span className="text-xs font-medium text-muted-foreground block">Total de Produtos</span>
            <p className="text-xl font-bold mt-1">{statistics.totalItems}</p>
          </div>

          <div className="bg-green-50/80 dark:bg-green-900/20 rounded-lg p-3 border border-green-200/40 dark:border-green-700/40">
            <span className="text-xs font-medium text-green-800 dark:text-green-200 block">Produtos Ativos</span>
            <p className="text-xl font-bold mt-1 text-green-800 dark:text-green-200">{statistics.activeItems}</p>
          </div>

          <div className="bg-blue-50/80 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200/40 dark:border-blue-700/40">
            <span className="text-xs font-medium text-blue-800 dark:text-blue-200 block">Valor Total</span>
            <p className="text-xl font-bold mt-1 text-blue-800 dark:text-blue-200">{formatCurrency(statistics.totalValue)}</p>
          </div>
        </div>

        {/* Stock Level Summary */}
        <div className="flex flex-wrap gap-2 mb-4">
          {[STOCK_LEVEL.NEGATIVE_STOCK, STOCK_LEVEL.OUT_OF_STOCK, STOCK_LEVEL.CRITICAL, STOCK_LEVEL.LOW, STOCK_LEVEL.OPTIMAL, STOCK_LEVEL.OVERSTOCKED].map((level) => {
            const count = statistics.stockLevels[level] || 0;
            const stockLevelColors = {
              [STOCK_LEVEL.NEGATIVE_STOCK]: "bg-neutral-500 hover:bg-neutral-600 text-white border-neutral-500",
              [STOCK_LEVEL.OUT_OF_STOCK]: "bg-red-700 hover:bg-red-800 text-white border-red-700",
              [STOCK_LEVEL.CRITICAL]: "bg-orange-500 hover:bg-orange-600 text-white border-orange-500",
              [STOCK_LEVEL.LOW]: "bg-yellow-500 hover:bg-yellow-600 text-white border-yellow-500",
              [STOCK_LEVEL.OPTIMAL]: "bg-green-700 hover:bg-green-800 text-white border-green-700",
              [STOCK_LEVEL.OVERSTOCKED]: "bg-purple-600 hover:bg-purple-700 text-white border-purple-600",
            };
            const colorClass = stockLevelColors[level];
            return (
              <Badge key={level} className={cn("font-medium border", colorClass)}>
                {STOCK_LEVEL_LABELS[level]} ({count})
              </Badge>
            );
          })}
        </div>

        {/* Items Grid */}
        <ScrollArea className="pr-4 flex-grow" style={maxHeight ? { maxHeight } : undefined}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {sortedItems.map((item) => {
              // Check if item has active orders
              const activeOrderStatuses = [ORDER_STATUS.CREATED, ORDER_STATUS.PARTIALLY_FULFILLED, ORDER_STATUS.FULFILLED, ORDER_STATUS.PARTIALLY_RECEIVED];

              const hasActiveOrder = item.orderItems?.some((orderItem) => orderItem.order && activeOrderStatuses.includes(orderItem.order.status)) || false;

              const stockLevel = determineStockLevel(item.quantity || 0, item.reorderPoint || null, item.maxQuantity || null, hasActiveOrder);
              const stockTextColor = getStockLevelTextColor(stockLevel);
              const quantity = item.quantity || 0;

              return (
                <Link key={item.id} to={routes.inventory.products.details(item.id)} className="block">
                  <div className="group relative overflow-hidden rounded-lg border border-border/50 dark:border-border/40 bg-card hover:bg-muted/50 transition-colors cursor-pointer min-h-[140px] flex flex-col">
                    <div className="p-3 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-sm text-foreground truncate">{item.name}</h4>
                          </div>
                        </div>

                        {item.brand && <p className="text-xs text-muted-foreground truncate">{item.brand.name}</p>}

                        {!item.isActive && (
                          <div className="flex flex-wrap items-center gap-1 mt-1">
                            <Badge variant="secondary" className="text-xs">
                              Inativo
                            </Badge>
                          </div>
                        )}
                      </div>

                      <div className="mt-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <IconAlertTriangleFilled className={cn("w-4 h-4 flex-shrink-0", stockTextColor)} aria-label={STOCK_LEVEL_LABELS[stockLevel]} />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <div className="space-y-1">
                                    <p className="font-semibold">{STOCK_LEVEL_LABELS[stockLevel]}</p>
                                    <p className="text-xs">{getStockLevelMessage(stockLevel, quantity, item.reorderPoint || null)}</p>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>

                            <span className="font-medium tabular-nums text-sm">{quantity.toLocaleString("pt-BR")} un</span>
                          </div>

                          {item.totalPrice && item.totalPrice > 0 && <p className="text-xs text-muted-foreground font-medium">{formatCurrency(item.totalPrice)}</p>}
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
