import { Badge } from "@/components/ui/badge";
import { EXTERNAL_OPERATION_STATUS, EXTERNAL_OPERATION_STATUS_LABELS, getBadgeVariant } from "../../../../constants";
import { cn } from "@/lib/utils";

interface ExternalOperationStatusBadgeProps {
  status: EXTERNAL_OPERATION_STATUS;
  className?: string;
  size?: "default" | "sm" | "lg";
}

export function ExternalOperationStatusBadge({ status, className, size = "default" }: ExternalOperationStatusBadgeProps) {
  // Use centralized badge configuration with entity context
  const variant = getBadgeVariant(status, "EXTERNAL_OPERATION");

  // Get display text
  const displayText = EXTERNAL_OPERATION_STATUS_LABELS[status] || status;

  return (
    <Badge variant={variant} size={size} className={cn("font-medium", className)}>
      {displayText}
    </Badge>
  );
}
