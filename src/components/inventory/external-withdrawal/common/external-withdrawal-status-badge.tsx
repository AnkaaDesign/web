import { Badge } from "@/components/ui/badge";
import { EXTERNAL_WITHDRAWAL_STATUS, EXTERNAL_WITHDRAWAL_STATUS_LABELS, getBadgeVariant } from "../../../../constants";
import { cn } from "@/lib/utils";

interface ExternalWithdrawalStatusBadgeProps {
  status: EXTERNAL_WITHDRAWAL_STATUS;
  className?: string;
  size?: "default" | "sm" | "lg";
}

export function ExternalWithdrawalStatusBadge({ status, className, size = "default" }: ExternalWithdrawalStatusBadgeProps) {
  // Use centralized badge configuration with entity context
  const variant = getBadgeVariant(status, "EXTERNAL_WITHDRAWAL");

  // Get display text
  const displayText = EXTERNAL_WITHDRAWAL_STATUS_LABELS[status] || status;

  return (
    <Badge variant={variant} size={size} className={cn("font-medium", className)}>
      {displayText}
    </Badge>
  );
}
