/**
 * Notification Configuration Details Page
 *
 * View detailed information about a notification configuration including:
 * - Basic information with status badge in header
 * - Channel configurations
 * - Target rules
 * - Sector overrides
 * - Templates (if any)
 */

import { useParams, useNavigate } from "react-router-dom";
import { useState, useCallback } from "react";
import {
  IconSettings,
  IconEdit,
  IconTestPipe,
  IconTrash,
  IconBell,
  IconDeviceMobile,
  IconMail,
  IconBrandWhatsapp,
  IconLock,
  IconClock,
  IconUsers,
  IconCheck,
  IconX,
  IconAlertTriangle,
  IconArrowLeft,
  IconHash,
  IconCategory,
  IconAlertCircle,
  IconBuilding,
  IconFileText,
  IconTemplate,
} from "@tabler/icons-react";
import { PageHeader } from "@/components/ui/page-header";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { routes, SECTOR_PRIVILEGES } from "@/constants";
import { cn } from "@/lib/utils";
import {
  useNotificationConfiguration,
  useNotificationConfigurationMutations,
} from "@/hooks/useNotificationConfiguration";
import type { NotificationChannelConfig } from "@/types/notification-configuration";

// =====================
// Constants
// =====================

const IMPORTANCE_CONFIG = {
  LOW: { label: "Baixa", variant: "gray" as const },
  NORMAL: { label: "Normal", variant: "blue" as const },
  HIGH: { label: "Alta", variant: "orange" as const },
  URGENT: { label: "Urgente", variant: "red" as const },
};

const TYPE_LABELS: Record<string, string> = {
  TASK: "Tarefas",
  ORDER: "Pedidos",
  SERVICE_ORDER: "Ordens de Serviço",
  STOCK: "Estoque",
  PPE: "EPI",
  VACATION: "Férias",
  WARNING: "Advertências",
  CUT: "Recortes",
  SYSTEM: "Sistema",
  GENERAL: "Geral",
};

const CHANNEL_CONFIG = {
  IN_APP: {
    label: "No App",
    icon: IconBell,
    color: "text-orange-600 dark:text-orange-400",
    bgColor: "bg-orange-50 dark:bg-orange-950",
    borderColor: "border-orange-200 dark:border-orange-800",
  },
  PUSH: {
    label: "Push",
    icon: IconDeviceMobile,
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-50 dark:bg-blue-950",
    borderColor: "border-blue-200 dark:border-blue-800",
  },
  EMAIL: {
    label: "E-mail",
    icon: IconMail,
    color: "text-purple-600 dark:text-purple-400",
    bgColor: "bg-purple-50 dark:bg-purple-950",
    borderColor: "border-purple-200 dark:border-purple-800",
  },
  WHATSAPP: {
    label: "WhatsApp",
    icon: IconBrandWhatsapp,
    color: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-50 dark:bg-green-950",
    borderColor: "border-green-200 dark:border-green-800",
  },
};

const SECTOR_LABELS: Record<string, string> = {
  ADMIN: "Administração",
  PRODUCTION: "Produção",
  WAREHOUSE: "Almoxarifado",
  FINANCIAL: "Financeiro",
  COMMERCIAL: "Comercial",
  LOGISTIC: "Logística",
  DESIGNER: "Design",
  HUMAN_RESOURCES: "RH",
  PLOTTING: "Plotagem",
  MAINTENANCE: "Manutenção",
  BASIC: "Básico",
  EXTERNAL: "Externo",
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
// Channel Card Component
// =====================

interface ChannelCardProps {
  channel: NotificationChannelConfig;
}

function ChannelCard({ channel }: ChannelCardProps) {
  const config = CHANNEL_CONFIG[channel.channel as keyof typeof CHANNEL_CONFIG];
  if (!config) return null;

  const Icon = config.icon;

  return (
    <div
      className={cn(
        "p-3 rounded-lg border-2 transition-all",
        channel.enabled
          ? config.borderColor
          : "border-muted bg-muted/50 opacity-50",
        channel.enabled && channel.mandatory && config.bgColor
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon className={cn("w-5 h-5", channel.enabled ? config.color : "text-muted-foreground")} />
          <span className={cn("font-medium text-sm", channel.enabled ? "text-foreground" : "text-muted-foreground")}>
            {config.label}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {channel.mandatory && (
            <Badge variant="purple" className="flex items-center gap-0.5 text-xs px-1.5 py-0.5">
              <IconLock className="w-3 h-3" />
              Obrig.
            </Badge>
          )}
          {channel.enabled ? (
            <Badge variant="active" className="text-xs px-1.5 py-0.5">Ativo</Badge>
          ) : (
            <Badge variant="inactive" className="text-xs px-1.5 py-0.5">Inativo</Badge>
          )}
        </div>
      </div>

      <div className="space-y-1.5 text-xs">
        <div className="flex items-center justify-between bg-background/50 rounded px-2 py-1">
          <span className="text-muted-foreground">Padrão ativo</span>
          {channel.defaultOn ? (
            <IconCheck className="w-3.5 h-3.5 text-green-600" />
          ) : (
            <IconX className="w-3.5 h-3.5 text-muted-foreground" />
          )}
        </div>
        {channel.minImportance && (
          <div className="flex items-center justify-between bg-background/50 rounded px-2 py-1">
            <span className="text-muted-foreground">Importância mín.</span>
            <Badge variant={IMPORTANCE_CONFIG[channel.minImportance as keyof typeof IMPORTANCE_CONFIG]?.variant || "outline"} className="text-xs px-1.5 py-0">
              {IMPORTANCE_CONFIG[channel.minImportance as keyof typeof IMPORTANCE_CONFIG]?.label}
            </Badge>
          </div>
        )}
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

export function NotificationConfigurationDetailsPage() {
  const { key } = useParams<{ key: string }>();
  const navigate = useNavigate();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Validate key is not a route parameter placeholder
  const isValidKey = key && !key.startsWith(":");

  const { data: response, isLoading, error } = useNotificationConfiguration(isValidKey ? key : "", {
    enabled: isValidKey,
  });
  const { delete: deleteMutation } = useNotificationConfigurationMutations();

  const config = response?.data;

  const handleDelete = useCallback(async () => {
    if (!config?.id) return;

    try {
      await deleteMutation.mutateAsync(config.id);
      setDeleteDialogOpen(false);
      navigate(routes.administration.notifications.configurations.root);
    } catch {
      // Error handled by mutation
    }
  }, [config?.id, deleteMutation, navigate]);

  if (isLoading) {
    return (
      <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.ADMIN}>
        <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4 pb-6">
          <PageHeader
            title="Carregando..."
            breadcrumbs={[
              { label: "Início", href: "/" },
              { label: "Administração", href: "/administracao" },
              { label: "Notificações", href: routes.administration.notifications.root },
              { label: "Configurações", href: routes.administration.notifications.configurations.root },
              { label: "Detalhes" },
            ]}
          />
          <LoadingSkeleton />
        </div>
      </PrivilegeRoute>
    );
  }

  if (!isValidKey || error || !config) {
    return (
      <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.ADMIN}>
        <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4 pb-6">
          <PageHeader
            title="Configuração não encontrada"
            breadcrumbs={[
              { label: "Início", href: "/" },
              { label: "Administração", href: "/administracao" },
              { label: "Notificações", href: routes.administration.notifications.root },
              { label: "Configurações", href: routes.administration.notifications.configurations.root },
              { label: "Detalhes" },
            ]}
          />
          <Card>
            <CardContent className="py-12 text-center">
              <IconAlertTriangle className="w-12 h-12 mx-auto mb-4 text-destructive" />
              <p className="text-lg font-medium mb-2">Configuração não encontrada</p>
              <p className="text-muted-foreground mb-4">
                A configuração solicitada não existe ou foi removida.
              </p>
              <Button onClick={() => navigate(routes.administration.notifications.configurations.root)}>
                <IconArrowLeft className="w-4 h-4 mr-2" />
                Voltar para lista
              </Button>
            </CardContent>
          </Card>
        </div>
      </PrivilegeRoute>
    );
  }

  const importanceConfig = IMPORTANCE_CONFIG[config.importance as keyof typeof IMPORTANCE_CONFIG] || IMPORTANCE_CONFIG.NORMAL;
  const typeLabel = TYPE_LABELS[config.notificationType] || config.notificationType;

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.ADMIN}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4 pb-6 overflow-auto">
        <PageHeader
          variant="detail"
          title={config.name || config.key}
          breadcrumbs={[
            { label: "Início", href: "/" },
            { label: "Administração", href: "/administracao" },
            { label: "Notificações", href: routes.administration.notifications.root },
            { label: "Configurações", href: routes.administration.notifications.configurations.root },
            { label: config.name || config.key },
          ]}
          actions={[
            {
              key: "test",
              label: "Testar",
              icon: IconTestPipe,
              onClick: () => navigate(routes.administration.notifications.configurations.test(config.key)),
              variant: "outline",
            },
            {
              key: "edit",
              label: "Editar",
              icon: IconEdit,
              onClick: () => navigate(routes.administration.notifications.configurations.edit(config.key)),
            },
            {
              key: "delete",
              label: "Excluir",
              icon: IconTrash,
              onClick: () => setDeleteDialogOpen(true),
              variant: "destructive",
            },
          ]}
        />

        <div className="flex-1 overflow-y-auto">
          <div className="space-y-4">
            {/* Row 1: Basic Info + Channel Configuration */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Basic Information */}
              <Card className="border flex flex-col">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <IconSettings className="h-5 w-5 text-muted-foreground" />
                      Informações Gerais
                    </CardTitle>
                    {config.enabled ? (
                      <Badge variant="active">Ativo</Badge>
                    ) : (
                      <Badge variant="inactive">Inativo</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pt-0 flex-1">
                  <div className="space-y-3">
                    <FieldRow icon={<IconHash className="h-4 w-4" />} label="Chave">
                      <span className="font-mono">{config.key}</span>
                    </FieldRow>

                    {config.description && (
                      <FieldRow icon={<IconFileText className="h-4 w-4" />} label="Descrição">
                        {config.description}
                      </FieldRow>
                    )}

                    <FieldRow icon={<IconCategory className="h-4 w-4" />} label="Tipo">
                      <Badge variant="outline">{typeLabel}</Badge>
                    </FieldRow>

                    <FieldRow icon={<IconHash className="h-4 w-4" />} label="Evento">
                      <span className="font-mono text-xs">{config.eventType}</span>
                    </FieldRow>

                    <FieldRow icon={<IconAlertCircle className="h-4 w-4" />} label="Importância">
                      <Badge variant={importanceConfig.variant}>{importanceConfig.label}</Badge>
                    </FieldRow>
                  </div>
                </CardContent>
              </Card>

              {/* Channel Configuration */}
              <Card className="border flex flex-col">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2">
                    <IconBell className="h-5 w-5 text-muted-foreground" />
                    Configuração de Canais
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 flex-1">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {config.channelConfigs?.map((channel) => (
                      <ChannelCard key={channel.channel} channel={channel} />
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Row 2: Business Rules + Target Rules */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Business Rules */}
              <Card className="border flex flex-col">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2">
                    <IconClock className="h-5 w-5 text-muted-foreground" />
                    Regras de Negócio
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 flex-1">
                  <div className="space-y-3">
                    <FieldRow icon={<IconClock className="h-4 w-4" />} label="Apenas horário comercial">
                      {config.workHoursOnly ? (
                        <IconCheck className="w-5 h-5 text-green-600" />
                      ) : (
                        <IconX className="w-5 h-5 text-muted-foreground" />
                      )}
                    </FieldRow>

                    <FieldRow icon={<IconSettings className="h-4 w-4" />} label="Agrupamento habilitado">
                      {config.batchingEnabled ? (
                        <IconCheck className="w-5 h-5 text-green-600" />
                      ) : (
                        <IconX className="w-5 h-5 text-muted-foreground" />
                      )}
                    </FieldRow>

                    <FieldRow icon={<IconAlertCircle className="h-4 w-4" />} label="Frequência máx/dia">
                      {config.maxFrequencyPerDay ?? "Sem limite"}
                    </FieldRow>

                    <FieldRow icon={<IconClock className="h-4 w-4" />} label="Janela de deduplicação">
                      {config.deduplicationWindow ? `${config.deduplicationWindow} min` : "Desabilitada"}
                    </FieldRow>
                  </div>
                </CardContent>
              </Card>

              {/* Target Rules */}
              <Card className="border flex flex-col">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2">
                    <IconUsers className="h-5 w-5 text-muted-foreground" />
                    Regras de Destinatário
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 flex-1">
                  {config.targetRule ? (
                    <div className="space-y-3">
                      <div className="bg-muted/50 rounded-lg px-4 py-3">
                        <div className="text-sm font-medium text-muted-foreground flex items-center gap-2 mb-2">
                          <IconBuilding className="h-4 w-4" />
                          Setores permitidos
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {config.targetRule.allowedSectors.length > 0 ? (
                            config.targetRule.allowedSectors.map((sector) => (
                              <Badge key={sector} variant="outline">
                                {SECTOR_LABELS[sector] || sector}
                              </Badge>
                            ))
                          ) : (
                            <Badge variant="secondary">Todos os setores</Badge>
                          )}
                        </div>
                      </div>

                      <FieldRow icon={<IconUsers className="h-4 w-4" />} label="Excluir inativos">
                        {config.targetRule.excludeInactive ? (
                          <IconCheck className="w-5 h-5 text-green-600" />
                        ) : (
                          <IconX className="w-5 h-5 text-muted-foreground" />
                        )}
                      </FieldRow>

                      <FieldRow icon={<IconUsers className="h-4 w-4" />} label="Excluir em férias">
                        {config.targetRule.excludeOnVacation ? (
                          <IconCheck className="w-5 h-5 text-green-600" />
                        ) : (
                          <IconX className="w-5 h-5 text-muted-foreground" />
                        )}
                      </FieldRow>

                      {config.targetRule.customFilter && (
                        <div className="bg-muted/50 rounded-lg px-4 py-3">
                          <div className="text-sm font-medium text-muted-foreground mb-1">Filtro customizado</div>
                          <code className="text-xs bg-background p-2 rounded block overflow-auto">
                            {config.targetRule.customFilter}
                          </code>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <IconUsers className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>Nenhuma regra de destinatário configurada</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Row 3: Templates (full width or can be paired with something else) */}
            <Card className="border">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2">
                  <IconTemplate className="h-5 w-5 text-muted-foreground" />
                  Templates
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {config.templates && Object.keys(config.templates).length > 0 ? (
                  <pre className="bg-muted/50 p-4 rounded-lg overflow-auto text-xs font-mono">
                    {JSON.stringify(config.templates, null, 2)}
                  </pre>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <IconTemplate className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Usando templates padrão do sistema</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Sector Overrides (if any) */}
            {config.sectorOverrides && config.sectorOverrides.length > 0 && (
              <Card className="border">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2">
                    <IconBuilding className="h-5 w-5 text-muted-foreground" />
                    Overrides por Setor
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {config.sectorOverrides.map((override) => (
                      <div key={override.id} className="p-4 border rounded-lg bg-muted/30">
                        <div className="flex items-center justify-between mb-3">
                          <Badge variant="outline" className="text-sm">
                            {SECTOR_LABELS[override.sector] || override.sector}
                          </Badge>
                          {override.importanceOverride && (
                            <Badge variant={IMPORTANCE_CONFIG[override.importanceOverride as keyof typeof IMPORTANCE_CONFIG]?.variant || "outline"}>
                              {IMPORTANCE_CONFIG[override.importanceOverride as keyof typeof IMPORTANCE_CONFIG]?.label}
                            </Badge>
                          )}
                        </div>
                        {override.channelOverrides && (
                          <pre className="text-xs bg-background p-2 rounded overflow-auto">
                            {JSON.stringify(override.channelOverrides, null, 2)}
                          </pre>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir configuração</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a configuração <strong>{config.key}</strong>?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PrivilegeRoute>
  );
}

export default NotificationConfigurationDetailsPage;
