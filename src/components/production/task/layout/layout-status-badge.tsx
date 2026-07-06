import { Badge } from "@/components/ui/badge";
import { LAYOUT_STATUS } from "@/constants/enums";
import { LAYOUT_STATUS_LABELS } from "@/constants/enum-labels";

interface LayoutStatusBadgeProps {
  status?: string | null;
  size?: "default" | "sm" | "lg";
}

export function LayoutStatusBadge({ status, size = "default" }: LayoutStatusBadgeProps) {
  // Don't show badge for DRAFT status (default state)
  if (!status || status === LAYOUT_STATUS.DRAFT) {
    return null;
  }

  const variant = getLayoutStatusVariant(status);
  const label = LAYOUT_STATUS_LABELS[status as LAYOUT_STATUS] || status;

  return (
    <Badge variant={variant} size={size}>
      {label}
    </Badge>
  );
}

function getLayoutStatusVariant(status: string): "approved" | "rejected" | "default" {
  switch (status) {
    case LAYOUT_STATUS.APPROVED:
      return "approved";
    case LAYOUT_STATUS.REPROVED:
      return "rejected";
    default:
      return "default";
  }
}
