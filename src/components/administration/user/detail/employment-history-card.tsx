import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, getBadgeVariantFromStatus } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { IconBriefcase, IconAlertTriangle, IconCalendar } from "@tabler/icons-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { formatDate, formatRelativeTime } from "../../../../utils";
import { CONTRACT_TYPE_LABELS, CONTRACT_STATUS, CONTRACT_STATUS_LABELS, EMPLOYEE_TYPE_LABELS, STABILITY_TYPE_LABELS } from "../../../../constants";
import { useEmploymentContracts } from "../../../../hooks/personnel-department/use-employment-contracts";
import type { EmploymentContract } from "../../../../types/employment-contract";

interface EmploymentHistoryCardProps {
  userId: string;
  className?: string;
  maxHeight?: string;
}

const NO_DATE = "Sem data";

/**
 * "Histórico de Vínculos" — lists every EmploymentContract (vínculo) the person
 * has had. Mirrors the visual language of ChangelogHistory / RelatedActivitiesCard:
 * a scrollable, date-grouped timeline where each vínculo is a nested card with an
 * icon node on the left rail. The current vínculo (isCurrent) is highlighted green,
 * terminated ones red.
 */
export function EmploymentHistoryCard({ userId, className, maxHeight = "500px" }: EmploymentHistoryCardProps) {
  const {
    data: response,
    isLoading,
    error,
  } = useEmploymentContracts(
    {
      userIds: [userId],
      orderBy: { sequence: "desc" },
      limit: 100,
      include: { position: true, sector: true },
    } as any,
    { enabled: !!userId },
  );

  const contracts: EmploymentContract[] = response?.data || [];

  // Group by admission date (newest first), matching the changelog/activity layout.
  const grouped = useMemo(() => {
    const groups = new Map<string, EmploymentContract[]>();
    contracts.forEach((contract) => {
      const date = contract.admissionDate ?? contract.exp1StartAt ?? null;
      const key = date ? format(new Date(date), "dd/MM/yyyy") : NO_DATE;
      const arr = groups.get(key) || [];
      arr.push(contract);
      groups.set(key, arr);
    });
    return Array.from(groups.entries()).sort((a, b) => {
      if (a[0] === NO_DATE) return 1;
      if (b[0] === NO_DATE) return -1;
      const dateA = new Date(a[0].split("/").reverse().join("-"));
      const dateB = new Date(b[0].split("/").reverse().join("-"));
      return dateB.getTime() - dateA.getTime();
    });
  }, [contracts]);

  return (
    <Card
      className={cn("shadow-sm border border-border flex flex-col overflow-hidden", className)}
      style={maxHeight ? { maxHeight, height: maxHeight } : undefined}
    >
      <CardHeader className="pb-4 flex-shrink-0">
        <CardTitle className="flex items-center gap-2">
          <IconBriefcase className="h-5 w-5 text-muted-foreground" />
          Histórico de Vínculos
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 flex-1 flex flex-col min-h-0 overflow-hidden">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <IconAlertTriangle className="h-4 w-4" />
            Não foi possível carregar os vínculos.
          </div>
        ) : contracts.length === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center">Nenhum vínculo registrado.</div>
        ) : (
          <ScrollArea className="pr-4 h-full">
            <div className="space-y-6">
              {grouped.map(([date, group], groupIndex) => {
                const isLastGroup = groupIndex === grouped.length - 1;

                return (
                  <div key={date} className="relative">
                    {/* Date header */}
                    <div className="pb-1 mb-4 rounded-md">
                      <div className="flex justify-center items-center gap-4">
                        <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/60 border border-border">
                          <IconCalendar className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm font-medium text-muted-foreground">{date}</span>
                        </div>
                        <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent via-border to-transparent" />
                      </div>
                    </div>

                    <div className="space-y-3 relative">
                      {!isLastGroup && <div className="absolute left-6 top-12 bottom-0 w-0.5 bg-border" />}

                      {group.map((contract, index) => {
                        const isExperience = contract.status === CONTRACT_STATUS.EXPERIENCE;
                        const isTerminated = contract.status === CONTRACT_STATUS.TERMINATED;
                        const isOnLeave = contract.status === CONTRACT_STATUS.ON_LEAVE;
                        const isNoticePeriod = contract.status === CONTRACT_STATUS.NOTICE_PERIOD;
                        const admission = contract.admissionDate ?? contract.exp1StartAt ?? null;
                        const experiencePhase = isExperience
                          ? contract.experiencePhase ?? (contract.exp2StartAt ? 2 : 1)
                          : null;
                        const hasStability =
                          !!contract.stabilityType && (!!contract.stabilityStart || !!contract.stabilityEnd);
                        const isLastItem = isLastGroup && index === group.length - 1;

                        return (
                          <div key={contract.id} className="relative">
                            {!isLastItem && <div className="absolute left-6 top-12 bottom-0 w-0.5 bg-border" />}

                            <div className="flex items-start gap-4">
                              {/* Icon node on the timeline rail */}
                              <div className="relative z-10 flex items-center justify-center w-12 h-12">
                                <div
                                  className={cn(
                                    "flex items-center justify-center w-10 h-10 rounded-full border",
                                    contract.isCurrent
                                      ? "bg-green-100 dark:bg-green-900/30 border-green-700/40 text-green-700 dark:text-green-400"
                                      : isTerminated
                                        ? "bg-red-100 dark:bg-red-900/30 border-red-700/40 text-red-700 dark:text-red-400"
                                        : "bg-muted border-border text-muted-foreground",
                                  )}
                                >
                                  <IconBriefcase className="h-5 w-5" />
                                </div>
                              </div>

                              {/* Vínculo card */}
                              <div className="flex-1 bg-card-nested rounded-xl p-4 border border-border">
                                <div className="flex items-center justify-between gap-2 mb-2">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm font-medium">Vínculo #{contract.sequence}</span>
                                    {contract.contractType && (
                                      <Badge variant={getBadgeVariantFromStatus(contract.contractType, "USER")} className="text-xs whitespace-nowrap">
                                        {CONTRACT_TYPE_LABELS[contract.contractType] || contract.contractType}
                                      </Badge>
                                    )}
                                    <Badge variant={getBadgeVariantFromStatus(contract.status, "CONTRACT_STATUS")} className="text-xs whitespace-nowrap">
                                      {CONTRACT_STATUS_LABELS[contract.status] || contract.status}
                                      {experiencePhase ? ` ${experiencePhase}` : ""}
                                    </Badge>
                                    {contract.isCurrent && (
                                      <Badge variant="active" className="text-xs whitespace-nowrap">
                                        Atual
                                      </Badge>
                                    )}
                                  </div>
                                  {admission && (
                                    <div className="text-sm text-muted-foreground whitespace-nowrap">{formatRelativeTime(admission)}</div>
                                  )}
                                </div>

                                <div className="text-xs text-muted-foreground">
                                  {EMPLOYEE_TYPE_LABELS[contract.employeeType] || contract.employeeType}
                                  {contract.position?.name ? ` · ${contract.position.name}` : ""}
                                  {contract.sector?.name ? ` · ${contract.sector.name}` : ""}
                                </div>

                                <div className="text-xs text-muted-foreground mt-1">
                                  Admissão: {admission ? formatDate(admission) : "-"}
                                  {contract.effectedAt ? ` · Efetivado: ${formatDate(contract.effectedAt)}` : ""}
                                  {isNoticePeriod ? " · Em aviso prévio" : ""}
                                  {isOnLeave ? " · Afastado" : ""}
                                  {isTerminated ? ` · Desligamento: ${contract.terminationDate ? formatDate(contract.terminationDate) : "-"}` : ""}
                                </div>

                                {hasStability && (
                                  <div className="text-xs text-amber-600 dark:text-amber-500 mt-1">
                                    Estabilidade: {contract.stabilityType ? STABILITY_TYPE_LABELS[contract.stabilityType] : "-"}
                                    {contract.stabilityStart || contract.stabilityEnd
                                      ? ` (${contract.stabilityStart ? formatDate(contract.stabilityStart) : "?"} – ${contract.stabilityEnd ? formatDate(contract.stabilityEnd) : "?"})`
                                      : ""}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
