/**
 * Edit Notification Configuration Page
 *
 * Admin page for editing existing notification configurations with:
 * - Basic information (key, description, type, importance)
 * - Channel configurations (enabled, mandatory, default on)
 * - Target rules (allowed sectors, exclusions)
 * - Business rules (work hours, batching, frequency)
 */

import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm, FormProvider, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  IconSettings,
  IconCheck,
  IconX,
  IconBell,
  IconDeviceMobile,
  IconMail,
  IconBrandWhatsapp,
  IconLock,
  IconClock,
  IconUsers,
  IconAlertTriangle,
  IconArrowLeft,
} from "@tabler/icons-react";
import { PageHeader } from "@/components/ui/page-header";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { FormCombobox } from "@/components/ui/form-combobox";
import { Separator } from "@/components/ui/separator";
import { routes, SECTOR_PRIVILEGES, type NOTIFICATION_CHANNEL } from "@/constants";
import { cn } from "@/lib/utils";
import {
  useNotificationConfiguration,
  useNotificationConfigurationMutations,
} from "@/hooks/administration/use-notification-configuration";
import { notificationConfigurationService } from "@/api-client/services/notification-configuration.service";

// =====================
// Schema
// =====================

const channelConfigSchema = z.object({
  channel: z.enum(["IN_APP", "PUSH", "EMAIL", "WHATSAPP"]),
  enabled: z.boolean(),
  mandatory: z.boolean(),
  defaultOn: z.boolean(),
});

const configurationSchema = z.object({
  key: z
    .string()
    .min(3, "Chave deve ter no mínimo 3 caracteres")
    .regex(/^[a-z][a-zA-Z0-9_.]*$/, "Chave deve começar com letra minúscula e conter apenas letras, números, underscore e ponto"),
  name: z
    .string()
    .min(3, "Nome deve ter no mínimo 3 caracteres")
    .max(100, "Nome deve ter no máximo 100 caracteres"),
  eventType: z
    .string()
    .min(3, "Tipo de evento deve ter no mínimo 3 caracteres"),
  description: z.string().optional(),
  notificationType: z.enum(["SYSTEM", "PRODUCTION", "STOCK", "USER", "GENERAL"]),
  importance: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]),
  enabled: z.boolean(),
  workHoursOnly: z.boolean(),
  batchingEnabled: z.boolean(),
  maxFrequencyPerDay: z.preprocess(
    (val) => {
      if (val === "" || val === null || val === undefined) return null;
      const num = Number(val);
      return isNaN(num) ? null : num;
    },
    z.number().min(0).nullable().optional()
  ),
  deduplicationWindow: z.preprocess(
    (val) => {
      if (val === "" || val === null || val === undefined) return null;
      const num = Number(val);
      return isNaN(num) ? null : num;
    },
    z.number().min(0).nullable().optional()
  ),
  channels: z.array(channelConfigSchema),
  targetRules: z.object({
    allowedSectors: z.array(z.string()),
    excludeInactive: z.boolean(),
    excludeOnVacation: z.boolean(),
  }),
});

type ConfigurationFormData = z.infer<typeof configurationSchema>;

// =====================
// Constants
// =====================

const NOTIFICATION_TYPES = [
  { value: "SYSTEM", label: "Sistema" },
  { value: "PRODUCTION", label: "Produção" },
  { value: "STOCK", label: "Estoque" },
  { value: "USER", label: "Usuário" },
  { value: "GENERAL", label: "Geral" },
];

const IMPORTANCE_OPTIONS = [
  { value: "LOW", label: "Baixa" },
  { value: "NORMAL", label: "Normal" },
  { value: "HIGH", label: "Alta" },
  { value: "URGENT", label: "Urgente" },
];

const CHANNEL_CONFIG = {
  IN_APP: {
    label: "No App",
    icon: IconBell,
    color: "#f97316",
    bgClass: "bg-orange-50 dark:bg-orange-950",
    borderClass: "border-orange-200 dark:border-orange-800",
    textClass: "text-orange-600 dark:text-orange-400",
  },
  PUSH: {
    label: "Push",
    icon: IconDeviceMobile,
    color: "#3b82f6",
    bgClass: "bg-blue-50 dark:bg-blue-950",
    borderClass: "border-blue-200 dark:border-blue-800",
    textClass: "text-blue-600 dark:text-blue-400",
  },
  EMAIL: {
    label: "E-mail",
    icon: IconMail,
    color: "#a855f7",
    bgClass: "bg-purple-50 dark:bg-purple-950",
    borderClass: "border-purple-200 dark:border-purple-800",
    textClass: "text-purple-600 dark:text-purple-400",
  },
  WHATSAPP: {
    label: "WhatsApp",
    icon: IconBrandWhatsapp,
    color: "#22c55e",
    bgClass: "bg-green-50 dark:bg-green-950",
    borderClass: "border-green-200 dark:border-green-800",
    textClass: "text-green-600 dark:text-green-400",
  },
};

const SECTOR_OPTIONS = [
  { value: "ADMIN", label: "Administração" },
  { value: "PRODUCTION", label: "Produção" },
  { value: "WAREHOUSE", label: "Almoxarifado" },
  { value: "FINANCIAL", label: "Financeiro" },
  { value: "COMMERCIAL", label: "Comercial" },
  { value: "LOGISTIC", label: "Logística" },
  { value: "DESIGNER", label: "Design" },
  { value: "HUMAN_RESOURCES", label: "RH" },
  { value: "PLOTTING", label: "Plotagem" },
  { value: "MAINTENANCE", label: "Manutenção" },
  { value: "BASIC", label: "Básico" },
  { value: "EXTERNAL", label: "Externo" },
];

const ALL_CHANNELS = ["IN_APP", "PUSH", "EMAIL", "WHATSAPP"] as const;

// =====================
// Channel Config Card Component
// =====================

interface ChannelConfigCardProps {
  channel: keyof typeof CHANNEL_CONFIG;
  value: {
    enabled: boolean;
    mandatory: boolean;
    defaultOn: boolean;
  };
  onChange: (value: { enabled: boolean; mandatory: boolean; defaultOn: boolean }) => void;
}

function ChannelConfigCard({ channel, value, onChange }: ChannelConfigCardProps) {
  const config = CHANNEL_CONFIG[channel];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "p-4 rounded-lg border-2 transition-colors",
        value.enabled ? [config.bgClass, config.borderClass] : "bg-muted/50 border-muted"
      )}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Icon className={cn("w-5 h-5", value.enabled ? config.textClass : "text-muted-foreground")} />
          <span className="font-medium">{config.label}</span>
        </div>
        <Switch
          checked={value.enabled}
          onCheckedChange={(enabled) =>
            onChange(enabled ? { ...value, enabled } : { enabled: false, mandatory: false, defaultOn: false })
          }
        />
      </div>

      {value.enabled && (
        <div className="space-y-3 pt-2 border-t border-border/50">
          <label className="flex items-center justify-between cursor-pointer">
            <div className="flex items-center gap-2">
              <IconLock className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm">Obrigatório</span>
            </div>
            <Checkbox
              checked={value.mandatory}
              onCheckedChange={(mandatory) =>
                onChange({ ...value, mandatory: mandatory as boolean })
              }
            />
          </label>
          <label className="flex items-center justify-between cursor-pointer">
            <div className="flex items-center gap-2">
              <IconCheck className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm">Ativo por padrão</span>
            </div>
            <Checkbox
              checked={value.defaultOn}
              onCheckedChange={(defaultOn) =>
                onChange({ ...value, defaultOn: defaultOn as boolean })
              }
            />
          </label>
        </div>
      )}
    </div>
  );
}

// =====================
// Loading Skeleton
// =====================

function LoadingSkeleton() {
  return (
    <div className="container mx-auto max-w-5xl space-y-4">
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
          <Skeleton className="h-20 w-full" />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// =====================
// Main Component
// =====================

export function NotificationConfigurationEditPage() {
  const { key } = useParams<{ key: string }>();
  const navigate = useNavigate();
  const [isSaving, setIsSaving] = useState(false);

  // Validate key is not a route parameter placeholder
  const isValidKey = key && !key.startsWith(":");

  const { data: response, isLoading, error } = useNotificationConfiguration(isValidKey ? key : "", {
    enabled: isValidKey,
  });
  const { update: updateMutation } = useNotificationConfigurationMutations();

  const config = response?.data;
  const initializedForKey = useRef<string | null>(null);

  const form = useForm<ConfigurationFormData>({
    resolver: zodResolver(configurationSchema),
    defaultValues: {
      key: "",
      name: "",
      eventType: "",
      description: "",
      notificationType: "GENERAL",
      importance: "NORMAL",
      enabled: true,
      workHoursOnly: false,
      batchingEnabled: false,
      maxFrequencyPerDay: null,
      deduplicationWindow: null,
      channels: ALL_CHANNELS.map((ch) => ({
        channel: ch,
        enabled: false,
        mandatory: false,
        defaultOn: false,
      })),
      targetRules: {
        allowedSectors: [],
        excludeInactive: true,
        excludeOnVacation: false,
      },
    },
  });

  // Load config data into form only once per config key
  useEffect(() => {
    if (config && initializedForKey.current !== config.key) {
      initializedForKey.current = config.key;

      // Map existing channel configs
      const channelMap = new Map(config.channelConfigs?.map((ch) => [ch.channel, ch]) || []);

      form.reset({
        key: config.key,
        name: config.name || "",
        eventType: config.eventType,
        description: config.description || "",
        notificationType: config.notificationType as any,
        importance: config.importance as any,
        enabled: config.enabled,
        workHoursOnly: config.workHoursOnly,
        batchingEnabled: config.batchingEnabled,
        maxFrequencyPerDay: config.maxFrequencyPerDay ?? null,
        deduplicationWindow: config.deduplicationWindow ?? null,
        channels: ALL_CHANNELS.map((ch) => {
          const existing = channelMap.get(ch);
          return {
            channel: ch,
            enabled: existing?.enabled ?? false,
            mandatory: existing?.mandatory ?? false,
            defaultOn: existing?.defaultOn ?? false,
          };
        }),
        targetRules: {
          allowedSectors: config.targetRule?.allowedSectors || [],
          excludeInactive: config.targetRule?.excludeInactive ?? true,
          excludeOnVacation: config.targetRule?.excludeOnVacation ?? false,
        },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  const onSubmit = async (data: ConfigurationFormData) => {
    if (!config?.id) return;

    try {
      setIsSaving(true);

      // 1. Update all channel configurations first (before main update invalidates cache)
      await Promise.all(
        data.channels.map((ch) =>
          notificationConfigurationService.updateChannelConfig(
            config.id,
            ch.channel as NOTIFICATION_CHANNEL,
            {
              enabled: ch.enabled,
              mandatory: ch.enabled ? ch.mandatory : false,
              defaultOn: ch.enabled ? ch.defaultOn : false,
            }
          )
        )
      );

      // 2. Update base configuration + target rules (mutation handles toast + cache invalidation)
      const payload = {
        name: data.name,
        eventType: data.eventType,
        description: data.description || undefined,
        notificationType: data.notificationType as any,
        importance: data.importance as any,
        enabled: data.enabled,
        workHoursOnly: data.workHoursOnly,
        batchingEnabled: data.batchingEnabled,
        maxFrequencyPerDay: data.maxFrequencyPerDay ?? undefined,
        deduplicationWindow: data.deduplicationWindow ?? undefined,
        targetRule: {
          allowedSectors: data.targetRules.allowedSectors,
          excludeInactive: data.targetRules.excludeInactive,
          excludeOnVacation: data.targetRules.excludeOnVacation,
        },
      };

      await updateMutation.mutateAsync({ id: config.id, data: payload });

      navigate(routes.administration.notifications.configurations.details(data.key));
    } catch (error) {
      // Error handled by mutation
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (key) {
      navigate(routes.administration.notifications.configurations.details(key));
    } else {
      navigate(routes.administration.notifications.configurations.root);
    }
  };

  const handleSubmit = () => {
    form.handleSubmit(onSubmit)();
  };

  if (isLoading) {
    return (
      <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.ADMIN}>
        <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4 pb-6">
          <div className="container mx-auto max-w-5xl">
            <PageHeader
              title="Carregando..."
              breadcrumbs={[
                { label: "Início", href: "/" },
                { label: "Notificações", href: routes.administration.notifications.root },
                { label: "Configurações", href: routes.administration.notifications.configurations.root },
                { label: "Editar" },
              ]}
            />
          </div>
          <LoadingSkeleton />
        </div>
      </PrivilegeRoute>
    );
  }

  if (!isValidKey || error || !config) {
    return (
      <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.ADMIN}>
        <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4 pb-6">
          <div className="container mx-auto max-w-5xl">
            <PageHeader
              title="Configuração não encontrada"
              breadcrumbs={[
                { label: "Início", href: "/" },
                { label: "Notificações", href: routes.administration.notifications.root },
                { label: "Configurações", href: routes.administration.notifications.configurations.root },
                { label: "Editar" },
              ]}
            />
          </div>
          <div className="container mx-auto max-w-5xl">
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
        </div>
      </PrivilegeRoute>
    );
  }

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.ADMIN}>
      <FormProvider {...form}>
        <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
          <div className="container mx-auto max-w-5xl flex-shrink-0">
            <PageHeader
              title={`Editar: ${config.name || config.key}`}
              icon={IconSettings}
              breadcrumbs={[
                { label: "Início", href: "/" },
                { label: "Administração", href: "/administracao" },
                { label: "Notificações", href: routes.administration.notifications.root },
                { label: "Configurações", href: routes.administration.notifications.configurations.root },
                { label: config.name || config.key, href: routes.administration.notifications.configurations.details(config.key) },
                { label: "Editar" },
              ]}
              variant="form"
              actions={[
                {
                  key: "cancel",
                  label: "Cancelar",
                  icon: IconX,
                  onClick: handleCancel,
                  variant: "outline",
                  disabled: isSaving,
                },
                {
                  key: "submit",
                  label: "Salvar",
                  icon: IconCheck,
                  onClick: handleSubmit,
                  variant: "default",
                  disabled: isSaving,
                  loading: isSaving,
                },
              ]}
            />
          </div>

          <div className="flex-1 overflow-y-auto pb-6">
            <div className="container mx-auto max-w-5xl space-y-4">
              {/* Basic Information */}
              <Card>
                <CardHeader>
                  <CardTitle>Informações Básicas</CardTitle>
                  <CardDescription>
                    Edite os dados principais da configuração de notificação
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="key">
                        Chave <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="key"
                        placeholder="Ex: service_order.completed"
                        transparent
                        {...form.register("key")}
                      />
                      {form.formState.errors.key && (
                        <p className="text-sm text-destructive">{form.formState.errors.key.message}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Identificador único para esta configuração
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="name">
                        Nome <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="name"
                        placeholder="Ex: Ordem de Serviço Concluída"
                        transparent
                        {...form.register("name")}
                      />
                      {form.formState.errors.name && (
                        <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Nome amigável exibido aos usuários
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="eventType">
                      Tipo de Evento <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="eventType"
                      placeholder="Ex: task.created"
                      transparent
                      {...form.register("eventType")}
                    />
                    {form.formState.errors.eventType && (
                      <p className="text-sm text-destructive">{form.formState.errors.eventType.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Descrição</Label>
                    <Textarea
                      id="description"
                      rows={2}
                      placeholder="Descreva quando esta notificação é enviada..."
                      {...form.register("description")}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormCombobox
                      name="notificationType"
                      label="Tipo de Notificação"
                      required
                      placeholder="Selecione o tipo"
                      options={NOTIFICATION_TYPES}
                      searchable={false}
                    />

                    <FormCombobox
                      name="importance"
                      label="Importância"
                      required
                      placeholder="Selecione a importância"
                      options={IMPORTANCE_OPTIONS}
                      searchable={false}
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <div className="space-y-0.5">
                      <Label>Habilitado</Label>
                      <p className="text-sm text-muted-foreground">
                        Se desabilitado, nenhuma notificação será enviada
                      </p>
                    </div>
                    <Controller
                      name="enabled"
                      control={form.control}
                      render={({ field }) => (
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Channel Configurations - Read Only Notice */}
              <Card>
                <CardHeader>
                  <CardTitle>Configuração de Canais</CardTitle>
                  <CardDescription>
                    Canais de entrega e suas configurações
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {(["IN_APP", "PUSH", "EMAIL", "WHATSAPP"] as const).map((channel, index) => (
                      <Controller
                        key={channel}
                        name={`channels.${index}`}
                        control={form.control}
                        render={({ field }) => (
                          <ChannelConfigCard
                            channel={channel}
                            value={{
                              enabled: field.value?.enabled ?? false,
                              mandatory: field.value?.mandatory ?? false,
                              defaultOn: field.value?.defaultOn ?? false,
                            }}
                            onChange={(value) =>
                              field.onChange({ channel, ...value })
                            }
                          />
                        )}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Target Rules */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <IconUsers className="w-5 h-5" />
                    Regras de Destinatário
                  </CardTitle>
                  <CardDescription>
                    Defina quem pode receber esta notificação
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormCombobox
                    name="targetRules.allowedSectors"
                    label="Setores Permitidos"
                    placeholder="Todos os setores (deixe vazio para permitir todos)"
                    options={SECTOR_OPTIONS}
                    multiple
                    searchable
                    emptyText="Nenhum setor encontrado"
                  />
                  <p className="text-xs text-muted-foreground">
                    Se nenhum setor for selecionado, a notificação estará disponível para todos os setores.
                  </p>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Excluir usuários inativos</Label>
                      <p className="text-sm text-muted-foreground">
                        Não enviar para usuários desativados
                      </p>
                    </div>
                    <Controller
                      name="targetRules.excludeInactive"
                      control={form.control}
                      render={({ field }) => (
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      )}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Excluir usuários de férias</Label>
                      <p className="text-sm text-muted-foreground">
                        Não enviar para usuários em período de férias
                      </p>
                    </div>
                    <Controller
                      name="targetRules.excludeOnVacation"
                      control={form.control}
                      render={({ field }) => (
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Business Rules */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <IconClock className="w-5 h-5" />
                    Regras de Negócio
                  </CardTitle>
                  <CardDescription>
                    Defina limitações de envio e comportamento
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Apenas em horário comercial</Label>
                      <p className="text-sm text-muted-foreground">
                        Enviar somente durante horário de trabalho
                      </p>
                    </div>
                    <Controller
                      name="workHoursOnly"
                      control={form.control}
                      render={({ field }) => (
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      )}
                    />
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Agrupamento habilitado</Label>
                      <p className="text-sm text-muted-foreground">
                        Agrupar notificações similares em uma única mensagem
                      </p>
                    </div>
                    <Controller
                      name="batchingEnabled"
                      control={form.control}
                      render={({ field }) => (
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      )}
                    />
                  </div>

                  <Separator />

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="maxFrequencyPerDay">Frequência máxima por dia</Label>
                      <Input
                        id="maxFrequencyPerDay"
                        type="number"
                        min={0}
                        placeholder="Sem limite"
                        transparent
                        {...form.register("maxFrequencyPerDay", {
                          setValueAs: (v) => (v === "" || v == null ? null : parseInt(v, 10)),
                        })}
                      />
                      {form.formState.errors.maxFrequencyPerDay && (
                        <p className="text-sm text-destructive">{form.formState.errors.maxFrequencyPerDay.message}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Deixe vazio para sem limite
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="deduplicationWindow">Janela de deduplicação (min)</Label>
                      <Input
                        id="deduplicationWindow"
                        type="number"
                        min={0}
                        placeholder="Desabilitada"
                        transparent
                        {...form.register("deduplicationWindow", {
                          setValueAs: (v) => (v === "" || v == null ? null : parseInt(v, 10)),
                        })}
                      />
                      {form.formState.errors.deduplicationWindow && (
                        <p className="text-sm text-destructive">{form.formState.errors.deduplicationWindow.message}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Tempo em minutos para ignorar notificações duplicadas
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </FormProvider>
    </PrivilegeRoute>
  );
}

export default NotificationConfigurationEditPage;
