import type { ComponentType } from "react";
import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { IconClock, IconUser, IconActivity } from "@tabler/icons-react";
import { formatDateTime, formatRelativeTime } from "../../../utils";
import { cn } from "@/lib/utils";

export interface TimelineEvent {
  id: string;
  type: string;
  title: string;
  description?: string;
  user?: {
    id: string;
    name: string;
  };
  metadata?: Record<string, string | number | boolean | null>;
  createdAt: Date | string;
  icon?: ComponentType<{ className?: string }>;
  variant?: "default" | "success" | "warning" | "danger" | "info";
}

export interface ActivityTimelineProps {
  events: TimelineEvent[];
  title?: string;
  description?: string;
  emptyMessage?: string;
  showRelativeTime?: boolean;
  className?: string;
}

export const ActivityTimeline: React.FC<ActivityTimelineProps> = ({
  events,
  title = "Histórico de Atividades",
  description = "Todas as ações e mudanças registradas",
  emptyMessage = "Nenhuma atividade registrada",
  showRelativeTime = true,
  className,
}) => {
  const getEventIcon = (event: TimelineEvent) => {
    if (event.icon) return event.icon;
    return IconActivity;
  };

  const getEventColor = (variant?: TimelineEvent["variant"]) => {
    switch (variant) {
      case "success":
        return "bg-[hsl(var(--success))]";
      case "warning":
        return "bg-[hsl(var(--warning))]";
      case "danger":
        return "bg-[hsl(var(--error))]";
      case "info":
        return "bg-[hsl(var(--info))]";
      default:
        return "bg-primary";
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <IconClock className="h-5 w-5" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <div className="text-center py-8">
            <IconActivity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">{emptyMessage}</p>
          </div>
        ) : (
          <div className="relative space-y-6">
            {/* Timeline line */}
            <div className="absolute left-4 top-8 bottom-0 w-0.5 bg-border" />

            {events.map((event, index) => {
              const EventIcon = getEventIcon(event);
              const isLast = index === events.length - 1;

              return (
                <div key={event.id} className="relative flex gap-4">
                  {/* Timeline dot */}
                  <div className={cn("relative z-10 flex h-8 w-8 items-center justify-center rounded-full text-white", getEventColor(event.variant))}>
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

                      {/* Metadata */}
                      {event.metadata && Object.keys(event.metadata).length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-2">
                          {Object.entries(event.metadata).map(([key, value]) => (
                            <Badge key={key} variant="secondary" className="text-xs">
                              {key}: {String(value)}
                            </Badge>
                          ))}
                        </div>
                      )}

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
