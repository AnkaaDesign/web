import { useEffect, useState, useCallback, useMemo } from "react";
import { toast } from "sonner";
import {
  Loader2,
  Bell,
  Smartphone,
  Mail,
  MessageCircle,
  BellDot,
  Info,
  Package,
  RotateCcw,
  Shield,
  Factory,
  Users,
} from "lucide-react";
import {
  notificationUserPreferenceService,
  type NotificationChannel,
  type UserPreferenceConfig,
  type GroupedConfigurationsResponse,
} from "@/api-client";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { routes } from "@/constants";
import { DETAIL_PAGE_SPACING } from "@/lib/layout-constants";
import { cn } from "@/lib/utils";

// =====================
// Constants
// =====================

const ALL_CHANNELS: NotificationChannel[] = ["IN_APP", "PUSH", "EMAIL", "WHATSAPP"];

// =====================
// Channel Metadata
// =====================

const channelMetadata: Record<NotificationChannel, {
  icon: typeof Smartphone;
  label: string;
  bgColor: string;
  borderColor: string;
  textColor: string;
}> = {
  IN_APP: {
    icon: BellDot,
    label: "In-App",
    bgColor: "bg-orange-50 dark:bg-orange-950",
    borderColor: "border-orange-200 dark:border-orange-800",
    textColor: "text-orange-600 dark:text-orange-400",
  },
  EMAIL: {
    icon: Mail,
    label: "E-mail",
    bgColor: "bg-purple-50 dark:bg-purple-950",
    borderColor: "border-purple-200 dark:border-purple-800",
    textColor: "text-purple-600 dark:text-purple-400",
  },
  PUSH: {
    icon: Smartphone,
    label: "Push",
    bgColor: "bg-blue-50 dark:bg-blue-950",
    borderColor: "border-blue-200 dark:border-blue-800",
    textColor: "text-blue-600 dark:text-blue-400",
  },
  WHATSAPP: {
    icon: MessageCircle,
    label: "WhatsApp",
    bgColor: "bg-green-50 dark:bg-green-950",
    borderColor: "border-green-200 dark:border-green-800",
    textColor: "text-green-600 dark:text-green-400",
  },
};

// =====================
// Type Labels
// =====================

const TYPE_LABELS: Record<string, { title: string; icon: typeof Factory }> = {
  // Domain-based types
  PRODUCTION: { title: "Produção", icon: Factory }, // Tasks, cuts, service orders
  STOCK: { title: "Estoque", icon: Package }, // Items, orders, activities
  USER: { title: "Usuário", icon: Users }, // Warnings, vacation, PPE, bonus
  SYSTEM: { title: "Sistema", icon: Shield },
  GENERAL: { title: "Geral", icon: Bell },
};

// =====================
// PreferenceRow Component
// =====================

interface PreferenceRowProps {
  config: UserPreferenceConfig;
  userChannels: NotificationChannel[];
  onChange: (configKey: string, channels: NotificationChannel[]) => void;
  isSaving: boolean;
}

function PreferenceRow({ config, userChannels, onChange, isSaving }: PreferenceRowProps) {
  // Mandatory channels - those marked as mandatory (regardless of enabled status)
  const mandatoryChannels = config.channels
    .filter((ch) => ch.mandatory)
    .map((ch) => ch.channel);

  // Available channels - those enabled in the system configuration
  const availableChannels = config.channels
    .filter((ch) => ch.enabled)
    .map((ch) => ch.channel);

  const handleChannelToggle = (channel: NotificationChannel) => {
    if (isSaving) return;

    const isMandatory = mandatoryChannels.includes(channel);
    const isSelected = userChannels.includes(channel);
    const isAvailable = availableChannels.includes(channel);

    // Cannot toggle unavailable channels
    if (!isAvailable) {
      toast.error("Este canal não está disponível para este tipo de notificação");
      return;
    }

    // Cannot disable mandatory channels
    if (isMandatory) {
      toast.error(`O canal ${channelMetadata[channel].label} é obrigatório e não pode ser desativado`);
      return;
    }

    const newChannels = isSelected
      ? userChannels.filter((c) => c !== channel)
      : [...userChannels, channel];

    // Only show "at least one channel" error if there are no mandatory channels
    // When mandatory channels exist, they're always enabled so this check is unnecessary
    if (newChannels.length === 0 && mandatoryChannels.length === 0) {
      toast.error("Pelo menos um canal deve estar selecionado");
      return;
    }

    onChange(config.configKey, newChannels);
  };

  return (
    <div className="flex items-start justify-between py-3 gap-4 border-b border-border last:border-b-0">
      <div className="flex-1 space-y-0.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{config.name || config.configKey}</span>
        </div>
        <p className="text-xs text-muted-foreground">{config.description || "Sem descrição"}</p>
      </div>
      <div className="flex items-center gap-2">
        {ALL_CHANNELS.map((channel) => {
          const metadata = channelMetadata[channel];
          const Icon = metadata.icon;
          const isSelected = userChannels.includes(channel);
          const isMandatory = mandatoryChannels.includes(channel);
          const isAvailable = availableChannels.includes(channel);

          // Unavailable channel
          if (!isAvailable) {
            return (
              <TooltipProvider key={channel}>
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
                    <p>{metadata.label} não disponível</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          }

          // Mandatory channel - filled background indicates mandatory
          if (isMandatory) {
            return (
              <TooltipProvider key={channel}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className={cn(
                        "flex items-center justify-center w-10 h-10 rounded-lg border-2",
                        metadata.bgColor,
                        metadata.borderColor,
                        "cursor-not-allowed"
                      )}
                    >
                      <Icon className={cn("w-5 h-5", metadata.textColor)} />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{metadata.label} (Obrigatório)</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          }

          // Toggleable channel
          // Enabled (selected): border only, no background
          // Disabled (not selected): muted border, no background
          return (
            <TooltipProvider key={channel}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => handleChannelToggle(channel)}
                    disabled={isSaving}
                    className={cn(
                      "relative flex items-center justify-center w-10 h-10 rounded-lg border-2 transition-all bg-background",
                      isSelected
                        ? metadata.borderColor
                        : "border-muted hover:border-muted-foreground/50",
                      isSaving && "opacity-50 cursor-wait"
                    )}
                    aria-label={`${metadata.label}: ${isSelected ? "Ativado" : "Desativado"}`}
                  >
                    <Icon
                      className={cn(
                        "w-5 h-5 transition-colors",
                        isSelected ? metadata.textColor : "text-muted-foreground"
                      )}
                    />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{metadata.label}: {isSelected ? "Ativado" : "Desativado"}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        })}
      </div>
    </div>
  );
}

// =====================
// Main Component
// =====================

export function NotificationPreferencesPage() {
  // State
  const [configurations, setConfigurations] = useState<GroupedConfigurationsResponse | null>(null);
  const [preferences, setPreferences] = useState<Record<string, NotificationChannel[]>>({});
  const [originalPreferences, setOriginalPreferences] = useState<Record<string, NotificationChannel[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [savingKeys, setSavingKeys] = useState<Set<string>>(new Set());
  const [openAccordions, setOpenAccordions] = useState<string[]>([]);

  // =====================
  // Load Configurations
  // =====================

  const loadConfigurations = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await notificationUserPreferenceService.getAvailableConfigurations();

      if (response.data?.success && response.data?.data) {
        const data = response.data.data;
        setConfigurations(data);

        // Extract user preferences from the configuration data
        // API returns array: [{ notificationType, configurations: [...] }, ...]
        const userPrefs: Record<string, NotificationChannel[]> = {};
        for (const group of data) {
          if (!group?.configurations || !Array.isArray(group.configurations)) {
            continue;
          }
          for (const config of group.configurations) {
            if (!config?.configKey || !Array.isArray(config?.channels)) {
              continue;
            }
            // Get channels where userEnabled is true OR mandatory (mandatory channels are always enabled)
            const enabledChannels = config.channels
              .filter((ch) => ch.userEnabled || ch.mandatory)
              .map((ch) => ch.channel);
            userPrefs[config.configKey] = enabledChannels;
          }
        }

        setPreferences(userPrefs);
        setOriginalPreferences(JSON.parse(JSON.stringify(userPrefs)));
      } else {
        setConfigurations(null);
        setPreferences({});
        setOriginalPreferences({});
      }
    } catch (error: any) {
      console.error("[NotificationPreferences] Error loading:", error);
      toast.error(error?.response?.data?.message || "Erro ao carregar preferências de notificação");
      setConfigurations(null);
      setPreferences({});
      setOriginalPreferences({});
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfigurations();
  }, [loadConfigurations]);

  // =====================
  // Handle Preference Change (Optimistic Update)
  // =====================

  const handlePreferenceChange = useCallback(
    async (configKey: string, channels: NotificationChannel[]) => {
      // Find the config to get mandatory channels
      let mandatoryChannels: NotificationChannel[] = [];
      if (configurations) {
        for (const group of configurations) {
          const config = group.configurations?.find((c) => c.configKey === configKey);
          if (config) {
            mandatoryChannels = config.channels
              .filter((ch) => ch.mandatory)
              .map((ch) => ch.channel);
            break;
          }
        }
      }

      // Ensure mandatory channels are always included
      const finalChannels = Array.from(new Set([...channels, ...mandatoryChannels]));

      // Optimistic update
      setPreferences((prev) => ({
        ...prev,
        [configKey]: finalChannels,
      }));

      // Track saving state for this key
      setSavingKeys((prev) => new Set(prev).add(configKey));

      try {
        const response = await notificationUserPreferenceService.updatePreference(configKey, {
          channels: finalChannels,
        });

        if (!response.data?.success) {
          // Rollback on failure
          setPreferences((prev) => ({
            ...prev,
            [configKey]: originalPreferences[configKey] || [],
          }));
          toast.error(response.data?.message || "Erro ao salvar preferência");
        } else {
          // Update original preferences on success
          setOriginalPreferences((prev) => ({
            ...prev,
            [configKey]: finalChannels,
          }));
          toast.success("Preferência salva");
        }
      } catch (error: any) {
        console.error("[NotificationPreferences] Error saving:", error);
        // Rollback on error
        setPreferences((prev) => ({
          ...prev,
          [configKey]: originalPreferences[configKey] || [],
        }));
        toast.error(error?.response?.data?.message || "Erro ao salvar preferência");
      } finally {
        setSavingKeys((prev) => {
          const newSet = new Set(prev);
          newSet.delete(configKey);
          return newSet;
        });
      }
    },
    [originalPreferences, configurations]
  );

  // =====================

  // =====================
  // Computed Values
  // =====================

  const groupedSections = useMemo(() => {
    if (!configurations || !Array.isArray(configurations)) return [];

    // API returns array: [{ notificationType, configurations: [...] }, ...]
    return configurations
      .filter((group) => group?.configurations && Array.isArray(group.configurations) && group.configurations.length > 0)
      .map((group) => ({
        type: group.notificationType,
        title: TYPE_LABELS[group.notificationType]?.title || group.notificationType,
        icon: TYPE_LABELS[group.notificationType]?.icon || Bell,
        configs: group.configurations,
      }))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [configurations]);

  // =====================
  // Render
  // =====================

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!configurations || groupedSections.length === 0) {
    return (
      <div className={cn("flex flex-col h-full", DETAIL_PAGE_SPACING.CONTAINER)}>
        <div className="flex-shrink-0">
          <PageHeader
            title="Preferências de Notificação"
            icon={Bell as any}
            breadcrumbs={[
              { label: "Início", href: routes.home },
              { label: "Meu Perfil", href: routes.profile },
              { label: "Notificações" }
            ]}
          />
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <Info className="w-12 h-12 text-muted-foreground" />
          <p className="text-muted-foreground">Nenhuma configuração de notificação disponível</p>
          <Button variant="outline" onClick={loadConfigurations}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-full", DETAIL_PAGE_SPACING.CONTAINER)}>
      <div className="flex-shrink-0">
        <PageHeader
          title="Preferências de Notificação"
          icon={Bell as any}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Meu Perfil", href: routes.profile },
            { label: "Notificações" }
          ]}
          actions={[
            {
              key: "refresh",
              label: "Atualizar",
              icon: RotateCcw as any,
              onClick: loadConfigurations,
              variant: "outline",
              disabled: savingKeys.size > 0,
            },
          ]}
        />
      </div>

      {/* Sticky Header - Channel Legend and Info Card */}
      <div className="flex-shrink-0 pt-6 pb-4 space-y-4">
        {/* Channel Legend */}
        <div className="flex items-center gap-4 p-3 bg-card border border-border rounded-lg flex-wrap">
          <span className="text-sm text-muted-foreground">Canais:</span>
          {ALL_CHANNELS.map((channel) => {
            const metadata = channelMetadata[channel];
            const Icon = metadata.icon;
            return (
              <div key={channel} className="flex items-center gap-1.5">
                <Icon className={cn("h-4 w-4", metadata.textColor)} />
                <span className="text-sm">{metadata.label}</span>
              </div>
            );
          })}
        </div>

        {/* Info Card */}
        <div className="flex items-start gap-3 p-3 bg-primary/5 border border-primary/20 rounded-lg">
          <Info className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium">Alterações são salvas automaticamente</p>
            <p className="text-xs text-muted-foreground">
              Suas preferências são atualizadas imediatamente ao alternar os canais.
            </p>
          </div>
        </div>
      </div>

      {/* Scrollable Accordion Sections */}
      <div className="flex-1 min-h-0 overflow-auto pb-8">
        <Accordion
            type="multiple"
            value={openAccordions}
            onValueChange={setOpenAccordions}
            className="space-y-2"
          >
            {groupedSections.map((section) => {
              const Icon = section.icon;

              return (
                <AccordionItem
                  key={section.type}
                  value={section.type}
                  className="border border-border rounded-lg px-4 bg-card"
                >
                  <AccordionTrigger className="hover:no-underline py-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-md">
                        <Icon className="h-4 w-4 text-primary" />
                      </div>
                      <div className="text-left">
                        <span className="font-medium">{section.title}</span>
                        <span className="text-xs text-muted-foreground ml-2">
                          ({section.configs.length} eventos)
                        </span>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-4">
                    <div className="pt-2">
                      {section.configs.map((config) => (
                        <PreferenceRow
                          key={config.configKey}
                          config={config}
                          userChannels={preferences[config.configKey] || []}
                          onChange={handlePreferenceChange}
                          isSaving={savingKeys.has(config.configKey)}
                        />
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
      </div>
    </div>
  );
}
