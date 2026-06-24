import { Badge } from "@/components/ui/badge";
import { ORDER_PAYMENT_STATUS, ORDER_PAYMENT_STATUS_LABELS, getBadgeVariant } from "../../../../constants";
import { cn } from "@/lib/utils";

interface OrderPaymentStatusBadgeProps {
  status: ORDER_PAYMENT_STATUS;
  // The order's payment method. Pass it so the badge can tell a genuinely payable
  // order (PIX/Boleto/Cartão chosen → amber "Aguardando Pagamento") apart from one
  // that was just created with no payment configured yet (neutral "A Definir").
  // This is derived live — once a method is set the badge flips automatically,
  // there is no stored "A Definir" status to keep in sync.
  paymentMethod?: string | null;
  className?: string;
  size?: "default" | "sm" | "lg";
}

export function OrderPaymentStatusBadge({ status, paymentMethod, className, size = "default" }: OrderPaymentStatusBadgeProps) {
  // "Aguardando Pagamento" with no payment method means nothing was set up — the
  // obligation isn't configured, so show a neutral "A Definir" instead of implying
  // a payment is staged and waiting. Settled states (Parcialmente Pago / Pago) are
  // shown as-is; PARTIALLY_PAID only comes from boleto (which always has a method).
  const isUnconfigured = status === ORDER_PAYMENT_STATUS.AWAITING_PAYMENT && !paymentMethod;

  // Use centralized badge configuration with entity context
  const variant = isUnconfigured ? "secondary" : getBadgeVariant(status, "ORDER_PAYMENT");

  // Get display text
  const displayText = isUnconfigured ? "A Definir" : ORDER_PAYMENT_STATUS_LABELS[status] || status;

  return (
    <Badge variant={variant} size={size} className={cn("font-medium whitespace-nowrap", className)}>
      {displayText}
    </Badge>
  );
}
