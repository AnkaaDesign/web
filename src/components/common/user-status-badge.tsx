import { Badge } from "@/components/ui/badge";
import { CONTRACT_TYPE, CONTRACT_TYPE_LABELS, getBadgeVariant } from "../../constants";
import { getUserStatusBadgeText } from "../../utils/user";
import { cn } from "@/lib/utils";
import type { User } from "../../types";

interface UserStatusBadgeProps {
  status: CONTRACT_TYPE;
  user?: User; // Optional user object for time tracking
  className?: string;
  size?: "default" | "sm" | "lg";
  showTime?: boolean; // Whether to show time information (default: true)
}

export function UserStatusBadge({ status, user, className, size = "default", showTime = true }: UserStatusBadgeProps) {
  // Use centralized badge configuration with entity context (keyed by CONTRACT_TYPE)
  const variant = getBadgeVariant(status, "USER");

  // Get display text - use time-aware text if user is provided and showTime is true
  let displayText = CONTRACT_TYPE_LABELS[status] || status;

  if (user && showTime) {
    displayText = getUserStatusBadgeText(user);
  }

  return (
    <Badge variant={variant} size={size} className={cn("font-medium whitespace-nowrap", className)}>
      {displayText}
    </Badge>
  );
}
