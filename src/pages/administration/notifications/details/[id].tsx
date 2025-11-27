import { PageHeader } from "@/components/ui/page-header";
import { IconBell, IconCheck, IconTrash, IconSend } from "@tabler/icons-react";
import { useParams } from "react-router-dom";
import { useNotification } from "../../../../hooks";
import { CHANGE_LOG_ENTITY_TYPE, NOTIFICATION_IMPORTANCE_LABELS, NOTIFICATION_CHANNEL_LABELS } from "../../../../constants";
import { ChangelogHistory } from "@/components/ui/changelog-history";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "../../../../utils";
import { cn } from "@/lib/utils";

const importanceColors: Record<string, string> = {
  LOW: "bg-gray-100 text-gray-800 border-gray-300",
  MEDIUM: "bg-blue-100 text-blue-800 border-blue-300",
  HIGH: "bg-orange-100 text-orange-800 border-orange-300",
  URGENT: "bg-red-100 text-red-800 border-red-300",
};

export const NotificationDetailsPage = () => {
  const { id } = useParams<{ id: string }>();
  const { data: response, isLoading } = useNotification(id || "", {
    enabled: !!id,
    include: {
      user: true,
      seenBy: {
        include: {
          user: true,
        },
      },
    },
  });

  const notification = response?.data;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          variant="detail"
          title="Carregando..."
          icon={IconBell}
          breadcrumbs={[
            { label: "Início", href: "/" },
            { label: "Administração", href: "/administracao" },
            { label: "Notificações", href: "/administracao/notificacoes" },
            { label: "Detalhes" },
          ]}
        />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <Skeleton className="h-7 w-40" />
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              </CardContent>
            </Card>
          </div>
          <div>
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!notification) {
    return (
      <div className="space-y-6">
        <PageHeader
          variant="detail"
          title="Notificação não encontrada"
          icon={IconBell}
          breadcrumbs={[
            { label: "Início", href: "/" },
            { label: "Administração", href: "/administracao" },
            { label: "Notificações", href: "/administracao/notificacoes" },
            { label: "Detalhes" },
          ]}
        />
      </div>
    );
  }

  const isRead = notification.seenBy && notification.seenBy.length > 0;
  const isSent = !!notification.sentAt;

  const actions = [
    ...(!isSent
      ? [
          {
            key: "send",
            label: "Enviar",
            icon: IconSend,
            variant: "outline" as const,
            onClick: () => {},
          },
        ]
      : []),
    ...(!isRead
      ? [
          {
            key: "mark-read",
            label: "Marcar como Lida",
            icon: IconCheck,
            variant: "outline" as const,
            onClick: () => {},
          },
        ]
      : []),
    {
      key: "delete",
      label: "Excluir",
      icon: IconTrash,
      variant: "outline" as const,
      onClick: () => {},
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        variant="detail"
        title={notification.title}
        icon={IconBell}
        breadcrumbs={[
          { label: "Início", href: "/" },
          { label: "Administração", href: "/administracao" },
          { label: "Notificações", href: "/administracao/notificacoes" },
          { label: notification.title },
        ]}
        actions={actions}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Notification Content */}
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Conteúdo da Notificação</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-lg font-semibold">{notification.title}</h3>
                      <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">{notification.body}</p>
                    </div>

                    {notification.actionUrl && (
                      <div className="pt-4 border-t">
                        <Button variant="outline" size="sm" asChild>
                          <a href={notification.actionUrl} target="_blank" rel="noopener noreferrer">
                            Ver Ação Relacionada
                          </a>
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Changelog History */}
              <ChangelogHistory
                entityType={CHANGE_LOG_ENTITY_TYPE.NOTIFICATION}
                entityId={notification.id}
                entityName={notification.title}
                entityCreatedAt={notification.createdAt}
              />
            </div>

            {/* Notification Details */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Detalhes</CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="space-y-3">
                    <div>
                      <dt className="text-sm font-medium text-muted-foreground">Status</dt>
                      <dd className="mt-1">
                        <Badge variant={isSent ? "default" : "secondary"}>{isSent ? "Enviada" : "Não Enviada"}</Badge>
                        {isRead && (
                          <Badge variant="outline" className="ml-2">
                            Lida
                          </Badge>
                        )}
                      </dd>
                    </div>

                    <div>
                      <dt className="text-sm font-medium text-muted-foreground">Importância</dt>
                      <dd className="mt-1">
                        <Badge className={cn("border", importanceColors[notification.importance])}>{NOTIFICATION_IMPORTANCE_LABELS[notification.importance]}</Badge>
                      </dd>
                    </div>

                    <div>
                      <dt className="text-sm font-medium text-muted-foreground">Canais</dt>
                      <dd className="mt-1 flex flex-wrap gap-1">
                        {notification.channel.map((channel) => (
                          <Badge key={channel} variant="outline">
                            {NOTIFICATION_CHANNEL_LABELS[channel]}
                          </Badge>
                        ))}
                      </dd>
                    </div>

                    {notification.user && (
                      <div>
                        <dt className="text-sm font-medium text-muted-foreground">Destinatário</dt>
                        <dd className="mt-1 text-sm">{notification.user.name}</dd>
                      </div>
                    )}

                    <div>
                      <dt className="text-sm font-medium text-muted-foreground">Criada em</dt>
                      <dd className="mt-1 text-sm">{formatDateTime(notification.createdAt)}</dd>
                    </div>

                    {notification.sentAt && (
                      <div>
                        <dt className="text-sm font-medium text-muted-foreground">Enviada em</dt>
                        <dd className="mt-1 text-sm">{formatDateTime(notification.sentAt)}</dd>
                      </div>
                    )}

                    {notification.scheduledAt && (
                      <div>
                        <dt className="text-sm font-medium text-muted-foreground">Agendada para</dt>
                        <dd className="mt-1 text-sm">{formatDateTime(notification.scheduledAt)}</dd>
                      </div>
                    )}
                  </dl>
                </CardContent>
              </Card>

              {/* Seen By */}
              {notification.seenBy && notification.seenBy.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Visualizações</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {notification.seenBy.map((seen) => (
                        <li key={seen.id} className="text-sm">
                          <span className="font-medium">{seen.user?.name}</span>
                          <span className="text-muted-foreground ml-2">{formatDateTime(seen.seenAt)}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
    </div>
  );
};
