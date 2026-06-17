import { Badge } from "@/components/ui/badge";
import { CONTRACT_TYPE, CONTRACT_TYPE_LABELS } from "../../constants";
import { getCollaboratorStatus } from "../../utils/user";
import { cn } from "@/lib/utils";
import type { User } from "../../types";

interface UserStatusBadgeProps {
  status: CONTRACT_TYPE;
  user?: User; // Optional user object — drives the unified collaborator status badge
  className?: string;
  size?: "default" | "sm" | "lg";
  showTime?: boolean; // Whether to show time information (default: true)
}

export function UserStatusBadge({ status, user, className, size = "default", showTime = true }: UserStatusBadgeProps) {
  // When a full user is provided, the unified collaborator status drives both the
  // label and the color (so "Efetivado" is never produced from the contract type).
  if (user) {
    const { label, variant } = getCollaboratorStatus(user);
    return (
      <Badge variant={variant} size={size} className={cn("font-medium whitespace-nowrap", className)}>
        {showTime ? label : label.split(" - ")[0]}
      </Badge>
    );
  }

  // Fallback: only a contract-type modality is known — render it as a neutral label.
  return (
    <Badge variant="outline" size={size} className={cn("font-medium whitespace-nowrap", className)}>
      {CONTRACT_TYPE_LABELS[status] || status}
    </Badge>
  );
}
