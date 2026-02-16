import { IconBeach, IconCalendar, IconUser, IconTag, IconUsers, IconClock } from "@tabler/icons-react";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";

import type { Vacation } from "../../../../types";
import { VACATION_TYPE_LABELS } from "../../../../constants";
import { VacationStatusBadge } from "../common/vacation-status-badge";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface SpecificationsCardProps {
  vacation: Vacation & { user?: { name: string; email: string | null } };
  className?: string;
}

export function SpecificationsCard({ vacation, className }: SpecificationsCardProps) {
  const start = new Date(vacation.startAt);
  const end = new Date(vacation.endAt);
  const today = new Date();
  const totalDays = differenceInDays(end, start) + 1;

  const getTimeStatus = () => {
    if (today < start) {
      const daysUntil = differenceInDays(start, today);
      return `Inicia em ${daysUntil} ${daysUntil === 1 ? "dia" : "dias"}`;
    } else if (today > end) {
      const daysAgo = differenceInDays(today, end);
      return `Finalizada há ${daysAgo} ${daysAgo === 1 ? "dia" : "dias"}`;
    } else {
      const daysRemaining = differenceInDays(end, today);
      return `${daysRemaining} ${daysRemaining === 1 ? "dia restante" : "dias restantes"}`;
    }
  };

  return (
    <Card className={cn("shadow-sm border border-border flex flex-col", className)}>
      <CardHeader className="pb-6">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <IconBeach className="h-5 w-5 text-muted-foreground" />
            Informações das Férias
          </CardTitle>
          <VacationStatusBadge status={vacation.status} />
        </div>
      </CardHeader>
      <CardContent className="pt-0 flex-1">
        <div className="space-y-6">
          {/* Collaborator Section */}
          {vacation.user && (
            <div>
              <h3 className="text-base font-semibold mb-4 text-foreground">Colaborador</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                  <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <IconUser className="h-4 w-4" />
                    Nome
                  </span>
                  <span className="text-sm font-semibold text-foreground">{vacation.user.name}</span>
                </div>
                {vacation.user.email && (
                  <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                    <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <IconUser className="h-4 w-4" />
                      E-mail
                    </span>
                    <a href={`mailto:${vacation.user.email}`} className="text-sm font-semibold text-primary hover:underline">
                      {vacation.user.email}
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Period Section */}
          <div className={cn(vacation.user && "pt-6 border-t border-border")}>
            <h3 className="text-base font-semibold mb-4 text-foreground">Período</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <IconCalendar className="h-4 w-4" />
                  Data de Início
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {format(start, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </span>
              </div>

              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <IconCalendar className="h-4 w-4" />
                  Data de Término
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {format(end, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </span>
              </div>

              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <IconClock className="h-4 w-4" />
                  Duração
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {totalDays} {totalDays === 1 ? "dia" : "dias"}
                </span>
              </div>

              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <IconClock className="h-4 w-4" />
                  Situação
                </span>
                <span className="text-sm font-semibold text-foreground">{getTimeStatus()}</span>
              </div>
            </div>
          </div>

          {/* Details Section */}
          <div className="pt-6 border-t border-border">
            <h3 className="text-base font-semibold mb-4 text-foreground">Detalhes</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <IconTag className="h-4 w-4" />
                  Tipo
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {VACATION_TYPE_LABELS[vacation.type]}
                </span>
              </div>

              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <IconUsers className="h-4 w-4" />
                  Modalidade
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {vacation.isCollective ? "Férias Coletivas" : "Férias Individuais"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
