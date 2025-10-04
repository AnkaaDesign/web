import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { IconDots, IconEye, IconEdit, IconTrash, IconBell, IconSend, IconCalendar } from "@tabler/icons-react";
import { formatDateTime, formatRelativeTime } from "../../../../utils";
import { NOTIFICATION_IMPORTANCE_LABELS, NOTIFICATION_CHANNEL_LABELS, NOTIFICATION_TYPE_LABELS } from "../../../../constants";
import type { Notification } from "../../../../types";
import { cn } from "@/lib/utils";

interface NotificationCardProps {
  notification: Notification;
  onView?: (id: string) => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  onSend?: (id: string) => void;
  onMarkAsRead?: (id: string) => void;
  className?: string;
}

const importanceColors = {
  LOW: "bg-gray-100 text-gray-800 border-gray-300",
  NORMAL: "bg-blue-100 text-blue-800 border-blue-300",
  HIGH: "bg-orange-100 text-orange-800 border-orange-300",
  URGENT: "bg-red-100 text-red-800 border-red-300",
} as const;

export function NotificationCard({ notification, onView, onEdit, onDelete, onSend, onMarkAsRead, className }: NotificationCardProps) {
  const isSent = !!notification.sentAt;
  const isRead = notification.seenBy && notification.seenBy.length > 0;
  const isScheduled = !!notification.scheduledAt && !isSent;

  const handleAction = (action: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    action();
  };

  return (
    <Card
      className={cn("hover:shadow-md transition-shadow cursor-pointer", !isSent && "border-l-4 border-l-orange-400", isRead && "bg-gray-50", className)}
      onClick={() => onView?.(notification.id)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="p-2 bg-blue-100 rounded-lg">
              <IconBell className="w-4 h-4 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-gray-900 truncate" title={notification.title}>
                {notification.title}
              </h3>
              <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
                <Badge variant="outline" className="text-xs">
                  {NOTIFICATION_TYPE_LABELS[notification.type]}
                </Badge>
                <Badge className={cn("text-xs border", importanceColors[notification.importance])}>{NOTIFICATION_IMPORTANCE_LABELS[notification.importance]}</Badge>
              </div>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <IconDots className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onView && (
                <DropdownMenuItem onClick={handleAction(() => onView(notification.id))}>
                  <IconEye className="w-4 h-4 mr-2" />
                  Visualizar
                </DropdownMenuItem>
              )}
              {onEdit && (
                <DropdownMenuItem onClick={handleAction(() => onEdit(notification.id))}>
                  <IconEdit className="w-4 h-4 mr-2" />
                  Editar
                </DropdownMenuItem>
              )}
              {!isSent && onSend && (
                <DropdownMenuItem onClick={handleAction(() => onSend(notification.id))}>
                  <IconSend className="w-4 h-4 mr-2" />
                  Enviar
                </DropdownMenuItem>
              )}
              {!isRead && onMarkAsRead && (
                <DropdownMenuItem onClick={handleAction(() => onMarkAsRead(notification.id))}>
                  <IconEye className="w-4 h-4 mr-2" />
                  Marcar como Lida
                </DropdownMenuItem>
              )}
              {onDelete && (
                <DropdownMenuItem onClick={handleAction(() => onDelete(notification.id))} className="text-red-600">
                  <IconTrash className="w-4 h-4 mr-2" />
                  Excluir
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="space-y-3">
          {/* Body preview */}
          <p className="text-sm text-gray-600 line-clamp-2" title={notification.body}>
            {notification.body}
          </p>

          {/* Recipient */}
          {notification.user && (
            <div className="text-sm">
              <span className="text-gray-500">Para: </span>
              <span className="font-medium">{notification.user.name}</span>
            </div>
          )}

          {/* Channels */}
          <div className="flex flex-wrap gap-1">
            {notification.channel.map((channel) => (
              <Badge key={channel} variant="secondary" className="text-xs">
                {NOTIFICATION_CHANNEL_LABELS[channel]}
              </Badge>
            ))}
          </div>

          {/* Status and dates */}
          <div className="flex items-center justify-between text-sm text-gray-500">
            <div className="flex items-center gap-4">
              {/* Status */}
              <div className="flex items-center gap-1">
                {isScheduled && (
                  <>
                    <IconCalendar className="w-3 h-3" />
                    <span>Agendada</span>
                  </>
                )}
                {isSent && (
                  <>
                    <IconSend className="w-3 h-3" />
                    <span>Enviada</span>
                  </>
                )}
                {!isSent && !isScheduled && <span>Rascunho</span>}
              </div>

              {/* Read status */}
              {isRead && (
                <Badge variant="outline" className="text-xs">
                  Lida
                </Badge>
              )}
            </div>

            {/* Date */}
            <div className="text-right">
              {isSent && notification.sentAt && <div title={formatDateTime(notification.sentAt)}>Enviada {formatRelativeTime(notification.sentAt)}</div>}
              {isScheduled && notification.scheduledAt && <div title={formatDateTime(notification.scheduledAt)}>Agendada para {formatDateTime(notification.scheduledAt)}</div>}
              {!isSent && !isScheduled && <div title={formatDateTime(notification.createdAt)}>Criada {formatRelativeTime(notification.createdAt)}</div>}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
