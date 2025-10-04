import { Badge } from "@/components/ui/badge";
import { STOCK_LEVEL, STOCK_LEVEL_LABELS, getBadgeVariant } from "../../../../constants";
import { cn } from "@/lib/utils";

interface StockLevelBadgeProps {
  level: STOCK_LEVEL;
  className?: string;
  size?: "default" | "sm" | "lg";
}

export function StockLevelBadge({ level, className, size = "default" }: StockLevelBadgeProps) {
  // Use centralized badge configuration with entity context
  const variant = getBadgeVariant(level, "STOCK");

  // Get display text
  const displayText = STOCK_LEVEL_LABELS[level] || level;

  // Add pulsing animation for critical stock levels
  const shouldPulse = level === STOCK_LEVEL.NEGATIVE_STOCK || level === STOCK_LEVEL.OUT_OF_STOCK;

  return (
    <Badge variant={variant} size={size} className={cn("font-medium", shouldPulse && "animate-pulse", className)}>
      {displayText}
    </Badge>
  );
}
