import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { IconBox, IconInfoCircle, IconExternalLink, IconCurrencyDollar, IconBoxMultiple, IconAlertTriangleFilled } from "@tabler/icons-react";
import type { Item } from "../../../../types";
import { determineStockLevel, getStockLevelMessage, formatCurrency } from "../../../../utils";
import { STOCK_LEVEL_LABELS, MEASURE_UNIT_LABELS, ORDER_STATUS, MEASURE_UNIT, STOCK_LEVEL } from "../../../../constants";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { routes } from "../../../../constants";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface TargetItemCardProps {
  item?: Item;
  className?: string;
}

export function TargetItemCard({ item, className }: TargetItemCardProps) {
  const navigate = useNavigate();
  if (!item) {
    return (
      <Card className={cn("shadow-sm border border-border", className)}>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2">
          <IconBox className="h-5 w-5 text-muted-foreground" />
          Equipamento da Manutenção
        </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="text-center py-12">
            <IconInfoCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Nenhum equipamento especificado para esta manutenção.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Get the most recent price from the prices array
  const currentPrice = item.prices && item.prices.length > 0 ? item.prices[0].value : null;

  // Check if item has active orders
  const activeOrderStatuses = [ORDER_STATUS.CREATED, ORDER_STATUS.PARTIALLY_FULFILLED, ORDER_STATUS.FULFILLED, ORDER_STATUS.PARTIALLY_RECEIVED];

  const hasActiveOrder = item.orderItems?.some((orderItem) => orderItem.order && activeOrderStatuses.includes(orderItem.order.status)) || false;

  // Determine stock level using the unified algorithm
  const stockLevel = determineStockLevel(item.quantity || 0, item.reorderPoint || null, item.maxQuantity || null, hasActiveOrder);

  // Get color based on stock level
  const getStockColor = () => {
    switch (stockLevel) {
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

  const stockStatus = {
    color: getStockColor(),
    label: STOCK_LEVEL_LABELS[stockLevel],
    description: getStockLevelMessage(stockLevel, item.quantity || 0, item.reorderPoint || null),
  };

  const handleViewItem = () => {
    navigate(routes.inventory.products.details(item.id));
  };

  return (
    <Card className={cn("shadow-sm border border-border flex flex-col", className)}>
      <CardHeader className="pb-6">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
          <IconBox className="h-5 w-5 text-muted-foreground" />
          Equipamento da Manutenção
        </CardTitle>
          <Button variant="ghost" size="sm" onClick={handleViewItem} className="text-xs">
            <IconExternalLink className="h-3 w-3 mr-1" />
            Ver detalhes
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0 flex-1">
        <div className="space-y-6">
          {/* Product Information Section */}
          <div>
            <h3 className="text-base font-semibold mb-4 text-foreground">Informações do Produto</h3>
            <div className="space-y-4">
              {/* Item Name */}
              <div className="bg-muted/30 rounded-lg p-4">
                <p className="text-base font-semibold text-foreground">
                  {item.uniCode && (
                    <>
                      <span className="font-mono text-sm text-muted-foreground">{item.uniCode}</span>
                      <span className="mx-2 text-muted-foreground">-</span>
                    </>
                  )}
                  {item.name}
                </p>
              </div>

              {/* Brand */}
              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                <span className="text-sm font-medium text-muted-foreground">Marca</span>
                <span className="text-sm font-semibold text-foreground">{item.brand ? item.brand.name : <span className="text-muted-foreground italic">Não definida</span>}</span>
              </div>

              {/* Category */}
              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                <span className="text-sm font-medium text-muted-foreground">Categoria</span>
                <span className="text-sm font-semibold text-foreground">
                  {item.category ? item.category.name : <span className="text-muted-foreground italic">Não definida</span>}
                </span>
              </div>

              {/* Supplier */}
              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                <span className="text-sm font-medium text-muted-foreground">Fornecedor</span>
                <span className="text-sm font-semibold text-foreground">
                  {item.supplier ? item.supplier.fantasyName || item.supplier.name : <span className="text-muted-foreground italic">Não definido</span>}
                </span>
              </div>
            </div>
          </div>

          {/* Stock and Price Section */}
          <div className="pt-6 border-t border-border/50">
            <h3 className="text-base font-semibold mb-4 text-foreground">Estoque e Preço</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-muted/30 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <IconBoxMultiple className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">Estoque Atual</span>
                </div>
                <div className="flex items-center gap-2">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <IconAlertTriangleFilled className={cn("w-5 h-5 flex-shrink-0", stockStatus.color)} aria-label={stockStatus.label} />
                      </TooltipTrigger>
                      <TooltipContent>
                        <div className="space-y-1">
                          <p className="font-semibold">{stockStatus.label}</p>
                          <p className="text-xs">{stockStatus.description}</p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <p className="text-2xl font-bold text-foreground">
                    {item.quantity % 1 === 0
                      ? item.quantity.toLocaleString("pt-BR")
                      : item.quantity.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                {item.measureUnit && <p className="text-sm text-muted-foreground mt-1">{MEASURE_UNIT_LABELS[item.measureUnit as MEASURE_UNIT]}</p>}
              </div>
              <div className="bg-muted/30 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <IconCurrencyDollar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">Preço Unitário</span>
                </div>
                {currentPrice !== null && currentPrice !== undefined ? (
                  <p className="text-2xl font-bold text-foreground">{formatCurrency(currentPrice)}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">Não definido</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
