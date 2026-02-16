import { Badge } from "@/components/ui/badge";
import { ARTWORK_STATUS } from "@/constants/enums";
import { ARTWORK_STATUS_LABELS } from "@/constants/enum-labels";

interface ArtworkStatusBadgeProps {
  status?: string | null;
  size?: "default" | "sm" | "lg";
}

export function ArtworkStatusBadge({ status, size = "default" }: ArtworkStatusBadgeProps) {
  // Don't show badge for DRAFT status (default state)
  if (!status || status === ARTWORK_STATUS.DRAFT) {
    return null;
  }

  const variant = getArtworkStatusVariant(status);
  const label = ARTWORK_STATUS_LABELS[status as ARTWORK_STATUS] || status;

  return (
    <Badge variant={variant} size={size}>
      {label}
    </Badge>
  );
}

function getArtworkStatusVariant(status: string): "approved" | "rejected" | "default" {
  switch (status) {
    case ARTWORK_STATUS.APPROVED:
      return "approved";
    case ARTWORK_STATUS.REPROVED:
      return "rejected";
    default:
      return "default";
  }
}
