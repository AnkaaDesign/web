import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { IconClock, IconCalendar, IconHistory, IconCheck, IconAlertCircle, IconTool, IconClockHour4 } from "@tabler/icons-react";
import type { User } from "../../../../types";
import { formatDateTime, formatRelativeTime } from "../../../../utils";
import { MAINTENANCE_STATUS_LABELS } from "../../../../constants";
import { cn } from "@/lib/utils";
import { useMemo } from "react";

// Define a simplified execution type since MaintenanceExecution doesn't exist yet
type ExecutionData = {
  id: string;
  status: string;
  executedAt: string;
  completedAt?: string | null;
  observations?: string | null;
  executedBy?: User;
};

interface LastRunCardProps {
  lastExecution?: ExecutionData;
  previousExecutions?: ExecutionData[];
  className?: string;
}

export function LastRunCard({ lastExecution, previousExecutions = [], className }: LastRunCardProps) {
  // Calculate statistics from execution history
  const statistics = useMemo(() => {
    if (!lastExecution || previousExecutions.length === 0) return null;

    const allExecutions = [lastExecution, ...previousExecutions].filter((e) => e.completedAt);
    const executionTimes = allExecutions.map((e) => {
      const start = new Date(e.executedAt).getTime();
      const end = e.completedAt ? new Date(e.completedAt).getTime() : start;
      return end - start;
    });

    if (executionTimes.length === 0) return null;

    const avgTime = executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length;
    const minTime = Math.min(...executionTimes);
    const maxTime = Math.max(...executionTimes);

    const successfulExecutions = allExecutions.filter((e) => e.status === "COMPLETED").length;
    const successRate = (successfulExecutions / allExecutions.length) * 100;

    return {
      avgTime,
      minTime,
      maxTime,
      totalExecutions: allExecutions.length,
      successRate,
      successfulExecutions,
    };
  }, [lastExecution, previousExecutions]);

  if (!lastExecution) {
    return (
      <Card className={cn("shadow-sm border border-border", className)} level={1}>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2">
          <IconHistory className="h-5 w-5 text-muted-foreground" />
          Última Execução
        </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="text-center py-12">
            <IconAlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Esta manutenção ainda não foi executada.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const executionDuration = lastExecution.completedAt
    ? (() => {
        const start = new Date(lastExecution.executedAt).getTime();
        const end = new Date(lastExecution.completedAt).getTime();
        const diffMs = end - start;
        const hours = Math.floor(diffMs / (1000 * 60 * 60));
        const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        if (hours > 0) return `${hours}h ${minutes}min`;
        return `${minutes} min`;
      })()
    : "Em andamento";

  const formatDuration = (ms: number) => {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) return `${hours}h ${minutes}min`;
    return `${minutes} min`;
  };

  return (
    <Card className={cn("shadow-sm border border-border", className)} level={1}>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2">
          <IconHistory className="h-5 w-5 text-muted-foreground" />
          Última Execução
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-6">
          {/* Execution Details */}
          <div>
            <h4 className="text-sm font-semibold mb-3 text-foreground">Detalhes da Execução</h4>
            <div className="space-y-3">
              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <IconCalendar className="h-4 w-4" />
                  Data de Execução
                </span>
                <div className="text-right">
                  <p className="text-sm font-semibold text-foreground">{formatDateTime(lastExecution.executedAt)}</p>
                  <p className="text-xs text-muted-foreground">{formatRelativeTime(lastExecution.executedAt)}</p>
                </div>
              </div>

              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <IconClockHour4 className="h-4 w-4" />
                  Duração
                </span>
                <span className="text-sm font-semibold text-foreground">{executionDuration}</span>
              </div>

              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                <span className="text-sm font-medium text-muted-foreground">Status</span>
                <Badge
                  className={cn(
                    "font-medium",
                    lastExecution.status === "COMPLETED" && "bg-green-700 text-white",
                    lastExecution.status === "IN_PROGRESS" && "bg-blue-600 text-white",
                    lastExecution.status === "FAILED" && "bg-red-700 text-white",
                  )}
                >
                  {MAINTENANCE_STATUS_LABELS[lastExecution.status as keyof typeof MAINTENANCE_STATUS_LABELS] || lastExecution.status}
                </Badge>
              </div>
            </div>
          </div>

          {/* Observations */}
          {lastExecution.observations && (
            <div className="pt-4 border-t border-border/50">
              <h4 className="text-sm font-semibold mb-3 text-foreground">Observações</h4>
              <div className="bg-muted/30 rounded-lg p-3">
                <p className="text-sm text-muted-foreground">{lastExecution.observations}</p>
              </div>
            </div>
          )}

          {/* Performance Statistics */}
          {statistics && (
            <div className="pt-4 border-t border-border/50">
              <h4 className="text-sm font-semibold mb-3 text-foreground flex items-center gap-2">
                <IconTool className="h-4 w-4 text-primary" />
                Estatísticas de Performance
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-primary/5 rounded-lg p-3">
                  <span className="text-xs font-medium text-muted-foreground block">Tempo Médio</span>
                  <p className="text-lg font-bold mt-1 text-primary">{formatDuration(statistics.avgTime)}</p>
                </div>
                <div className="bg-green-50/80 dark:bg-green-900/20 rounded-lg p-3 border border-green-200/40 dark:border-green-700/40">
                  <span className="text-xs font-medium text-green-800 dark:text-green-200 block">Taxa de Sucesso</span>
                  <p className="text-lg font-bold mt-1 text-green-800 dark:text-green-200">{statistics.successRate.toFixed(0)}%</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3">
                  <span className="text-xs font-medium text-muted-foreground block">Tempo Mínimo</span>
                  <p className="text-base font-semibold mt-1 text-foreground">{formatDuration(statistics.minTime)}</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3">
                  <span className="text-xs font-medium text-muted-foreground block">Tempo Máximo</span>
                  <p className="text-base font-semibold mt-1 text-foreground">{formatDuration(statistics.maxTime)}</p>
                </div>
              </div>

              <div className="mt-3 bg-muted/30 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Total de Execuções</span>
                  <span className="text-sm font-semibold text-foreground">{statistics.totalExecutions}</span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                    <IconCheck className="h-3 w-3 text-green-600" />
                    Execuções Bem-sucedidas
                  </span>
                  <span className="text-sm font-semibold text-foreground">{statistics.successfulExecutions}</span>
                </div>
              </div>
            </div>
          )}

          {/* Recent History */}
          {previousExecutions.length > 0 && (
            <div className="pt-4 border-t border-border/50">
              <h4 className="text-sm font-semibold mb-3 text-foreground">Histórico Recente</h4>
              <div className="space-y-2">
                {previousExecutions.slice(0, 3).map((execution) => (
                  <div key={execution.id} className="flex items-center justify-between bg-muted/30 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-3">
                      <IconClock className="h-3 w-3 text-muted-foreground" />
                      <div>
                        <p className="text-xs font-medium text-foreground">{formatDateTime(execution.executedAt)}</p>
                        <p className="text-xs text-muted-foreground">{execution.executedBy?.name || "Desconhecido"}</p>
                      </div>
                    </div>
                    <Badge variant={execution.status === "COMPLETED" ? "success" : "destructive"} className="text-xs">
                      {MAINTENANCE_STATUS_LABELS[execution.status as keyof typeof MAINTENANCE_STATUS_LABELS] || execution.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
