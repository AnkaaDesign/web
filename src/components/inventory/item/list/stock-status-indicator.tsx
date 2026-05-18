import type { Item } from "../../../../types";
import { determineStockLevel, getStockLevelMessage } from "../../../../utils";
import { STOCK_LEVEL_LABELS, ORDER_STATUS, STOCK_LEVEL } from "../../../../constants";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { IconAlertTriangleFilled, IconShoppingCart } from "@tabler/icons-react";

interface StockStatusIndicatorProps {
  item: Item;
  showQuantity?: boolean;
  className?: string;
}

// Spec §15 colors — matches stock-thresholds and metrics card.
function getLevelColor(level: STOCK_LEVEL): string {
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
}

export function StockStatusIndicator({ item, showQuantity = true, className }: StockStatusIndicatorProps) {
  const quantity = item.quantity || 0;

  // Prefer the API-computed stockLevel (spec §15 / §18); fall back to local
  // band classification for older payloads.
  const stockLevel =
    item.stockLevel ??
    determineStockLevel(quantity, item.reorderPoint || null, item.maxQuantity || null, false, item.category?.type ?? null);

  // Pending-order badge: prefer API-provided flag, fall back to a scan of
  // included orderItems for legacy callers.
  const activeOrderStatuses = [
    ORDER_STATUS.CREATED,
    ORDER_STATUS.PARTIALLY_FULFILLED,
    ORDER_STATUS.FULFILLED,
    ORDER_STATUS.PARTIALLY_RECEIVED,
  ];
  const hasActiveOrder =
    item.hasActiveOrder ??
    (item.orderItems?.some((orderItem) => orderItem.order && activeOrderStatuses.includes(orderItem.order.status)) || false);

  const color = getLevelColor(stockLevel);
  const label = STOCK_LEVEL_LABELS[stockLevel];
  const description = getStockLevelMessage(stockLevel, quantity, item.reorderPoint || null);

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Tooltip>
        <TooltipTrigger className="inline-flex cursor-help relative" aria-label={label}>
          <IconAlertTriangleFilled className={cn("w-4 h-4 flex-shrink-0", color)} />
          {hasActiveOrder && (
            <span className="absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full bg-blue-700 text-white shadow-sm ring-1 ring-background">
              <IconShoppingCart className="h-2 w-2" />
            </span>
          )}
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1">
            <p className="font-semibold">{label}</p>
            <p className="text-xs">{description}</p>
            {hasActiveOrder && <p className="text-xs text-blue-300">Pedido em aberto para este item</p>}
          </div>
        </TooltipContent>
      </Tooltip>

      {showQuantity && (
        <span className="font-medium tabular-nums">
          {quantity % 1 === 0 ? quantity.toLocaleString("pt-BR") : quantity.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      )}
    </div>
  );
}
