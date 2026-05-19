// components/production/skill-assessment/sector-banner.tsx
//
// Sticky banner shown at the top of the fill page. Surfaces the evaluatee +
// assessment context so the leader always knows who they're scoring.

import { Card, CardContent } from "@/components/ui/card";
import {
  IconBuilding,
  IconCalendar,
  IconClipboardCheck,
  IconUser,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { ASSESSMENT_ENTRY_STATUS } from "../../../constants";
import { AssessmentEntryStatusBadge } from "./assessment-entry-status-badge";

interface SectorBannerProps {
  assessmentName: string;
  periodStart: Date | string;
  periodEnd: Date | string;
  evaluateeName: string;
  evaluateeSector?: string | null;
  evaluateePosition?: string | null;
  evaluatorName: string;
  status: ASSESSMENT_ENTRY_STATUS;
  /** All topics scored — display as "Concluída" even if not yet SUBMITTED. */
  fullyScored?: boolean;
  className?: string;
}

const formatDate = (d: Date | string) => {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
};

export function SectorBanner({
  assessmentName,
  periodStart,
  periodEnd,
  evaluateeName,
  evaluateeSector,
  evaluateePosition,
  evaluatorName,
  status,
  fullyScored,
  className,
}: SectorBannerProps) {
  return (
    <Card className={cn("border-primary/30 bg-primary/[0.03]", className)}>
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <IconClipboardCheck className="h-5 w-5 text-primary" />
            <span className="text-base font-semibold leading-none">{assessmentName}</span>
            <AssessmentEntryStatusBadge
              status={status}
              fullyScored={fullyScored}
              className="ml-1"
            />
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <IconUser className="h-4 w-4" />
              <span className="font-medium text-foreground">{evaluateeName}</span>
              {evaluateePosition && <span>· {evaluateePosition}</span>}
            </span>
            {evaluateeSector && (
              <span className="inline-flex items-center gap-1.5">
                <IconBuilding className="h-4 w-4" />
                {evaluateeSector}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <IconCalendar className="h-4 w-4" />
              {formatDate(periodStart)} – {formatDate(periodEnd)}
            </span>
          </div>
        </div>
        <div className="text-xs text-muted-foreground">
          Líder avaliador: <span className="font-medium text-foreground">{evaluatorName}</span>
        </div>
      </CardContent>
    </Card>
  );
}
