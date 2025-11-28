import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { IconSettings, IconCalendar, IconClock, IconRepeat, IconCurrencyDollar } from "@tabler/icons-react";
import { type Maintenance } from "../../../../types";
import { getDynamicFrequencyLabel, SCHEDULE_FREQUENCY } from "../../../../constants";
import { formatDate, formatDateTime, formatCurrency } from "../../../../utils";
import { cn } from "@/lib/utils";
import { MaintenanceStatusBadge } from "../common/maintenance-status-badge";
import { useMemo } from "react";

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
    maintenanceScheduleId?: string | null; // Schedule ID if from a schedule
    maintenanceSchedule?: {
      frequency?: string;
      frequencyCount?: number;
      dayOfMonth?: number;
      weeklyConfig?: any;
      monthlyConfig?: any;
      yearlyConfig?: any;
      maintenanceItemsConfig?: any;
    };
    itemsNeeded?: Array<{
      quantity: number;
      item?: {
        prices?: Array<{ value: number }>;
      };
    }>;
  };
  onMaintenanceUpdate?: () => void;
  className?: string;
}

function MaintenanceInfoCard({ maintenance, className }: MaintenanceInfoCardProps) {
  // Calculate estimated cost
  const estimatedCost = useMemo(() => {
    return (
      maintenance.itemsNeeded?.reduce((total, mi) => {
        if (!mi.item) return total;
        let itemPrice = 0;
        if (mi.item.prices && mi.item.prices.length > 0) {
          itemPrice = mi.item.prices[0].value;
        }
        return total + itemPrice * mi.quantity;
      }, 0) || 0
    );
  }, [maintenance.itemsNeeded]);

  // Get frequency - use maintenance's own or fallback to schedule
  const frequency = maintenance.frequency || maintenance.maintenanceSchedule?.frequency;
  const frequencyCount = maintenance.frequencyCount || maintenance.maintenanceSchedule?.frequencyCount;

  // Get schedule configuration details
  const getScheduleDetails = () => {
    switch (frequency) {
      case SCHEDULE_FREQUENCY.WEEKLY:
        const weeklyConfig = maintenance.weeklyConfig || maintenance.maintenanceSchedule?.weeklyConfig;
        if (weeklyConfig) {
          const days = weeklyConfig.daysOfWeek?.join(", ") || "";
          return `Dias: ${days}`;
        }
        break;
      case SCHEDULE_FREQUENCY.MONTHLY:
        const monthlyConfig = maintenance.monthlyConfig || maintenance.maintenanceSchedule?.monthlyConfig;
        if (monthlyConfig && monthlyConfig.dayOfMonth) {
          return `Dia ${monthlyConfig.dayOfMonth} de cada mês`;
        }
        // Fallback to dayOfMonth on schedule
        if (maintenance.maintenanceSchedule?.dayOfMonth) {
          return `Dia ${maintenance.maintenanceSchedule.dayOfMonth} de cada mês`;
        }
        break;
      case SCHEDULE_FREQUENCY.QUARTERLY:
        return "A cada 3 meses";
      case SCHEDULE_FREQUENCY.SEMI_ANNUAL:
        return "A cada 6 meses";
      case SCHEDULE_FREQUENCY.ANNUAL:
        const yearlyConfig = maintenance.yearlyConfig || maintenance.maintenanceSchedule?.yearlyConfig;
        if (yearlyConfig) {
          return `${yearlyConfig.dayOfMonth}/${yearlyConfig.month}`;
        }
        break;
    }
    return null;
  };

  // Determine if this is a unique maintenance (not from a schedule)
  const isUniqueMaintenance = !maintenance.maintenanceScheduleId;

  return (
    <Card className={cn("shadow-sm border border-border", className)}>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <IconSettings className="h-5 w-5 text-muted-foreground" />
            Informações da Manutenção
          </div>
          <MaintenanceStatusBadge status={maintenance.status} showIcon={false} />
        </CardTitle>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="space-y-6">
          {/* Basic Information */}
          {maintenance.description && maintenance.description !== "Manutenção criada automaticamente pelo agendamento." && (
            <div>
              <p className="text-sm text-muted-foreground">{maintenance.description}</p>
            </div>
          )}

          {/* Schedule Information - Only show if from a schedule */}
          {!isUniqueMaintenance && (
            <div>
            <h4 className="text-sm font-semibold mb-3 text-foreground">Configuração de Agendamento</h4>
            <div className="space-y-3">
              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <IconRepeat className="h-4 w-4" />
                  Frequência
                </span>
                <div className="text-right">
                  <span className="text-sm font-semibold text-foreground">{getDynamicFrequencyLabel(frequency as SCHEDULE_FREQUENCY, frequencyCount)}</span>
                  {getScheduleDetails() && (
                    <div className="text-xs text-muted-foreground mt-1">
                      {getScheduleDetails()}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <IconSettings className="h-4 w-4" />
                  Status
                </span>
                <Badge variant={maintenance.isActive !== false ? "success" : "secondary"}>{maintenance.isActive !== false ? "Ativo" : "Inativo"}</Badge>
              </div>

              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <IconCurrencyDollar className="h-4 w-4" />
                  Custo Estimado
                </span>
                <span className="text-sm font-semibold text-foreground">{formatCurrency(estimatedCost)}</span>
              </div>
            </div>
            </div>
          )}

          {/* For unique maintenances, show simplified info */}
          {isUniqueMaintenance && (
            <div className={cn(maintenance.description && maintenance.description !== "Manutenção criada automaticamente pelo agendamento." && "pt-4 border-t border-border/50")}>
              <h4 className="text-sm font-semibold mb-3 text-foreground">Tipo</h4>
              <div className="space-y-3">
                <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                  <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <IconRepeat className="h-4 w-4" />
                    Frequência
                  </span>
                  <span className="text-sm font-semibold text-foreground">Única</span>
                </div>
                <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                  <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <IconCurrencyDollar className="h-4 w-4" />
                    Custo Estimado
                  </span>
                  <span className="text-sm font-semibold text-foreground">{formatCurrency(estimatedCost)}</span>
                </div>
              </div>
            </div>
          )}

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
                  <span className="text-sm font-semibold text-foreground">{formatDate(new Date(maintenance.nextRun))}</span>
                </div>
              </div>
            </div>
          )}

          {/* Date Information */}
          <div className="pt-4 border-t border-border/50">
            <h4 className="text-sm font-semibold mb-3 text-foreground">Datas do Sistema</h4>
            <div className="space-y-3">
              {/* Last Execution - Only for scheduled maintenances */}
              {!isUniqueMaintenance && maintenance.finishedAt && (
                <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                  <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <IconClock className="h-4 w-4" />
                    Última Execução
                  </span>
                  <span className="text-sm font-semibold text-foreground">{formatDateTime(new Date(maintenance.finishedAt))}</span>
                </div>
              )}

              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <IconCalendar className="h-4 w-4" />
                  Criada em
                </span>
                <span className="text-sm font-semibold text-foreground">{formatDateTime(new Date(maintenance.createdAt))}</span>
              </div>

              {maintenance.startedAt && (
                <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                  <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <IconClock className="h-4 w-4" />
                    Iniciada em
                  </span>
                  <span className="text-sm font-semibold text-foreground">{formatDateTime(new Date(maintenance.startedAt))}</span>
                </div>
              )}

              {maintenance.finishedAt && (
                <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                  <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <IconClock className="h-4 w-4" />
                    Finalizada em
                  </span>
                  <span className="text-sm font-semibold text-foreground">{formatDateTime(new Date(maintenance.finishedAt))}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export { MaintenanceInfoCard };
