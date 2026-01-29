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
      <Card className={cn("shadow-sm border border-border", className)}>
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
    <Card className={cn("shadow-sm border border-border", className)}>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2">
          <IconCalendar className="h-5 w-5 text-muted-foreground" />
          Agendamento
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Status do Agendamento */}
        <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
          <span className="text-sm font-medium text-muted-foreground">Status</span>
          <Badge variant={schedule.isActive ? "success" : "secondary"}>{schedule.isActive ? "Ativo" : "Inativo"}</Badge>
        </div>

        {/* Frequência */}
        <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
          <div className="flex items-center gap-2">
            <IconRefresh className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">Frequência</span>
          </div>
          <div className="text-right">
            <span className="text-sm font-semibold text-foreground">{SCHEDULE_FREQUENCY_LABELS[schedule.frequency]}</span>
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
        <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
          <div className="flex items-center gap-2">
            <IconUsers className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">Atribuição</span>
          </div>
          <Badge variant="outline">{ASSIGNMENT_TYPE_LABELS[schedule.assignmentType]}</Badge>
        </div>

        {/* Tipos de EPI */}
        {schedule.items && schedule.items.length > 0 && (
          <div className="bg-muted/50 rounded-lg px-4 py-3">
            <div className="flex items-center gap-2 mb-2">
              <IconPackage className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Tipos de EPI</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {schedule.items.map((ppeItem: PpeScheduleItem, index: number) => (
                <Badge key={index} variant="secondary" className="text-xs">
                  {PPE_TYPE_LABELS[ppeItem.ppeType as keyof typeof PPE_TYPE_LABELS] || ppeItem.ppeType} ({ppeItem.quantity}x)
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Última Execução */}
        {schedule.lastRun && (
          <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
            <div className="flex items-center gap-2">
              <IconClock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Última Execução</span>
            </div>
            <div className="text-right">
              <span className="text-sm font-semibold text-foreground">{formatDate(schedule.lastRun)}</span>
              <p className="text-xs text-muted-foreground">{formatDateTime(schedule.lastRun)}</p>
            </div>
          </div>
        )}

        {/* Próxima Execução */}
        {schedule.nextRun && (
          <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
            <div className="flex items-center gap-2">
              <IconCalendarCheck className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Próxima Execução</span>
            </div>
            <div className="text-right">
              <span className="text-sm font-semibold text-primary">{formatDate(schedule.nextRun)}</span>
              <p className="text-xs text-muted-foreground">{formatDateTime(schedule.nextRun)}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
