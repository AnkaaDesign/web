// Shared status badge for AssessmentEntry.status — used across the admin
// detail page (Avaliações table + entry detail) and the leader fill page so
// the same status always renders the same colour. Uses the project's
// canonical Badge variants ("completed" = green-700, "inProgress" = blue-700,
// "secondary" = gray) so the colours match every other completion/progress
// indicator in the app.
//
// Mapping:
//   PENDING                              → secondary (gray)
//   IN_PROGRESS                          → inProgress (blue-700)
//   SUBMITTED  /  fully-scored derived   → completed (green-700)

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  ASSESSMENT_ENTRY_STATUS,
  ASSESSMENT_ENTRY_STATUS_LABELS,
} from "@/constants";

interface AssessmentEntryStatusBadgeProps {
  status: ASSESSMENT_ENTRY_STATUS | string | null | undefined;
  /** When true, render as "Concluída" (completed/green) regardless of underlying status. */
  fullyScored?: boolean;
  className?: string;
}

export function AssessmentEntryStatusBadge({
  status,
  fullyScored,
  className,
}: AssessmentEntryStatusBadgeProps) {
  const baseClass = cn("whitespace-nowrap", className);

  if (status === ASSESSMENT_ENTRY_STATUS.SUBMITTED) {
    return (
      <Badge variant="completed" className={baseClass}>
        {ASSESSMENT_ENTRY_STATUS_LABELS[ASSESSMENT_ENTRY_STATUS.SUBMITTED]}
      </Badge>
    );
  }
  if (fullyScored) {
    return (
      <Badge variant="completed" className={baseClass}>
        Concluída
      </Badge>
    );
  }
  if (status === ASSESSMENT_ENTRY_STATUS.IN_PROGRESS) {
    return (
      <Badge variant="inProgress" className={baseClass}>
        {ASSESSMENT_ENTRY_STATUS_LABELS[ASSESSMENT_ENTRY_STATUS.IN_PROGRESS]}
      </Badge>
    );
  }
  // PENDING (default) — gray, per the user's request that pending matches the
  // current "Em andamento" gray look (which historically was `secondary`).
  return (
    <Badge variant="secondary" className={baseClass}>
      {status && (ASSESSMENT_ENTRY_STATUS_LABELS as any)[status]
        ? (ASSESSMENT_ENTRY_STATUS_LABELS as any)[status]
        : ASSESSMENT_ENTRY_STATUS_LABELS[ASSESSMENT_ENTRY_STATUS.PENDING]}
    </Badge>
  );
}
