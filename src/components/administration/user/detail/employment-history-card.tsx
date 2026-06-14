import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, getBadgeVariantFromStatus } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { IconBriefcase, IconAlertTriangle } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { formatDate } from "../../../../utils";
import { CONTRACT_TYPE_LABELS, CONTRACT_STATUS, CONTRACT_STATUS_LABELS, EMPLOYEE_TYPE_LABELS, STABILITY_TYPE_LABELS } from "../../../../constants";
import { useEmploymentContracts } from "../../../../hooks/personnel-department/use-employment-contracts";
import type { EmploymentContract } from "../../../../types/employment-contract";

interface EmploymentHistoryCardProps {
  userId: string;
  className?: string;
  maxHeight?: string;
}

/**
 * "Histórico de Vínculos" — lists every EmploymentContract (vínculo) the person
 * has had, ordered by sequence: admissão→desligamento, categoria, tipo de
 * contrato, situação and cargo. The current vínculo (isCurrent) is highlighted.
 * This is the Alisson/Kennedy view (one person, multiple vínculos over time).
 */
export function EmploymentHistoryCard({ userId, className, maxHeight }: EmploymentHistoryCardProps) {
  const {
    data: response,
    isLoading,
    error,
  } = useEmploymentContracts(
    {
      userIds: [userId],
      orderBy: { sequence: "asc" },
      limit: 100,
      include: { position: true, sector: true },
    } as any,
    { enabled: !!userId },
  );

  const contracts: EmploymentContract[] = response?.data || [];

  return (
    <Card className={cn("shadow-sm border border-border flex flex-col", className)}>
      <CardHeader className="pb-6">
        <CardTitle className="flex items-center gap-2">
          <IconBriefcase className="h-5 w-5 text-muted-foreground" />
          Histórico de Vínculos
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 flex-1 overflow-y-auto" style={maxHeight ? { maxHeight } : undefined}>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <IconAlertTriangle className="h-4 w-4" />
            Não foi possível carregar os vínculos.
          </div>
        ) : contracts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum vínculo registrado.</p>
        ) : (
          <ol className="space-y-3">
            {contracts.map((contract) => {
              const isExperience = contract.status === CONTRACT_STATUS.EXPERIENCE;
              const isTerminated = contract.status === CONTRACT_STATUS.TERMINATED;
              const isOnLeave = contract.status === CONTRACT_STATUS.ON_LEAVE;
              const isNoticePeriod = contract.status === CONTRACT_STATUS.NOTICE_PERIOD;
              const admission = contract.admissionDate ?? contract.exp1StartAt ?? null;

              // Experiência phase is derived from the dates unless explicitly set.
              const experiencePhase = isExperience
                ? contract.experiencePhase ?? (contract.exp2StartAt ? 2 : 1)
                : null;

              const hasStability =
                !!contract.stabilityType && (!!contract.stabilityStart || !!contract.stabilityEnd);

              return (
                <li
                  key={contract.id}
                  className={cn(
                    "rounded-md border px-3 py-2.5",
                    contract.isCurrent ? "border-primary/40 bg-primary/5" : "border-border bg-muted/20",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">#{contract.sequence}</span>
                        {contract.contractType && (
                          <Badge variant={getBadgeVariantFromStatus(contract.contractType, "USER")} className="text-xs">
                            {CONTRACT_TYPE_LABELS[contract.contractType] || contract.contractType}
                          </Badge>
                        )}
                        <Badge variant={getBadgeVariantFromStatus(contract.status, "CONTRACT_STATUS")} className="text-xs">
                          {CONTRACT_STATUS_LABELS[contract.status] || contract.status}
                          {experiencePhase ? ` ${experiencePhase}` : ""}
                        </Badge>
                        {contract.isCurrent && <span className="text-xs text-primary font-medium">Atual</span>}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {EMPLOYEE_TYPE_LABELS[contract.employeeType] || contract.employeeType}
                        {contract.position?.name ? ` · ${contract.position.name}` : ""}
                        {contract.sector?.name ? ` · ${contract.sector.name}` : ""}
                      </div>
                      {hasStability && (
                        <div className="text-xs text-amber-600 dark:text-amber-500">
                          Estabilidade: {contract.stabilityType ? STABILITY_TYPE_LABELS[contract.stabilityType] : "-"}
                          {contract.stabilityStart || contract.stabilityEnd
                            ? ` (${contract.stabilityStart ? formatDate(contract.stabilityStart) : "?"} – ${contract.stabilityEnd ? formatDate(contract.stabilityEnd) : "?"})`
                            : ""}
                        </div>
                      )}
                    </div>
                    <div className="text-right text-xs text-muted-foreground whitespace-nowrap">
                      <div>Admissão: {admission ? formatDate(admission) : "-"}</div>
                      {contract.effectedAt && <div>Efetivado: {formatDate(contract.effectedAt)}</div>}
                      {isNoticePeriod && <div>Em aviso prévio</div>}
                      {isOnLeave && <div>Afastado</div>}
                      {isTerminated && <div>Desligamento: {contract.terminationDate ? formatDate(contract.terminationDate) : "-"}</div>}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
