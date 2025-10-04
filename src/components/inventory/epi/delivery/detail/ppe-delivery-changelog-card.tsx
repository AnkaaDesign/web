import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  IconHistory,
  IconEdit,
  IconPlus,
  IconTrash,
  IconRefresh,
  IconRestore,
  IconClock,
  IconUser,
  IconAlertCircle,
  IconCalendar,
  IconToggleLeft,
  IconToggleRight,
  IconArchive,
  IconArchiveOff,
  IconCheck,
  IconX,
} from "@tabler/icons-react";
import type { ChangeLog } from "../../../../../types";
import { CHANGE_LOG_ENTITY_TYPE, CHANGE_LOG_ACTION, PPE_DELIVERY_STATUS_LABELS, PPE_DELIVERY_STATUS } from "../../../../../constants";
import { formatDateTime, formatRelativeTime, getFieldLabel, formatFieldValue, getActionLabel } from "../../../../../utils";
import { useChangeLogs } from "../../../../../hooks";
import { cn } from "@/lib/utils";

interface PpeDeliveryChangelogCardProps {
  deliveryId: string;
  className?: string;
}

// Helper function to group changelogs
function groupChangelogsByEntity(changelogs: ChangeLog[]): ChangeLog[][] {
  const groups: ChangeLog[][] = [];
  const usedIds = new Set<string>();

  for (const changelog of changelogs) {
    if (usedIds.has(changelog.id)) continue;

    // Find all changelogs with the same timestamp and user
    const group = changelogs.filter((c) => {
      if (usedIds.has(c.id)) return false;
      const timeDiff = Math.abs(new Date(c.createdAt).getTime() - new Date(changelog.createdAt).getTime());
      return timeDiff < 1000 && c.userId === changelog.userId && c.action === changelog.action && c.triggeredBy === changelog.triggeredBy;
    });

    group.forEach((c) => usedIds.add(c.id));
    if (group.length > 0) groups.push(group);
  }

  return groups;
}

// Get action configuration
function getActionConfig(action: CHANGE_LOG_ACTION) {
  const configs = {
    [CHANGE_LOG_ACTION.CREATE]: { icon: IconPlus, color: "text-green-600 dark:text-green-400" },
    [CHANGE_LOG_ACTION.UPDATE]: { icon: IconEdit, color: "text-blue-600 dark:text-blue-400" },
    [CHANGE_LOG_ACTION.DELETE]: { icon: IconTrash, color: "text-red-600 dark:text-red-400" },
    [CHANGE_LOG_ACTION.RESTORE]: { icon: IconRefresh, color: "text-purple-600 dark:text-purple-400" },
    [CHANGE_LOG_ACTION.ROLLBACK]: { icon: IconRestore, color: "text-yellow-600 dark:text-yellow-400" },
    [CHANGE_LOG_ACTION.ARCHIVE]: { icon: IconArchive, color: "text-orange-600 dark:text-orange-400" },
    [CHANGE_LOG_ACTION.UNARCHIVE]: { icon: IconArchiveOff, color: "text-teal-600 dark:text-teal-400" },
    [CHANGE_LOG_ACTION.ACTIVATE]: { icon: IconToggleRight, color: "text-green-600 dark:text-green-400" },
    [CHANGE_LOG_ACTION.DEACTIVATE]: { icon: IconToggleLeft, color: "text-gray-600 dark:text-gray-400" },
    [CHANGE_LOG_ACTION.APPROVE]: { icon: IconCheck, color: "text-green-600 dark:text-green-400" },
    [CHANGE_LOG_ACTION.REJECT]: { icon: IconX, color: "text-red-600 dark:text-red-400" },
  };

  return configs[action as keyof typeof configs] || { icon: IconEdit, color: "text-gray-600 dark:text-gray-400" };
}

// Format field value with Portuguese labels
function formatPpeDeliveryFieldValue(value: any, field: string): string | React.ReactNode {
  if (value === null || value === undefined) return "—";

  // Handle status fields with proper labels
  if (field === "status" && typeof value === "string") {
    return PPE_DELIVERY_STATUS_LABELS[value as PPE_DELIVERY_STATUS] || value;
  }

  // Handle boolean fields
  if (typeof value === "boolean") {
    return value ? "Sim" : "Não";
  }

  // Handle date fields
  if (field.includes("Date") || field.includes("At")) {
    return formatDateTime(value);
  }

  // Handle quantity fields
  if (field === "quantity") {
    return `${value} unidade${value !== 1 ? "s" : ""}`;
  }

  // Default formatting
  return formatFieldValue(value, field, CHANGE_LOG_ENTITY_TYPE.PPE_DELIVERY);
}

// Get field label in Portuguese
function getPpeDeliveryFieldLabel(field: string): string {
  const fieldLabels: Record<string, string> = {
    status: "Status",
    quantity: "Quantidade",
    deliveryDate: "Data de Entrega",
    approvedBy: "Aprovado Por",
    approvedAt: "Aprovado Em",
    itemId: "Item",
    userId: "Funcionário",
    ppeScheduleId: "Agendamento",
    notes: "Observações",
    createdAt: "Criado Em",
    updatedAt: "Atualizado Em",
  };

  return fieldLabels[field] || getFieldLabel(field, CHANGE_LOG_ENTITY_TYPE.PPE_DELIVERY);
}

export function PpeDeliveryChangelogCard({ deliveryId, className }: PpeDeliveryChangelogCardProps) {
  // Fetch changelogs
  const {
    data: changelogsResponse,
    isLoading,
    error,
  } = useChangeLogs({
    where: {
      entityType: CHANGE_LOG_ENTITY_TYPE.PPE_DELIVERY,
      entityId: deliveryId,
    },
    include: {
      user: true,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 50,
  });

  const changelogs = changelogsResponse?.data || [];

  // Group changelogs by entity and time
  const groupedChangelogs = useMemo(() => {
    const changelogGroups = groupChangelogsByEntity(changelogs);

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
  }, [changelogs]);

  // Calculate summary statistics
  const changeStats = useMemo(() => {
    const totalChanges = changelogs.length;
    const recentChanges = changelogs.filter((c) => new Date(c.createdAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).length;
    const uniqueUsers = new Set(changelogs.map((c) => c.userId).filter(Boolean)).size;

    return {
      totalChanges,
      recentChanges,
      uniqueUsers,
    };
  }, [changelogs]);

  if (error) {
    return (
      <Card className={cn("shadow-sm border border-border", className)} level={1}>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center">
            <IconAlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <p className="text-destructive">Erro ao carregar histórico de alterações</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("shadow-sm border border-border flex flex-col", className)} level={1}>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-3 text-xl">
          <div className="p-2 rounded-lg bg-primary/10">
            <IconHistory className="h-5 w-5 text-primary" />
          </div>
          Histórico de Alterações
        </CardTitle>

        {/* Summary stats */}
        {changeStats.totalChanges > 0 && (
          <div className="grid grid-cols-3 gap-2 mt-4">
            <div className="bg-muted/30 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <IconEdit className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Total</span>
              </div>
              <p className="text-lg font-bold">{changeStats.totalChanges}</p>
            </div>

            <div className="bg-muted/30 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <IconClock className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">7 dias</span>
              </div>
              <p className="text-lg font-bold">{changeStats.recentChanges}</p>
            </div>

            <div className="bg-muted/30 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <IconUser className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Usuários</span>
              </div>
              <p className="text-lg font-bold">{changeStats.uniqueUsers}</p>
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent className="pt-0 flex-1 min-h-0">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-20 w-full" />
              </div>
            ))}
          </div>
        ) : changelogs.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <IconHistory className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Nenhuma alteração registrada</p>
            </div>
          </div>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-6">
              {groupedChangelogs.map(([date, dayChangelogGroups]) => (
                <div key={date} className="space-y-4">
                  {/* Date Header */}
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <IconCalendar className="h-4 w-4" />
                    <span className="font-medium">{date}</span>
                    <div className="flex-1 h-px bg-border" />
                  </div>

                  {/* Changes for this date */}
                  <div className="space-y-3">
                    {dayChangelogGroups.map((changelogGroup) => {
                      const firstChange = changelogGroup[0];
                      const config = getActionConfig(firstChange.action);
                      const Icon = config.icon;
                      const actionLabel = getActionLabel(firstChange.action, firstChange.triggeredBy || undefined);

                      return (
                        <div key={firstChange.id} className="bg-muted/30 rounded-lg p-4">
                          {/* Header */}
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <Icon className={cn("h-4 w-4", config.color)} />
                              <span className="font-medium text-sm">{actionLabel}</span>
                            </div>
                            <span className="text-xs text-muted-foreground">{formatRelativeTime(firstChange.createdAt)}</span>
                          </div>

                          {/* User info */}
                          <div className="text-sm text-muted-foreground mb-3">
                            Por: <span className="text-foreground font-medium">{firstChange.user?.name || "Sistema"}</span>
                          </div>

                          {/* Field changes */}
                          {changelogGroup.length > 0 && changelogGroup[0].field && (
                            <div className="space-y-2">
                              {changelogGroup.map((changelog) => {
                                if (!changelog.field) return null;

                                return (
                                  <div key={changelog.id} className="bg-background/50 rounded-md p-3">
                                    <div className="text-xs font-medium text-muted-foreground mb-1">{getPpeDeliveryFieldLabel(changelog.field)}</div>
                                    <div className="flex items-center gap-2 text-sm">
                                      {changelog.oldValue !== null && (
                                        <>
                                          <span className="text-red-600 dark:text-red-400 line-through">{formatPpeDeliveryFieldValue(changelog.oldValue, changelog.field)}</span>
                                          <span className="text-muted-foreground">→</span>
                                        </>
                                      )}
                                      <span className="text-green-600 dark:text-green-400 font-medium">{formatPpeDeliveryFieldValue(changelog.newValue, changelog.field)}</span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
