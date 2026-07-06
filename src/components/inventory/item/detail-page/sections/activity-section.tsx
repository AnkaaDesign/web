import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { IconArrowUpRight, IconArrowDownRight, IconCalendar, IconDots, IconTrendingUp, IconTrendingDown } from "@tabler/icons-react";
import type { Item, Activity } from "../../../../../types";
import { ACTIVITY_REASON, ACTIVITY_REASON_LABELS, ACTIVITY_OPERATION } from "../../../../../constants";
import { formatRelativeTime } from "../../../../../utils";
import { format, startOfMonth, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

// Round movement quantities for display — integers stay clean, fractions cap at 2 decimals.
const fmtQty = (value: number) => (value ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 });

const ACTIVITY_TYPE_COLORS: Record<string, { bg: string; icon: string; text: string }> = {
  [ACTIVITY_REASON.ORDER_RECEIVED]: { bg: "bg-muted/50", icon: "text-muted-foreground", text: "text-foreground" },
  [ACTIVITY_REASON.PRODUCTION_USAGE]: { bg: "bg-primary/10", icon: "text-primary", text: "text-foreground" },
  [ACTIVITY_REASON.PPE_DELIVERY]: { bg: "bg-[hsl(var(--success))]/10", icon: "text-[hsl(var(--success))]", text: "text-foreground" },
  [ACTIVITY_REASON.RETURN]: { bg: "bg-[hsl(var(--info))]/10", icon: "text-[hsl(var(--info))]", text: "text-foreground" },
  [ACTIVITY_REASON.EXTERNAL_OPERATION]: { bg: "bg-[hsl(var(--error))]/10", icon: "text-[hsl(var(--error))]", text: "text-foreground" },
  [ACTIVITY_REASON.EXTERNAL_OPERATION_RETURN]: { bg: "bg-[hsl(var(--info))]/10", icon: "text-[hsl(var(--info))]", text: "text-foreground" },
  [ACTIVITY_REASON.INVENTORY_COUNT]: { bg: "bg-muted/50", icon: "text-muted-foreground", text: "text-foreground" },
  [ACTIVITY_REASON.MANUAL_ADJUSTMENT]: { bg: "bg-[hsl(var(--warning))]/10", icon: "text-[hsl(var(--warning))]", text: "text-foreground" },
  [ACTIVITY_REASON.MAINTENANCE]: { bg: "bg-primary/10", icon: "text-primary", text: "text-foreground" },
  [ACTIVITY_REASON.DAMAGE]: { bg: "bg-[hsl(var(--error))]/10", icon: "text-[hsl(var(--error))]", text: "text-foreground" },
  [ACTIVITY_REASON.LOSS]: { bg: "bg-muted/50", icon: "text-muted-foreground", text: "text-foreground" },
  [ACTIVITY_REASON.OTHER]: { bg: "bg-muted/50", icon: "text-muted-foreground", text: "text-foreground" },
};

/** True when the item has at least one activity — drives whether the section is shown. */
export function hasActivities(item: Item): boolean {
  return (item.activities || []).length > 0;
}

/** True when the item has at least one activity within the CURRENT PERIOD (this
 *  month). ActivitySection only renders current-month movements, so the page
 *  gates on the same period — otherwise an item whose only activities are older
 *  than this month would render an empty "Histórico de Atividades" card. */
export function hasActivitiesThisPeriod(item: Item): boolean {
  const currentMonthStart = startOfMonth(new Date());
  const now = new Date();
  return (item.activities || []).some((activity) => {
    const activityDate = new Date(activity.createdAt);
    return isWithinInterval(activityDate, { start: startOfDay(currentMonthStart), end: endOfDay(now) });
  });
}

/** Current-month label (e.g. "junho de 2026") used by the section title. */
export function activityMonthLabel(): string {
  return format(startOfMonth(new Date()), "MMMM 'de' yyyy", { locale: ptBR });
}

/** Body of the legacy ActivityHistoryCard (without the Card chrome) — the DetailPage section
 *  provides the plain "Histórico de Atividades" title; the current-month label lives inside the
 *  body. Returns null when there are no activities for the period so the base drops the whole
 *  card. Fills its resizable container. */
export function ActivitySection({ item, maxHeight = "100%" }: { item: Item; maxHeight?: string }) {
  const activities = item.activities || [];

  // Filter activities to show only current month activities
  const filteredActivities = useMemo(() => {
    const currentMonthStart = startOfMonth(new Date());
    const now = new Date();
    return activities.filter((activity) => {
      const activityDate = new Date(activity.createdAt);
      return isWithinInterval(activityDate, { start: startOfDay(currentMonthStart), end: endOfDay(now) });
    });
  }, [activities]);

  // Calculate statistics
  const statistics = useMemo(() => {
    const totalMovements = filteredActivities.length;
    const totalIn = filteredActivities.filter((a) => a.operation === ACTIVITY_OPERATION.INBOUND).reduce((sum, a) => sum + a.quantity, 0);
    const totalOut = filteredActivities.filter((a) => a.operation === ACTIVITY_OPERATION.OUTBOUND).reduce((sum, a) => sum + Math.abs(a.quantity), 0);
    return { totalMovements, totalIn, totalOut };
  }, [filteredActivities]);

  // Group activities by date
  const groupedActivities = useMemo(() => {
    const groups = new Map<string, Activity[]>();
    filteredActivities.forEach((activity) => {
      const date = format(new Date(activity.createdAt), "dd/MM/yyyy");
      const group = groups.get(date) || [];
      group.push(activity);
      groups.set(date, group);
    });
    return Array.from(groups.entries()).sort((a, b) => {
      const dateA = new Date(a[0].split("/").reverse().join("-"));
      const dateB = new Date(b[0].split("/").reverse().join("-"));
      return dateB.getTime() - dateA.getTime();
    });
  }, [filteredActivities]);

  // No activities for the current period → return null so the base hides the whole section.
  if (filteredActivities.length === 0) return null;

  return (
    <div className="flex h-full flex-col min-h-0">
      {/* Current-month label (moved out of the section title) */}
      <p className="text-sm text-muted-foreground mb-4 flex-shrink-0 capitalize">{activityMonthLabel()}</p>

      {/* Statistics Summary - 3 Full-width Cards */}
      {statistics.totalMovements > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-6 flex-shrink-0">
          <div className="bg-card-nested rounded-lg p-4 border border-border">
            <div className="flex flex-col justify-between h-full">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 rounded-lg bg-muted/50">
                  <IconDots className="h-4 w-4 text-muted-foreground" />
                </div>
                <span className="text-xs font-medium text-muted-foreground line-clamp-2">Total de Movimentos</span>
              </div>
              <p className="text-2xl font-bold">{statistics.totalMovements}</p>
            </div>
          </div>

          <div className="bg-primary/10 rounded-lg p-4 border border-primary/20">
            <div className="flex flex-col justify-between h-full">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 rounded-lg bg-primary/15">
                  <IconTrendingUp className="h-4 w-4 text-primary" />
                </div>
                <span className="text-xs font-medium text-primary line-clamp-2">Total de Entradas</span>
              </div>
              <p className="text-2xl font-bold text-primary">+{fmtQty(statistics.totalIn)}</p>
            </div>
          </div>

          <div className="bg-destructive/10 rounded-lg p-4 border border-destructive/20">
            <div className="flex flex-col justify-between h-full">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 rounded-lg bg-destructive/15">
                  <IconTrendingDown className="h-4 w-4 text-destructive" />
                </div>
                <span className="text-xs font-medium text-destructive line-clamp-2">Total de Saídas</span>
              </div>
              <p className="text-2xl font-bold text-destructive">-{fmtQty(statistics.totalOut)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Activities Timeline */}
      <ScrollArea className="pr-4 flex-grow min-h-0" style={{ maxHeight }}>
          <div className="space-y-6">
            {groupedActivities.map(([date, dayActivities], groupIndex) => {
              const isLastGroup = groupIndex === groupedActivities.length - 1;
              return (
                <div key={date} className="relative">
                  {/* Date Header */}
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

                  {/* Activities for this date */}
                  <div className="space-y-3 relative">
                    {!isLastGroup && <div className="absolute left-6 top-12 bottom-0 w-0.5 bg-border" />}

                    {dayActivities.map((activity, index) => {
                      const colors = ACTIVITY_TYPE_COLORS[activity.reason] || ACTIVITY_TYPE_COLORS[ACTIVITY_REASON.OTHER];
                      const isLastActivity = isLastGroup && index === dayActivities.length - 1;
                      return (
                        <div key={activity.id} className="relative">
                          {!isLastActivity && <div className="absolute left-6 top-12 bottom-0 w-0.5 bg-border" />}

                          <div className="flex items-start gap-4 group">
                            <div className="relative z-10 flex items-center justify-center w-12 h-12">
                              {activity.operation === ACTIVITY_OPERATION.INBOUND ? (
                                <IconArrowUpRight className={cn("h-5 w-5 transition-transform group-hover:scale-110", colors.icon)} />
                              ) : (
                                <IconArrowDownRight className={cn("h-5 w-5 transition-transform group-hover:scale-110", colors.icon)} />
                              )}
                            </div>

                            <div className="flex-1 bg-card-nested rounded-xl p-4 border border-border">
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-3">
                                  <Badge variant="secondary" className="font-medium">
                                    {ACTIVITY_REASON_LABELS[activity.reason]}
                                  </Badge>
                                  <Badge
                                    className={cn(
                                      "font-medium border",
                                      activity.operation === ACTIVITY_OPERATION.INBOUND
                                        ? "bg-primary hover:bg-primary/90 border-primary text-primary-foreground"
                                        : "bg-destructive hover:bg-destructive/90 border-destructive text-destructive-foreground",
                                    )}
                                  >
                                    <span className="font-enhanced-unicode sort-arrow">{activity.operation === ACTIVITY_OPERATION.INBOUND ? "↑" : "↓"}</span>{" "}
                                    {fmtQty(Math.abs(activity.quantity))}
                                  </Badge>
                                </div>
                                <div className="text-sm text-muted-foreground">{formatRelativeTime(activity.createdAt)}</div>
                              </div>

                              <div className="mt-3 pt-3 border-t border-border text-sm text-muted-foreground">
                                <span className="text-muted-foreground">Por: </span>
                                <span className="text-foreground font-medium">{activity.user?.name || "Sistema"}</span>
                              </div>
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
    </div>
  );
}
