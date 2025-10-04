import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { IconPackage, IconAlertCircle, IconAlertTriangleFilled } from "@tabler/icons-react";
import type { MaintenanceItem, Item } from "../../../../types";
import { determineStockLevel, getStockLevelTextColor, getStockLevelMessage } from "../../../../utils";
import { STOCK_LEVEL_LABELS } from "../../../../constants";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { routes } from "../../../../constants";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface MaintenanceItemsCardProps {
  maintenanceItems?: Array<MaintenanceItem & { item?: Item }>;
  className?: string;
}

export function MaintenanceItemsCard({ maintenanceItems, className }: MaintenanceItemsCardProps) {
  const safeItems = maintenanceItems || [];

  // Calculate statistics
  const statistics = useMemo(() => {
    const totalItems = safeItems.length;
    const totalQuantityNeeded = safeItems.reduce((sum, mi) => sum + mi.quantity, 0);
    const itemsWithStock = safeItems.filter((mi) => mi.item && mi.item.quantity >= mi.quantity).length;
    const itemsWithoutStock = totalItems - itemsWithStock;

    const stockLevels = safeItems.reduce(
      (acc, mi) => {
        if (mi.item) {
          const level = determineStockLevel(mi.item.quantity || 0, mi.item.reorderPoint || null, mi.item.maxQuantity || null, false);
          acc[level] = (acc[level] || 0) + 1;
        }
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      totalItems,
      totalQuantityNeeded,
      itemsWithStock,
      itemsWithoutStock,
      stockLevels,
    };
  }, [safeItems]);

  if (safeItems.length === 0) {
    return (
      <Card className={cn("shadow-sm border border-border", className)} level={1}>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-3 text-xl">
            <div className="p-2 rounded-lg bg-primary/10">
              <IconPackage className="h-5 w-5 text-primary" />
            </div>
            Itens Necessários
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="text-center py-12">
            <IconAlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Nenhum item necessário para esta manutenção.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("shadow-sm border border-border", className)} level={1}>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-3 text-xl">
          <div className="p-2 rounded-lg bg-primary/10">
            <IconPackage className="h-5 w-5 text-primary" />
          </div>
          Itens Necessários
        </CardTitle>
      </CardHeader>

      <CardContent className="pt-0">
        {/* Statistics Summary */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-card-nested rounded-lg p-3 border border-border">
            <span className="text-xs font-medium text-muted-foreground block">Total de Itens</span>
            <p className="text-xl font-bold mt-1">{statistics.totalItems}</p>
          </div>

          <div className="bg-green-50/80 dark:bg-green-900/20 rounded-lg p-3 border border-green-200/40 dark:border-green-700/40">
            <span className="text-xs font-medium text-green-800 dark:text-green-200 block">Com Estoque</span>
            <p className="text-xl font-bold mt-1 text-green-800 dark:text-green-200">{statistics.itemsWithStock}</p>
          </div>

          <div className="bg-red-50/80 dark:bg-red-900/20 rounded-lg p-3 border border-red-200/40 dark:border-red-700/40">
            <span className="text-xs font-medium text-red-800 dark:text-red-200 block">Sem Estoque</span>
            <p className="text-xl font-bold mt-1 text-red-800 dark:text-red-200">{statistics.itemsWithoutStock}</p>
          </div>
        </div>

        {/* Items Grid */}
        <ScrollArea className="h-[320px]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pr-4">
            {safeItems.map((maintenanceItem) => {
              const item = maintenanceItem.item;
              if (!item) {
                return (
                  <div
                    key={maintenanceItem.id}
                    className="group relative overflow-hidden rounded-lg border border-border/50 dark:border-border/40 bg-muted/30 min-h-[140px] flex flex-col"
                  >
                    <div className="p-3 flex-1 flex flex-col justify-center items-center">
                      <IconAlertCircle className="h-8 w-8 text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">Item não encontrado</p>
                      <Badge variant="secondary" className="mt-2">
                        Qtd: {maintenanceItem.quantity}
                      </Badge>
                    </div>
                  </div>
                );
              }

              const stockLevel = determineStockLevel(item.quantity || 0, item.reorderPoint || null, item.maxQuantity || null, false);
              const stockTextColor = getStockLevelTextColor(stockLevel);
              const hasEnoughStock = item.quantity >= maintenanceItem.quantity;

              return (
                <Link key={maintenanceItem.id} to={routes.inventory.products.details(item.id)} className="block">
                  <div className="group relative overflow-hidden rounded-lg border border-border/50 dark:border-border/40 bg-card hover:bg-muted/50 transition-colors cursor-pointer min-h-[140px] flex flex-col">
                    <div className="p-3 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-sm text-foreground truncate">{item.name}</h4>
                          </div>
                        </div>

                        {item.category && <p className="text-xs text-muted-foreground truncate">{item.category.name}</p>}

                        {item.brand && <p className="text-xs text-muted-foreground truncate">Marca: {item.brand.name}</p>}
                      </div>

                      <div className="mt-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <IconAlertTriangleFilled className={cn("w-4 h-4 flex-shrink-0", stockTextColor)} aria-label={STOCK_LEVEL_LABELS[stockLevel]} />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <div className="space-y-1">
                                    <p className="font-semibold">{STOCK_LEVEL_LABELS[stockLevel]}</p>
                                    <p className="text-xs">{getStockLevelMessage(stockLevel, item.quantity || 0, item.reorderPoint || null)}</p>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>

                            <span className={cn("font-medium tabular-nums text-sm", !hasEnoughStock && "text-red-600 dark:text-red-400")}>{item.quantity || 0} em estoque</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <Badge variant={hasEnoughStock ? "success" : "destructive"} className="text-xs">
                            Necessário: {maintenanceItem.quantity}
                          </Badge>

                          {!hasEnoughStock && <span className="text-xs text-red-600 dark:text-red-400 font-medium">Falta: {maintenanceItem.quantity - item.quantity}</span>}
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
