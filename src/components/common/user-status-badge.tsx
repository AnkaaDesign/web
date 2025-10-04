import { Badge } from "@/components/ui/badge";
import { USER_STATUS, USER_STATUS_LABELS, getBadgeVariant } from "../../constants";
import { cn } from "@/lib/utils";

interface UserStatusBadgeProps {
  status: USER_STATUS;
  className?: string;
  size?: "default" | "sm" | "lg";
}

export function UserStatusBadge({ status, className, size = "default" }: UserStatusBadgeProps) {
  // Use centralized badge configuration with entity context
  const variant = getBadgeVariant(status, "USER");

  // Get display text
  const displayText = USER_STATUS_LABELS[status] || status;

  return (
    <Badge variant={variant} size={size} className={cn("font-medium", className)}>
      {displayText}
    </Badge>
  );
}
