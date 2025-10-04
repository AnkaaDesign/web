import { IconCalendar, IconUser, IconTag, IconFlag, IconUsers } from "@tabler/icons-react";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";

import type { Vacation } from "../../../../types";
import { VACATION_STATUS_LABELS, VACATION_TYPE_LABELS } from "../../../../constants";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface SpecificationsCardProps {
  vacation: Vacation & { user?: { name: string; email: string | null } };
}

export function SpecificationsCard({ vacation }: SpecificationsCardProps) {
  const start = new Date(vacation.startAt);
  const end = new Date(vacation.endAt);
  const today = new Date();
  const totalDays = differenceInDays(end, start) + 1;

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "APPROVED":
        return "success";
      case "REJECTED":
        return "destructive";
      case "CANCELLED":
        return "secondary";
      case "IN_PROGRESS":
        return "default";
      case "COMPLETED":
        return "outline";
      default:
        return "warning";
    }
  };

  const getTimeStatus = () => {
    if (today < start) {
      const daysUntil = differenceInDays(start, today);
      return { text: `Inicia em ${daysUntil} dias`, variant: "secondary" as const };
    } else if (today > end) {
      const daysAgo = differenceInDays(today, end);
      return { text: `Finalizada há ${daysAgo} dias`, variant: "outline" as const };
    } else {
      const daysRemaining = differenceInDays(end, today);
      return { text: `${daysRemaining} dias restantes`, variant: "default" as const };
    }
  };

  const timeStatus = getTimeStatus();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Especificações</CardTitle>
        <CardDescription>Informações detalhadas das férias</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {vacation.user && (
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground font-medium flex items-center gap-1">
              <IconUser className="h-3.5 w-3.5" />
              Colaborador
            </p>
            <div>
              <p className="text-base font-medium">{vacation.user.name}</p>
              <p className="text-sm text-muted-foreground">{vacation.user.email}</p>
            </div>
          </div>
        )}

        <div className="space-y-1">
          <p className="text-sm text-muted-foreground font-medium flex items-center gap-1">
            <IconCalendar className="h-3.5 w-3.5" />
            Período
          </p>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{format(start, "dd/MM/yyyy", { locale: ptBR })}</span>
              <span className="text-muted-foreground">→</span>
              <span className="text-sm font-medium">{format(end, "dd/MM/yyyy", { locale: ptBR })}</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {totalDays} {totalDays === 1 ? "dia" : "dias"}
              </Badge>
              <Badge variant={timeStatus.variant} className="text-xs">
                {timeStatus.text}
              </Badge>
            </div>
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-sm text-muted-foreground font-medium flex items-center gap-1">
            <IconTag className="h-3.5 w-3.5" />
            Tipo
          </p>
          <Badge variant="outline" className="w-fit">
            {VACATION_TYPE_LABELS[vacation.type]}
          </Badge>
        </div>

        <div className="space-y-1">
          <p className="text-sm text-muted-foreground font-medium flex items-center gap-1">
            <IconFlag className="h-3.5 w-3.5" />
            Status
          </p>
          <Badge variant={getStatusBadgeVariant(vacation.status)} className="w-fit">
            {VACATION_STATUS_LABELS[vacation.status]}
          </Badge>
        </div>

        <div className="space-y-1">
          <p className="text-sm text-muted-foreground font-medium flex items-center gap-1">
            <IconUsers className="h-3.5 w-3.5" />
            Tipo de Férias
          </p>
          <p className="text-base">{vacation.isCollective ? "Férias Coletivas" : "Férias Individuais"}</p>
        </div>

        <div className="pt-4 border-t space-y-3">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">Criado em</p>
            <p className="text-sm">{format(new Date(vacation.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
          </div>

          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">Última atualização</p>
            <p className="text-sm">{format(new Date(vacation.updatedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
