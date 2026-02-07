/**
 * Test Notification Configuration Page
 *
 * Admin page for testing notification configurations:
 * - Dry run to see who would receive the notification
 * - Preview template rendering
 * - Channel delivery simulation
 */

import { useNavigate, useParams } from "react-router-dom";
import {
  IconSettings,
  IconTestPipe,
  IconArrowLeft,
  IconAlertTriangle,
  IconBell,
  IconDeviceMobile,
  IconMail,
  IconBrandWhatsapp,
  IconUsers,
  IconPlayerPlay,
  IconHash,
  IconCategory,
  IconAlertCircle,
  IconTemplate,
} from "@tabler/icons-react";
import { PageHeader } from "@/components/ui/page-header";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { routes, SECTOR_PRIVILEGES } from "@/constants";
import { cn } from "@/lib/utils";
import {
  useNotificationConfiguration,
  useTestConfiguration,
} from "@/hooks/use-notification-configuration";
import type { TestConfigurationResponse } from "@/types/notification-configuration";

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
    icon: IconBell,
    label: "No App",
    color: "text-orange-600 dark:text-orange-400",
    borderColor: "border-orange-200 dark:border-orange-800",
    bgColor: "bg-orange-50 dark:bg-orange-950",
  },
  PUSH: {
    icon: IconDeviceMobile,
    label: "Push",
    color: "text-blue-600 dark:text-blue-400",
    borderColor: "border-blue-200 dark:border-blue-800",
    bgColor: "bg-blue-50 dark:bg-blue-950",
  },
  EMAIL: {
    icon: IconMail,
    label: "E-mail",
    color: "text-purple-600 dark:text-purple-400",
    borderColor: "border-purple-200 dark:border-purple-800",
    bgColor: "bg-purple-50 dark:bg-purple-950",
  },
  WHATSAPP: {
    icon: IconBrandWhatsapp,
    label: "WhatsApp",
    color: "text-green-600 dark:text-green-400",
    borderColor: "border-green-200 dark:border-green-800",
    bgColor: "bg-green-50 dark:bg-green-950",
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
            {[1, 2, 3, 4].map((i) => (
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
// Test Results Component
// =====================

interface TestResultsProps {
  results: TestConfigurationResponse["data"];
}

function TestResults({ results }: TestResultsProps) {
  if (!results) return null;

  const { configuration, testResults } = results;
  const importanceConfig = IMPORTANCE_CONFIG[configuration.importance as keyof typeof IMPORTANCE_CONFIG] || IMPORTANCE_CONFIG.NORMAL;

  return (
    <div className="space-y-4">
      {/* Row 1: Configuration Summary + Channel Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Configuration Summary */}
        <Card className="border flex flex-col">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <IconSettings className="h-5 w-5 text-muted-foreground" />
                Configuração Testada
              </CardTitle>
              {configuration.enabled ? (
                <Badge variant="active">Ativo</Badge>
              ) : (
                <Badge variant="inactive">Inativo</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-0 flex-1">
            <div className="space-y-3">
              <FieldRow icon={<IconHash className="h-4 w-4" />} label="Chave">
                <span className="font-mono">{configuration.key}</span>
              </FieldRow>

              <FieldRow icon={<IconCategory className="h-4 w-4" />} label="Tipo">
                <Badge variant="outline">
                  {TYPE_LABELS[configuration.notificationType] || configuration.notificationType}
                </Badge>
              </FieldRow>

              <FieldRow icon={<IconAlertCircle className="h-4 w-4" />} label="Importância">
                <Badge variant={importanceConfig.variant}>{importanceConfig.label}</Badge>
              </FieldRow>

              <FieldRow icon={<IconHash className="h-4 w-4" />} label="Evento">
                <span className="font-mono text-xs">{configuration.eventType}</span>
              </FieldRow>
            </div>
          </CardContent>
        </Card>

        {/* Channel Summary */}
        <Card className="border flex flex-col">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2">
              <IconBell className="h-5 w-5 text-muted-foreground" />
              Resumo por Canal
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 flex-1">
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(testResults.channelSummary).map(([channel, stats]) => {
                const channelConf = CHANNEL_CONFIG[channel as keyof typeof CHANNEL_CONFIG];
                if (!channelConf) return null;
                const Icon = channelConf.icon;

                return (
                  <div
                    key={channel}
                    className={cn(
                      "p-3 rounded-lg border text-center",
                      channelConf.borderColor
                    )}
                  >
                    <Icon className={cn("w-6 h-6 mx-auto mb-1", channelConf.color)} />
                    <p className="text-sm font-medium">{channelConf.label}</p>
                    <p className="text-2xl font-bold text-foreground">
                      {stats.wouldReceive}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      de {stats.total} elegíveis
                    </p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Recipients List */}
      <Card className="border">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2">
            <IconUsers className="h-5 w-5 text-muted-foreground" />
            Destinatários
            <Badge variant="secondary" className="ml-2">
              {testResults.totalRecipients}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {testResults.recipients.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <IconUsers className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium mb-2">Nenhum destinatário encontrado</p>
              <p className="text-sm">Nenhum usuário corresponde aos critérios desta configuração</p>
            </div>
          ) : (
            <ScrollArea className="max-h-[400px]">
              <div className="space-y-2">
                {testResults.recipients.map((recipient) => (
                  <div
                    key={recipient.user.id}
                    className="bg-muted/50 rounded-lg p-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{recipient.user.name}</p>
                        <p className="text-xs text-muted-foreground">{recipient.user.email}</p>
                        {recipient.user.sector && (
                          <Badge variant="outline" className="mt-1 text-xs">
                            {recipient.user.sector}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        {recipient.channels
                          .filter((ch) => ch.wouldSend)
                          .map((ch) => {
                            const channelConf = CHANNEL_CONFIG[ch.channel as keyof typeof CHANNEL_CONFIG];
                            if (!channelConf) return null;
                            const Icon = channelConf.icon;
                            return (
                              <div
                                key={ch.channel}
                                className={cn(
                                  "p-1.5 rounded-md border transition-all flex items-center justify-center",
                                  channelConf.borderColor,
                                  ch.mandatory && channelConf.bgColor
                                )}
                                title={`${channelConf.label}${ch.mandatory ? " (Obrigatório)" : ""}`}
                              >
                                <Icon className={cn("h-4 w-4", channelConf.color)} />
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Rendered Templates (if any) */}
      {testResults.renderedTemplates && Object.keys(testResults.renderedTemplates).length > 0 && (
        <Card className="border">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2">
              <IconTemplate className="h-5 w-5 text-muted-foreground" />
              Templates Renderizados
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <pre className="bg-muted/50 p-4 rounded-lg overflow-auto text-xs font-mono">
              {JSON.stringify(testResults.renderedTemplates, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// =====================
// Main Component
// =====================

export function NotificationConfigurationTestPage() {
  const { key } = useParams<{ key: string }>();
  const navigate = useNavigate();

  // Validate key is not a route parameter placeholder
  const isValidKey = key && !key.startsWith(":");

  const { data: response, isLoading, error } = useNotificationConfiguration(isValidKey ? key : "", {
    enabled: isValidKey,
  });
  const testMutation = useTestConfiguration();

  const config = response?.data;

  const handleRunTest = async () => {
    if (!isValidKey) return;
    await testMutation.mutateAsync({ key: key! });
  };

  const handleBack = () => {
    if (isValidKey) {
      navigate(routes.administration.notifications.configurations.details(key!));
    } else {
      navigate(routes.administration.notifications.configurations.root);
    }
  };

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
              { label: "Testar" },
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
              { label: "Testar" },
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

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.ADMIN}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4 pb-6 overflow-auto">
        <PageHeader
          variant="detail"
          title={`Testar: ${config.name || config.key}`}
          breadcrumbs={[
            { label: "Início", href: "/" },
            { label: "Administração", href: "/administracao" },
            { label: "Notificações", href: routes.administration.notifications.root },
            { label: "Configurações", href: routes.administration.notifications.configurations.root },
            { label: config.name || config.key, href: routes.administration.notifications.configurations.details(config.key) },
            { label: "Testar" },
          ]}
          actions={[
            {
              key: "back",
              label: "Voltar",
              icon: IconArrowLeft,
              onClick: handleBack,
              variant: "outline",
            },
            {
              key: "run",
              label: testMutation.isPending ? "Executando..." : "Executar Simulação",
              icon: IconPlayerPlay,
              onClick: handleRunTest,
              disabled: testMutation.isPending,
              variant: "default",
            },
          ]}
        />

        <div className="flex-1 overflow-y-auto">
          <div className="space-y-4">
            {/* Test Info Card */}
            <Card className="border">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2">
                  <IconTestPipe className="h-5 w-5 text-muted-foreground" />
                  Simulação de Envio
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="bg-muted/50 rounded-lg px-4 py-3">
                  <p className="text-sm text-muted-foreground">
                    Execute uma simulação para verificar quem receberia esta notificação e em quais canais.
                    Este teste <strong>não envia</strong> notificações reais.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Test Results */}
            {testMutation.isSuccess && testMutation.data?.data && (
              <TestResults results={testMutation.data.data} />
            )}

            {/* Error State */}
            {testMutation.isError && (
              <Card className="border">
                <CardContent className="py-12 text-center">
                  <IconAlertTriangle className="w-12 h-12 mx-auto mb-4 text-destructive" />
                  <p className="text-lg font-medium mb-2">Erro ao executar teste</p>
                  <p className="text-muted-foreground">
                    {testMutation.error?.message || "Ocorreu um erro ao simular o envio da notificação."}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Initial State */}
            {!testMutation.isSuccess && !testMutation.isPending && !testMutation.isError && (
              <Card className="border">
                <CardContent className="py-12 text-center">
                  <IconTestPipe className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-lg font-medium mb-2">Pronto para testar</p>
                  <p className="text-muted-foreground">
                    Clique em "Executar Simulação" para ver quem receberia esta notificação.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </PrivilegeRoute>
  );
}

export default NotificationConfigurationTestPage;
