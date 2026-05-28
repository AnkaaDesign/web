// components/questionnaire/questionnaire-entry-status-badge.tsx
//
// Status badge for QuestionnaireEntry.status — mirrors the assessment entry
// badge so completion/progress colours match the rest of the app.
//   PENDING     → secondary (gray)
//   IN_PROGRESS → inProgress (blue-700)
//   SUBMITTED   → completed (green-700)

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  QUESTIONNAIRE_ENTRY_STATUS,
  QUESTIONNAIRE_ENTRY_STATUS_LABELS,
} from "@/constants";

interface QuestionnaireEntryStatusBadgeProps {
  status: QUESTIONNAIRE_ENTRY_STATUS | string | null | undefined;
  /** When true, render as "Concluído" (green) regardless of underlying status. */
  fullyAnswered?: boolean;
  className?: string;
}

export function QuestionnaireEntryStatusBadge({
  status,
  fullyAnswered,
  className,
}: QuestionnaireEntryStatusBadgeProps) {
  const baseClass = cn("whitespace-nowrap", className);

  if (status === QUESTIONNAIRE_ENTRY_STATUS.SUBMITTED) {
    return (
      <Badge variant="completed" className={baseClass}>
        {QUESTIONNAIRE_ENTRY_STATUS_LABELS[QUESTIONNAIRE_ENTRY_STATUS.SUBMITTED]}
      </Badge>
    );
  }
  if (fullyAnswered) {
    return (
      <Badge variant="completed" className={baseClass}>
        Concluído
      </Badge>
    );
  }
  if (status === QUESTIONNAIRE_ENTRY_STATUS.IN_PROGRESS) {
    return (
      <Badge variant="inProgress" className={baseClass}>
        {QUESTIONNAIRE_ENTRY_STATUS_LABELS[QUESTIONNAIRE_ENTRY_STATUS.IN_PROGRESS]}
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className={baseClass}>
      {status && (QUESTIONNAIRE_ENTRY_STATUS_LABELS as any)[status]
        ? (QUESTIONNAIRE_ENTRY_STATUS_LABELS as any)[status]
        : QUESTIONNAIRE_ENTRY_STATUS_LABELS[QUESTIONNAIRE_ENTRY_STATUS.PENDING]}
    </Badge>
  );
}
