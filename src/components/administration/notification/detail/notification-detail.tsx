import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { NOTIFICATION_IMPORTANCE_LABELS, NOTIFICATION_CHANNEL_LABELS, NOTIFICATION_TYPE_LABELS } from "../../../../constants";
import type { Notification } from "../../../../types";
import { formatDateTime } from "../../../../utils";
import { IconEdit, IconTrash, IconSend, IconCheck, IconCalendar, IconUser, IconBell } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

interface NotificationDetailProps {
  notification: Notification;
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

export function NotificationDetail({ notification, onEdit, onDelete, onSend, onMarkAsRead, className }: NotificationDetailProps) {
  const isSent = !!notification.sentAt;
  const isRead = notification.seenBy && notification.seenBy.length > 0;
  const isScheduled = !!notification.scheduledAt && !isSent;

  return (
    <div className={cn("space-y-6", className)}>
      {/* Action buttons */}
      <div className="flex items-center justify-end gap-2">
        {!isSent && onSend && (
          <Button variant="outline" size="sm" onClick={() => onSend(notification.id)}>
            <IconSend className="w-4 h-4 mr-2" />
            Enviar
          </Button>
        )}
        {!isRead && onMarkAsRead && (
          <Button variant="outline" size="sm" onClick={() => onMarkAsRead(notification.id)}>
            <IconCheck className="w-4 h-4 mr-2" />
            Marcar como Lida
          </Button>
        )}
        {onEdit && (
          <Button variant="outline" size="sm" onClick={() => onEdit(notification.id)}>
            <IconEdit className="w-4 h-4 mr-2" />
            Editar
          </Button>
        )}
        {onDelete && (
          <Button variant="destructive" size="sm" onClick={() => onDelete(notification.id)}>
            <IconTrash className="w-4 h-4 mr-2" />
            Excluir
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Notification content */}
          <Card>
            <CardHeader>
              <div className="flex items-start gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <IconBell className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-xl">{notification.title}</CardTitle>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="outline">{NOTIFICATION_TYPE_LABELS[notification.type]}</Badge>
                    <Badge className={cn("border", importanceColors[notification.importance])}>{NOTIFICATION_IMPORTANCE_LABELS[notification.importance]}</Badge>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Mensagem</h4>
                  <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{notification.body}</p>
                </div>

                {notification.actionUrl && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Ação Relacionada</h4>
                      <Button variant="outline" size="sm" asChild>
                        <a href={notification.actionUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center">
                          Ver Ação
                        </a>
                      </Button>
                      {notification.actionType && <p className="text-sm text-gray-500 mt-1">Tipo: {notification.actionType}</p>}
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar with details */}
        <div className="space-y-6">
          {/* Status and metadata */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Detalhes</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-4">
                {/* Status */}
                <div>
                  <dt className="text-sm font-medium text-gray-500 mb-1">Status</dt>
                  <dd className="flex items-center gap-2">
                    {isScheduled && (
                      <Badge variant="secondary" className="flex items-center gap-1">
                        <IconCalendar className="w-3 h-3" />
                        Agendada
                      </Badge>
                    )}
                    {isSent && (
                      <Badge variant="default" className="flex items-center gap-1">
                        <IconSend className="w-3 h-3" />
                        Enviada
                      </Badge>
                    )}
                    {!isSent && !isScheduled && <Badge variant="secondary">Rascunho</Badge>}
                    {isRead && <Badge variant="outline">Lida</Badge>}
                  </dd>
                </div>

                {/* Recipient */}
                <div>
                  <dt className="text-sm font-medium text-gray-500 mb-1">Destinatário</dt>
                  <dd className="flex items-center gap-2">
                    <IconUser className="w-4 h-4 text-gray-400" />
                    {notification.user ? notification.user.name : "Todos os usuários"}
                  </dd>
                </div>

                {/* Channels */}
                <div>
                  <dt className="text-sm font-medium text-gray-500 mb-1">Canais</dt>
                  <dd className="flex flex-wrap gap-1">
                    {notification.channel.map((channel) => (
                      <Badge key={channel} variant="outline" className="text-xs">
                        {NOTIFICATION_CHANNEL_LABELS[channel]}
                      </Badge>
                    ))}
                  </dd>
                </div>

                <Separator />

                {/* Dates */}
                <div>
                  <dt className="text-sm font-medium text-gray-500 mb-1">Criada em</dt>
                  <dd className="text-sm">{formatDateTime(notification.createdAt)}</dd>
                </div>

                {notification.scheduledAt && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500 mb-1">Agendada para</dt>
                    <dd className="text-sm">{formatDateTime(notification.scheduledAt)}</dd>
                  </div>
                )}

                {notification.sentAt && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500 mb-1">Enviada em</dt>
                    <dd className="text-sm">{formatDateTime(notification.sentAt)}</dd>
                  </div>
                )}
              </dl>
            </CardContent>
          </Card>

          {/* Seen by users */}
          {notification.seenBy && notification.seenBy.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Visualizações</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {notification.seenBy.map((seen) => (
                    <div key={seen.id} className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                        <IconUser className="w-4 h-4 text-gray-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{seen.user?.name || "Usuário desconhecido"}</p>
                        <p className="text-xs text-gray-500">{formatDateTime(seen.seenAt)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
