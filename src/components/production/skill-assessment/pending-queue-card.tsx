// components/production/skill-assessment/pending-queue-card.tsx
//
// One row per AssessmentEntry on the leader's queue. Shows evaluatee identity,
// progress + status, and the "Avaliar" CTA. Click-through navigates to the
// per-entry fill page.

import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  IconBuilding,
  IconChevronRight,
  IconUserCircle,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { routes } from "../../../constants";
import type { AssessmentEntry } from "../../../types";
import { AssessmentEntryStatusBadge } from "./assessment-entry-status-badge";

interface PendingQueueCardProps {
  entry: AssessmentEntry;
  totalTopics: number;
  className?: string;
}

export function PendingQueueCard({ entry, totalTopics, className }: PendingQueueCardProps) {
  const navigate = useNavigate();
  const evaluatee = entry.evaluatee;
  const completed =
    entry._count?.responses ?? entry.responses?.length ?? 0;
  const pct = totalTopics > 0 ? Math.min(100, Math.round((completed / totalTopics) * 100)) : 0;
  const fullyScored = totalTopics > 0 && completed >= totalTopics;
  const onOpen = () => navigate(routes.skillAssessmentLeader.fill(entry.id));

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "group flex w-full flex-col gap-3 rounded-lg border bg-card p-4 text-left transition-colors",
        "hover:border-primary/60 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="inline-flex items-center gap-2 text-base font-semibold leading-tight">
            <IconUserCircle className="h-5 w-5 text-muted-foreground" />
            {evaluatee?.name ?? "—"}
          </span>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {evaluatee?.position?.name && <span>{evaluatee.position.name}</span>}
            {evaluatee?.sector?.name && (
              <span className="inline-flex items-center gap-1">
                <IconBuilding className="h-3.5 w-3.5" />
                {evaluatee.sector.name}
              </span>
            )}
          </div>
        </div>
        <AssessmentEntryStatusBadge
          status={entry.status}
          fullyScored={fullyScored}
        />
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-baseline justify-between text-xs text-muted-foreground">
          <span>
            <span className="font-semibold text-foreground">{completed}</span> / {totalTopics} tópicos pontuados
          </span>
          <span>{pct}%</span>
        </div>
        <Progress value={pct} className="h-1.5" />
      </div>

      <div className="flex items-center justify-end">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="-mr-2 text-primary group-hover:bg-primary/10"
          onClick={(e) => {
            e.stopPropagation();
            onOpen();
          }}
        >
          Avaliar
          <IconChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </button>
  );
}
