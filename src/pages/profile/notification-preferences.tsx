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
  RotateCcw,
  Shield,
  Calendar,
} from "lucide-react";
import { getProfile, notificationPreferenceService } from "@/api-client";
import type { UserNotificationPreference } from "@/types";
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
// Types and Schemas
// =====================

type NotificationChannel = "IN_APP" | "EMAIL" | "PUSH" | "WHATSAPP";

const ALL_CHANNELS: NotificationChannel[] = ["IN_APP", "EMAIL", "PUSH", "WHATSAPP"];

interface NotificationEventPreference {
  channels: NotificationChannel[];
  mandatoryChannels: NotificationChannel[];
}

interface NotificationPreferences {
  task: {
    // Lifecycle
    created: NotificationEventPreference;
    status: NotificationEventPreference;
    finishedAt: NotificationEventPreference;
    overdue: NotificationEventPreference;
    // Dates
    term: NotificationEventPreference;
    deadline: NotificationEventPreference;
    forecastDate: NotificationEventPreference;
    // Basic info
    details: NotificationEventPreference;
    serialNumber: NotificationEventPreference;
    // Assignment
    sector: NotificationEventPreference;
    // Artwork
    artworks: NotificationEventPreference;
    // Negotiation
    negotiatingWith: NotificationEventPreference;
    // Production
    paint: NotificationEventPreference;
    observation: NotificationEventPreference;
    // Financial
    commission: NotificationEventPreference;
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
  system: {
    maintenance: NotificationEventPreference;
    update: NotificationEventPreference;
    security: NotificationEventPreference;
  };
  vacation: {
    requested: NotificationEventPreference;
    approved: NotificationEventPreference;
    rejected: NotificationEventPreference;
    reminder: NotificationEventPreference;
  };
}

const channelSchema = z.object({
  channels: z.array(z.enum(["IN_APP", "EMAIL", "PUSH", "WHATSAPP"])),
  mandatoryChannels: z.array(z.enum(["IN_APP", "EMAIL", "PUSH", "WHATSAPP"])),
});

const notificationPreferencesSchema = z.object({
  task: z.object({
    // Lifecycle
    created: channelSchema,
    status: channelSchema,
    finishedAt: channelSchema,
    overdue: channelSchema,
    // Dates
    term: channelSchema,
    deadline: channelSchema,
    forecastDate: channelSchema,
    // Basic info
    details: channelSchema,
    serialNumber: channelSchema,
    // Assignment
    sector: channelSchema,
    // Artwork
    artworks: channelSchema,
    // Negotiation
    negotiatingWith: channelSchema,
    // Production
    paint: channelSchema,
    observation: channelSchema,
    // Financial
    commission: channelSchema,
  }),
  order: z.object({
    created: channelSchema,
    status: channelSchema,
    fulfilled: channelSchema,
    cancelled: channelSchema,
    overdue: channelSchema,
  }),
  stock: z.object({
    low: channelSchema,
    out: channelSchema,
    restock: channelSchema,
  }),
  system: z.object({
    maintenance: channelSchema,
    update: channelSchema,
    security: channelSchema,
  }),
  vacation: z.object({
    requested: channelSchema,
    approved: channelSchema,
    rejected: channelSchema,
    reminder: channelSchema,
  }),
});

type NotificationPreferencesFormData = z.infer<typeof notificationPreferencesSchema>;

// =====================
// Channel Metadata
// =====================

const channelMetadata: Record<NotificationChannel, { icon: typeof Smartphone; label: string; color: string; bgColor: string }> = {
  IN_APP: { icon: BellDot, label: "In-App", color: "text-orange-500", bgColor: "bg-orange-500/10" },
  EMAIL: { icon: Mail, label: "E-mail", color: "text-purple-500", bgColor: "bg-purple-500/10" },
  PUSH: { icon: Smartphone, label: "Push", color: "text-blue-500", bgColor: "bg-blue-500/10" },
  WHATSAPP: { icon: MessageCircle, label: "WhatsApp", color: "text-green-500", bgColor: "bg-green-500/10" },
};

// =====================
// PreferenceRow Component
// =====================

interface PreferenceRowProps {
  label: string;
  description: string;
  selectedChannels: NotificationChannel[];
  onChange: (channels: NotificationChannel[]) => void;
  mandatoryChannels: NotificationChannel[];
  disabled?: boolean;
}

function PreferenceRow({
  label,
  description,
  selectedChannels,
  onChange,
  mandatoryChannels,
  disabled = false,
}: PreferenceRowProps) {
  const handleChannelToggle = (channel: NotificationChannel) => {
    if (disabled) return;

    // Check if channel is mandatory - cannot be disabled
    if (mandatoryChannels.includes(channel)) {
      toast.error("Este canal é obrigatório e não pode ser desativado");
      return;
    }

    const newChannels = selectedChannels.includes(channel)
      ? selectedChannels.filter((c) => c !== channel)
      : [...selectedChannels, channel];

    if (newChannels.length === 0) {
      toast.error("Pelo menos um canal deve estar selecionado");
      return;
    }

    onChange(newChannels);
  };

  return (
    <div className="flex items-start justify-between py-3 gap-4 border-b border-border last:border-b-0">
      <div className="flex-1 space-y-0.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{label}</span>
          {mandatoryChannels.length > 0 && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    Canais obrigatórios: {mandatoryChannels.map(ch => channelMetadata[ch].label).join(", ")}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="flex items-center gap-2">
        {ALL_CHANNELS.map((channel) => {
          const metadata = channelMetadata[channel];
          const Icon = metadata.icon;
          const isSelected = selectedChannels.includes(channel);
          const isMandatory = mandatoryChannels.includes(channel);

          return (
            <TooltipProvider key={channel}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => handleChannelToggle(channel)}
                    disabled={disabled || isMandatory}
                    className={cn(
                      "p-2 rounded-md border transition-all",
                      isSelected
                        ? `border-primary ${metadata.bgColor}`
                        : "border-border bg-transparent hover:bg-muted",
                      (disabled || isMandatory) && "opacity-50 cursor-not-allowed"
                    )}
                    aria-label={`${metadata.label} - ${isSelected ? "Ativado" : "Desativado"}${isMandatory ? " (Obrigatório)" : ""}`}
                  >
                    <Icon className={cn("h-4 w-4", isSelected ? metadata.color : "text-muted-foreground")} />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{metadata.label}{isMandatory ? " (Obrigatório)" : ""}</p>
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
// Section Data
// =====================

interface NotificationEvent {
  key: string;
  label: string;
  description: string;
  mandatoryChannels: NotificationChannel[];
}

interface NotificationSection {
  id: string;
  title: string;
  icon: typeof ClipboardList;
  events: NotificationEvent[];
}

const notificationSections: NotificationSection[] = [
  {
    id: "task",
    title: "Tarefas",
    icon: ClipboardList,
    events: [
      // Lifecycle - with mandatory channels
      { key: "created", label: "Nova Tarefa", description: "Quando uma nova tarefa é criada", mandatoryChannels: ["IN_APP", "PUSH", "WHATSAPP"] },
      { key: "status", label: "Mudança de Status", description: "Quando o status de uma tarefa é alterado", mandatoryChannels: ["IN_APP", "PUSH"] },
      { key: "finishedAt", label: "Conclusão", description: "Quando uma tarefa é concluída", mandatoryChannels: ["IN_APP", "PUSH"] },
      { key: "overdue", label: "Tarefa Atrasada", description: "Quando uma tarefa está atrasada", mandatoryChannels: ["IN_APP", "PUSH", "WHATSAPP"] },
      // Dates - with mandatory channels
      { key: "term", label: "Prazo Alterado", description: "Quando o prazo da tarefa é alterado", mandatoryChannels: ["IN_APP", "PUSH", "WHATSAPP"] },
      { key: "deadline", label: "Prazo Próximo", description: "Quando uma tarefa está próxima do prazo", mandatoryChannels: ["IN_APP", "PUSH", "WHATSAPP"] },
      { key: "forecastDate", label: "Data Prevista", description: "Quando a previsão de disponibilidade é alterada", mandatoryChannels: [] },
      // Basic info - optional
      { key: "details", label: "Detalhes Alterados", description: "Quando os detalhes da tarefa são modificados", mandatoryChannels: [] },
      { key: "serialNumber", label: "Número de Série", description: "Quando o número de série é alterado", mandatoryChannels: [] },
      // Assignment - with mandatory channels
      { key: "sector", label: "Setor Alterado", description: "Quando o setor responsável é alterado", mandatoryChannels: ["IN_APP", "PUSH"] },
      // Artwork - with mandatory channels
      { key: "artworks", label: "Atualização de Arte", description: "Quando arquivos de arte são adicionados/removidos", mandatoryChannels: ["IN_APP", "PUSH"] },
      // Negotiation - optional
      { key: "negotiatingWith", label: "Negociação", description: "Quando o contato de negociação é alterado", mandatoryChannels: [] },
      // Production - optional
      { key: "paint", label: "Pintura Geral", description: "Quando a pintura geral é definida/alterada", mandatoryChannels: [] },
      { key: "observation", label: "Observação", description: "Quando observações são adicionadas", mandatoryChannels: [] },
      // Financial - optional
      { key: "commission", label: "Comissão", description: "Quando o status de comissão é alterado", mandatoryChannels: [] },
    ],
  },
  {
    id: "order",
    title: "Pedidos",
    icon: ShoppingCart,
    events: [
      { key: "created", label: "Novo Pedido", description: "Quando um novo pedido é criado", mandatoryChannels: [] },
      { key: "status", label: "Mudança de Status", description: "Quando o status de um pedido é alterado", mandatoryChannels: [] },
      { key: "fulfilled", label: "Pedido Finalizado", description: "Quando um pedido é finalizado/entregue", mandatoryChannels: [] },
      { key: "cancelled", label: "Pedido Cancelado", description: "Quando um pedido é cancelado", mandatoryChannels: [] },
      { key: "overdue", label: "Pedido Atrasado", description: "Quando um pedido está atrasado", mandatoryChannels: [] },
    ],
  },
  {
    id: "stock",
    title: "Estoque",
    icon: Package,
    events: [
      { key: "low", label: "Estoque Baixo", description: "Quando um item está abaixo do mínimo", mandatoryChannels: [] },
      { key: "out", label: "Estoque Esgotado", description: "Quando um item fica sem estoque", mandatoryChannels: [] },
      { key: "restock", label: "Reabastecimento", description: "Quando é necessário reabastecer", mandatoryChannels: [] },
    ],
  },
  {
    id: "system",
    title: "Sistema",
    icon: Shield,
    events: [
      { key: "maintenance", label: "Manutenção", description: "Avisos de manutenção programada", mandatoryChannels: [] },
      { key: "update", label: "Atualizações", description: "Novidades e atualizações do sistema", mandatoryChannels: [] },
      { key: "security", label: "Segurança", description: "Alertas de segurança importantes", mandatoryChannels: [] },
    ],
  },
  {
    id: "vacation",
    title: "Férias",
    icon: Calendar,
    events: [
      { key: "requested", label: "Solicitação", description: "Quando férias são solicitadas", mandatoryChannels: [] },
      { key: "approved", label: "Aprovação", description: "Quando férias são aprovadas", mandatoryChannels: [] },
      { key: "rejected", label: "Rejeição", description: "Quando férias são rejeitadas", mandatoryChannels: [] },
      { key: "reminder", label: "Lembrete", description: "Lembretes sobre férias próximas", mandatoryChannels: [] },
    ],
  },
];

// =====================
// Default Preferences
// =====================

const createDefaultPreference = (
  channels: NotificationChannel[],
  mandatoryChannels: NotificationChannel[] = []
): NotificationEventPreference => ({
  channels,
  mandatoryChannels,
});

const defaultPreferences: NotificationPreferencesFormData = {
  task: {
    // Lifecycle
    created: createDefaultPreference(["IN_APP", "PUSH", "WHATSAPP", "EMAIL"], ["IN_APP", "PUSH", "WHATSAPP"]),
    status: createDefaultPreference(["IN_APP", "PUSH", "EMAIL"], ["IN_APP", "PUSH"]),
    finishedAt: createDefaultPreference(["IN_APP", "PUSH", "EMAIL"], ["IN_APP", "PUSH"]),
    overdue: createDefaultPreference(["IN_APP", "PUSH", "WHATSAPP", "EMAIL"], ["IN_APP", "PUSH", "WHATSAPP"]),
    // Dates
    term: createDefaultPreference(["IN_APP", "PUSH", "WHATSAPP", "EMAIL"], ["IN_APP", "PUSH", "WHATSAPP"]),
    deadline: createDefaultPreference(["IN_APP", "PUSH", "WHATSAPP", "EMAIL"], ["IN_APP", "PUSH", "WHATSAPP"]),
    forecastDate: createDefaultPreference(["IN_APP", "EMAIL"], []),
    // Basic info
    details: createDefaultPreference(["IN_APP", "EMAIL"], []),
    serialNumber: createDefaultPreference(["IN_APP", "EMAIL"], []),
    // Assignment
    sector: createDefaultPreference(["IN_APP", "PUSH", "EMAIL"], ["IN_APP", "PUSH"]),
    // Artwork
    artworks: createDefaultPreference(["IN_APP", "PUSH", "EMAIL"], ["IN_APP", "PUSH"]),
    // Negotiation
    negotiatingWith: createDefaultPreference(["IN_APP", "EMAIL"], []),
    // Production
    paint: createDefaultPreference(["IN_APP", "EMAIL"], []),
    observation: createDefaultPreference(["IN_APP", "EMAIL"], []),
    // Financial
    commission: createDefaultPreference(["IN_APP", "EMAIL"], []),
  },
  order: {
    created: createDefaultPreference(["IN_APP"], []),
    status: createDefaultPreference(["IN_APP", "EMAIL"], []),
    fulfilled: createDefaultPreference(["IN_APP", "EMAIL"], []),
    cancelled: createDefaultPreference(["IN_APP", "EMAIL"], []),
    overdue: createDefaultPreference(["IN_APP", "EMAIL", "PUSH"], []),
  },
  stock: {
    low: createDefaultPreference(["IN_APP", "EMAIL"], []),
    out: createDefaultPreference(["IN_APP", "EMAIL"], []),
    restock: createDefaultPreference(["IN_APP"], []),
  },
  system: {
    maintenance: createDefaultPreference(["IN_APP", "EMAIL"], []),
    update: createDefaultPreference(["IN_APP"], []),
    security: createDefaultPreference(["IN_APP", "EMAIL"], []),
  },
  vacation: {
    requested: createDefaultPreference(["IN_APP"], []),
    approved: createDefaultPreference(["IN_APP", "EMAIL", "PUSH"], []),
    rejected: createDefaultPreference(["IN_APP", "EMAIL", "PUSH"], []),
    reminder: createDefaultPreference(["IN_APP", "EMAIL"], []),
  },
};

// =====================
// Main Component
// =====================

export function NotificationPreferencesPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [openAccordions, setOpenAccordions] = useState<string[]>([]);

  const form = useForm<NotificationPreferencesFormData>({
    resolver: zodResolver(notificationPreferencesSchema),
    defaultValues: defaultPreferences,
  });

  useEffect(() => {
    loadPreferences();
  }, []);

  /**
   * Transform API preferences to form format
   */
  const transformPreferencesToForm = (
    preferences: UserNotificationPreference[]
  ): NotificationPreferencesFormData => {
    const formData = { ...defaultPreferences };

    for (const pref of preferences) {
      const section = pref.notificationType.toLowerCase() as keyof NotificationPreferencesFormData;
      const eventKey = pref.eventType || 'default';

      if (formData[section] && eventKey in (formData[section] as Record<string, NotificationEventPreference>)) {
        (formData[section] as Record<string, NotificationEventPreference>)[eventKey] = {
          channels: pref.channels as NotificationChannel[],
          mandatoryChannels: pref.mandatoryChannels as NotificationChannel[],
        };
      }
    }

    return formData;
  };

  /**
   * Transform form data to API format for saving
   */
  const transformFormToPreferences = (
    data: NotificationPreferencesFormData
  ): Array<{ type: string; eventType: string | null; channels: string[] }> => {
    const preferences: Array<{ type: string; eventType: string | null; channels: string[] }> = [];

    for (const [sectionKey, section] of Object.entries(data)) {
      const type = sectionKey.toUpperCase(); // e.g., "task" -> "TASK"

      for (const [eventKey, eventData] of Object.entries(section as Record<string, NotificationEventPreference>)) {
        preferences.push({
          type,
          eventType: eventKey,
          channels: eventData.channels,
        });
      }
    }

    return preferences;
  };

  const loadPreferences = async () => {
    try {
      setIsLoading(true);
      const profileResponse = await getProfile();

      if (profileResponse.success && profileResponse.data) {
        const currentUserId = profileResponse.data.id;
        setUserId(currentUserId);

        // Load user's notification preferences from API
        const prefsResponse = await notificationPreferenceService.getPreferences(currentUserId);

        // Note: axios returns AxiosResponse, so actual data is in prefsResponse.data
        const responseData = prefsResponse.data;
        if (responseData?.success && responseData?.data && responseData.data.length > 0) {
          const formData = transformPreferencesToForm(responseData.data);
          form.reset(formData);
        } else {
          // No preferences saved yet, use defaults
          form.reset(defaultPreferences);
        }
      }
    } catch (error: any) {
      console.error("Error loading preferences:", error);
      toast.error(error?.response?.data?.message || "Erro ao carregar preferências");
      form.reset(defaultPreferences);
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

      // Transform form data to API format
      const preferences = transformFormToPreferences(data);

      // Use batch update for efficiency
      const response = await notificationPreferenceService.batchUpdatePreferences(userId, {
        preferences: preferences.map(p => ({
          type: p.type,
          eventType: p.eventType || '',
          channels: p.channels,
        })),
      });

      // Note: axios returns AxiosResponse, so actual data is in response.data
      const responseData = response.data;
      if (responseData?.success) {
        toast.success(`${responseData.data?.updated || 0} preferências salvas com sucesso!`);
      } else {
        toast.error(responseData?.message || "Erro ao salvar preferências");
      }
    } catch (error: any) {
      console.error("Error saving preferences:", error);
      toast.error(error?.response?.data?.message || "Erro ao salvar preferências");
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
          title="Preferências de Notificação"
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
              label: "Salvar",
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
        <div className="pb-8 pt-6">
          {/* Channel Legend */}
          <div className="flex items-center gap-4 mb-6 p-3 bg-card border border-border rounded-lg">
            <span className="text-sm text-muted-foreground">Canais:</span>
            {ALL_CHANNELS.map((channel) => {
              const metadata = channelMetadata[channel];
              const Icon = metadata.icon;
              return (
                <div key={channel} className="flex items-center gap-1.5">
                  <Icon className={cn("h-4 w-4", metadata.color)} />
                  <span className="text-sm">{metadata.label}</span>
                </div>
              );
            })}
          </div>

          {/* Accordion Sections */}
          <Accordion
            type="multiple"
            value={openAccordions}
            onValueChange={setOpenAccordions}
            className="space-y-2"
          >
            {notificationSections.map((section) => {
              const Icon = section.icon;
              const sectionKey = section.id as keyof NotificationPreferencesFormData;

              return (
                <AccordionItem
                  key={section.id}
                  value={section.id}
                  className="border rounded-lg px-4 bg-card"
                >
                  <AccordionTrigger className="hover:no-underline py-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-md">
                        <Icon className="h-4 w-4 text-primary" />
                      </div>
                      <div className="text-left">
                        <span className="font-medium">{section.title}</span>
                        <span className="text-xs text-muted-foreground ml-2">
                          ({section.events.length} eventos)
                        </span>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-4">
                    <div className="pt-2">
                      {section.events.map((event) => {
                        const eventKey = event.key as keyof (typeof defaultPreferences)[typeof sectionKey];
                        const watchPath = `${sectionKey}.${eventKey}` as const;

                        return (
                          <PreferenceRow
                            key={event.key}
                            label={event.label}
                            description={event.description}
                            selectedChannels={form.watch(`${watchPath}.channels` as any) || []}
                            onChange={(channels) =>
                              form.setValue(`${watchPath}.channels` as any, channels, { shouldDirty: true })
                            }
                            mandatoryChannels={event.mandatoryChannels}
                          />
                        );
                      })}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </div>
      </div>
    </div>
  );
}
