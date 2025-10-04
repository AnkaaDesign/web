import React, { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { IconClock, IconUser, IconHistory, IconPackageImport, IconEdit, IconTrash, IconPlus, IconCheck, IconCalendar, IconAlertCircle } from "@tabler/icons-react";
import { formatDateTime, formatRelativeTime } from "../../../../utils";
import { cn } from "@/lib/utils";
import { useChangeLogs } from "../../../../hooks";
import { CHANGE_LOG_ACTION, CHANGE_LOG_ENTITY_TYPE, BORROW_STATUS, CHANGE_LOG_ACTION_LABELS, BORROW_STATUS_LABELS } from "../../../../constants";
import type { ChangeLog, Borrow } from "../../../../types";

interface BorrowTimelineProps {
  borrowId: string;
  borrow?: Borrow;
  showRelativeTime?: boolean;
  className?: string;
}

interface TimelineEvent {
  id: string;
  type: CHANGE_LOG_ACTION;
  title: string;
  description?: string;
  user?: {
    id: string;
    name: string;
  };
  metadata?: Record<string, any>;
  createdAt: Date | string;
  icon?: React.ComponentType<{ className?: string }>;
  variant?: "default" | "success" | "warning" | "danger" | "info";
  field?: string | null;
  oldValue?: any;
  newValue?: any;
}

export const BorrowTimeline: React.FC<BorrowTimelineProps> = ({ borrowId, borrow, showRelativeTime = true, className }) => {
  // Fetch change logs for this borrow
  const {
    data: changeLogsResponse,
    isLoading,
    error,
  } = useChangeLogs({
    where: {
      entityType: CHANGE_LOG_ENTITY_TYPE.BORROW,
      entityId: borrowId,
    },
    orderBy: {
      createdAt: "desc",
    },
    include: {
      user: true,
    },
  });

  const changeLogs = changeLogsResponse?.data || [];

  // Transform change logs into timeline events
  const timelineEvents: TimelineEvent[] = useMemo(() => {
    return changeLogs.map((log: ChangeLog) => {
      let icon: React.ComponentType<{ className?: string }> = IconHistory;
      let variant: TimelineEvent["variant"] = "default";
      let title = CHANGE_LOG_ACTION_LABELS[log.action] || log.action;
      let description = "";

      // Customize based on action type
      switch (log.action) {
        case CHANGE_LOG_ACTION.CREATE:
          icon = IconPlus;
          variant = "success";
          title = "Empréstimo criado";
          description = `${log.metadata?.quantity || borrow?.quantity || 0} unidade(s) emprestada(s)`;
          break;

        case CHANGE_LOG_ACTION.UPDATE:
          icon = IconEdit;
          variant = "info";

          // Handle specific field updates
          if (log.field === "status") {
            if (log.newValue === BORROW_STATUS.RETURNED) {
              icon = IconPackageImport;
              variant = "success";
              title = "Item devolvido";
              description = "O item foi devolvido ao estoque";
            } else {
              title = "Status atualizado";
              description = `De ${BORROW_STATUS_LABELS[log.oldValue as BORROW_STATUS] || log.oldValue} para ${BORROW_STATUS_LABELS[log.newValue as BORROW_STATUS] || log.newValue}`;
            }
          } else if (log.field === "quantity") {
            title = "Quantidade alterada";
            description = `De ${log.oldValue} para ${log.newValue} unidade(s)`;
          } else if (log.field === "returnedAt") {
            icon = IconCalendar;
            title = "Data de devolução registrada";
            description = formatDateTime(log.newValue);
          } else if (log.field) {
            title = `Campo ${log.field} atualizado`;
            if (log.oldValue && log.newValue) {
              description = `De "${log.oldValue}" para "${log.newValue}"`;
            }
          }
          break;

        case CHANGE_LOG_ACTION.DELETE:
          icon = IconTrash;
          variant = "danger";
          title = "Empréstimo excluído";
          break;

        case CHANGE_LOG_ACTION.RESTORE:
          icon = IconCheck;
          variant = "success";
          title = "Empréstimo restaurado";
          break;

        default:
          title = log.action;
      }

      // Add metadata information to description
      if (log.metadata && Object.keys(log.metadata).length > 0) {
        const metadataInfo = Object.entries(log.metadata)
          .filter(([key]) => key !== "quantity") // Already handled above
          .map(([key, value]) => `${key}: ${value}`)
          .join(", ");

        if (metadataInfo) {
          description = description ? `${description} (${metadataInfo})` : metadataInfo;
        }
      }

      // Add reason if available
      if (log.reason) {
        description = description ? `${description} - Motivo: ${log.reason}` : `Motivo: ${log.reason}`;
      }

      return {
        id: log.id,
        type: log.action,
        title,
        description,
        user: log.user
          ? {
              id: log.user.id,
              name: log.user.name,
            }
          : undefined,
        metadata: log.metadata,
        createdAt: log.createdAt,
        icon,
        variant,
        field: log.field,
        oldValue: log.oldValue,
        newValue: log.newValue,
      };
    });
  }, [changeLogs, borrow]);

  // Add the initial borrow creation if not in logs
  const eventsWithCreation = useMemo(() => {
    const hasCreationEvent = timelineEvents.some((event) => event.type === CHANGE_LOG_ACTION.CREATE);

    if (!hasCreationEvent && borrow) {
      const creationEvent: TimelineEvent = {
        id: `creation-${borrow.id}`,
        type: CHANGE_LOG_ACTION.CREATE,
        title: "Empréstimo criado",
        description: `${borrow.quantity} unidade(s) emprestada(s)`,
        user: borrow.user
          ? {
              id: borrow.user.id,
              name: borrow.user.name,
            }
          : undefined,
        createdAt: borrow.createdAt,
        icon: IconPlus,
        variant: "success",
      };

      return [...timelineEvents, creationEvent].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    return timelineEvents;
  }, [timelineEvents, borrow]);

  const getEventColor = (variant?: string) => {
    switch (variant) {
      case "success":
        return "bg-green-500";
      case "warning":
        return "bg-yellow-500";
      case "danger":
        return "bg-red-500";
      case "info":
        return "bg-blue-500";
      default:
        return "bg-primary";
    }
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent className="space-y-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-4">
              <Skeleton className="h-8 w-8 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-20 w-full" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconAlertCircle className="h-5 w-5 text-destructive" />
            Erro ao carregar histórico
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Não foi possível carregar o histórico deste empréstimo.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <IconClock className="h-5 w-5" />
          Histórico do Empréstimo
        </CardTitle>
        <CardDescription>Todas as ações e mudanças registradas para este empréstimo</CardDescription>
      </CardHeader>
      <CardContent>
        {eventsWithCreation.length === 0 ? (
          <div className="text-center py-8">
            <IconHistory className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Nenhuma atividade registrada</p>
          </div>
        ) : (
          <div className="relative space-y-6">
            {/* Timeline line */}
            <div className="absolute left-4 top-8 bottom-0 w-0.5 bg-border" />

            {eventsWithCreation.map((event, index) => {
              const EventIcon = event.icon || IconHistory;
              const isLast = index === eventsWithCreation.length - 1;

              return (
                <div key={event.id} className="relative flex gap-4">
                  {/* Timeline dot */}
                  <div className={cn("relative z-10 flex h-8 w-8 items-center justify-center rounded-full text-white shrink-0", getEventColor(event.variant))}>
                    <EventIcon className="h-4 w-4" />
                  </div>

                  {/* Content */}
                  <div className={cn("flex-1 pb-6", isLast && "pb-0")}>
                    <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                      {/* Header */}
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                          <h4 className="font-semibold">{event.title}</h4>
                          {event.description && <p className="text-sm text-muted-foreground">{event.description}</p>}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm text-muted-foreground">{showRelativeTime ? formatRelativeTime(event.createdAt) : formatDateTime(event.createdAt)}</p>
                          {!showRelativeTime && <p className="text-xs text-muted-foreground">{formatRelativeTime(event.createdAt)}</p>}
                        </div>
                      </div>

                      {/* User */}
                      {event.user && (
                        <div className="flex items-center gap-2 pt-2 border-t">
                          <IconUser className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">Por {event.user.name}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
