import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { IconHistory, IconArrowUpRight, IconArrowDownRight, IconEdit, IconX, IconCalendar, IconClock, IconAlertCircle } from "@tabler/icons-react";
import type { Borrow, ChangeLog } from "../../../../types";
import { BORROW_STATUS, CHANGE_LOG_ACTION, CHANGE_LOG_ENTITY_TYPE, CHANGE_TRIGGERED_BY } from "../../../../constants";
import { formatDateTime, formatRelativeTime, getFieldLabel, formatFieldValue, getActionLabel } from "../../../../utils";
import { useChangeLogs } from "../../../../hooks";
import { cn } from "@/lib/utils";

interface BorrowHistoryCardProps {
  borrow: Borrow & {
    item?: { name: string };
    user?: { name: string };
  };
  className?: string;
  maxHeight?: string;
}

// Map actions to icons and colors
const actionConfig: Record<CHANGE_LOG_ACTION, { icon: React.ElementType; color: string }> = {
  [CHANGE_LOG_ACTION.CREATE]: { icon: IconArrowDownRight, color: "text-orange-600" },
  [CHANGE_LOG_ACTION.UPDATE]: { icon: IconEdit, color: "text-neutral-600" },
  [CHANGE_LOG_ACTION.DELETE]: { icon: IconX, color: "text-red-600" },
  [CHANGE_LOG_ACTION.RESTORE]: { icon: IconArrowUpRight, color: "text-green-600" },
  [CHANGE_LOG_ACTION.ROLLBACK]: { icon: IconAlertCircle, color: "text-yellow-600" },
  [CHANGE_LOG_ACTION.ARCHIVE]: { icon: IconX, color: "text-gray-600" },
  [CHANGE_LOG_ACTION.UNARCHIVE]: { icon: IconArrowUpRight, color: "text-gray-600" },
  [CHANGE_LOG_ACTION.ACTIVATE]: { icon: IconArrowUpRight, color: "text-green-600" },
  [CHANGE_LOG_ACTION.DEACTIVATE]: { icon: IconX, color: "text-orange-600" },
  [CHANGE_LOG_ACTION.APPROVE]: { icon: IconArrowUpRight, color: "text-green-600" },
  [CHANGE_LOG_ACTION.REJECT]: { icon: IconX, color: "text-red-600" },
  [CHANGE_LOG_ACTION.CANCEL]: { icon: IconX, color: "text-red-600" },
  [CHANGE_LOG_ACTION.COMPLETE]: { icon: IconArrowUpRight, color: "text-green-600" },
  [CHANGE_LOG_ACTION.BATCH_CREATE]: { icon: IconArrowDownRight, color: "text-orange-600" },
  [CHANGE_LOG_ACTION.BATCH_UPDATE]: { icon: IconEdit, color: "text-neutral-600" },
  [CHANGE_LOG_ACTION.BATCH_DELETE]: { icon: IconX, color: "text-red-600" },
  [CHANGE_LOG_ACTION.VIEW]: { icon: IconHistory, color: "text-gray-600" },
};

// Loading skeleton
const BorrowHistorySkeleton = () => (
  <div className="space-y-6">
    {Array.from({ length: 3 }, (_, i) => (
      <div key={i} className="relative">
        {/* Date header skeleton */}
        <div className="flex justify-center items-center gap-4 mb-4">
          <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
          <Skeleton className="h-8 w-32 rounded-lg" />
          <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent via-border to-transparent" />
        </div>

        {/* Timeline items */}
        <div className="space-y-3 relative">
          {i < 2 && <div className="absolute left-6 top-12 bottom-0 w-0.5 bg-border" />}

          {Array.from({ length: 2 }, (_, j) => (
            <div key={j} className="relative">
              {(i < 2 || j < 1) && <div className="absolute left-6 top-12 bottom-0 w-0.5 bg-border" />}

              <div className="flex gap-4">
                <div className="flex items-center justify-center w-12 h-12">
                  <Skeleton className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <Skeleton className="h-20 w-full rounded-xl" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    ))}
  </div>
);

// Empty state
const EmptyState = () => (
  <div className="text-center py-12">
    <IconHistory className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
    <p className="text-muted-foreground mb-2">Nenhuma alteração registrada</p>
    <p className="text-sm text-muted-foreground">As alterações realizadas neste empréstimo aparecerão aqui</p>
  </div>
);

// Format timeline event based on action and field
const formatTimelineEvent = (changelog: ChangeLog, borrow: Borrow) => {
  // Handle special cases for borrow-specific fields
  if (changelog.action === CHANGE_LOG_ACTION.CREATE) {
    return {
      title: "Empréstimo criado",
      description: `${borrow.quantity} unidade(s) emprestada(s)`,
      icon: IconArrowDownRight,
      color: "text-orange-600",
    };
  }

  if (changelog.field === "returnedAt" && changelog.newValue) {
    return {
      title: "Item devolvido",
      description: `${borrow.quantity} unidade(s) devolvida(s)`,
      icon: IconArrowUpRight,
      color: "text-green-600",
    };
  }

  if (changelog.field === "status" && changelog.newValue === BORROW_STATUS.LOST) {
    return {
      title: "Item marcado como perdido",
      description: `${borrow.quantity} unidade(s) marcada(s) como perdida(s)`,
      icon: IconAlertCircle,
      color: "text-red-600",
    };
  }

  if (changelog.field === "quantity") {
    const oldQty = changelog.oldValue as number;
    const newQty = changelog.newValue as number;
    if (newQty > oldQty) {
      return {
        title: "Quantidade aumentada",
        description: `De ${oldQty} para ${newQty} unidade(s)`,
        icon: IconArrowUpRight,
        color: "text-orange-600",
      };
    } else {
      return {
        title: "Quantidade reduzida",
        description: `De ${oldQty} para ${newQty} unidade(s)`,
        icon: IconArrowDownRight,
        color: "text-green-600",
      };
    }
  }

  // Default action label
  const config = actionConfig[changelog.action];
  return {
    title: getActionLabel(changelog.action, changelog.triggeredBy || undefined),
    description: changelog.field ? getFieldLabel(changelog.field, CHANGE_LOG_ENTITY_TYPE.BORROW) : null,
    icon: config.icon,
    color: config.color,
  };
};

// Timeline item component
const BorrowTimelineItem = ({ changelog, borrow, isLast }: { changelog: ChangeLog; borrow: Borrow; isLast: boolean }) => {
  const event = formatTimelineEvent(changelog, borrow);
  const Icon = event.icon;

  return (
    <div className="relative">
      {/* Timeline line connector */}
      {!isLast && <div className="absolute left-6 top-12 bottom-0 w-0.5 bg-border" />}

      <div className="flex items-start gap-4 group">
        {/* Timeline dot and icon */}
        <div className="relative z-10 flex items-center justify-center w-12 h-12">
          <Icon className={cn("h-5 w-5 transition-transform group-hover:scale-110", event.color)} />
        </div>

        {/* Event card */}
        <div className="flex-1 bg-card-nested rounded-xl p-4 border border-border">
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <div className="text-lg font-semibold">{event.title}</div>
            <div className="text-sm text-muted-foreground">{formatRelativeTime(changelog.createdAt)}</div>
          </div>

          {/* Description */}
          {event.description && <div className="text-sm text-muted-foreground mb-3">{event.description}</div>}

          {/* Field changes */}
          {changelog.field && changelog.oldValue !== undefined && changelog.newValue !== undefined && (
            <div className="space-y-1 mb-3">
              <div className="text-sm">
                <span className="text-muted-foreground">Antes: </span>
                <span className="text-red-600 dark:text-red-400 font-medium">{formatFieldValue(changelog.oldValue, changelog.field, CHANGE_LOG_ENTITY_TYPE.BORROW)}</span>
              </div>
              <div className="text-sm">
                <span className="text-muted-foreground">Agora: </span>
                <span className="text-green-600 dark:text-green-400 font-medium">{formatFieldValue(changelog.newValue, changelog.field, CHANGE_LOG_ENTITY_TYPE.BORROW)}</span>
              </div>
            </div>
          )}

          {/* Footer - Show borrower info for create */}
          {changelog.action === CHANGE_LOG_ACTION.CREATE && (borrow.user || borrow.item) && (
            <div className="pt-3 border-t text-sm space-y-1">
              {borrow.user && (
                <div>
                  <span className="text-muted-foreground">Emprestado para: </span>
                  <span className="text-foreground font-medium">{borrow.user.name}</span>
                </div>
              )}
              {borrow.item && (
                <div>
                  <span className="text-muted-foreground">Item: </span>
                  <span className="text-foreground font-medium">{borrow.item.name}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export function BorrowHistoryCard({ borrow, className, maxHeight = "500px" }: BorrowHistoryCardProps) {
  // Fetch changelogs for this borrow
  const {
    data: changelogsResponse,
    isLoading,
    error,
  } = useChangeLogs({
    where: {
      entityType: CHANGE_LOG_ENTITY_TYPE.BORROW,
      entityId: borrow.id,
    },
    include: {
      user: true,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 50,
  });

  const changelogs = useMemo(() => {
    const logs = changelogsResponse?.data || [];

    // Add creation entry if not already present
    if (!isLoading && borrow.createdAt) {
      // Check if there's already a CREATE action in the logs
      const hasCreateAction = logs.some((log) => log.action === CHANGE_LOG_ACTION.CREATE);

      if (!hasCreateAction) {
        const creationEntry: ChangeLog = {
          id: `${borrow.id}-creation`,
          entityId: borrow.id,
          entityType: CHANGE_LOG_ENTITY_TYPE.BORROW,
          action: CHANGE_LOG_ACTION.CREATE,
          field: null,
          oldValue: null,
          newValue: null,
          reason: null,
          metadata: null,
          triggeredBy: CHANGE_TRIGGERED_BY.USER,
          triggeredById: null,
          userId: null, // We don't know who created it from the borrow record
          user: undefined, // This will show "Sistema" in the UI
          createdAt: new Date(borrow.createdAt),
          updatedAt: new Date(borrow.createdAt),
        };

        // Add creation entry at the end (oldest)
        return [...logs, creationEntry];
      }
    }

    return logs;
  }, [changelogsResponse?.data, borrow, isLoading]);

  // Group changelogs by date
  const groupedChangelogs = useMemo(() => {
    const dateGroups = new Map<string, ChangeLog[]>();

    changelogs.forEach((changelog) => {
      const date = formatDateTime(changelog.createdAt).split(" às ")[0]; // Get only date part
      const group = dateGroups.get(date) || [];
      group.push(changelog);
      dateGroups.set(date, group);
    });

    return Array.from(dateGroups.entries()).sort((a, b) => {
      const dateA = new Date(a[1][0].createdAt);
      const dateB = new Date(b[1][0].createdAt);
      return dateB.getTime() - dateA.getTime();
    });
  }, [changelogs]);

  // Calculate statistics
  const statistics = useMemo(() => {
    const totalEvents = changelogs.length;
    const isReturned = borrow.status === BORROW_STATUS.RETURNED;
    const isLost = borrow.status === BORROW_STATUS.LOST;
    const borrowDuration = borrow.returnedAt
      ? Math.ceil((new Date(borrow.returnedAt).getTime() - new Date(borrow.createdAt).getTime()) / (1000 * 60 * 60 * 24))
      : Math.ceil((new Date().getTime() - new Date(borrow.createdAt).getTime()) / (1000 * 60 * 60 * 24));

    return {
      totalEvents,
      isReturned,
      isLost,
      borrowDuration,
    };
  }, [changelogs, borrow]);

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center">
            <IconAlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <p className="text-destructive">Erro ao carregar histórico do empréstimo</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("shadow-sm border border-border flex flex-col", className)} level={1}>
      <CardHeader className="pb-4 flex-shrink-0">
        <CardTitle className="flex items-center gap-3 text-xl">
          <div className="p-2 rounded-lg bg-primary/10">
            <IconHistory className="h-5 w-5 text-primary" />
          </div>
          Histórico do Empréstimo
        </CardTitle>

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-3 mt-4">
          <div className="bg-card-nested rounded-lg p-4 border border-border">
            <div className="flex flex-col justify-between h-full">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 rounded-lg bg-muted/50">
                  <IconHistory className="h-4 w-4 text-muted-foreground" />
                </div>
                <span className="text-xs font-medium text-muted-foreground line-clamp-2">Total de Eventos</span>
              </div>
              <p className="text-2xl font-bold">{statistics.totalEvents}</p>
            </div>
          </div>

          <div
            className={cn(
              "rounded-lg p-4 border",
              statistics.isReturned
                ? "bg-green-50/80 dark:bg-green-900/20 border-green-200/40 dark:border-green-700/40"
                : statistics.isLost
                  ? "bg-red-50/80 dark:bg-red-900/20 border-red-200/40 dark:border-red-700/40"
                  : "bg-orange-50/80 dark:bg-orange-900/20 border-orange-200/40 dark:border-orange-700/40",
            )}
          >
            <div className="flex flex-col justify-between h-full">
              <div className="flex items-center gap-2 mb-2">
                <div
                  className={cn(
                    "p-2 rounded-lg",
                    statistics.isReturned
                      ? "bg-green-200/50 dark:bg-green-800/50"
                      : statistics.isLost
                        ? "bg-red-200/50 dark:bg-red-800/50"
                        : "bg-orange-200/50 dark:bg-orange-800/50",
                  )}
                >
                  {statistics.isReturned ? (
                    <IconArrowUpRight className="h-4 w-4 text-green-700 dark:text-green-300" />
                  ) : statistics.isLost ? (
                    <IconAlertCircle className="h-4 w-4 text-red-700 dark:text-red-300" />
                  ) : (
                    <IconArrowDownRight className="h-4 w-4 text-orange-700 dark:text-orange-300" />
                  )}
                </div>
                <span
                  className={cn(
                    "text-xs font-medium line-clamp-2",
                    statistics.isReturned ? "text-green-800 dark:text-green-200" : statistics.isLost ? "text-red-800 dark:text-red-200" : "text-orange-800 dark:text-orange-200",
                  )}
                >
                  Status
                </span>
              </div>
              <p
                className={cn(
                  "text-lg font-bold",
                  statistics.isReturned ? "text-green-800 dark:text-green-200" : statistics.isLost ? "text-red-800 dark:text-red-200" : "text-orange-800 dark:text-orange-200",
                )}
              >
                {statistics.isReturned ? "Devolvido" : statistics.isLost ? "Perdido" : "Em Aberto"}
              </p>
            </div>
          </div>

          <div className="bg-card-nested rounded-lg p-4 border border-border">
            <div className="flex flex-col justify-between h-full">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 rounded-lg bg-muted/50">
                  <IconClock className="h-4 w-4 text-muted-foreground" />
                </div>
                <span className="text-xs font-medium text-muted-foreground line-clamp-2">Duração</span>
              </div>
              <p className="text-2xl font-bold">
                {statistics.borrowDuration} {statistics.borrowDuration === 1 ? "dia" : "dias"}
              </p>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0 flex-grow flex flex-col min-h-0">
        {isLoading ? (
          <BorrowHistorySkeleton />
        ) : changelogs.length === 0 ? (
          <EmptyState />
        ) : (
          <ScrollArea className="pr-4 flex-grow" style={{ maxHeight }}>
            <div className="space-y-6">
              {groupedChangelogs.map(([date, dayChangelogs], groupIndex) => {
                const isLastGroup = groupIndex === groupedChangelogs.length - 1;

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

                    {/* Events for this date */}
                    <div className="space-y-3 relative">
                      {/* Timeline line */}
                      {!isLastGroup && <div className="absolute left-6 top-12 bottom-0 w-0.5 bg-border" />}

                      {dayChangelogs.map((changelog, index) => {
                        const isLastEvent = isLastGroup && index === dayChangelogs.length - 1;

                        return <BorrowTimelineItem key={changelog.id} changelog={changelog} borrow={borrow} isLast={isLastEvent} />;
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
