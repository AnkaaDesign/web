import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  IconCalendar,
  IconClock,
  IconRefresh,
  IconCalendarCheck,
  IconFileText,
  IconUsers,
  IconUserCheck,
  IconUserX,
} from "@tabler/icons-react";
import type { PpeDeliverySchedule } from "../../../../../types";
import { getDynamicFrequencyLabel } from "../../../../../utils/maintenance";
import { formatDate, formatRelativeTime } from "../../../../../utils";
import { ASSIGNMENT_TYPE, ASSIGNMENT_TYPE_LABELS } from "../../../../../constants";
import { cn } from "@/lib/utils";

interface PpeScheduleInfoCardProps {
  schedule: PpeDeliverySchedule;
  className?: string;
}

export function PpeScheduleInfoCard({ schedule, className }: PpeScheduleInfoCardProps) {
  // Check if next run is overdue
  const isOverdue = schedule.nextRun && new Date(schedule.nextRun) < new Date();

  // Get assignment icon based on type
  const getAssignmentIcon = () => {
    switch (schedule.assignmentType) {
      case ASSIGNMENT_TYPE.ALL:
        return <IconUsers className="h-4 w-4" />;
      case ASSIGNMENT_TYPE.SPECIFIC:
        return <IconUserCheck className="h-4 w-4" />;
      case ASSIGNMENT_TYPE.ALL_EXCEPT:
        return <IconUserX className="h-4 w-4" />;
      default:
        return <IconUsers className="h-4 w-4" />;
    }
  };

  // Get user count label
  const getUserCountLabel = () => {
    if (schedule.assignmentType === ASSIGNMENT_TYPE.SPECIFIC) {
      const count = schedule.includedUserIds?.length || 0;
      return `${count} ${count === 1 ? "usuário" : "usuários"}`;
    }
    if (schedule.assignmentType === ASSIGNMENT_TYPE.ALL_EXCEPT) {
      const count = schedule.excludedUserIds?.length || 0;
      return `${count} ${count === 1 ? "excluído" : "excluídos"}`;
    }
    return "Todos os usuários";
  };

  return (
    <Card className={cn("shadow-sm border border-border", className)}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <IconCalendar className="h-5 w-5 text-muted-foreground" />
            Informações do Agendamento
          </CardTitle>
          <Badge variant={schedule.isActive ? "active" : "destructive"}>
            {schedule.isActive ? "Ativo" : "Inativo"}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Basic Info Section */}
        <div className="space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Informações Básicas</h4>

          {/* Nome */}
          <div className="flex items-start justify-between gap-4 bg-muted/50 rounded-lg px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground flex-shrink-0">
              <IconFileText className="h-4 w-4" />
              Nome
            </div>
            <div className="text-right flex-1">
              <p className="font-semibold text-sm break-words">{schedule.name || "-"}</p>
            </div>
          </div>

          {/* Frequency */}
          <div className="flex items-center justify-between bg-muted/50 rounded-lg px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <IconRefresh className="h-4 w-4" />
              Frequência
            </div>
            <span className="font-semibold text-sm">{getDynamicFrequencyLabel(schedule.frequency, schedule.frequencyCount)}</span>
          </div>

          {/* Assignment Type */}
          <div className="flex items-center justify-between bg-muted/50 rounded-lg px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              {getAssignmentIcon()}
              Atribuição
            </div>
            <div className="text-right">
              <p className="font-semibold text-sm">{ASSIGNMENT_TYPE_LABELS[schedule.assignmentType]}</p>
              <p className="text-xs text-muted-foreground">{getUserCountLabel()}</p>
            </div>
          </div>
        </div>

        {/* Timeline Section */}
        <div className="pt-2 border-t border-border space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Timeline</h4>

          {/* Next Run */}
          {schedule.nextRun && (
            <div className="flex items-center justify-between bg-muted/50 rounded-lg px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <IconCalendarCheck className="h-4 w-4" />
                Próxima Execução
              </div>
              <div className="text-right">
                <p className={cn("text-sm font-semibold", isOverdue && "text-orange-600 dark:text-orange-400")}>
                  {formatDate(schedule.nextRun)}
                </p>
                <p className={cn("text-xs", isOverdue ? "text-orange-500" : "text-muted-foreground")}>
                  {formatRelativeTime(schedule.nextRun)}
                </p>
              </div>
            </div>
          )}

          {/* Last Run */}
          {schedule.lastRun && (
            <div className="flex items-center justify-between bg-muted/50 rounded-lg px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <IconClock className="h-4 w-4" />
                Última Execução
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold">{formatDate(schedule.lastRun)}</p>
                <p className="text-xs text-muted-foreground">{formatRelativeTime(schedule.lastRun)}</p>
              </div>
            </div>
          )}

          {/* Created At */}
          <div className="flex items-center justify-between bg-muted/50 rounded-lg px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <IconCalendar className="h-4 w-4" />
              Criado em
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold">{formatDate(schedule.createdAt)}</p>
              <p className="text-xs text-muted-foreground">{formatRelativeTime(schedule.createdAt)}</p>
            </div>
          </div>

          {/* Updated At - Only show if different from created */}
          {schedule.updatedAt && new Date(schedule.updatedAt).getTime() !== new Date(schedule.createdAt).getTime() && (
            <div className="flex items-center justify-between bg-muted/50 rounded-lg px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <IconClock className="h-4 w-4" />
                Atualizado em
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold">{formatDate(schedule.updatedAt)}</p>
                <p className="text-xs text-muted-foreground">{formatRelativeTime(schedule.updatedAt)}</p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
