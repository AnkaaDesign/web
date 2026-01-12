import { PageHeader } from "@/components/ui/page-header";
import { IconCheck, IconTrash, IconSend, IconEye, IconUser } from "@tabler/icons-react";
import { useParams } from "react-router-dom";
import { useNotification } from "../../../../hooks";
import { NOTIFICATION_IMPORTANCE_LABELS, NOTIFICATION_CHANNEL_LABELS, NOTIFICATION_TYPE_LABELS } from "../../../../constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDateTime, formatRelativeTime } from "../../../../utils";
import { cn } from "@/lib/utils";

const importanceColors: Record<string, string> = {
  LOW: "bg-gray-100 text-gray-800 border-gray-300",
  NORMAL: "bg-blue-100 text-blue-800 border-blue-300",
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
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="detail"
          title="Carregando..."
          breadcrumbs={[
            { label: "Início", href: "/" },
            { label: "Administração", href: "/administracao" },
            { label: "Notificações", href: "/administracao/notificacoes" },
            { label: "Detalhes" },
          ]}
          className="flex-shrink-0"
        />
        <div className="flex-1 overflow-y-auto pb-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
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
      </div>
    );
  }

  if (!notification) {
    return (
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="detail"
          title="Notificação não encontrada"
          breadcrumbs={[
            { label: "Início", href: "/" },
            { label: "Administração", href: "/administracao" },
            { label: "Notificações", href: "/administracao/notificacoes" },
            { label: "Detalhes" },
          ]}
          className="flex-shrink-0"
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
    <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
      <PageHeader
        variant="detail"
        title={notification.title}
        breadcrumbs={[
          { label: "Início", href: "/" },
          { label: "Administração", href: "/administracao" },
          { label: "Notificações", href: "/administracao/notificacoes" },
          { label: notification.title },
        ]}
        actions={actions}
        className="flex-shrink-0"
      />
      <div className="flex-1 overflow-y-auto pb-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Detalhes Section */}
          <Card className="h-fit">
            <CardHeader>
              <CardTitle>Detalhes</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-4">
                {/* Título e Mensagem */}
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Título</dt>
                  <dd className="mt-1 text-base font-semibold">{notification.title}</dd>
                </div>

                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Mensagem</dt>
                  <dd className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">{notification.body}</dd>
                </div>

                {notification.actionUrl && (
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">Ação Relacionada</dt>
                    <dd className="mt-1">
                      <Button variant="outline" size="sm" asChild>
                        <a href={notification.actionUrl} target="_blank" rel="noopener noreferrer">
                          Ver Ação Relacionada
                        </a>
                      </Button>
                    </dd>
                  </div>
                )}

                <div className="border-t pt-4">
                  <dt className="text-sm font-medium text-muted-foreground">Status</dt>
                  <dd className="mt-1 flex flex-wrap gap-2">
                    <Badge variant={isSent ? "default" : "secondary"}>{isSent ? "Enviada" : "Não Enviada"}</Badge>
                    {isRead && <Badge variant="outline">Lida</Badge>}
                  </dd>
                </div>

                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Tipo</dt>
                  <dd className="mt-1">
                    <Badge variant="outline">{NOTIFICATION_TYPE_LABELS[notification.type] || notification.type}</Badge>
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
                        {NOTIFICATION_CHANNEL_LABELS[channel] || channel}
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

                <div className="border-t pt-4">
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

          {/* Visualizações Section */}
          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconEye className="h-5 w-5 text-muted-foreground" />
                Visualizações
              </CardTitle>
            </CardHeader>
            <CardContent>
              {notification.seenBy && notification.seenBy.length > 0 ? (
                <ScrollArea className="max-h-[400px]">
                  <div className="space-y-3">
                    {notification.seenBy.map((seen, index) => {
                      const isLast = index === notification.seenBy!.length - 1;
                      return (
                        <div key={seen.id} className="relative">
                          {/* Timeline connector */}
                          {!isLast && (
                            <div className="absolute left-6 top-12 bottom-0 w-0.5 bg-border" />
                          )}

                          <div className="flex items-start gap-4 group">
                            {/* Timeline dot and icon */}
                            <div className="relative z-10 flex items-center justify-center w-12 h-12">
                              <IconUser className="h-5 w-5 text-green-600 transition-transform group-hover:scale-110" />
                            </div>

                            {/* Content card */}
                            <div className="flex-1 bg-card-nested rounded-xl p-4 border border-border">
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-semibold text-sm">{seen.user?.name || "Usuário desconhecido"}</span>
                                <span className="text-xs text-muted-foreground">{formatRelativeTime(seen.seenAt)}</span>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                Visualizou em {formatDateTime(seen.seenAt)}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-8">
                  <IconEye className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                  <p className="text-muted-foreground mb-2">Nenhuma visualização registrada</p>
                  <p className="text-sm text-muted-foreground">As visualizações desta notificação aparecerão aqui</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
