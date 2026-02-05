/**
 * Notification Preferences Page (v2)
 *
 * Configuration-driven notification preferences using the new API.
 * Fetches available configurations dynamically based on user's sector.
 */

import { useMemo, useCallback, useState } from "react";
import { toast } from "sonner";
import {
  IconBell,
  IconDeviceMobile,
  IconMail,
  IconBrandWhatsapp,
  IconLock,
  IconRefresh,
  IconInfoCircle,
  IconClipboardList,
  IconPackage,
  IconShield,
  IconSettings,
  IconChevronDown,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { routes } from "@/constants";
import { DETAIL_PAGE_SPACING } from "@/lib/layout-constants";
import {
  useAvailableConfigurations,
  useUpdateMyPreference,
  useResetMyPreference,
} from "@/hooks/useNotificationConfiguration";
import type {
  UserPreferenceResponse,
  ChannelPreferenceDetail,
  GroupedConfigurationsResponse,
} from "@/types/notification-configuration";
import type { NOTIFICATION_CHANNEL } from "@/constants";

// =====================
// Constants
// =====================

const CHANNEL_CONFIG = {
  IN_APP: {
    label: "No App",
    icon: IconBell,
    color: "#f97316",
    bgColor: "bg-orange-50 dark:bg-orange-950",
    borderColor: "border-orange-200 dark:border-orange-800",
    textColor: "text-orange-600 dark:text-orange-400",
  },
  PUSH: {
    label: "Push",
    icon: IconDeviceMobile,
    color: "#3b82f6",
    bgColor: "bg-blue-50 dark:bg-blue-950",
    borderColor: "border-blue-200 dark:border-blue-800",
    textColor: "text-blue-600 dark:text-blue-400",
  },
  EMAIL: {
    label: "E-mail",
    icon: IconMail,
    color: "#a855f7",
    bgColor: "bg-purple-50 dark:bg-purple-950",
    borderColor: "border-purple-200 dark:border-purple-800",
    textColor: "text-purple-600 dark:text-purple-400",
  },
  WHATSAPP: {
    label: "WhatsApp",
    icon: IconBrandWhatsapp,
    color: "#22c55e",
    bgColor: "bg-green-50 dark:bg-green-950",
    borderColor: "border-green-200 dark:border-green-800",
    textColor: "text-green-600 dark:text-green-400",
  },
} as const;

const IMPORTANCE_CONFIG = {
  LOW: { label: "Baixa", color: "bg-gray-100 text-gray-800 border-gray-300" },
  NORMAL: { label: "Normal", color: "bg-blue-100 text-blue-800 border-blue-300" },
  HIGH: { label: "Alta", color: "bg-orange-100 text-orange-800 border-orange-300" },
  URGENT: { label: "Urgente", color: "bg-red-100 text-red-800 border-red-300" },
} as const;

const NOTIFICATION_TYPE_CONFIG: Record<string, { label: string; icon: typeof IconBell }> = {
  SYSTEM: { label: "Sistema", icon: IconSettings },
  PRODUCTION: { label: "Produção", icon: IconClipboardList },
  STOCK: { label: "Estoque", icon: IconPackage },
  USER: { label: "Usuário", icon: IconShield },
  GENERAL: { label: "Geral", icon: IconBell },
};

// =====================
// Channel Toggle Component
// =====================

interface ChannelToggleProps {
  channel: ChannelPreferenceDetail;
  configKey: string;
  onToggle: (configKey: string, channel: string, enabled: boolean) => void;
  isPending: boolean;
}

function ChannelToggle({ channel, configKey, onToggle, isPending }: ChannelToggleProps) {
  const config = CHANNEL_CONFIG[channel.channel as keyof typeof CHANNEL_CONFIG];
  const Icon = config?.icon || IconBell;

  // Channel not available
  if (!channel.enabled) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={cn(
                "relative flex items-center justify-center w-10 h-10 rounded-lg border-2",
                "bg-muted/50 border-muted cursor-not-allowed opacity-50"
              )}
            >
              <Icon className="w-5 h-5 text-muted-foreground" />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>{config?.label || channel.channel} não disponível</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Mandatory channel
  if (channel.mandatory) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={cn(
                "relative flex items-center justify-center w-10 h-10 rounded-lg border-2",
                config?.bgColor,
                config?.borderColor,
                "cursor-not-allowed"
              )}
            >
              <Icon className={cn("w-5 h-5", config?.textColor)} />
              <div className="absolute -top-1 -right-1 bg-violet-500 rounded-full p-0.5">
                <IconLock className="w-2.5 h-2.5 text-white" />
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>{config?.label || channel.channel} (Obrigatório)</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Toggleable channel
  const isEnabled = channel.userEnabled;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => onToggle(configKey, channel.channel, !isEnabled)}
            disabled={isPending}
            className={cn(
              "relative flex items-center justify-center w-10 h-10 rounded-lg border-2 transition-all",
              isEnabled ? [config?.bgColor, config?.borderColor] : "bg-background border-muted hover:border-muted-foreground/50",
              isPending && "opacity-50 cursor-wait"
            )}
          >
            <Icon
              className={cn(
                "w-5 h-5 transition-colors",
                isEnabled ? config?.textColor : "text-muted-foreground"
              )}
            />
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{config?.label || channel.channel}: {isEnabled ? "Ativado" : "Desativado"}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// =====================
// Notification Item Component
// =====================

interface NotificationItemProps {
  preference: UserPreferenceResponse;
  onToggle: (configKey: string, channel: string, enabled: boolean) => void;
  onReset: (configKey: string) => void;
  isPending: boolean;
}

function NotificationItem({ preference, onToggle, onReset, isPending }: NotificationItemProps) {
  const importanceConfig = IMPORTANCE_CONFIG[preference.importance as keyof typeof IMPORTANCE_CONFIG] || IMPORTANCE_CONFIG.NORMAL;

  const mandatoryCount = preference.channels.filter((c) => c.mandatory && c.enabled).length;

  return (
    <div className="flex items-center justify-between py-3 border-b last:border-b-0">
      <div className="flex-1 min-w-0 mr-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-sm truncate">{preference.description}</span>
          <Badge variant="outline" className={cn("text-xs", importanceConfig.color)}>
            {importanceConfig.label}
          </Badge>
          {mandatoryCount > 0 && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Badge variant="secondary" className="text-xs flex items-center gap-1">
                    <IconLock className="w-3 h-3" />
                    {mandatoryCount}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{mandatoryCount} canal(is) obrigatório(s)</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate">
          {preference.configKey}
        </p>
      </div>

      <div className="flex items-center gap-2">
        {preference.channels.map((channel) => (
          <ChannelToggle
            key={channel.channel}
            channel={channel}
            configKey={preference.configKey}
            onToggle={onToggle}
            isPending={isPending}
          />
        ))}

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 ml-2"
                onClick={() => onReset(preference.configKey)}
                disabled={isPending}
              >
                <IconRefresh className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Restaurar padrão</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}

// =====================
// Section Component
// =====================

interface NotificationSectionProps {
  type: string;
  preferences: UserPreferenceResponse[];
  onToggle: (configKey: string, channel: string, enabled: boolean) => void;
  onReset: (configKey: string) => void;
  isPending: boolean;
  defaultOpen?: boolean;
}

function NotificationSection({
  type,
  preferences,
  onToggle,
  onReset,
  isPending,
  defaultOpen = false,
}: NotificationSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const typeConfig = NOTIFICATION_TYPE_CONFIG[type] || { label: type, icon: IconBell };
  const Icon = typeConfig.icon;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base">{typeConfig.label}</CardTitle>
                  <CardDescription>{preferences.length} configurações</CardDescription>
                </div>
              </div>
              <IconChevronDown
                className={cn(
                  "w-5 h-5 text-muted-foreground transition-transform",
                  isOpen && "rotate-180"
                )}
              />
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">
            <div className="divide-y">
              {preferences.map((pref) => (
                <NotificationItem
                  key={pref.configKey}
                  preference={pref}
                  onToggle={onToggle}
                  onReset={onReset}
                  isPending={isPending}
                />
              ))}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

// =====================
// Loading Skeleton
// =====================

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <Card key={i}>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Skeleton className="w-10 h-10 rounded-lg" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[1, 2, 3].map((j) => (
                <div key={j} className="flex items-center justify-between py-3">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <div className="flex gap-2">
                    <Skeleton className="w-10 h-10 rounded-lg" />
                    <Skeleton className="w-10 h-10 rounded-lg" />
                    <Skeleton className="w-10 h-10 rounded-lg" />
                    <Skeleton className="w-10 h-10 rounded-lg" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// =====================
// Main Component
// =====================

export function NotificationPreferencesV2Page() {
  const { data: configurations, isLoading, error, refetch } = useAvailableConfigurations();
  const updatePreference = useUpdateMyPreference();
  const resetPreference = useResetMyPreference();

  const handleToggle = useCallback(
    (configKey: string, channel: string, enabled: boolean) => {
      if (!configurations) return;

      // Find the current preference
      let currentPref: UserPreferenceResponse | undefined;
      for (const type in configurations) {
        const found = configurations[type].find((p) => p.configKey === configKey);
        if (found) {
          currentPref = found;
          break;
        }
      }

      if (!currentPref) return;

      // Calculate new channels array
      const currentChannels = currentPref.channels
        .filter((c) => c.userEnabled || c.mandatory)
        .map((c) => c.channel);

      let newChannels: string[];
      if (enabled) {
        newChannels = [...new Set([...currentChannels, channel])];
      } else {
        newChannels = currentChannels.filter((c) => c !== channel);
      }

      // Ensure mandatory channels are always included
      const mandatoryChannels = currentPref.channels
        .filter((c) => c.mandatory && c.enabled)
        .map((c) => c.channel);
      newChannels = [...new Set([...newChannels, ...mandatoryChannels])];

      updatePreference.mutate({
        configKey,
        data: { channels: newChannels as NOTIFICATION_CHANNEL[] },
      });
    },
    [configurations, updatePreference]
  );

  const handleReset = useCallback(
    (configKey: string) => {
      resetPreference.mutate(configKey);
    },
    [resetPreference]
  );

  // Group and sort configurations
  const groupedConfigurations = useMemo(() => {
    if (!configurations) return [];

    const typeOrder = ["SYSTEM", "PRODUCTION", "STOCK", "USER", "GENERAL"];

    return Object.entries(configurations)
      .sort(([a], [b]) => {
        const indexA = typeOrder.indexOf(a);
        const indexB = typeOrder.indexOf(b);
        return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
      })
      .filter(([, prefs]) => prefs.length > 0);
  }, [configurations]);

  const isPending = updatePreference.isPending || resetPreference.isPending;

  return (
    <div className={cn("space-y-6", DETAIL_PAGE_SPACING)}>
      <PageHeader
        title="Preferências de Notificação"
        subtitle="Configure como você deseja receber notificações"
        breadcrumbs={[
          { label: "Início", href: routes.home },
          { label: "Perfil", href: routes.profile },
          { label: "Preferências de Notificação" },
        ]}
        actions={[
          {
            key: "refresh",
            label: "Atualizar",
            icon: IconRefresh,
            onClick: () => refetch(),
            variant: "outline",
            disabled: isLoading,
          },
        ]}
      />

      {/* Channel Legend */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <IconInfoCircle className="w-4 h-4" />
              <span>Canais:</span>
            </div>
            {Object.entries(CHANNEL_CONFIG).map(([key, config]) => {
              const Icon = config.icon;
              return (
                <div key={key} className="flex items-center gap-1.5">
                  <div
                    className={cn(
                      "p-1.5 rounded",
                      config.bgColor,
                      config.borderColor,
                      "border"
                    )}
                  >
                    <Icon className={cn("w-4 h-4", config.textColor)} />
                  </div>
                  <span className="text-sm">{config.label}</span>
                </div>
              );
            })}
            <div className="flex items-center gap-1.5 ml-4">
              <div className="p-1.5 rounded bg-violet-100 dark:bg-violet-900 border border-violet-200 dark:border-violet-700">
                <IconLock className="w-4 h-4 text-violet-600 dark:text-violet-400" />
              </div>
              <span className="text-sm">Obrigatório</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Loading State */}
      {isLoading && <LoadingSkeleton />}

      {/* Error State */}
      {error && (
        <Card>
          <CardContent className="py-8">
            <div className="flex flex-col items-center gap-4 text-center">
              <IconAlertTriangle className="w-12 h-12 text-destructive" />
              <div>
                <p className="font-medium">Erro ao carregar preferências</p>
                <p className="text-sm text-muted-foreground">
                  Não foi possível carregar suas preferências de notificação.
                </p>
              </div>
              <Button onClick={() => refetch()}>
                <IconRefresh className="w-4 h-4 mr-2" />
                Tentar novamente
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!isLoading && !error && groupedConfigurations.length === 0 && (
        <Card>
          <CardContent className="py-8">
            <div className="flex flex-col items-center gap-4 text-center">
              <IconBell className="w-12 h-12 text-muted-foreground" />
              <div>
                <p className="font-medium">Nenhuma configuração disponível</p>
                <p className="text-sm text-muted-foreground">
                  Não há configurações de notificação disponíveis para seu setor.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Configuration Sections */}
      {!isLoading && !error && groupedConfigurations.length > 0 && (
        <div className="space-y-4">
          {groupedConfigurations.map(([type, preferences], index) => (
            <NotificationSection
              key={type}
              type={type}
              preferences={preferences}
              onToggle={handleToggle}
              onReset={handleReset}
              isPending={isPending}
              defaultOpen={index === 0}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default NotificationPreferencesV2Page;
