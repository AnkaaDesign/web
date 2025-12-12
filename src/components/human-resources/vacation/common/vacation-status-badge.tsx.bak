import { Badge } from "@/components/ui/badge";
import { VACATION_STATUS, VACATION_STATUS_LABELS, getBadgeVariant } from "../../../../constants";
import { cn } from "@/lib/utils";

interface VacationStatusBadgeProps {
  status: VACATION_STATUS;
  className?: string;
  size?: "default" | "sm" | "lg";
}

export function VacationStatusBadge({ status, className, size = "default" }: VacationStatusBadgeProps) {
  // Use centralized badge configuration with entity context
  const variant = getBadgeVariant(status, "VACATION");

  // Get display text
  const displayText = VACATION_STATUS_LABELS[status] || status;

  return (
    <Badge variant={variant} size={size} className={cn("font-medium", className)}>
      {displayText}
    </Badge>
  );
}
