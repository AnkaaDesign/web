import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
  ShoppingCart,
  ClipboardList,
  Save,
} from "lucide-react";
import { getProfile } from "@/api-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { routes } from "@/constants";
import { DETAIL_PAGE_SPACING } from "@/lib/layout-constants";
import { cn } from "@/lib/utils";
import { useNotificationPreferences, useUpdatePreference, useResetPreferences } from "@/hooks/useNotificationPreferences";
import type { UserNotificationPreference } from "@/types";

// =====================
// Types and Schemas
// =====================

type NotificationChannel = "IN_APP" | "EMAIL" | "PUSH" | "WHATSAPP";

interface NotificationEventPreference {
  channels: NotificationChannel[];
  mandatory: boolean;
}

interface NotificationPreferences {
  task: {
    status: NotificationEventPreference;
    artwork: NotificationEventPreference;
    deadline: NotificationEventPreference;
    assignment: NotificationEventPreference;
    comment: NotificationEventPreference;
    priority: NotificationEventPreference;
    description: NotificationEventPreference;
    customer: NotificationEventPreference;
    sector: NotificationEventPreference;
    completion: NotificationEventPreference;
  };
  order: {
    created: NotificationEventPreference;
    status: NotificationEventPreference;
    fulfilled: NotificationEventPreference;
    cancelled: NotificationEventPreference;
    overdue: NotificationEventPreference;
  };
  stock: {
    low: NotificationEventPreference;
    out: NotificationEventPreference;
    restock: NotificationEventPreference;
  };
}

const notificationPreferencesSchema = z.object({
  task: z.object({
    status: z.object({
      channels: z.array(z.enum(["IN_APP", "EMAIL", "PUSH", "WHATSAPP"])),
      mandatory: z.boolean(),
    }),
    artwork: z.object({
      channels: z.array(z.enum(["IN_APP", "EMAIL", "PUSH", "WHATSAPP"])),
      mandatory: z.boolean(),
    }),
    deadline: z.object({
      channels: z.array(z.enum(["IN_APP", "EMAIL", "PUSH", "WHATSAPP"])),
      mandatory: z.boolean(),
    }),
    assignment: z.object({
      channels: z.array(z.enum(["IN_APP", "EMAIL", "PUSH", "WHATSAPP"])),
      mandatory: z.boolean(),
    }),
    comment: z.object({
      channels: z.array(z.enum(["IN_APP", "EMAIL", "PUSH", "WHATSAPP"])),
      mandatory: z.boolean(),
    }),
  }),
  order: z.object({
    created: z.object({
      channels: z.array(z.enum(["IN_APP", "EMAIL", "PUSH", "WHATSAPP"])),
      mandatory: z.boolean(),
    }),
    statusChange: z.object({
      channels: z.array(z.enum(["IN_APP", "EMAIL", "PUSH", "WHATSAPP"])),
      mandatory: z.boolean(),
    }),
    delivered: z.object({
      channels: z.array(z.enum(["IN_APP", "EMAIL", "PUSH", "WHATSAPP"])),
      mandatory: z.boolean(),
    }),
    cancelled: z.object({
      channels: z.array(z.enum(["IN_APP", "EMAIL", "PUSH", "WHATSAPP"])),
      mandatory: z.boolean(),
    }),
  }),
  stock: z.object({
    lowStock: z.object({
      channels: z.array(z.enum(["IN_APP", "EMAIL", "PUSH", "WHATSAPP"])),
      mandatory: z.boolean(),
    }),
    outOfStock: z.object({
      channels: z.array(z.enum(["IN_APP", "EMAIL", "PUSH", "WHATSAPP"])),
      mandatory: z.boolean(),
    }),
    reorderNeeded: z.object({
      channels: z.array(z.enum(["IN_APP", "EMAIL", "PUSH", "WHATSAPP"])),
      mandatory: z.boolean(),
    }),
  }),
});

type NotificationPreferencesFormData = z.infer<typeof notificationPreferencesSchema>;

// =====================
// Helper Functions
// =====================

/**
 * Transform API preferences to form data structure
 */
const transformApiToForm = (apiPreferences: UserNotificationPreference[]): Partial<NotificationPreferencesFormData> => {
  const grouped: Record<string, Record<string, UserNotificationPreference>> = {};

  apiPreferences.forEach((pref) => {
    const type = pref.notificationType.toLowerCase();
    const eventType = pref.eventType || "general";

    if (!grouped[type]) {
      grouped[type] = {};
    }

    grouped[type][eventType] = pref;
  });

  const result: any = {
    task: {},
    order: {},
    stock: {},
  };

  // Map task preferences
  const taskEvents = ["status", "artwork", "deadline", "assignment", "comment", "priority", "description", "customer", "sector", "completion"];
  taskEvents.forEach(event => {
    if (grouped.task?.[event]) {
      result.task[event] = {
        channels: grouped.task[event].channels as NotificationChannel[],
        mandatory: grouped.task[event].isMandatory,
      };
    }
  });

  // Map order preferences
  const orderEvents = ["created", "status", "fulfilled", "cancelled", "overdue"];
  orderEvents.forEach(event => {
    if (grouped.order?.[event]) {
      result.order[event] = {
        channels: grouped.order[event].channels as NotificationChannel[],
        mandatory: grouped.order[event].isMandatory,
      };
    }
  });

  // Map stock preferences
  const stockEvents = ["low", "out", "restock"];
  stockEvents.forEach(event => {
    if (grouped.stock?.[event]) {
      result.stock[event] = {
        channels: grouped.stock[event].channels as NotificationChannel[],
        mandatory: grouped.stock[event].isMandatory,
      };
    }
  });

  return result;
};

// =====================
// Channel Metadata
// =====================

const channelMetadata: Record<NotificationChannel, { icon: typeof Smartphone; label: string; color: string }> = {
  PUSH: { icon: Smartphone, label: "Push Móvel", color: "text-blue-500" },
  EMAIL: { icon: Mail, label: "E-mail", color: "text-purple-500" },
  WHATSAPP: { icon: MessageCircle, label: "WhatsApp", color: "text-green-500" },
  IN_APP: { icon: BellDot, label: "In-App", color: "text-orange-500" },
};

// =====================
// PreferenceRow Component
// =====================

interface PreferenceRowProps {
  label: string;
  description: string;
  channels: NotificationChannel[];
  selectedChannels: NotificationChannel[];
  onChange: (channels: NotificationChannel[]) => void;
  mandatory: boolean;
  disabled: boolean;
}

function PreferenceRow({
  label,
  description,
  channels,
  selectedChannels,
  onChange,
  mandatory,
  disabled,
}: PreferenceRowProps) {
  const handleChannelToggle = (channel: NotificationChannel) => {
    if (disabled) return;

    const newChannels = selectedChannels.includes(channel)
      ? selectedChannels.filter((c) => c !== channel)
      : [...selectedChannels, channel];

    // Validate at least one channel is selected
    if (newChannels.length === 0) {
      toast.error("Pelo menos um canal deve estar selecionado");
      return;
    }

    onChange(newChannels);
  };

  return (
    <div className="flex items-start justify-between py-4 gap-4">
      <div className="flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
            {label}
          </label>
          {mandatory && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Esta notificação é obrigatória e não pode ser desativada</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="flex items-center gap-3">
        {channels.map((channel) => {
          const metadata = channelMetadata[channel];
          const Icon = metadata.icon;
          const isSelected = selectedChannels.includes(channel);

          return (
            <TooltipProvider key={channel}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => handleChannelToggle(channel)}
                    disabled={disabled}
                    className={cn(
                      "p-2 rounded-md border transition-all",
                      isSelected
                        ? "border-primary bg-primary/10"
                        : "border-border bg-transparent hover:bg-muted",
                      disabled && "opacity-50 cursor-not-allowed"
                    )}
                    aria-label={`${metadata.label} - ${isSelected ? "Ativado" : "Desativado"}`}
                  >
                    <Icon className={cn("h-4 w-4", isSelected ? metadata.color : "text-muted-foreground")} />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{metadata.label}</p>
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
// Section Component
// =====================

interface SectionProps {
  title: string;
  icon: typeof Package;
  children: React.ReactNode;
}

function Section({ title, icon: Icon, children }: SectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className="h-5 w-5" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="divide-y">{children}</div>
      </CardContent>
    </Card>
  );
}

// =====================
// Default Preferences
// =====================

const defaultPreferences: NotificationPreferencesFormData = {
  task: {
    status: {
      channels: ["IN_APP", "EMAIL"],
      mandatory: true,
    },
    artwork: {
      channels: ["IN_APP"],
      mandatory: false,
    },
    deadline: {
      channels: ["IN_APP", "EMAIL", "PUSH"],
      mandatory: true,
    },
    assignment: {
      channels: ["IN_APP", "EMAIL"],
      mandatory: true,
    },
    comment: {
      channels: ["IN_APP"],
      mandatory: false,
    },
  },
  order: {
    created: {
      channels: ["IN_APP"],
      mandatory: false,
    },
    statusChange: {
      channels: ["IN_APP", "EMAIL"],
      mandatory: false,
    },
    delivered: {
      channels: ["IN_APP"],
      mandatory: false,
    },
    cancelled: {
      channels: ["IN_APP", "EMAIL"],
      mandatory: false,
    },
  },
  stock: {
    lowStock: {
      channels: ["IN_APP"],
      mandatory: false,
    },
    outOfStock: {
      channels: ["IN_APP", "EMAIL"],
      mandatory: false,
    },
    reorderNeeded: {
      channels: ["IN_APP"],
      mandatory: false,
    },
  },
};

// =====================
// Main Component
// =====================

export function NotificationPreferencesPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const form = useForm<NotificationPreferencesFormData>({
    resolver: zodResolver(notificationPreferencesSchema),
    defaultValues: defaultPreferences,
  });

  // Load user profile and preferences
  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      setIsLoading(true);
      const response = await getProfile();

      if (response.success && response.data) {
        setUserId(response.data.id);

        // TODO: Load actual preferences from API when available
        // For now, use default preferences
        form.reset(defaultPreferences);
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Erro ao carregar preferências");
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmit = async (data: NotificationPreferencesFormData) => {
    if (!userId) {
      toast.error("Usuário não encontrado");
      return;
    }

    try {
      setIsSaving(true);

      // TODO: Implement API call to save preferences
      // await updateNotificationPreferences(userId, data);

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));

      toast.success("Preferências salvas com sucesso!");
    } catch (error: any) {
      toast.error("Erro ao salvar preferências");
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error saving preferences:", error);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = () => {
    form.handleSubmit(onSubmit)();
  };

  const handleReset = () => {
    form.reset(defaultPreferences);
    toast.success("Preferências restauradas para o padrão");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-full", DETAIL_PAGE_SPACING.CONTAINER)}>
      <div className="flex-shrink-0">
        <PageHeader
          title="Notificações"
          subtitle={
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">Escolha como você quer ser notificado</p>
              <p className="text-sm text-muted-foreground">
                Configure os canais de notificação para cada tipo de evento. Algumas notificações são obrigatórias para garantir
                que você não perca informações importantes.
              </p>
            </div>
          }
          icon={Bell}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Meu Perfil", href: routes.profile },
            { label: "Notificações" }
          ]}
          actions={[
            {
              key: "reset",
              label: "Restaurar Padrão",
              icon: RotateCcw,
              onClick: handleReset,
              variant: "outline",
              disabled: isSaving || !form.formState.isDirty,
            },
            {
              key: "save",
              label: "Salvar Preferências",
              icon: Save,
              onClick: handleSave,
              variant: "default",
              disabled: isSaving || !form.formState.isDirty,
              loading: isSaving,
            }
          ]}
        />
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        <div className="space-y-6 pb-8">

          {/* Task Notifications */}
          <Section title="Notificações de Tarefas" icon={ClipboardList}>
            <PreferenceRow
              label="Mudanças de Status"
              description="Quando o status de uma tarefa é atualizado"
              channels={["IN_APP", "EMAIL", "PUSH", "WHATSAPP"]}
              selectedChannels={form.watch("task.status.channels")}
              onChange={(channels) => form.setValue("task.status.channels", channels, { shouldDirty: true })}
              mandatory={form.watch("task.status.mandatory")}
              disabled={form.watch("task.status.mandatory")}
            />
            <PreferenceRow
              label="Atualizações de Arte"
              description="Quando arquivos de arte são adicionados ou modificados"
              channels={["IN_APP", "EMAIL", "PUSH", "WHATSAPP"]}
              selectedChannels={form.watch("task.artwork.channels")}
              onChange={(channels) => form.setValue("task.artwork.channels", channels, { shouldDirty: true })}
              mandatory={form.watch("task.artwork.mandatory")}
              disabled={form.watch("task.artwork.mandatory")}
            />
            <PreferenceRow
              label="Prazos Próximos"
              description="Quando uma tarefa está próxima do prazo de entrega"
              channels={["IN_APP", "EMAIL", "PUSH", "WHATSAPP"]}
              selectedChannels={form.watch("task.deadline.channels")}
              onChange={(channels) => form.setValue("task.deadline.channels", channels, { shouldDirty: true })}
              mandatory={form.watch("task.deadline.mandatory")}
              disabled={form.watch("task.deadline.mandatory")}
            />
            <PreferenceRow
              label="Atribuição de Tarefas"
              description="Quando uma tarefa é atribuída a você"
              channels={["IN_APP", "EMAIL", "PUSH", "WHATSAPP"]}
              selectedChannels={form.watch("task.assignment.channels")}
              onChange={(channels) => form.setValue("task.assignment.channels", channels, { shouldDirty: true })}
              mandatory={form.watch("task.assignment.mandatory")}
              disabled={form.watch("task.assignment.mandatory")}
            />
            <PreferenceRow
              label="Comentários"
              description="Quando alguém comenta em uma tarefa que você segue"
              channels={["IN_APP", "EMAIL", "PUSH", "WHATSAPP"]}
              selectedChannels={form.watch("task.comment.channels")}
              onChange={(channels) => form.setValue("task.comment.channels", channels, { shouldDirty: true })}
              mandatory={form.watch("task.comment.mandatory")}
              disabled={form.watch("task.comment.mandatory")}
            />
          </Section>

          {/* Order Notifications */}
          <Section title="Notificações de Pedidos" icon={ShoppingCart}>
            <PreferenceRow
              label="Novos Pedidos"
              description="Quando um novo pedido é criado"
              channels={["IN_APP", "EMAIL", "PUSH"]}
              selectedChannels={form.watch("order.created.channels")}
              onChange={(channels) => form.setValue("order.created.channels", channels, { shouldDirty: true })}
              mandatory={form.watch("order.created.mandatory")}
              disabled={form.watch("order.created.mandatory")}
            />
            <PreferenceRow
              label="Mudanças de Status"
              description="Quando o status de um pedido é alterado"
              channels={["IN_APP", "EMAIL", "PUSH"]}
              selectedChannels={form.watch("order.statusChange.channels")}
              onChange={(channels) => form.setValue("order.statusChange.channels", channels, { shouldDirty: true })}
              mandatory={form.watch("order.statusChange.mandatory")}
              disabled={form.watch("order.statusChange.mandatory")}
            />
            <PreferenceRow
              label="Pedidos Entregues"
              description="Quando um pedido é marcado como entregue"
              channels={["IN_APP", "EMAIL", "PUSH"]}
              selectedChannels={form.watch("order.delivered.channels")}
              onChange={(channels) => form.setValue("order.delivered.channels", channels, { shouldDirty: true })}
              mandatory={form.watch("order.delivered.mandatory")}
              disabled={form.watch("order.delivered.mandatory")}
            />
            <PreferenceRow
              label="Pedidos Cancelados"
              description="Quando um pedido é cancelado"
              channels={["IN_APP", "EMAIL", "PUSH"]}
              selectedChannels={form.watch("order.cancelled.channels")}
              onChange={(channels) => form.setValue("order.cancelled.channels", channels, { shouldDirty: true })}
              mandatory={form.watch("order.cancelled.mandatory")}
              disabled={form.watch("order.cancelled.mandatory")}
            />
          </Section>

          {/* Stock Notifications */}
          <Section title="Notificações de Estoque" icon={Package}>
            <PreferenceRow
              label="Estoque Baixo"
              description="Quando o estoque de um item está abaixo do mínimo"
              channels={["IN_APP", "EMAIL", "PUSH"]}
              selectedChannels={form.watch("stock.lowStock.channels")}
              onChange={(channels) => form.setValue("stock.lowStock.channels", channels, { shouldDirty: true })}
              mandatory={form.watch("stock.lowStock.mandatory")}
              disabled={form.watch("stock.lowStock.mandatory")}
            />
            <PreferenceRow
              label="Estoque Esgotado"
              description="Quando um item fica sem estoque"
              channels={["IN_APP", "EMAIL", "PUSH"]}
              selectedChannels={form.watch("stock.outOfStock.channels")}
              onChange={(channels) => form.setValue("stock.outOfStock.channels", channels, { shouldDirty: true })}
              mandatory={form.watch("stock.outOfStock.mandatory")}
              disabled={form.watch("stock.outOfStock.mandatory")}
            />
            <PreferenceRow
              label="Reabastecimento Necessário"
              description="Quando é necessário fazer um novo pedido de reabastecimento"
              channels={["IN_APP", "EMAIL", "PUSH"]}
              selectedChannels={form.watch("stock.reorderNeeded.channels")}
              onChange={(channels) => form.setValue("stock.reorderNeeded.channels", channels, { shouldDirty: true })}
              mandatory={form.watch("stock.reorderNeeded.mandatory")}
              disabled={form.watch("stock.reorderNeeded.mandatory")}
            />
          </Section>

          {/* Channel Legend */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Canais de Notificação</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {(Object.entries(channelMetadata) as [NotificationChannel, typeof channelMetadata[NotificationChannel]][]).map(([channel, metadata]) => {
                  const Icon = metadata.icon;
                  return (
                    <div key={channel} className="flex items-center gap-2">
                      <Icon className={cn("h-4 w-4", metadata.color)} />
                      <span className="text-sm">{metadata.label}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
