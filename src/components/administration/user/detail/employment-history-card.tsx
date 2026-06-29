import { useEffect, useMemo } from "react";
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
import type { EmploymentContract, ContractPhaseHistory } from "../../../../types/employment-contract";

interface EmploymentHistoryCardProps {
  userId: string;
  className?: string;
  maxHeight?: string;
  /**
   * Reports how many vínculos were loaded so the parent can decide whether to
   * render this card at all (it must never show an empty "Nenhum registro"
   * placeholder). `null` while loading, then the contract count.
   */
  onCount?: (count: number | null) => void;
  /**
   * When true, render ONLY the inner timeline body (no outer `<Card>`,
   * `<CardHeader>` or `<CardTitle>`). The surrounding detail-page section
   * supplies the single card chrome + title. Default false → unchanged.
   */
  embedded?: boolean;
}

const NO_DATE = "Sem data";

/**
 * "Histórico de Vínculos" — lists every EmploymentContract (vínculo) the person
 * has had. It is a visual sibling of RelatedActivitiesCard ("Histórico de
 * Atividades") and ChangelogHistory ("Histórico de Alterações"): same card
 * chrome, same centered date-chip separator, the same `w-12 h-12` timeline node
 * + `absolute left-6 top-12 ... w-0.5 bg-border` rail, the same
 * `bg-card-nested rounded-xl p-4 border border-border` entry card with a
 * right-aligned relative timestamp in its header. The phase sub-timeline reuses
 * the same rail idiom at a smaller scale so it reads as a nested mini-rail.
 */
export function EmploymentHistoryCard({ userId, className, maxHeight = "500px", onCount, embedded = false }: EmploymentHistoryCardProps) {
  const {
    data: response,
    isLoading,
    error,
  } = useEmploymentContracts(
    {
      userIds: [userId],
      orderBy: { sequence: "desc" },
      limit: 100,
      include: {
        position: true,
        sector: true,
        phaseHistory: { orderBy: { startDate: "asc" } },
      },
    } as any,
    { enabled: !!userId },
  );

  const contracts: EmploymentContract[] = response?.data || [];

  // Surface the record count to the parent (used to hide this card when empty).
  useEffect(() => {
    onCount?.(isLoading ? null : contracts.length);
  }, [isLoading, contracts.length, onCount]);

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

  const body = (
    <>
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
          <ScrollArea className="pr-4 flex-grow">
            <div className="space-y-6">
              {grouped.map(([date, group], groupIndex) => {
                const isLastGroup = groupIndex === grouped.length - 1;

                return (
                  <div key={date} className="relative">
                    {/* Date Header — identical centered chip separator as the reference cards */}
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

                    {/* Entries for this date */}
                    <div className="space-y-3 relative">
                      {/* Timeline rail */}
                      {!isLastGroup && <div className="absolute left-6 top-12 bottom-0 w-0.5 bg-border" />}

                      {group.map((contract, index) => {
                        const isTerminated = contract.status === CONTRACT_STATUS.TERMINATED;
                        const admission = contract.admissionDate ?? contract.exp1StartAt ?? null;
                        const hasStability = !!contract.stabilityType && (!!contract.stabilityStart || !!contract.stabilityEnd);
                        const isLastItem = isLastGroup && index === group.length - 1;

                        // Phase history: every MODALITY this vínculo held over time,
                        // ordered by startDate. endDate === null ⇒ current/open phase.
                        const phases: ContractPhaseHistory[] = [...(contract.phaseHistory ?? [])].sort(
                          (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
                        );

                        return (
                          <div key={contract.id} className="relative">
                            {/* Timeline rail connector */}
                            {!isLastItem && <div className="absolute left-6 top-12 bottom-0 w-0.5 bg-border" />}

                            <div className="flex items-start gap-4 group">
                              {/* Timeline dot and icon — bare icon in the w-12 h-12 node, exactly like the reference cards */}
                              <div className="relative z-10 flex items-center justify-center w-12 h-12">
                                <IconBriefcase
                                  className={cn(
                                    "h-5 w-5 transition-transform group-hover:scale-110",
                                    contract.isCurrent
                                      ? "text-green-600 dark:text-green-400"
                                      : isTerminated
                                        ? "text-red-600 dark:text-red-400"
                                        : "text-muted-foreground",
                                  )}
                                />
                              </div>

                              {/* Vínculo card */}
                              <div className="flex-1 bg-card-nested rounded-xl p-4 border border-border">
                                {/* Header — badges on the left, relative timestamp right-aligned (matches references) */}
                                <div className="flex items-center justify-between gap-2 mb-3">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm font-semibold">Vínculo #{contract.sequence}</span>
                                    {contract.contractType && (
                                      <Badge variant={getBadgeVariantFromStatus(contract.contractType, "USER")} className="text-xs whitespace-nowrap">
                                        {CONTRACT_TYPE_LABELS[contract.contractType] || contract.contractType}
                                      </Badge>
                                    )}
                                    <Badge variant={getBadgeVariantFromStatus(contract.status, "CONTRACT_STATUS")} className="text-xs whitespace-nowrap">
                                      {CONTRACT_STATUS_LABELS[contract.status] || contract.status}
                                    </Badge>
                                    {contract.isCurrent && (
                                      <Badge variant="active" className="text-xs whitespace-nowrap">
                                        Atual
                                      </Badge>
                                    )}
                                  </div>
                                  {admission && <div className="text-sm text-muted-foreground whitespace-nowrap">{formatRelativeTime(admission)}</div>}
                                </div>

                                <div className="text-xs text-muted-foreground">
                                  {EMPLOYEE_TYPE_LABELS[contract.employeeType] || contract.employeeType}
                                  {contract.position?.name ? ` · ${contract.position.name}` : ""}
                                  {contract.sector?.name ? ` · ${contract.sector.name}` : ""}
                                </div>

                                <div className="text-xs text-muted-foreground mt-1">
                                  Admissão: {admission ? formatDate(admission) : "-"}
                                  {contract.effectedAt ? ` · Efetivado: ${formatDate(contract.effectedAt)}` : ""}
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

                                {phases.length > 0 && (
                                  <div className="mt-3 pt-3 border-t border-border">
                                    <div className="text-xs font-medium text-muted-foreground mb-2">Fases da modalidade</div>
                                    {/* Nested mini-rail — same rail idiom as the parent timeline, scaled down to read as a subtle sub-timeline */}
                                    <div className="relative space-y-2">
                                      {phases.map((phase, phaseIndex) => {
                                        const isOpen = phase.endDate === null || phase.endDate === undefined;
                                        const isLastPhase = phaseIndex === phases.length - 1;
                                        return (
                                          <div key={phase.id} className="relative flex items-start gap-2.5">
                                            {/* Mini rail connector */}
                                            {!isLastPhase && <div className="absolute left-[3px] top-3.5 bottom-0 w-px bg-border" />}
                                            <div
                                              className={cn(
                                                "relative z-10 mt-1 h-1.5 w-1.5 rounded-full flex-shrink-0",
                                                isOpen ? "bg-green-600 dark:bg-green-400" : "bg-muted-foreground/50",
                                              )}
                                            />
                                            <div className="flex-1 min-w-0">
                                              <div className="flex items-center gap-1.5 flex-wrap">
                                                <span className="text-xs font-medium">{CONTRACT_TYPE_LABELS[phase.contractType] || phase.contractType}</span>
                                                {isOpen && (
                                                  <Badge variant="active" className="text-[10px] px-1.5 py-0 leading-4 whitespace-nowrap">
                                                    Atual
                                                  </Badge>
                                                )}
                                              </div>
                                              <div className="text-xs text-muted-foreground">
                                                {formatDate(phase.startDate)} – {isOpen ? "atual" : formatDate(phase.endDate)}
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
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
    </>
  );

  // Embedded: render only the inner body — the detail-page section provides the
  // single card chrome + "Histórico de Vínculos" title.
  if (embedded) {
    return <div className={cn("flex flex-col min-h-0 h-full overflow-hidden", className)}>{body}</div>;
  }

  return (
    <Card className={cn("shadow-sm border border-border flex flex-col overflow-hidden", className)} style={maxHeight ? { maxHeight, height: maxHeight } : undefined}>
      <CardHeader className="pb-4 flex-shrink-0">
        <CardTitle className="flex items-center gap-2">
          <IconBriefcase className="h-5 w-5 text-muted-foreground" />
          Histórico de Vínculos
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 flex-grow flex flex-col min-h-0 overflow-hidden">{body}</CardContent>
    </Card>
  );
}
