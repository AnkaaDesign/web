// components/questionnaire/questionnaire-banner.tsx
//
// Sticky context banner at the top of the self-fill page. Mirrors the
// skill-assessment SectorBanner but for a questionnaire: shows the
// questionnaire name, the respondent (you), the period and the status.

import { Card, CardContent } from "@/components/ui/card";
import { IconBuilding, IconCalendar, IconClipboardCheck, IconUser } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { QUESTIONNAIRE_ENTRY_STATUS } from "@/constants";
import { QuestionnaireEntryStatusBadge } from "./questionnaire-entry-status-badge";

interface QuestionnaireBannerProps {
  questionnaireName: string;
  periodStart: Date | string;
  periodEnd: Date | string;
  respondentName: string;
  respondentSector?: string | null;
  respondentPosition?: string | null;
  status: QUESTIONNAIRE_ENTRY_STATUS | string;
  fullyAnswered?: boolean;
  className?: string;
}

const formatDate = (d: Date | string) => {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
};

export function QuestionnaireBanner({
  questionnaireName,
  periodStart,
  periodEnd,
  respondentName,
  respondentSector,
  respondentPosition,
  status,
  fullyAnswered,
  className,
}: QuestionnaireBannerProps) {
  return (
    <Card className={cn("border-primary/30 bg-primary/[0.03]", className)}>
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <IconClipboardCheck className="h-5 w-5 text-primary" />
            <span className="text-base font-semibold leading-none">{questionnaireName}</span>
            <QuestionnaireEntryStatusBadge status={status} fullyAnswered={fullyAnswered} className="ml-1" />
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <IconUser className="h-4 w-4" />
              <span className="font-medium text-foreground">{respondentName}</span>
              {respondentPosition && <span>· {respondentPosition}</span>}
            </span>
            {respondentSector && (
              <span className="inline-flex items-center gap-1.5">
                <IconBuilding className="h-4 w-4" />
                {respondentSector}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <IconCalendar className="h-4 w-4" />
              {formatDate(periodStart)} – {formatDate(periodEnd)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
