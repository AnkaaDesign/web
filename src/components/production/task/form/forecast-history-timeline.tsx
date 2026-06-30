import { IconHistory, IconArrowRight } from "@tabler/icons-react";
import { useForecastHistory } from "../../../../hooks";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { TaskForecastHistory } from "../../../../types";

interface ForecastHistoryTimelineProps {
  taskId: string;
}

function formatDate(date: Date | string | null): string {
  if (!date) return "\u2014";
  const d = new Date(date);
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRelativeTime(date: Date | string): string {
  const now = new Date();
  const d = new Date(date);
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "agora";
  if (diffMins < 60) return `${diffMins}min atrás`;
  if (diffHours < 24) return `${diffHours}h atrás`;
  if (diffDays < 7) return `${diffDays}d atrás`;
  return formatDate(date);
}

function HistoryEntry({ entry, isLast }: { entry: TaskForecastHistory; isLast: boolean }) {
  return (
    <div className="relative pl-6 pb-4 last:pb-0">
      {/* Timeline rail */}
      {!isLast && (
        <span className="absolute left-[5px] top-3 bottom-0 w-px bg-border" aria-hidden />
      )}
      {/* Timeline dot */}
      <span className="absolute left-0 top-1.5 h-[11px] w-[11px] rounded-full border-2 border-primary bg-background" aria-hidden />

      {/* Header: who + when */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium leading-tight">
          {entry.changedBy?.name || "Sistema"}
        </span>
        <span className="text-xs text-muted-foreground shrink-0">
          {formatRelativeTime(entry.createdAt)}
        </span>
      </div>

      {/* Date change */}
      <div className="mt-1.5 flex items-center gap-2 text-xs">
        <span className="rounded-md bg-muted px-2 py-0.5 text-muted-foreground line-through decoration-muted-foreground/50">
          {formatDate(entry.previousDate)}
        </span>
        <IconArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="rounded-md bg-primary/10 px-2 py-0.5 font-medium text-foreground">
          {formatDate(entry.newDate)}
        </span>
      </div>

      {/* Reason */}
      {entry.reason && (
        <p className="mt-1.5 text-sm text-muted-foreground leading-snug">
          {entry.reason}
        </p>
      )}
    </div>
  );
}

export function ForecastHistoryTimeline({ taskId }: ForecastHistoryTimelineProps) {
  const { data, isLoading } = useForecastHistory(taskId);

  if (isLoading) {
    return (
      <div className="text-sm text-muted-foreground py-2">
        Carregando histórico...
      </div>
    );
  }

  // Filter out entries where previousDate is null — setting a forecast for the first time is not a reschedule
  const entries = ((data?.data ?? []) as TaskForecastHistory[]).filter(e => e.previousDate);

  if (entries.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
        <IconHistory className="h-4 w-4" />
        Nenhum reagendamento registrado
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-border dark:border-border/30 bg-card/50 p-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <IconHistory className="h-4 w-4 text-muted-foreground" />
        Histórico de Reagendamentos
        <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
          {entries.length}
        </span>
      </div>
      <ScrollArea className="max-h-[300px]">
        <div className="pr-2">
          {entries.map((entry, index) => (
            <HistoryEntry
              key={entry.id}
              entry={entry}
              isLast={index === entries.length - 1}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
