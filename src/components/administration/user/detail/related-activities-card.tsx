import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { IconClock, IconArrowUpRight, IconArrowDownRight, IconCalendar, IconDots, IconTrendingUp, IconTrendingDown } from "@tabler/icons-react";
import type { User, Activity } from "../../../../types";
import { ACTIVITY_REASON, ACTIVITY_REASON_LABELS, ACTIVITY_OPERATION } from "../../../../constants";
import { formatRelativeTime } from "../../../../utils";
import { format, startOfMonth, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface RelatedActivitiesCardProps {
  user: User;
  className?: string;
  maxHeight?: string;
}

const ACTIVITY_TYPE_COLORS: Record<string, { bg: string; icon: string; text: string }> = {
  [ACTIVITY_REASON.ORDER_RECEIVED]: { bg: "bg-muted/50", icon: "text-muted-foreground", text: "text-foreground" },
  [ACTIVITY_REASON.PRODUCTION_USAGE]: { bg: "bg-primary/10", icon: "text-primary", text: "text-foreground" },
  [ACTIVITY_REASON.PPE_DELIVERY]: { bg: "bg-[hsl(var(--success))]/10", icon: "text-[hsl(var(--success))]", text: "text-foreground" },
  [ACTIVITY_REASON.BORROW]: { bg: "bg-[hsl(var(--warning))]/10", icon: "text-[hsl(var(--warning))]", text: "text-foreground" },
  [ACTIVITY_REASON.RETURN]: { bg: "bg-[hsl(var(--info))]/10", icon: "text-[hsl(var(--info))]", text: "text-foreground" },
  [ACTIVITY_REASON.EXTERNAL_WITHDRAWAL]: { bg: "bg-[hsl(var(--error))]/10", icon: "text-[hsl(var(--error))]", text: "text-foreground" },
  [ACTIVITY_REASON.EXTERNAL_WITHDRAWAL_RETURN]: { bg: "bg-[hsl(var(--info))]/10", icon: "text-[hsl(var(--info))]", text: "text-foreground" },
  [ACTIVITY_REASON.INVENTORY_COUNT]: { bg: "bg-muted/50", icon: "text-muted-foreground", text: "text-foreground" },
  [ACTIVITY_REASON.MANUAL_ADJUSTMENT]: { bg: "bg-[hsl(var(--warning))]/10", icon: "text-[hsl(var(--warning))]", text: "text-foreground" },
  [ACTIVITY_REASON.MAINTENANCE]: { bg: "bg-primary/10", icon: "text-primary", text: "text-foreground" },
  [ACTIVITY_REASON.DAMAGE]: { bg: "bg-[hsl(var(--error))]/10", icon: "text-[hsl(var(--error))]", text: "text-foreground" },
  [ACTIVITY_REASON.LOSS]: { bg: "bg-muted/50", icon: "text-muted-foreground", text: "text-foreground" },
  [ACTIVITY_REASON.OTHER]: { bg: "bg-muted/50", icon: "text-muted-foreground", text: "text-foreground" },
};

export function RelatedActivitiesCard({ user, className, maxHeight = "500px" }: RelatedActivitiesCardProps) {
  const activities = user.activities || [];

  // Sort activities by date (newest first) and filter to current month
  const filteredActivities = useMemo(() => {
    const currentMonthStart = startOfMonth(new Date());
    const now = new Date();

    const sortedActivities = [...activities].sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return sortedActivities.filter((activity) => {
      const activityDate = new Date(activity.createdAt);
      return isWithinInterval(activityDate, {
        start: startOfDay(currentMonthStart),
        end: endOfDay(now),
      });
    });
  }, [activities]);

  // Calculate statistics
  const statistics = useMemo(() => {
    const totalMovements = filteredActivities.length;
    const totalIn = filteredActivities.filter((a) => a.operation === ACTIVITY_OPERATION.INBOUND).reduce((sum, a) => sum + a.quantity, 0);
    const totalOut = filteredActivities.filter((a) => a.operation === ACTIVITY_OPERATION.OUTBOUND).reduce((sum, a) => sum + Math.abs(a.quantity), 0);

    return {
      totalMovements,
      totalIn,
      totalOut,
    };
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

  if (activities.length === 0) {
    return null;
  }

  return (
    <Card className={cn("shadow-sm border border-border flex flex-col", className)} level={1}>
      <CardHeader className="pb-4 flex-shrink-0">
        <CardTitle className="flex items-center gap-2">
          <IconClock className="h-5 w-5 text-muted-foreground" />
          Histórico de Atividades - {format(startOfMonth(new Date()), "MMMM 'de' yyyy", { locale: ptBR })}
        </CardTitle>
      </CardHeader>

      <CardContent className="pt-0 flex-grow flex flex-col min-h-0">
        {statistics.totalMovements > 0 && (
          <div className="grid grid-cols-3 gap-3 mb-6">
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

            <div className="bg-green-50/80 dark:bg-green-900/20 rounded-lg p-4 border border-green-200/40 dark:border-green-700/40">
              <div className="flex flex-col justify-between h-full">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 rounded-lg bg-green-200/50 dark:bg-green-800/50">
                    <IconTrendingUp className="h-4 w-4 text-green-700 dark:text-green-300" />
                  </div>
                  <span className="text-xs font-medium text-green-800 dark:text-green-200 line-clamp-2">Total de Entradas</span>
                </div>
                <p className="text-2xl font-bold text-green-800 dark:text-green-200">+{statistics.totalIn}</p>
              </div>
            </div>

            <div className="bg-red-50/80 dark:bg-red-900/20 rounded-lg p-4 border border-red-200/40 dark:border-red-700/40">
              <div className="flex flex-col justify-between h-full">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 rounded-lg bg-red-200/50 dark:bg-red-800/50">
                    <IconTrendingDown className="h-4 w-4 text-red-700 dark:text-red-300" />
                  </div>
                  <span className="text-xs font-medium text-red-800 dark:text-red-200 line-clamp-2">Total de Saídas</span>
                </div>
                <p className="text-2xl font-bold text-red-800 dark:text-red-200">-{statistics.totalOut}</p>
              </div>
            </div>
          </div>
        )}

        {filteredActivities.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Nenhuma atividade encontrada neste mês.</p>
          </div>
        ) : (
          <ScrollArea className="pr-4 flex-grow" style={{ maxHeight }}>
            <div className="space-y-6">
              {groupedActivities.map(([date, dayActivities], groupIndex) => {
                const isLastGroup = groupIndex === groupedActivities.length - 1;

                return (
                  <div key={date} className="relative">
                    {/* Date Header */}
                    <div className="pb-1 mb-4 rounded-md">
                      <div className="flex justify-center items-center gap-4">
                        <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/60 border border-border/50">
                          <IconCalendar className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm font-medium text-muted-foreground">{date}</span>
                        </div>
                        <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent via-border to-transparent" />
                      </div>
                    </div>

                    {/* Activities for this date */}
                    <div className="space-y-3 relative">
                      {/* Timeline line */}
                      {!isLastGroup && <div className="absolute left-6 top-12 bottom-0 w-0.5 bg-border" />}

                      {dayActivities.map((activity, index) => {
                        const colors = ACTIVITY_TYPE_COLORS[activity.reason] || ACTIVITY_TYPE_COLORS[ACTIVITY_REASON.OTHER];
                        const isLastActivity = isLastGroup && index === dayActivities.length - 1;

                        return (
                          <div key={activity.id} className="relative">
                            {/* Timeline line connector */}
                            {!isLastActivity && <div className="absolute left-6 top-12 bottom-0 w-0.5 bg-border" />}

                            <div className="flex items-start gap-4 group">
                              {/* Timeline dot and icon */}
                              <div className="relative z-10 flex items-center justify-center w-12 h-12">
                                {activity.operation === ACTIVITY_OPERATION.INBOUND ? (
                                  <IconArrowUpRight className={cn("h-5 w-5 transition-transform group-hover:scale-110", colors.icon)} />
                                ) : (
                                  <IconArrowDownRight className={cn("h-5 w-5 transition-transform group-hover:scale-110", colors.icon)} />
                                )}
                              </div>

                              {/* Activity card */}
                              <div className="flex-1 bg-card-nested rounded-xl p-4 border border-border">
                                {/* Header */}
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center gap-3">
                                    <Badge variant="secondary" className="font-medium">
                                      {ACTIVITY_REASON_LABELS[activity.reason]}
                                    </Badge>
                                    <Badge
                                      className={cn(
                                        "font-medium border text-white",
                                        activity.operation === ACTIVITY_OPERATION.INBOUND
                                          ? "bg-green-700 hover:bg-green-800 border-green-700"
                                          : "bg-red-700 hover:bg-red-800 border-red-700",
                                      )}
                                    >
                                      <span className="font-enhanced-unicode sort-arrow">{activity.operation === ACTIVITY_OPERATION.INBOUND ? "↑" : "↓"}</span>{" "}
                                      {Math.abs(activity.quantity)}
                                    </Badge>
                                  </div>
                                  <div className="text-sm text-muted-foreground">{formatRelativeTime(activity.createdAt)}</div>
                                </div>

                                {/* Item info */}
                                {activity.item && (
                                  <div className="mb-3">
                                    <span className="text-sm text-foreground font-medium">{activity.item.name}</span>
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
