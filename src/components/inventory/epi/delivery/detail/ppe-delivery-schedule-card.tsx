import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { IconCalendar, IconClock, IconRefresh, IconUsers, IconPackage, IconCalendarCheck } from "@tabler/icons-react";
import type { PpeDeliverySchedule, PpeScheduleItem } from "../../../../../types";
import { SCHEDULE_FREQUENCY, SCHEDULE_FREQUENCY_LABELS, ASSIGNMENT_TYPE_LABELS, PPE_TYPE_LABELS } from "../../../../../constants";
import { formatDate, formatDateTime } from "../../../../../utils";
import { cn } from "@/lib/utils";

interface PpeDeliveryScheduleCardProps {
  schedule?: PpeDeliverySchedule;
  className?: string;
}

export function PpeDeliveryScheduleCard({ schedule, className }: PpeDeliveryScheduleCardProps) {
  if (!schedule) {
    return (
      <Card className={cn("shadow-sm border border-border", className)} level={1}>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2">
          <IconCalendar className="h-5 w-5 text-muted-foreground" />
          Agendamento
        </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <IconCalendarCheck className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">Entrega não vinculada a agendamento</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("shadow-sm border border-border", className)} level={1}>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2">
          <IconCalendar className="h-5 w-5 text-muted-foreground" />
          Agendamento
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Status do Agendamento */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">Status</span>
          <Badge variant={schedule.isActive ? "success" : "secondary"}>{schedule.isActive ? "Ativo" : "Inativo"}</Badge>
        </div>

        {/* Frequência */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <IconRefresh className="h-4 w-4" />
            Frequência
          </div>
          <div className="text-right">
            <p className="font-medium">{SCHEDULE_FREQUENCY_LABELS[schedule.frequency]}</p>
            {schedule.frequencyCount > 1 && (
              <p className="text-xs text-muted-foreground">
                A cada {schedule.frequencyCount}{" "}
                {schedule.frequency === SCHEDULE_FREQUENCY.DAILY
                  ? "dias"
                  : schedule.frequency === SCHEDULE_FREQUENCY.WEEKLY
                    ? "semanas"
                    : schedule.frequency === SCHEDULE_FREQUENCY.MONTHLY
                      ? "meses"
                      : "anos"}
              </p>
            )}
          </div>
        </div>

        {/* Tipo de Atribuição */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <IconUsers className="h-4 w-4" />
            Atribuição
          </div>
          <Badge variant="outline">{ASSIGNMENT_TYPE_LABELS[schedule.assignmentType]}</Badge>
        </div>

        {/* Tipos de EPI */}
        {schedule.ppeItems && schedule.ppeItems.length > 0 && (
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
              <IconPackage className="h-4 w-4" />
              Tipos de EPI
            </div>
            <div className="flex flex-wrap gap-1">
              {schedule.ppeItems.map((ppeItem: PpeScheduleItem, index: number) => (
                <Badge key={index} variant="secondary" className="text-xs">
                  {PPE_TYPE_LABELS[ppeItem.ppeType as keyof typeof PPE_TYPE_LABELS] || ppeItem.ppeType} ({ppeItem.quantity}x)
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Última Execução */}
        {schedule.lastRun && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <IconClock className="h-4 w-4" />
              Última Execução
            </div>
            <div className="text-right">
              <p className="text-sm">{formatDate(schedule.lastRun)}</p>
              <p className="text-xs text-muted-foreground">{formatDateTime(schedule.lastRun)}</p>
            </div>
          </div>
        )}

        {/* Próxima Execução */}
        {schedule.nextRun && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <IconCalendarCheck className="h-4 w-4" />
              Próxima Execução
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-primary">{formatDate(schedule.nextRun)}</p>
              <p className="text-xs text-muted-foreground">{formatDateTime(schedule.nextRun)}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
