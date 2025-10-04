import { useMemo } from "react";
import { IconHistory, IconUser, IconCalendar, IconEdit, IconPlus, IconTrash, IconEye, IconRefresh } from "@tabler/icons-react";

import type { Paint, ChangeLog } from "../../../../types";
import { CHANGE_LOG_ACTION_LABELS, CHANGE_LOG_ACTION, CHANGE_LOG_ENTITY_TYPE } from "../../../../constants";
import { formatDate, formatRelativeTime, getFieldLabel, formatFieldValue } from "../../../../utils";
import { useChangeLogs } from "../../../../hooks";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";

interface PaintChangelogHistoryCardProps {
  paint: Paint;
}

export function PaintChangelogHistoryCard({ paint }: PaintChangelogHistoryCardProps) {
  // Fetch changelog entries for this paint
  const { data: changeLogResponse, isLoading } = useChangeLogs({
    where: {
      entityType: CHANGE_LOG_ENTITY_TYPE.PAINT,
      entityId: paint.id,
    },
    include: {
      user: true,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 50, // Limit to recent 50 changes
  });

  const changeLogs = changeLogResponse?.data || [];

  // Group changes by date
  const groupedChanges = useMemo(() => {
    const groups: Record<string, ChangeLog[]> = {};

    changeLogs.forEach((log) => {
      const dateKey = formatDate(log.createdAt);
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(log);
    });

    return groups;
  }, [changeLogs]);

  const getActionIcon = (action: CHANGE_LOG_ACTION) => {
    switch (action) {
      case CHANGE_LOG_ACTION.CREATE:
        return <IconPlus className="h-3 w-3" />;
      case CHANGE_LOG_ACTION.UPDATE:
        return <IconEdit className="h-3 w-3" />;
      case CHANGE_LOG_ACTION.DELETE:
        return <IconTrash className="h-3 w-3" />;
      case CHANGE_LOG_ACTION.VIEW:
        return <IconEye className="h-3 w-3" />;
      default:
        return <IconRefresh className="h-3 w-3" />;
    }
  };

  const getActionColor = (action: CHANGE_LOG_ACTION): "default" | "secondary" | "destructive" | "outline" => {
    switch (action) {
      case CHANGE_LOG_ACTION.CREATE:
        return "secondary";
      case CHANGE_LOG_ACTION.DELETE:
        return "destructive";
      case CHANGE_LOG_ACTION.UPDATE:
        return "default";
      default:
        return "outline";
    }
  };

  const formatFieldName = (field: string | null) => {
    return getFieldLabel(field, CHANGE_LOG_ENTITY_TYPE.PAINT);
  };

  const formatValue = (value: unknown, field: string | null = null) => {
    return formatFieldValue(value, field, CHANGE_LOG_ENTITY_TYPE.PAINT);
  };

  if (isLoading) {
    return (
      <Card className="shadow-sm border border-border flex flex-col" level={1}>
        <CardHeader className="pb-6">
          <CardTitle className="flex items-center gap-3 text-xl">
            <div className="p-2 rounded-lg bg-primary/10">
              <IconHistory className="h-5 w-5 text-primary" />
            </div>
            Histórico de Alterações
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-20 w-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm border border-border flex flex-col" level={1}>
      <CardHeader className="pb-6">
        <CardTitle className="flex items-center gap-3 text-xl">
          <div className="p-2 rounded-lg bg-primary/10">
            <IconHistory className="h-5 w-5 text-primary" />
          </div>
          Histórico de Alterações
        </CardTitle>
      </CardHeader>

      <CardContent className="pt-0">
        {changeLogs.length > 0 ? (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-6">
              {Object.entries(groupedChanges).map(([date, logs], dateIndex) => (
                <div key={date} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <IconCalendar className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold text-muted-foreground">{date}</h3>
                  </div>

                  <div className="space-y-2">
                    {logs.map((log, logIndex) => (
                      <div key={log.id}>
                        <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <Badge variant={getActionColor(log.action)} className="text-xs">
                                <span className="flex items-center gap-1">
                                  {getActionIcon(log.action)}
                                  {CHANGE_LOG_ACTION_LABELS[log.action]}
                                </span>
                              </Badge>
                              <span className="text-xs text-muted-foreground">{formatRelativeTime(log.createdAt)}</span>
                            </div>
                          </div>

                          <div className="space-y-1">
                            <p className="text-sm font-medium">{formatFieldName(log.field)}</p>

                            {log.field && log.action === CHANGE_LOG_ACTION.UPDATE && (
                              <div className="text-xs space-y-1">
                                <div className="flex items-start gap-2">
                                  <span className="text-muted-foreground min-w-[60px]">Antes:</span>
                                  <span className="text-red-600 dark:text-red-400">{formatValue(log.oldValue, log.field)}</span>
                                </div>
                                <div className="flex items-start gap-2">
                                  <span className="text-muted-foreground min-w-[60px]">Depois:</span>
                                  <span className="text-green-600 dark:text-green-400">{formatValue(log.newValue, log.field)}</span>
                                </div>
                              </div>
                            )}

                            {log.reason && (
                              <div className="mt-2">
                                <span className="text-xs text-muted-foreground">Motivo: </span>
                                <span className="text-xs">{log.reason}</span>
                              </div>
                            )}

                            {log.user && (
                              <div className="flex items-center gap-2 mt-2">
                                <IconUser className="h-3 w-3 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground">{log.user.name || log.user.email}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {logIndex < logs.length - 1 && <Separator className="my-2" />}
                      </div>
                    ))}
                  </div>

                  {dateIndex < Object.entries(groupedChanges).length - 1 && <Separator className="my-4" />}
                </div>
              ))}
            </div>
          </ScrollArea>
        ) : (
          <div className="text-center py-8">
            <IconHistory className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">Nenhuma alteração registrada para esta tinta</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
