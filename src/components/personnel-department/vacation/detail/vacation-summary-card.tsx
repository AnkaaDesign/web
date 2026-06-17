import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { IconBeach } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { routes, VACATION_STATUS_LABELS } from "../../../../constants";
import { formatDate } from "../../../../utils";
import type { Vacation } from "../../../../types/vacation";
import { getVacationStatusVariant, isConcessiveExpired, isConcessiveExpiringSoon, getConcessiveDaysRemaining } from "../list/vacation-table-columns";
import { DetailRow } from "@/components/ui/detail-row";

interface VacationSummaryCardProps {
  vacation: Vacation;
  className?: string;
}

export function VacationSummaryCard({ vacation, className }: VacationSummaryCardProps) {
  const expired = isConcessiveExpired(vacation);
  const expiring = isConcessiveExpiringSoon(vacation);
  const remaining = getConcessiveDaysRemaining(vacation);

  // A Vacation is now a single gozo "taking" (startDate + days). The full
  // remaining-days picture across sibling takings lives in the balance card.
  const gozoEntitled = Math.max(0, vacation.entitledDays - vacation.abonoPecuniarioDays);

  return (
    <Card className={cn("shadow-sm border border-border", className)}>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2">
          <IconBeach className="h-5 w-5 text-muted-foreground" />
          Resumo
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          <DetailRow
            label="Colaborador"
            value={
              vacation.user ? (
                <Link to={routes.administration.collaborators.details(vacation.userId)} className="text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
                  {vacation.user.name}
                </Link>
              ) : (
                "-"
              )
            }
          />

          {vacation.user?.position?.name && <DetailRow label="Cargo" value={vacation.user.position.name} />}
          {vacation.user?.sector?.name && <DetailRow label="Setor" value={vacation.user.sector.name} />}

          <DetailRow
            label="Status"
            value={
              <Badge variant={getVacationStatusVariant(vacation.status)} className="text-xs">
                {VACATION_STATUS_LABELS[vacation.status] || vacation.status}
              </Badge>
            }
          />

          <DetailRow
            label="Período Aquisitivo"
            value={`${vacation.acquisitiveStart ? formatDate(new Date(vacation.acquisitiveStart)) : "-"} — ${vacation.acquisitiveEnd ? formatDate(new Date(vacation.acquisitiveEnd)) : "-"}`}
          />

          <DetailRow
            label="Limite Concessivo"
            value={
              vacation.concessiveEnd ? (
                <span className="inline-flex items-center gap-2">
                  <span className={expired ? "text-destructive font-medium" : expiring ? "text-amber-600 font-medium" : undefined}>{formatDate(new Date(vacation.concessiveEnd))}</span>
                  {expired && (
                    <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                      Vencido
                    </Badge>
                  )}
                  {!expired && expiring && (
                    <Badge variant="warning" className="text-[10px] px-1.5 py-0">
                      {remaining}d restantes
                    </Badge>
                  )}
                </span>
              ) : (
                "-"
              )
            }
          />

          <DetailRow
            label="Início do Gozo"
            value={vacation.startDate ? formatDate(new Date(vacation.startDate)) : "Não agendado"}
          />
          <DetailRow label="Dias de Gozo (este período)" value={`${vacation.days} dia(s)`} />

          <DetailRow label="Faltas Injustificadas" value={vacation.unjustifiedAbsencesInPeriod} />
          <DetailRow label="Dias de Direito (art. 130)" value={`${vacation.entitledDays} dias`} />
          <DetailRow label="Abono Pecuniário" value={vacation.abonoPecuniarioDays > 0 ? `${vacation.abonoPecuniarioDays} dia(s)` : "-"} />
          <DetailRow label="Gozo de Direito (direito − abono)" value={`${gozoEntitled} dias`} />
          <DetailRow label="Vendeu 1/3" value={vacation.soldThird ? "Sim" : "Não"} />
          <DetailRow
            label="Em Dobro (art. 137)"
            value={vacation.isDouble ? <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Em dobro</Badge> : "Não"}
          />

          <DetailRow label="Prazo de Pagamento" value={vacation.paymentDueDate ? formatDate(new Date(vacation.paymentDueDate)) : "-"} />
          <DetailRow label="Data de Pagamento" value={vacation.paymentDate ? formatDate(new Date(vacation.paymentDate)) : "-"} />

          {vacation.notes && <DetailRow label="Observações" value={vacation.notes} block />}
        </div>
      </CardContent>
    </Card>
  );
}
