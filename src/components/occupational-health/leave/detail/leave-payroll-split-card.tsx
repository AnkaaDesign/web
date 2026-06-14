import { IconCash, IconBuildingBank, IconCalendarStats, IconInfoCircle, IconLoader2 } from "@tabler/icons-react";

import type { Leave } from "../../../../types/leave";
import { LEAVE_TYPE, INSS_BENEFIT_SPECIES_LABELS } from "../../../../constants";
import type { INSS_BENEFIT_SPECIES } from "../../../../constants";
import { formatDate } from "../../../../utils";
import { useLeavePayrollSplit } from "../../../../hooks/occupational-health/use-leaves";
import { cn } from "@/lib/utils";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DetailRow } from "@/components/ui/detail-row";

interface LeavePayrollSplitCardProps {
  leave: Leave;
  className?: string;
}

// Tipos de afastamento que disparam o split previdenciário (15 dias empregador / 16º+ INSS).
const INSS_SPLIT_TYPES: string[] = [LEAVE_TYPE.ILLNESS_INSS, LEAVE_TYPE.WORK_ACCIDENT];

/**
 * Cobertura previdenciária do afastamento (Part E): primeiros 15 dias pagos pelo
 * empregador, 16º dia em diante pelo INSS. Só faz sentido para auxílio-doença e
 * acidente de trabalho — para outros tipos exibimos uma nota explicativa.
 */
export function LeavePayrollSplitCard({ leave, className }: LeavePayrollSplitCardProps) {
  const isInssSplit = INSS_SPLIT_TYPES.includes(leave.type as string);

  const { data, isLoading, error } = useLeavePayrollSplit(leave.id, { enabled: isInssSplit });
  const split = data?.data;

  return (
    <Card className={cn("shadow-sm border border-border flex flex-col", className)}>
      <CardHeader className="pb-6">
        <CardTitle className="flex items-center gap-2">
          <IconCash className="h-5 w-5 text-muted-foreground" />
          Cobertura previdenciária
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 flex-1">
        {!isInssSplit ? (
          <div className="flex items-start gap-2 bg-muted/50 rounded-lg px-4 py-3">
            <IconInfoCircle className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
            <p className="text-sm text-muted-foreground">Este tipo de afastamento não gera benefício previdenciário (sem split empregador/INSS).</p>
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-6">
            <IconLoader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error || !split ? (
          <div className="flex items-start gap-2 bg-muted/50 rounded-lg px-4 py-3">
            <IconInfoCircle className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
            <p className="text-sm text-muted-foreground">Não foi possível calcular a divisão da folha para este afastamento.</p>
          </div>
        ) : (
          <div className="space-y-2">
            <DetailRow
              icon={IconCalendarStats}
              label="Período"
              value={`${formatDate(new Date(split.startDate))} — ${formatDate(new Date(split.endDate))}`}
            />
            <DetailRow icon={IconCalendarStats} label="Total de dias" value={split.totalDays} />
            <DetailRow
              icon={IconCash}
              label="Empregador (1º–15º dia)"
              value={
                <Badge variant="blue" className="font-normal">
                  {split.employerPaidDays} {split.employerPaidDays === 1 ? "dia" : "dias"}
                </Badge>
              }
            />
            <DetailRow
              icon={IconBuildingBank}
              label="INSS (16º dia em diante)"
              value={
                <Badge variant="teal" className="font-normal">
                  {split.inssDays} {split.inssDays === 1 ? "dia" : "dias"}
                </Badge>
              }
            />
            {split.inssBenefitSpecies && (
              <DetailRow
                icon={IconBuildingBank}
                label="Espécie do benefício"
                value={INSS_BENEFIT_SPECIES_LABELS[split.inssBenefitSpecies as INSS_BENEFIT_SPECIES] || split.inssBenefitSpecies}
              />
            )}
            <p className="text-xs text-muted-foreground px-1">
              Os primeiros 15 dias são pagos pelo empregador; a partir do 16º dia o INSS assume o benefício.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
