import { Badge } from "@/components/ui/badge";
import { ORDER_PAYMENT_STATUS, ORDER_PAYMENT_STATUS_LABELS, getBadgeVariant } from "../../../../constants";
import { cn } from "@/lib/utils";

interface OrderPaymentStatusBadgeProps {
  status: ORDER_PAYMENT_STATUS;
  className?: string;
  size?: "default" | "sm" | "lg";
}

export function OrderPaymentStatusBadge({ status, className, size = "default" }: OrderPaymentStatusBadgeProps) {
  // Use centralized badge configuration with entity context
  const variant = getBadgeVariant(status, "ORDER_PAYMENT");

  // Get display text
  const displayText = ORDER_PAYMENT_STATUS_LABELS[status] || status;

  return (
    <Badge variant={variant} size={size} className={cn("font-medium whitespace-nowrap", className)}>
      {displayText}
    </Badge>
  );
}
