import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  IconCalendar,
  IconHash,
  IconClock,
  IconRefresh,
  IconCalendarCheck,
  IconAlertCircle,
  IconCircleCheck,
  IconFileText,
} from "@tabler/icons-react";
import type { PpeDeliverySchedule } from "../../../../../types";
import { getDynamicFrequencyLabel } from "../../../../../utils/maintenance";
import { formatDate, formatDateTime, formatRelativeTime } from "../../../../../utils";
import { cn } from "@/lib/utils";

interface PpeScheduleInfoCardProps {
  schedule: PpeDeliverySchedule;
  className?: string;
}

export function PpeScheduleInfoCard({ schedule, className }: PpeScheduleInfoCardProps) {
  // Check if next run is overdue
  const isOverdue = schedule.nextRun && new Date(schedule.nextRun) < new Date();

  return (
    <Card className={cn("shadow-sm border border-border", className)} level={1}>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2">
          <IconCalendar className="h-5 w-5 text-muted-foreground" />
          Informações do Agendamento
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Status */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">Status</span>
          <Badge variant={schedule.isActive ? "success" : "secondary"} className="gap-1.5">
            {schedule.isActive ? <IconCircleCheck className="h-4 w-4" /> : <IconAlertCircle className="h-4 w-4" />}
            {schedule.isActive ? "Ativo" : "Inativo"}
          </Badge>
        </div>

        {/* ID */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <IconHash className="h-4 w-4" />
            ID do Agendamento
          </div>
          <span className="font-mono text-sm">#{schedule.id.slice(-8)}</span>
        </div>

        {/* Nome */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground flex-shrink-0">
            <IconFileText className="h-4 w-4" />
            Nome
          </div>
          <div className="text-right flex-1">
            <p className="font-medium text-sm break-words">{schedule.name || "-"}</p>
          </div>
        </div>

        {/* Description */}
        {schedule.description && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <IconFileText className="h-4 w-4" />
              Descrição
            </div>
            <p className="text-sm text-muted-foreground bg-muted/30 rounded-lg p-3">{schedule.description}</p>
          </div>
        )}

        {/* Frequency */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <IconRefresh className="h-4 w-4" />
            Frequência
          </div>
          <span className="font-medium">{getDynamicFrequencyLabel(schedule.frequency, schedule.frequencyCount)}</span>
        </div>

        {/* Next Run */}
        {schedule.nextRun && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <IconCalendarCheck className="h-4 w-4" />
              Próxima Execução
            </div>
            <div className="text-right">
              <p className={cn("text-sm font-medium", isOverdue && "text-orange-600")}>
                {formatDate(schedule.nextRun)}
              </p>
              <p className="text-xs text-muted-foreground">{formatRelativeTime(schedule.nextRun)}</p>
            </div>
          </div>
        )}

        {/* Last Run */}
        {schedule.lastRun && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <IconClock className="h-4 w-4" />
              Última Execução
            </div>
            <div className="text-right">
              <p className="text-sm">{formatDate(schedule.lastRun)}</p>
              <p className="text-xs text-muted-foreground">{formatRelativeTime(schedule.lastRun)}</p>
            </div>
          </div>
        )}

        {/* Created At */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <IconCalendar className="h-4 w-4" />
            Data de Criação
          </div>
          <div className="text-right">
            <p className="text-sm">{formatDate(schedule.createdAt)}</p>
            <p className="text-xs text-muted-foreground">{formatRelativeTime(schedule.createdAt)}</p>
          </div>
        </div>

        {/* Updated At */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <IconClock className="h-4 w-4" />
            Última Atualização
          </div>
          <div className="text-right">
            <p className="text-sm">{formatDate(schedule.updatedAt)}</p>
            <p className="text-xs text-muted-foreground">{formatRelativeTime(schedule.updatedAt)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
