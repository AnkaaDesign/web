import { Badge } from "@/components/ui/badge";
import { ORDER_PAYMENT_STATUS, ORDER_PAYMENT_STATUS_LABELS, getBadgeVariant } from "../../../../constants";
import { cn } from "@/lib/utils";

interface OrderPaymentStatusBadgeProps {
  status: ORDER_PAYMENT_STATUS;
  // Accepted for call-site compatibility; no longer affects the label. The old
  // "A Definir" derivation (AWAITING + no method) was retired — the PENDING status
  // now represents a not-yet-requested order, and a requisitioned (AWAITING) order
  // is always payable, with or without a method chosen.
  paymentMethod?: string | null;
  className?: string;
  size?: "default" | "sm" | "lg";
}

export function OrderPaymentStatusBadge({ status, className, size = "default" }: OrderPaymentStatusBadgeProps) {
  // The stored payment status drives the badge directly: PENDING → "Pagamento
  // Pendente" (gray), AWAITING_PAYMENT → "Aguardando Pagamento" (amber),
  // Parcialmente Pago / Pago as-is. No method-derived "A Definir" state.
  const variant = getBadgeVariant(status, "ORDER_PAYMENT");
  const displayText = ORDER_PAYMENT_STATUS_LABELS[status] || status;

  return (
    <Badge variant={variant} size={size} className={cn("font-medium whitespace-nowrap", className)}>
      {displayText}
    </Badge>
  );
}
