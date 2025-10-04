import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { IconSettings, IconCalendar, IconClock, IconRepeat } from "@tabler/icons-react";
import { type Maintenance } from "../../../../types";
import { getDynamicFrequencyLabel, SCHEDULE_FREQUENCY } from "../../../../constants";
import { formatDate, formatRelativeTime } from "../../../../utils";
import { cn } from "@/lib/utils";
import { MaintenanceStatusBadge } from "../common/maintenance-status-badge";

interface MaintenanceInfoCardProps {
  maintenance: Maintenance & {
    item?: { name: string; uniCode?: string | null };
    weeklyConfig?: any;
    monthlyConfig?: any;
    yearlyConfig?: any;
    lastRun?: Date | null; // Optional lastRun field that might come from schedule
    nextRun?: Date | null; // Next run date for schedules
    frequency?: string; // Maintenance schedule frequency
    frequencyCount?: number; // Frequency count
    isActive?: boolean; // Whether the maintenance is active
    rescheduleCount?: number; // Number of reschedules
    originalDate?: Date | null; // Original scheduled date
    rescheduleReason?: string | null; // Reason for reschedule
  };
  onMaintenanceUpdate?: () => void;
  className?: string;
}

function MaintenanceInfoCard({ maintenance, className }: MaintenanceInfoCardProps) {
  // Get schedule configuration details
  const getScheduleDetails = () => {
    switch (maintenance.frequency) {
      case SCHEDULE_FREQUENCY.WEEKLY:
        if (maintenance.weeklyConfig) {
          const days = maintenance.weeklyConfig.daysOfWeek?.join(", ") || "";
          return `Dias: ${days}`;
        }
        break;
      case SCHEDULE_FREQUENCY.MONTHLY:
        if (maintenance.monthlyConfig) {
          return `Dia ${maintenance.monthlyConfig.dayOfMonth} de cada mês`;
        }
        break;
      case SCHEDULE_FREQUENCY.QUARTERLY:
        return "A cada 3 meses";
      case SCHEDULE_FREQUENCY.SEMI_ANNUAL:
        return "A cada 6 meses";
      case SCHEDULE_FREQUENCY.ANNUAL:
        if (maintenance.yearlyConfig) {
          return `${maintenance.yearlyConfig.dayOfMonth}/${maintenance.yearlyConfig.month}`;
        }
        break;
    }
    return null;
  };

  return (
    <Card className={cn("shadow-sm border border-border", className)}>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-3 text-xl">
          <div className="p-2 rounded-lg bg-primary/10">
            <IconSettings className="h-5 w-5 text-primary" />
          </div>
          Informações da Manutenção
        </CardTitle>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="space-y-6">
          {/* Basic Information */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-foreground">{maintenance.name}</h3>
              <MaintenanceStatusBadge status={maintenance.status} showIcon={true} />
            </div>
            {maintenance.description && <p className="text-sm text-muted-foreground mb-4">{maintenance.description}</p>}
          </div>

          {/* Schedule Information */}
          <div className="pt-4 border-t border-border/50">
            <h4 className="text-sm font-semibold mb-3 text-foreground">Configuração de Agendamento</h4>
            <div className="space-y-3">
              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <IconRepeat className="h-4 w-4" />
                  Frequência
                </span>
                <div className="text-right">
                  <span className="text-sm font-semibold text-foreground">{getDynamicFrequencyLabel(maintenance.frequency as SCHEDULE_FREQUENCY, maintenance.frequencyCount)}</span>
                </div>
              </div>

              {getScheduleDetails() && (
                <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                  <span className="text-sm font-medium text-muted-foreground">Configuração</span>
                  <span className="text-sm font-semibold text-foreground">{getScheduleDetails()}</span>
                </div>
              )}

              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                <span className="text-sm font-medium text-muted-foreground">Status</span>
                <Badge variant={maintenance.isActive !== false ? "success" : "secondary"}>{maintenance.isActive !== false ? "Ativo" : "Inativo"}</Badge>
              </div>
            </div>
          </div>

          {/* Next Run Information */}
          {maintenance.nextRun && (
            <div className="pt-4 border-t border-border/50">
              <h4 className="text-sm font-semibold mb-3 text-foreground">Próxima Execução</h4>
              <div className="space-y-3">
                <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                  <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <IconCalendar className="h-4 w-4" />
                    Data Agendada
                  </span>
                  <div className="text-right">
                    <span className="text-sm font-semibold text-foreground">{formatDate(new Date(maintenance.nextRun))}</span>
                    <div className="text-xs text-muted-foreground">{formatRelativeTime(new Date(maintenance.nextRun))}</div>
                  </div>
                </div>

                {maintenance.lastRun && (
                  <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                    <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <IconClock className="h-4 w-4" />
                      Última Execução
                    </span>
                    <div className="text-right">
                      <span className="text-sm font-semibold text-foreground">{formatDate(new Date(maintenance.lastRun))}</span>
                      <div className="text-xs text-muted-foreground">{formatRelativeTime(new Date(maintenance.lastRun))}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Reschedule Information */}
          {(maintenance.rescheduleCount ?? 0) > 0 && (
            <div className="pt-4 border-t border-border/50">
              <h4 className="text-sm font-semibold mb-3 text-foreground">Reagendamentos</h4>
              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-lg p-3">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-amber-700 dark:text-amber-300 font-medium">Total de Reagendamentos:</span>
                    <span className="text-amber-900 dark:text-amber-100">{maintenance.rescheduleCount}</span>
                  </div>
                  {maintenance.originalDate && (
                    <div className="flex justify-between">
                      <span className="text-amber-700 dark:text-amber-300 font-medium">Data Original:</span>
                      <span className="text-amber-900 dark:text-amber-100">{formatDate(maintenance.originalDate)}</span>
                    </div>
                  )}
                  {maintenance.rescheduleReason && (
                    <div>
                      <span className="text-amber-700 dark:text-amber-300 font-medium">Motivo:</span>
                      <p className="text-amber-900 dark:text-amber-100 mt-1">{maintenance.rescheduleReason}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Date Information */}
          <div className="pt-4 border-t border-border/50">
            <h4 className="text-sm font-semibold mb-3 text-foreground">Datas do Sistema</h4>
            <div className="space-y-3">
              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <IconCalendar className="h-4 w-4" />
                  Criada em
                </span>
                <div className="text-right">
                  <span className="text-sm font-semibold text-foreground">{formatDate(new Date(maintenance.createdAt))}</span>
                  <div className="text-xs text-muted-foreground">{formatRelativeTime(new Date(maintenance.createdAt))}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export { MaintenanceInfoCard };
