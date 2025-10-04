import type { Item } from "../../../../types";
import { determineStockLevel, getStockLevelMessage } from "../../../../utils";
import { STOCK_LEVEL_LABELS, ORDER_STATUS, STOCK_LEVEL } from "../../../../constants";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { IconAlertTriangleFilled } from "@tabler/icons-react";

interface StockStatusIndicatorProps {
  item: Item;
  showQuantity?: boolean;
  className?: string;
}

export function StockStatusIndicator({ item, showQuantity = true, className }: StockStatusIndicatorProps) {
  const quantity = item.quantity || 0;

  // Check if item has active orders
  const activeOrderStatuses = [ORDER_STATUS.CREATED, ORDER_STATUS.PARTIALLY_FULFILLED, ORDER_STATUS.FULFILLED, ORDER_STATUS.PARTIALLY_RECEIVED];

  const hasActiveOrder = item.orderItems?.some((orderItem) => orderItem.order && activeOrderStatuses.includes(orderItem.order.status)) || false;

  // Determine stock level using the unified algorithm
  const stockLevel = determineStockLevel(quantity, item.reorderPoint || null, item.maxQuantity || null, hasActiveOrder);

  // Get color based on stock level
  const getColor = () => {
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

  const status = {
    color: getColor(),
    label: STOCK_LEVEL_LABELS[stockLevel],
    description: getStockLevelMessage(stockLevel, quantity, item.reorderPoint || null),
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <IconAlertTriangleFilled className={cn("w-4 h-4 flex-shrink-0", status.color)} aria-label={status.label} />
          </TooltipTrigger>
          <TooltipContent>
            <div className="space-y-1">
              <p className="font-semibold">{status.label}</p>
              <p className="text-xs">{status.description}</p>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {showQuantity && (
        <span className="font-medium tabular-nums">
          {quantity % 1 === 0 ? quantity.toLocaleString("pt-BR") : quantity.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      )}
    </div>
  );
}
