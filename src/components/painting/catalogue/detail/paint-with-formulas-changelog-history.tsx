import { useMemo } from "react";
import type { Paint, ChangeLog } from "../../../../types";
import { CHANGE_LOG_ACTION, CHANGE_TRIGGERED_BY } from "../../../../constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IconHistory, IconFlask, IconPaint, IconEdit, IconPlus, IconTrash, IconRefresh, IconArchive, IconArchiveOff, IconToggleLeft, IconToggleRight, IconCheck, IconX, IconClock, IconCalendar, IconArrowBackUpDouble } from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useChangeLogs } from "../../../../hooks";
import { formatRelativeTime, getFieldLabel, formatFieldValue, getActionLabel } from "../../../../utils";
import { cn } from "@/lib/utils";

interface PaintWithFormulasChangelogHistoryProps {
  paint: Paint;
  className?: string;
}

// Map actions to icons and colors (matching ChangelogHistory exactly)
const actionConfig: Record<CHANGE_LOG_ACTION, { icon: React.ElementType; color: string }> = {
  [CHANGE_LOG_ACTION.CREATE]: { icon: IconPlus, color: "text-green-600" },
  [CHANGE_LOG_ACTION.UPDATE]: { icon: IconEdit, color: "text-neutral-600" },
  [CHANGE_LOG_ACTION.DELETE]: { icon: IconTrash, color: "text-red-600" },
  [CHANGE_LOG_ACTION.RESTORE]: { icon: IconRefresh, color: "text-purple-600" },
  [CHANGE_LOG_ACTION.ROLLBACK]: { icon: IconArrowBackUpDouble, color: "text-blue-600" },
  [CHANGE_LOG_ACTION.ARCHIVE]: { icon: IconArchive, color: "text-gray-600" },
  [CHANGE_LOG_ACTION.UNARCHIVE]: { icon: IconArchiveOff, color: "text-gray-600" },
  [CHANGE_LOG_ACTION.ACTIVATE]: { icon: IconToggleRight, color: "text-green-600" },
  [CHANGE_LOG_ACTION.DEACTIVATE]: { icon: IconToggleLeft, color: "text-orange-600" },
  [CHANGE_LOG_ACTION.APPROVE]: { icon: IconCheck, color: "text-green-600" },
  [CHANGE_LOG_ACTION.REJECT]: { icon: IconX, color: "text-red-600" },
  [CHANGE_LOG_ACTION.CANCEL]: { icon: IconX, color: "text-red-600" },
  [CHANGE_LOG_ACTION.COMPLETE]: { icon: IconCheck, color: "text-green-600" },
  [CHANGE_LOG_ACTION.RESCHEDULE]: { icon: IconCalendar, color: "text-blue-600" },
  [CHANGE_LOG_ACTION.BATCH_CREATE]: { icon: IconPlus, color: "text-green-600" },
  [CHANGE_LOG_ACTION.BATCH_UPDATE]: { icon: IconEdit, color: "text-neutral-600" },
  [CHANGE_LOG_ACTION.BATCH_DELETE]: { icon: IconTrash, color: "text-red-600" },
  [CHANGE_LOG_ACTION.VIEW]: { icon: IconHistory, color: "text-gray-600" },
};

// Group changelog fields by entity and time (within 1 second)
const groupChangelogsByEntity = (changelogs: ChangeLog[]) => {
  const groups: ChangeLog[][] = [];
  let currentGroup: ChangeLog[] = [];
  let currentTime: number | null = null;

  changelogs.forEach((changelog) => {
    const time = new Date(changelog.createdAt).getTime();

    // Group changes that happened within 1 second of each other
    if (!currentTime || Math.abs(time - currentTime) < 1000) {
      currentGroup.push(changelog);
      currentTime = time;
    } else {
      if (currentGroup.length > 0) {
        groups.push(currentGroup);
      }
      currentGroup = [changelog];
      currentTime = time;
    }
  });

  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  return groups;
};

export function PaintWithFormulasChangelogHistory({ paint, className }: PaintWithFormulasChangelogHistoryProps) {
  const formulaCount = paint.formulas?.length || 0;

  // Build array of all entity IDs to query
  const entityIdsToQuery = useMemo(() => {
    const ids: string[] = [paint.id];
    if (paint.formulas) {
      ids.push(...paint.formulas.map(f => f.id));
    }
    return ids;
  }, [paint.id, paint.formulas]);

  // Fetch changelogs for paint and all formulas in one query using OR
  const {
    data: changelogsResponse,
    isLoading,
    error,
  } = useChangeLogs({
    where: {
      OR: entityIdsToQuery.map(id => ({
        entityId: id,
      })),
    },
    include: {
      user: true,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 100,
  });

  // Enrich changelogs with entity metadata
  const enrichedChangelogs = useMemo(() => {
    if (!changelogsResponse?.data) return [];

    return changelogsResponse.data.map(log => {
      // Check if this is a paint or formula changelog
      const isPaintLog = log.entityId === paint.id;

      if (isPaintLog) {
        return {
          ...log,
          _entityLabel: "Tinta",
          _entityName: paint.name,
        };
      } else {
        // Find which formula this belongs to
        const formulaIndex = paint.formulas?.findIndex(f => f.id === log.entityId) ?? -1;
        const formula = paint.formulas?.[formulaIndex];

        return {
          ...log,
          _entityLabel: `Fórmula ${formulaIndex + 1}`,
          _entityName: formula?.description || `Fórmula ${formulaIndex + 1}`,
        };
      }
    });
  }, [changelogsResponse?.data, paint.id, paint.name, paint.formulas]);

  // Group changelogs by entity and time
  const groupedChangelogs = useMemo(() => {
    const changelogGroups = groupChangelogsByEntity(enrichedChangelogs);

    // Group by date
    const dateGroups = new Map<string, typeof changelogGroups>();

    changelogGroups.forEach((group) => {
      const date = new Date(group[0].createdAt).toLocaleDateString("pt-BR");
      const existingGroups = dateGroups.get(date) || [];
      existingGroups.push(group);
      dateGroups.set(date, existingGroups);
    });

    return Array.from(dateGroups.entries()).sort((a, b) => {
      const dateA = new Date(a[0].split("/").reverse().join("-"));
      const dateB = new Date(b[0].split("/").reverse().join("-"));
      return dateB.getTime() - dateA.getTime();
    });
  }, [enrichedChangelogs]);

  // Calculate summary statistics
  const changeStats = useMemo(() => {
    const totalChanges = enrichedChangelogs.length;
    const recentChanges = enrichedChangelogs.filter((c) => new Date(c.createdAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).length;
    const uniqueUsers = new Set(enrichedChangelogs.map((c) => c.userId).filter(Boolean)).size;

    return {
      totalChanges,
      recentChanges,
      uniqueUsers,
    };
  }, [enrichedChangelogs]);

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center">
            <IconHistory className="h-12 w-12 text-destructive mx-auto mb-4" />
            <p className="text-destructive">Erro ao carregar histórico de alterações</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Don't show the card if there are no changelogs
  if (!isLoading && enrichedChangelogs.length === 0) {
    return null;
  }

  return (
    <Card className={cn("shadow-sm border border-border flex flex-col", className)} style={{ maxHeight: className?.includes("h-") ? undefined : "600px" }}>
      <CardHeader className="pb-4 flex-shrink-0">
        <CardTitle className="flex items-center gap-2">
          <IconHistory className="h-5 w-5 text-muted-foreground" />
          Histórico de Alterações
          <span className="text-base font-normal text-muted-foreground">- {paint.name}</span>
        </CardTitle>

        {/* Summary stats */}
        {changeStats.totalChanges > 0 && (
          <div className="grid grid-cols-3 gap-3 mt-4">
            <div className="bg-card-nested rounded-lg p-4 border border-border">
              <div className="flex flex-col justify-between h-full">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 rounded-lg bg-muted/50">
                    <IconEdit className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <span className="text-xs font-medium text-muted-foreground line-clamp-2">Total de Alterações</span>
                </div>
                <p className="text-2xl font-bold">{changeStats.totalChanges}</p>
              </div>
            </div>

            <div className="bg-card-nested rounded-lg p-4 border border-border">
              <div className="flex flex-col justify-between h-full">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 rounded-lg bg-muted/50">
                    <IconClock className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <span className="text-xs font-medium text-muted-foreground line-clamp-2">Últimos 7 Dias</span>
                </div>
                <p className="text-2xl font-bold">{changeStats.recentChanges}</p>
              </div>
            </div>

            <div className="bg-card-nested rounded-lg p-4 border border-border">
              <div className="flex flex-col justify-between h-full">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 rounded-lg bg-muted/50">
                    <Badge variant="outline" className="flex items-center gap-1 text-[10px] px-1.5 py-0">
                      <IconPaint className="h-2.5 w-2.5" />
                      <IconFlask className="h-2.5 w-2.5" />
                    </Badge>
                  </div>
                  <span className="text-xs font-medium text-muted-foreground line-clamp-2">Tinta + Fórmulas</span>
                </div>
                <p className="text-2xl font-bold">1 + {formulaCount}</p>
              </div>
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent className="pt-0 flex-grow flex flex-col min-h-0 overflow-hidden">
        {isLoading ? (
          <ChangelogSkeleton />
        ) : enrichedChangelogs.length === 0 ? (
          <div className="text-center py-12">
            <IconHistory className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-2">Nenhuma alteração registrada</p>
            <p className="text-sm text-muted-foreground">As alterações realizadas aparecerão aqui</p>
          </div>
        ) : (
          <ScrollArea className="pr-4 flex-1">
            <div className="space-y-6">
              {groupedChangelogs.map(([date, dayChangelogGroups], groupIndex) => {
                const isLastGroup = groupIndex === groupedChangelogs.length - 1;

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

                    {/* Changes for this date */}
                    <div className="space-y-3 relative">
                      {/* Timeline line */}
                      {!isLastGroup && <div className="absolute left-6 top-12 bottom-0 w-0.5 bg-border" />}

                      {dayChangelogGroups.map((changelogGroup, index) => {
                        const isLastChange = isLastGroup && index === dayChangelogGroups.length - 1;

                        return (
                          <div key={changelogGroup[0].id} className="relative">
                            {/* Timeline line connector */}
                            {!isLastChange && <div className="absolute left-6 top-12 bottom-0 w-0.5 bg-border" />}

                            <ChangelogTimelineItem
                              changelogGroup={changelogGroup}
                              isLast={isLastChange}
                            />
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

// Timeline item component (matching ChangelogHistory exactly)
const ChangelogTimelineItem = ({
  changelogGroup,
  isLast: _isLast,
}: {
  changelogGroup: Array<ChangeLog & { _entityLabel?: string; _entityName?: string }>;
  isLast: boolean;
}) => {
  const firstChange = changelogGroup[0];
  const config = actionConfig[firstChange.action] || {
    icon: IconEdit,
    color: "text-gray-500",
  };

  const Icon = config.icon;

  // Determine the action label
  const actionLabel = getActionLabel(firstChange.action as any, firstChange.triggeredBy || CHANGE_TRIGGERED_BY.USER);

  // Check if this is a CREATE action
  if (firstChange.action === CHANGE_LOG_ACTION.CREATE) {
    return (
      <div className="relative">
        <div className="flex items-start gap-4 group">
          {/* Timeline dot and icon */}
          <div className="relative z-10 flex items-center justify-center w-12 h-12">
            <Icon className={cn("h-5 w-5 transition-transform group-hover:scale-110", config.color)} />
          </div>

          {/* Change card */}
          <div className="flex-1 bg-card-nested rounded-xl p-4 border border-border">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="secondary" className="text-xs">
                {firstChange._entityLabel}
              </Badge>
              <span className="text-lg font-semibold">{actionLabel}</span>
            </div>
            <div className="text-sm text-muted-foreground">
              <span className="text-muted-foreground">Por: </span>
              <span className="text-foreground font-medium">{firstChange.user?.name || "Sistema"}</span>
              <span className="ml-3 text-muted-foreground">{formatRelativeTime(firstChange.createdAt)}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="flex items-start gap-4 group">
        {/* Timeline dot and icon */}
        <div className="relative z-10 flex items-center justify-center w-12 h-12">
          <Icon className={cn("h-5 w-5 transition-transform group-hover:scale-110", config.color)} />
        </div>

        {/* Change card */}
        <div className="flex-1 bg-card-nested rounded-xl p-4 border border-border">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                {firstChange._entityLabel}
              </Badge>
              <div className="text-lg font-semibold">
                {firstChange.field === "status" ? "Status" : actionLabel}
              </div>
            </div>
            <div className="text-sm text-muted-foreground">{formatRelativeTime(firstChange.createdAt)}</div>
          </div>

          {/* Field changes */}
          <div className="space-y-3">
            {changelogGroup.map((changelog, index) => {
              if (!changelog.field) {
                return null;
              }

              const showSeparator = index > 0 && index < changelogGroup.length;

              return (
                <div key={changelog.id}>
                  {showSeparator && <Separator className="my-3" />}

                  {/* Field name */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm text-muted-foreground">
                      {changelog.field === "status" ? (
                        <span className="text-foreground font-medium">Status</span>
                      ) : (
                        <>
                          <span className="text-muted-foreground">Campo: </span>
                          <span className="text-foreground font-medium">{getFieldLabel(changelog.field, changelog.entityType)}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Values */}
                  <div className="space-y-1">
                    {changelog.oldValue !== undefined || changelog.newValue !== undefined ? (
                      <>
                        <div className="text-sm">
                          <span className="text-muted-foreground">Antes: </span>
                          <span className="text-red-600 dark:text-red-400 font-medium">
                            {formatFieldValue(changelog.oldValue, changelog.field, changelog.entityType, changelog.metadata)}
                          </span>
                        </div>
                        <div className="text-sm">
                          <span className="text-muted-foreground">Depois: </span>
                          <span className="text-green-600 dark:text-green-400 font-medium">
                            {formatFieldValue(changelog.newValue, changelog.field, changelog.entityType, changelog.metadata)}
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="text-sm text-muted-foreground">Sem alteração de valor registrada</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Reason */}
          {firstChange.reason && (
            <div className="mt-3 pt-3 border-t">
              <div className="text-sm text-muted-foreground italic border-l-2 border-primary/20 pl-3">
                {firstChange.reason}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="mt-3 pt-3 border-t text-sm text-muted-foreground">
            <span className="text-muted-foreground">Por: </span>
            <span className="text-foreground font-medium">{firstChange.user?.name || "Sistema"}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Loading skeleton (matching ChangelogHistory exactly)
const ChangelogSkeleton = () => (
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
