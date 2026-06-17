import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { IconCalendarStats, IconLoader2 } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { routes, VACATION_STATUS_LABELS } from "../../../../constants";
import { formatDate } from "../../../../utils";
import type { Vacation } from "../../../../types/vacation";
import { useVacationPeriodBalance } from "../../../../hooks/personnel-department/use-vacations";
import { getVacationStatusVariant } from "../list/vacation-table-columns";

interface VacationBalanceCardProps {
  vacation: Vacation;
  className?: string;
}

function Stat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn("mt-1 text-xl font-bold tabular-nums", highlight && "text-primary")}>{value}</div>
    </div>
  );
}

/**
 * Remaining-days history for the vacation's acquisitive period. Multiple
 * Vacation rows can share the same período aquisitivo (each a single gozo
 * "taking"); the balance groups the siblings and shows what is still available.
 */
export function VacationBalanceCard({ vacation, className }: VacationBalanceCardProps) {
  const { data: response, isLoading } = useVacationPeriodBalance(vacation.id, {
    enabled: !!vacation.id,
  });

  const balance = response?.data;

  return (
    <Card className={cn("shadow-sm border border-border", className)}>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2">
          <IconCalendarStats className="h-5 w-5 text-muted-foreground" />
          Saldo do Período Aquisitivo
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-6 text-muted-foreground">
            <IconLoader2 className="h-5 w-5 animate-spin mr-2" />
            Carregando saldo...
          </div>
        ) : !balance ? (
          <p className="text-sm text-muted-foreground">Saldo indisponível para este período.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Stat label="Direito (gozo)" value={balance.gozoEntitled} />
              <Stat label="Abono" value={balance.abonoDays} />
              <Stat label="Agendados" value={balance.scheduledDays} />
              <Stat label="Restantes" value={balance.remainingDays} highlight />
            </div>

            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">Tomadas no período</div>
              {balance.takings.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma tomada registrada.</p>
              ) : (
                balance.takings.map((t) => {
                  const isCurrent = t.id === vacation.id;
                  return (
                    <Link
                      key={t.id}
                      to={routes.personnelDepartment.vacations.details(t.id)}
                      className={cn(
                        "flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm transition-colors",
                        isCurrent ? "border-primary/40 bg-primary/5" : "border-border hover:bg-muted/50",
                      )}
                    >
                      <span className="font-medium">{t.startDate ? formatDate(new Date(t.startDate)) : "Não agendado"}</span>
                      <span className="text-muted-foreground tabular-nums">{t.days} dia(s)</span>
                      <Badge variant={getVacationStatusVariant(t.status)} className="text-[10px] px-1.5 py-0">
                        {VACATION_STATUS_LABELS[t.status] || t.status}
                      </Badge>
                    </Link>
                  );
                })
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
