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
  if (diffMins < 60) return `${diffMins}min atras`;
  if (diffHours < 24) return `${diffHours}h atras`;
  if (diffDays < 7) return `${diffDays}d atras`;
  return formatDate(date);
}

function HistoryEntry({ entry }: { entry: TaskForecastHistory }) {
  return (
    <div className="flex flex-col gap-1 border-l-2 border-muted pl-3 pb-3 last:pb-0">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">
          {entry.changedBy?.name || "Sistema"}
        </span>
        <span className="text-xs text-muted-foreground">
          {formatRelativeTime(entry.createdAt)}
        </span>
      </div>

      <div className="flex items-center gap-1.5 text-sm flex-wrap">
        <span className="text-muted-foreground">{formatDate(entry.previousDate)}</span>
        <IconArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="font-medium">{formatDate(entry.newDate)}</span>
        {entry.reason && (
          <>
            <span className="text-muted-foreground">—</span>
            <span className="text-sm italic">{entry.reason}</span>
          </>
        )}
      </div>
    </div>
  );
}

export function ForecastHistoryTimeline({ taskId }: ForecastHistoryTimelineProps) {
  const { data, isLoading } = useForecastHistory(taskId);

  if (isLoading) {
    return (
      <div className="text-sm text-muted-foreground py-2">
        Carregando historico...
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
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium">
        <IconHistory className="h-4 w-4" />
        Historico de Reagendamentos ({entries.length})
      </div>
      <ScrollArea className="max-h-[300px]">
        <div className="space-y-0 pr-2">
          {entries.map((entry) => (
            <HistoryEntry key={entry.id} entry={entry} />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
