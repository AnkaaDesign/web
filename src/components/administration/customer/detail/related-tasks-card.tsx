import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { IconChecklist, IconAlertCircle, IconCircleCheckFilled, IconClock, IconPlayerPause, IconX, IconHourglass } from "@tabler/icons-react";
import type { Customer } from "../../../../types";
import { formatCurrency, formatDate } from "../../../../utils";
import { TASK_STATUS, TASK_STATUS_LABELS } from "../../../../constants";
import { cn } from "@/lib/utils";
import { Link, useNavigate } from "react-router-dom";
import { routes } from "../../../../constants";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface RelatedTasksCardProps {
  customer: Customer;
  className?: string;
}

// Status icons and colors (solid backgrounds with white text)
const TASK_STATUS_CONFIG: Record<
  string,
  {
    icon: any;
    color: string;
    badgeClass: string;
  }
> = {
  [TASK_STATUS.PENDING]: {
    icon: IconClock,
    color: "text-neutral-500",
    badgeClass: "bg-neutral-500 hover:bg-neutral-600 text-white border-neutral-500",
  },
  [TASK_STATUS.IN_PRODUCTION]: {
    icon: IconHourglass,
    color: "text-blue-500",
    badgeClass: "bg-blue-500 hover:bg-blue-600 text-white border-blue-500",
  },
  [TASK_STATUS.ON_HOLD]: {
    icon: IconPlayerPause,
    color: "text-yellow-500",
    badgeClass: "bg-yellow-500 hover:bg-yellow-600 text-white border-yellow-500",
  },
  [TASK_STATUS.COMPLETED]: {
    icon: IconCircleCheckFilled,
    color: "text-green-700",
    badgeClass: "bg-green-700 hover:bg-green-800 text-white border-green-700",
  },
  [TASK_STATUS.CANCELLED]: {
    icon: IconX,
    color: "text-red-700",
    badgeClass: "bg-red-700 hover:bg-red-800 text-white border-red-700",
  },
};

export function RelatedTasksCard({ customer, className }: RelatedTasksCardProps) {
  const navigate = useNavigate();

  if (!customer) {
    return null;
  }

  const tasks = customer.tasks || [];

  // Sort tasks by status priority (active tasks first) and then by date
  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      // Priority for active statuses
      const statusPriority: Record<string, number> = {
        [TASK_STATUS.IN_PRODUCTION]: 1,
        [TASK_STATUS.ON_HOLD]: 2,
        [TASK_STATUS.PENDING]: 3,
        [TASK_STATUS.COMPLETED]: 4,
        [TASK_STATUS.CANCELLED]: 5,
      };

      const aPriority = statusPriority[a.status] ?? 6;
      const bPriority = statusPriority[b.status] ?? 6;

      if (aPriority !== bPriority) return aPriority - bPriority;

      // Then sort by date (newest first)
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [tasks]);

  // Calculate statistics
  const statistics = useMemo(() => {
    const totalTasks = tasks.length;
    const activeTasks = tasks.filter((task) => task.status !== TASK_STATUS.CANCELLED && task.status !== TASK_STATUS.COMPLETED).length;
    const completedTasks = tasks.filter((task) => task.status === TASK_STATUS.COMPLETED).length;

    const statusCounts = tasks.reduce(
      (acc, task) => {
        acc[task.status] = (acc[task.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      totalTasks,
      activeTasks,
      completedTasks,
      statusCounts,
    };
  }, [tasks]);

  if (tasks.length === 0) {
    return (
      <Card className={cn("shadow-sm border border-border", className)}>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
          <IconChecklist className="h-5 w-5 text-muted-foreground" />
          Tarefas Relacionadas
        </CardTitle>
            {customer.id && (
              <Button variant="outline" size="sm" onClick={() => navigate(`${routes.production.schedule.list}?customerId=${customer.id}`)}>
                Ver todas as tarefas
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="text-center py-12">
            <IconAlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Nenhuma tarefa associada a este cliente.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("shadow-sm border border-border", className)}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
          <IconChecklist className="h-5 w-5 text-muted-foreground" />
          Tarefas Relacionadas
        </CardTitle>
          {customer.id && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`${routes.production.schedule.list}?customerId=${customer.id}&customerName=${encodeURIComponent(customer.fantasyName || "")}`)}
            >
              Ver todas as tarefas
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {/* Statistics Summary */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-card-nested rounded-lg p-3 border border-border">
            <span className="text-xs font-medium text-muted-foreground block">Total de Tarefas</span>
            <p className="text-xl font-bold mt-1">{statistics.totalTasks}</p>
          </div>

          <div className="bg-blue-50/80 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200/40 dark:border-blue-700/40">
            <span className="text-xs font-medium text-blue-800 dark:text-blue-200 block">Tarefas Ativas</span>
            <p className="text-xl font-bold mt-1 text-blue-800 dark:text-blue-200">{statistics.activeTasks}</p>
          </div>

          <div className="bg-green-50/80 dark:bg-green-900/20 rounded-lg p-3 border border-green-200/40 dark:border-green-700/40">
            <span className="text-xs font-medium text-green-800 dark:text-green-200 block">Valor Total</span>
            <p className="text-xl font-bold mt-1 text-green-800 dark:text-green-200">{formatCurrency(statistics.totalValue)}</p>
          </div>
        </div>

        {/* Status Summary */}
        <div className="flex flex-wrap gap-2 mb-4">
          {[TASK_STATUS.PENDING, TASK_STATUS.IN_PRODUCTION, TASK_STATUS.ON_HOLD, TASK_STATUS.COMPLETED, TASK_STATUS.CANCELLED].map((status: string) => {
            const count = statistics.statusCounts[status] || 0;
            const config = TASK_STATUS_CONFIG[status];
            return (
              <Badge key={status} className={cn("font-medium border", config.badgeClass)}>
                {TASK_STATUS_LABELS[status as TASK_STATUS]} ({count})
              </Badge>
            );
          })}
        </div>

        {/* Tasks Grid */}
        <ScrollArea className="h-[320px]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pr-4">
            {sortedTasks.map((task: any) => {
              const config = TASK_STATUS_CONFIG[task.status];
              const StatusIcon = config.icon;

              // Get task description with better fallback
              const getTaskTitle = () => {
                if (task.name) {
                  return task.name;
                }
                if (task.details) {
                  return task.details;
                }
                if (task.services && task.services.length > 0) {
                  return task.services.map((service: any) => service.description).join(", ");
                }
                return `Tarefa #${task.id.slice(-8).toUpperCase()}`;
              };

              const taskDescription = getTaskTitle();

              return (
                <Link key={task.id} to={routes.production.schedule.details(task.id)} className="block">
                  <div className="group relative overflow-hidden rounded-lg border border-border/50 dark:border-border/40 bg-card hover:bg-muted/50 transition-colors cursor-pointer min-h-[180px] flex flex-col">
                    <div className="p-3 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-sm text-foreground truncate">{taskDescription}</h4>
                            <p className="text-xs text-muted-foreground truncate mt-1">ID: #{task.id.slice(-8).toUpperCase()}</p>
                          </div>
                        </div>

                        {/* Task Assignment and Sector */}
                        <div className="space-y-1 mb-2">
                          {task.user && (
                            <p className="text-xs text-muted-foreground truncate">
                              <span className="font-medium">Responsável:</span> {task.user.name}
                            </p>
                          )}
                          {task.sector && (
                            <p className="text-xs text-muted-foreground truncate">
                              <span className="font-medium">Setor:</span> {task.sector.name}
                            </p>
                          )}
                          {task.services && task.services.length > 0 && (
                            <p className="text-xs text-muted-foreground truncate">
                              <span className="font-medium">Serviços:</span> {task.services.map((s: any) => s.description).join(", ")}
                            </p>
                          )}
                        </div>

                        {task.status === TASK_STATUS.CANCELLED && (
                          <div className="flex flex-wrap items-center gap-1 mt-1">
                            <Badge variant="secondary" className="text-xs">
                              Cancelado
                            </Badge>
                          </div>
                        )}
                      </div>

                      <div className="mt-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <StatusIcon className={cn("w-4 h-4 flex-shrink-0", config.color)} aria-label={TASK_STATUS_LABELS[task.status as TASK_STATUS]} />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <div className="space-y-1">
                                    <p className="font-semibold">{TASK_STATUS_LABELS[task.status as TASK_STATUS]}</p>
                                    <p className="text-xs">Criado em {formatDate(task.createdAt)}</p>
                                    {task.startedAt && <p className="text-xs">Iniciado em {formatDate(task.startedAt)}</p>}
                                    {task.finishedAt && <p className="text-xs">Finalizado em {formatDate(task.finishedAt)}</p>}
                                    {task.user && <p className="text-xs">Responsável: {task.user.name}</p>}
                                    {task.sector && <p className="text-xs">Setor: {task.sector.name}</p>}
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>

                            <span className="font-medium tabular-nums text-sm">{formatDate(task.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
