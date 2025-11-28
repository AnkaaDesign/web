import { Badge } from "@/components/ui/badge";
import { ORDER_STATUS, ORDER_STATUS_LABELS, getBadgeVariant } from "../../../../constants";
import { cn } from "@/lib/utils";

interface OrderStatusBadgeProps {
  status: ORDER_STATUS;
  className?: string;
  size?: "default" | "sm" | "lg";
}

export function OrderStatusBadge({ status, className, size = "default" }: OrderStatusBadgeProps) {
  // Use centralized badge configuration with entity context
  const variant = getBadgeVariant(status, "ORDER");

  // Get display text
  const displayText = ORDER_STATUS_LABELS[status] || status;

  return (
    <Badge variant={variant} size={size} className={cn("font-medium whitespace-nowrap", className)}>
      {displayText}
    </Badge>
  );
}
