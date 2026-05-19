// Shared status badge for Assessment.status — used on both the admin
// detail page and the leader-facing list / fill pages. Uses the project's
// canonical Badge variants so the same colour appears across the app for
// the same semantics.
//
// Mapping:
//   DRAFT     → outline (neutral)
//   OPEN      → inProgress (blue-700)  — same blue as IN_PROGRESS entries
//   CLOSED    → completed  (green-700) — same green as completed entries
//   CANCELLED → cancelled  (red-700)

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ASSESSMENT_STATUS, ASSESSMENT_STATUS_LABELS } from "@/constants";

interface AssessmentStatusBadgeProps {
  status: ASSESSMENT_STATUS | string | null | undefined;
  className?: string;
}

export function AssessmentStatusBadge({ status, className }: AssessmentStatusBadgeProps) {
  const label =
    status && (ASSESSMENT_STATUS_LABELS as any)[status]
      ? (ASSESSMENT_STATUS_LABELS as any)[status]
      : status ?? "—";

  const base = cn("whitespace-nowrap", className);

  switch (status) {
    case ASSESSMENT_STATUS.OPEN:
      return (
        <Badge variant="inProgress" className={base}>
          {label}
        </Badge>
      );
    case ASSESSMENT_STATUS.CLOSED:
      return (
        <Badge variant="completed" className={base}>
          {label}
        </Badge>
      );
    case ASSESSMENT_STATUS.CANCELLED:
      return (
        <Badge variant="cancelled" className={base}>
          {label}
        </Badge>
      );
    case ASSESSMENT_STATUS.DRAFT:
    default:
      return (
        <Badge variant="outline" className={base}>
          {label}
        </Badge>
      );
  }
}
