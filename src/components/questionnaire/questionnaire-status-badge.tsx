// Shared status badge for Questionnaire.status — used on both the admin
// list/details pages. Uses the project's canonical Badge variants so the same
// colour appears across the app for the same semantics.
//
// Mapping:
//   DRAFT     → outline (neutral)
//   OPEN      → inProgress (blue-700)  — same blue as IN_PROGRESS entries
//   CLOSED    → completed  (green-700) — same green as completed entries
//   CANCELLED → cancelled  (red-700)

import { Badge } from "@/components/ui/badge";
import { QUESTIONNAIRE_STATUS, QUESTIONNAIRE_STATUS_LABELS } from "@/constants";

const STATUS_VARIANT: Record<string, "outline" | "inProgress" | "completed" | "cancelled"> = {
  [QUESTIONNAIRE_STATUS.DRAFT]: "outline",
  [QUESTIONNAIRE_STATUS.OPEN]: "inProgress",
  [QUESTIONNAIRE_STATUS.CLOSED]: "completed",
  [QUESTIONNAIRE_STATUS.CANCELLED]: "cancelled",
};

export function QuestionnaireStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={STATUS_VARIANT[status] ?? "outline"} className="whitespace-nowrap">
      {(QUESTIONNAIRE_STATUS_LABELS as any)[status] ?? status}
    </Badge>
  );
}
