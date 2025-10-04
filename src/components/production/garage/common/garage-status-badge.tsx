import { Badge } from "@/components/ui/badge";
import { GARAGE_STATUS, GARAGE_STATUS_LABELS, getBadgeVariant } from "../../../../constants";
import { cn } from "@/lib/utils";

interface GarageStatusBadgeProps {
  status: GARAGE_STATUS;
  className?: string;
  size?: "default" | "sm" | "lg";
}

export function GarageStatusBadge({ status, className, size = "default" }: GarageStatusBadgeProps) {
  // Use centralized badge configuration with entity context
  const variant = getBadgeVariant(status, "GARAGE");

  // Get display text
  const displayText = GARAGE_STATUS_LABELS[status] || status;

  return (
    <Badge variant={variant} size={size} className={cn("font-medium", className)}>
      {displayText}
    </Badge>
  );
}
