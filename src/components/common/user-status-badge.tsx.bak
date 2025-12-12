import { Badge } from "@/components/ui/badge";
import { USER_STATUS, USER_STATUS_LABELS, getBadgeVariant } from "../../constants";
import { getUserStatusBadgeText } from "../../utils/user";
import { cn } from "@/lib/utils";
import type { User } from "../../types";

interface UserStatusBadgeProps {
  status: USER_STATUS;
  user?: User; // Optional user object for time tracking
  className?: string;
  size?: "default" | "sm" | "lg";
  showTime?: boolean; // Whether to show time information (default: true)
}

export function UserStatusBadge({ status, user, className, size = "default", showTime = true }: UserStatusBadgeProps) {
  // Use centralized badge configuration with entity context
  const variant = getBadgeVariant(status, "USER");

  // Get display text - use time-aware text if user is provided and showTime is true
  let displayText = USER_STATUS_LABELS[status] || status;

  if (user && showTime) {
    displayText = getUserStatusBadgeText(user);
  }

  return (
    <Badge variant={variant} size={size} className={cn("font-medium whitespace-nowrap", className)}>
      {displayText}
    </Badge>
  );
}
