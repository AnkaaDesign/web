import { useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { IconTimeline, IconAlertTriangle, IconCalendar, IconTrendingUp, IconTrendingDown, IconArrowsHorizontal, IconAdjustments } from "@tabler/icons-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { formatDate, formatRelativeTime } from "../../../../utils";
import { POSITION_CHANGE_REASON, POSITION_CHANGE_REASON_LABELS } from "../../../../constants";
import { useUserPositionHistories } from "../../../../hooks/personnel-department/use-user-position-history";
import { getReasonBadgeVariant, PositionChangeSummary } from "../list/user-position-history-table-columns";
import type { UserPositionHistory } from "../../../../types/user-position-history";

interface UserPositionHistoryCardProps {
  userId: string;
  className?: string;
  /** Maximum height of the scrollable timeline area. */
  maxHeight?: string;
  /**
   * Reports how many cargo records were loaded so the parent can hide this card
   * entirely when there are none (promotion history is frequently empty — it
   * must never surface a "Nenhum registro" placeholder). `null` while loading.
   */
  onCount?: (count: number | null) => void;
  /**
   * When true, render ONLY the inner timeline body (no outer `<Card>`,
   * `<CardHeader>` or `<CardTitle>`). The surrounding detail-page section
   * supplies the single card chrome + "Histórico de Cargos" title. Default
   * false → unchanged (standalone card).
   */
  embedded?: boolean;
}

const NO_DATE = "Sem data";

/** Per-reason icon node — keeps the timeline legible (promoção ↑, rebaixamento ↓). */
function reasonIconNode(reason: string) {
  switch (reason) {
    case POSITION_CHANGE_REASON.PROMOTION:
      return {
        Icon: IconTrendingUp,
        className: "bg-green-100 dark:bg-green-900/30 border-green-700/40 text-green-700 dark:text-green-400",
      };
    case POSITION_CHANGE_REASON.DEMOTION:
      return {
        Icon: IconTrendingDown,
        className: "bg-red-100 dark:bg-red-900/30 border-red-700/40 text-red-700 dark:text-red-400",
      };
    case POSITION_CHANGE_REASON.TRANSFER:
      return { Icon: IconArrowsHorizontal, className: "bg-muted border-border text-muted-foreground" };
    default:
      return { Icon: IconAdjustments, className: "bg-muted border-border text-muted-foreground" };
  }
}

/**
 * "Histórico de Cargos" — self-contained card for the collaborator detail page.
 * Mirrors ChangelogHistory / RelatedActivitiesCard: a scrollable, date-grouped
 * timeline where each promotion/adjustment is a nested card with a reason-coloured
 * icon node on the left rail. The open row (endedAt = null) is the current cargo.
 *
 * Read-only: shows previous→new cargo, reason, who changed it, note and date
 * ranges — never salary (that lives on the dedicated Promoções pages), so it is
 * safe for the collaborator detail audience.
 */
export function UserPositionHistoryCard({ userId, className, maxHeight = "500px", onCount, embedded = false }: UserPositionHistoryCardProps) {
  const {
    data: response,
    isLoading,
    error,
  } = useUserPositionHistories(
    {
      userIds: [userId],
      orderBy: { startedAt: "desc" },
      limit: 100,
      include: {
        position: true,
        previousPosition: true,
        changedBy: true,
      },
    },
    { enabled: !!userId },
  );

  const records: UserPositionHistory[] = response?.data || [];

  // Surface the record count to the parent (used to hide this card when empty).
  useEffect(() => {
    onCount?.(isLoading ? null : records.length);
  }, [isLoading, records.length, onCount]);

  // Group by start date (newest first), matching the changelog/activity layout.
  const grouped = useMemo(() => {
    const groups = new Map<string, UserPositionHistory[]>();
    records.forEach((record) => {
      const key = record.startedAt ? format(new Date(record.startedAt), "dd/MM/yyyy") : NO_DATE;
      const arr = groups.get(key) || [];
      arr.push(record);
      groups.set(key, arr);
    });
    return Array.from(groups.entries()).sort((a, b) => {
      if (a[0] === NO_DATE) return 1;
      if (b[0] === NO_DATE) return -1;
      const dateA = new Date(a[0].split("/").reverse().join("-"));
      const dateB = new Date(b[0].split("/").reverse().join("-"));
      return dateB.getTime() - dateA.getTime();
    });
  }, [records]);

  const body = isLoading ? (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-xl" />
      ))}
    </div>
  ) : error ? (
    <div className="flex flex-col items-center justify-center py-8 text-center text-destructive">
      <IconAlertTriangle className="h-8 w-8 mb-3" />
      <div className="text-sm font-medium">Não foi possível carregar o histórico de cargos</div>
    </div>
  ) : records.length === 0 ? (
    <div className="text-sm text-muted-foreground py-8 text-center">Nenhum registro de cargo para este colaborador.</div>
  ) : (
    <ScrollArea className="pr-4 flex-grow" style={{ maxHeight }}>
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

                {group.map((record, index) => {
                  const isCurrent = !record.endedAt;
                  const { Icon, className: nodeClassName } = reasonIconNode(record.reason);
                  const isLastItem = isLastGroup && index === group.length - 1;

                  return (
                    <div key={record.id} className="relative">
                      {!isLastItem && <div className="absolute left-6 top-12 bottom-0 w-0.5 bg-border" />}

                      <div className="flex items-start gap-4">
                        {/* Reason icon node on the timeline rail */}
                        <div className="relative z-10 flex items-center justify-center w-12 h-12">
                          <div className={cn("flex items-center justify-center w-10 h-10 rounded-full border", nodeClassName)}>
                            <Icon className="h-5 w-5" />
                          </div>
                        </div>

                        {/* Cargo change card */}
                        <div className="flex-1 bg-card-nested rounded-xl p-4 border border-border">
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <PositionChangeSummary history={record} />
                              <Badge variant={getReasonBadgeVariant(record.reason)} className="text-xs whitespace-nowrap">
                                {POSITION_CHANGE_REASON_LABELS[record.reason as POSITION_CHANGE_REASON] || record.reason}
                              </Badge>
                              {isCurrent && (
                                <Badge variant="active" className="text-xs whitespace-nowrap">
                                  Atual
                                </Badge>
                              )}
                            </div>
                            {record.startedAt && (
                              <div className="text-sm text-muted-foreground whitespace-nowrap">{formatRelativeTime(record.startedAt)}</div>
                            )}
                          </div>

                          <div className="text-xs text-muted-foreground">
                            {record.startedAt ? formatDate(new Date(record.startedAt)) : "-"}
                            {isCurrent ? (
                              <span> — presente</span>
                            ) : (
                              <span>
                                {" — "}
                                {record.endedAt ? formatDate(new Date(record.endedAt)) : "-"}
                              </span>
                            )}
                            <span> · por {record.changedBy?.name || <span className="italic">Sistema</span>}</span>
                          </div>

                          {record.note && (
                            <div className="text-xs text-foreground/80 whitespace-pre-wrap break-words mt-1">{record.note}</div>
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
  );

  // Embedded: render only the inner timeline body — the detail-page section
  // provides the single card chrome + "Histórico de Cargos" title.
  if (embedded) {
    return <div className={cn("flex flex-col min-h-0 h-full", className)}>{body}</div>;
  }

  return (
    <Card
      className={cn("shadow-sm border border-border flex flex-col overflow-hidden", className)}
      style={maxHeight ? { maxHeight, height: maxHeight } : undefined}
    >
      <CardHeader className="pb-4 flex-shrink-0">
        <CardTitle className="flex items-center gap-2">
          <IconTimeline className="h-5 w-5 text-muted-foreground" />
          Histórico de Cargos
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 flex-1 flex flex-col min-h-0 overflow-hidden">{body}</CardContent>
    </Card>
  );
}
