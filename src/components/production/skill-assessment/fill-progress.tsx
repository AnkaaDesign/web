// components/production/skill-assessment/fill-progress.tsx
//
// Slim progress bar shown under the SectorBanner. Reactive to the live response
// count vs. the total topics on the assessment.

import { Progress } from "@/components/ui/progress";
import { IconClock, IconCheck } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

interface FillProgressProps {
  completed: number;
  total: number;
  lastSavedAt?: Date | null;
  isSaving?: boolean;
  isDirty?: boolean;
  className?: string;
}

const formatTime = (d: Date) =>
  d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

export function FillProgress({
  completed,
  total,
  lastSavedAt,
  isSaving,
  isDirty,
  className,
}: FillProgressProps) {
  const pct = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0;
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-baseline justify-between gap-4">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold">
            {completed} <span className="text-muted-foreground">/ {total}</span> tópicos pontuados
          </span>
          <span className="text-xs text-muted-foreground">({pct}%)</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {isSaving ? (
            <>
              <IconClock className="h-3.5 w-3.5 animate-pulse" />
              <span>Salvando…</span>
            </>
          ) : lastSavedAt ? (
            <>
              <IconCheck className="h-3.5 w-3.5 text-emerald-600" />
              <span>
                Salvo às {formatTime(lastSavedAt)}
                {isDirty && " (alterações pendentes)"}
              </span>
            </>
          ) : isDirty ? (
            <span className="text-amber-600">Alterações não salvas</span>
          ) : null}
        </div>
      </div>
      <Progress value={pct} className="h-2" />
    </div>
  );
}
