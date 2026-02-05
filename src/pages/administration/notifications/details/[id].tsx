/**
 * Notification Details Page
 *
 * View detailed information about a notification including:
 * - Basic information with status badge in header
 * - Channel information
 * - Timeline of views
 */

import { useParams, useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/ui/page-header";
import {
  IconCheck,
  IconTrash,
  IconSend,
  IconEye,
  IconUser,
  IconBell,
  IconMail,
  IconDeviceMobile,
  IconBrandWhatsapp,
  IconAlertCircle,
  IconCategory,
  IconHash,
  IconClock,
  IconLink,
  IconCalendar,
  IconArrowLeft,
  IconAlertTriangle,
} from "@tabler/icons-react";
import { useNotification } from "@/hooks";
import {
  NOTIFICATION_IMPORTANCE_LABELS,
  NOTIFICATION_CHANNEL_LABELS,
  NOTIFICATION_TYPE_LABELS,
  routes,
} from "@/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDateTime, formatRelativeTime } from "@/utils";
import { cn } from "@/lib/utils";

// =====================
// Constants
// =====================

const IMPORTANCE_CONFIG = {
  LOW: { label: "Baixa", variant: "gray" as const },
  NORMAL: { label: "Normal", variant: "blue" as const },
  HIGH: { label: "Alta", variant: "orange" as const },
  URGENT: { label: "Urgente", variant: "red" as const },
};

const CHANNEL_CONFIG = {
  IN_APP: {
    label: "No App",
    icon: IconBell,
    color: "text-orange-500",
    borderColor: "border-orange-500",
  },
  PUSH: {
    label: "Push",
    icon: IconDeviceMobile,
    color: "text-blue-500",
    borderColor: "border-blue-500",
  },
  EMAIL: {
    label: "E-mail",
    icon: IconMail,
    color: "text-purple-500",
    borderColor: "border-purple-500",
  },
  WHATSAPP: {
    label: "WhatsApp",
    icon: IconBrandWhatsapp,
    color: "text-green-500",
    borderColor: "border-green-500",
  },
};

// =====================
// Field Row Component
// =====================

interface FieldRowProps {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}

function FieldRow({ icon, label, children }: FieldRowProps) {
  return (
    <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2">
      <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
        {icon}
        {label}
      </span>
      <div className="text-sm font-semibold text-foreground text-right">
        {children}
      </div>
    </div>
  );
}

// =====================
// Loading Skeleton
// =====================

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// =====================
// Main Component
// =====================

export const NotificationDetailsPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: response, isLoading, error } = useNotification(id || "", {
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
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4 pb-6">
        <PageHeader
          variant="detail"
          title="Carregando..."
          breadcrumbs={[
            { label: "Início", href: "/" },
            { label: "Administração", href: "/administracao" },
            { label: "Notificações", href: routes.administration.notifications.root },
            { label: "Detalhes" },
          ]}
        />
        <LoadingSkeleton />
      </div>
    );
  }

  if (error || !notification) {
    return (
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4 pb-6">
        <PageHeader
          variant="detail"
          title="Notificação não encontrada"
          breadcrumbs={[
            { label: "Início", href: "/" },
            { label: "Administração", href: "/administracao" },
            { label: "Notificações", href: routes.administration.notifications.root },
            { label: "Detalhes" },
          ]}
        />
        <Card>
          <CardContent className="py-12 text-center">
            <IconAlertTriangle className="w-12 h-12 mx-auto mb-4 text-destructive" />
            <p className="text-lg font-medium mb-2">Notificação não encontrada</p>
            <p className="text-muted-foreground mb-4">
              A notificação solicitada não existe ou foi removida.
            </p>
            <Button onClick={() => navigate(routes.administration.notifications.root)}>
              <IconArrowLeft className="w-4 h-4 mr-2" />
              Voltar para lista
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isRead = notification.seenBy && notification.seenBy.length > 0;
  const isSent = !!notification.sentAt;
  const importanceConfig = IMPORTANCE_CONFIG[notification.importance as keyof typeof IMPORTANCE_CONFIG] || IMPORTANCE_CONFIG.NORMAL;
  const typeLabel = NOTIFICATION_TYPE_LABELS[notification.type] || notification.type;

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
      variant: "destructive" as const,
      onClick: () => {},
    },
  ];

  return (
    <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4 pb-6 overflow-auto">
      <PageHeader
        variant="detail"
        title={notification.title}
        breadcrumbs={[
          { label: "Início", href: "/" },
          { label: "Administração", href: "/administracao" },
          { label: "Notificações", href: routes.administration.notifications.root },
          { label: notification.title },
        ]}
        actions={actions}
      />

      <div className="flex-1 overflow-y-auto">
        <div className="space-y-4">
          {/* Row 1: Basic Info + Status */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Basic Information */}
            <Card className="border flex flex-col">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <IconBell className="h-5 w-5 text-muted-foreground" />
                    Informações Gerais
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {isSent ? (
                      <Badge variant="active">Enviada</Badge>
                    ) : (
                      <Badge variant="inactive">Não Enviada</Badge>
                    )}
                    {isRead && <Badge variant="outline">Lida</Badge>}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0 flex-1">
                <div className="space-y-3">
                  <FieldRow icon={<IconHash className="h-4 w-4" />} label="Título">
                    {notification.title}
                  </FieldRow>

                  <FieldRow icon={<IconCategory className="h-4 w-4" />} label="Tipo">
                    <Badge variant="outline">{typeLabel}</Badge>
                  </FieldRow>

                  <FieldRow icon={<IconAlertCircle className="h-4 w-4" />} label="Importância">
                    <Badge variant={importanceConfig.variant}>{importanceConfig.label}</Badge>
                  </FieldRow>

                  {notification.user && (
                    <FieldRow icon={<IconUser className="h-4 w-4" />} label="Destinatário">
                      {notification.user.name}
                    </FieldRow>
                  )}

                  <FieldRow icon={<IconBell className="h-4 w-4" />} label="Canais de Envio">
                    <div className="flex items-center gap-1.5">
                      {(["IN_APP", "PUSH", "EMAIL", "WHATSAPP"] as const).map((channelKey) => {
                        const channelConfig = CHANNEL_CONFIG[channelKey];
                        const isEnabled = notification.channel.includes(channelKey);
                        const Icon = channelConfig.icon;
                        return (
                          <div
                            key={channelKey}
                            className={cn(
                              "p-1.5 rounded-md border transition-all flex items-center justify-center",
                              isEnabled
                                ? channelConfig.borderColor
                                : "border-muted-foreground/30"
                            )}
                            title={`${channelConfig.label}${!isEnabled ? " (Desativado)" : ""}`}
                          >
                            <Icon className={cn("h-4 w-4", isEnabled ? channelConfig.color : "text-muted-foreground/50")} />
                          </div>
                        );
                      })}
                    </div>
                  </FieldRow>

                  {notification.actionUrl && (
                    <FieldRow icon={<IconLink className="h-4 w-4" />} label="Ação Relacionada">
                      <Button variant="link" size="sm" className="h-auto p-0" asChild>
                        <a href={notification.actionUrl} target="_blank" rel="noopener noreferrer">
                          Ver Ação
                        </a>
                      </Button>
                    </FieldRow>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Dates */}
            <Card className="border flex flex-col">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2">
                  <IconClock className="h-5 w-5 text-muted-foreground" />
                  Datas
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 flex-1">
                <div className="space-y-3">
                  <FieldRow icon={<IconCalendar className="h-4 w-4" />} label="Criada em">
                    {formatDateTime(notification.createdAt)}
                  </FieldRow>

                  {notification.sentAt && (
                    <FieldRow icon={<IconSend className="h-4 w-4" />} label="Enviada em">
                      {formatDateTime(notification.sentAt)}
                    </FieldRow>
                  )}

                  {notification.scheduledAt && (
                    <FieldRow icon={<IconClock className="h-4 w-4" />} label="Agendada para">
                      {formatDateTime(notification.scheduledAt)}
                    </FieldRow>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Row 2: Mensagem + Visualizations */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Mensagem */}
            <Card className="border flex flex-col">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2">
                  <IconBell className="h-5 w-5 text-muted-foreground" />
                  Mensagem
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 flex-1">
                <div className="bg-muted/50 rounded-lg px-4 py-3 h-full">
                  <p className="text-sm whitespace-pre-wrap">{notification.body}</p>
                </div>
              </CardContent>
            </Card>

            {/* Visualizations */}
            <Card className="border flex flex-col">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2">
                  <IconEye className="h-5 w-5 text-muted-foreground" />
                  Visualizações
                  {notification.seenBy && notification.seenBy.length > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {notification.seenBy.length}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 flex-1">
                {notification.seenBy && notification.seenBy.length > 0 ? (
                  <ScrollArea className="max-h-[300px]">
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
                              <div className="relative z-10 flex items-center justify-center w-12 h-12 rounded-full bg-green-500/10 border border-green-500/30">
                                <IconUser className="h-5 w-5 text-green-600 transition-transform group-hover:scale-110" />
                              </div>

                              {/* Content card */}
                              <div className="flex-1 bg-muted/50 rounded-lg p-4">
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
                  <div className="text-center py-8 text-muted-foreground">
                    <IconEye className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="font-medium mb-2">Nenhuma visualização registrada</p>
                    <p className="text-sm">As visualizações desta notificação aparecerão aqui</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};
