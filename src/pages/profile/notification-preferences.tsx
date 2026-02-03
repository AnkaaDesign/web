import { useEffect, useState, useMemo } from "react";
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
  ClipboardCheck,
  Scissors,
  HardHat,
} from "lucide-react";
import { getProfile, notificationPreferenceService } from "@/api-client";
import type { UserNotificationPreference } from "@/types";

// =====================
// Sector Privileges (must match backend)
// =====================

type SectorPrivilege =
  | "BASIC"
  | "PRODUCTION"
  | "MAINTENANCE"
  | "WAREHOUSE"
  | "PLOTTING"
  | "ADMIN"
  | "HUMAN_RESOURCES"
  | "EXTERNAL"
  | "DESIGNER"
  | "FINANCIAL"
  | "LOGISTIC"
  | "COMMERCIAL";
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
    // Representatives
    representatives: NotificationEventPreference;
    // Production
    paint: NotificationEventPreference;
    logoPaints: NotificationEventPreference;
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
  service_order: {
    created: NotificationEventPreference;
    assigned: NotificationEventPreference;
    assigned_updated: NotificationEventPreference;
    my_updated: NotificationEventPreference;
    my_completed: NotificationEventPreference;
  };
  stock: {
    low: NotificationEventPreference;
    out: NotificationEventPreference;
    restock: NotificationEventPreference;
  };
  cut: {
    created: NotificationEventPreference;
    started: NotificationEventPreference;
    completed: NotificationEventPreference;
    request: NotificationEventPreference;
  };
  ppe: {
    requested: NotificationEventPreference;
    approved: NotificationEventPreference;
    rejected: NotificationEventPreference;
    delivered: NotificationEventPreference;
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
    // Representatives
    representatives: channelSchema,
    // Production
    paint: channelSchema,
    logoPaints: channelSchema,
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
  service_order: z.object({
    created: channelSchema,
    assigned: channelSchema,
    assigned_updated: channelSchema,
    my_updated: channelSchema,
    my_completed: channelSchema,
  }),
  stock: z.object({
    low: channelSchema,
    out: channelSchema,
    restock: channelSchema,
  }),
  cut: z.object({
    created: channelSchema,
    started: channelSchema,
    completed: channelSchema,
    request: channelSchema,
  }),
  ppe: z.object({
    requested: channelSchema,
    approved: channelSchema,
    rejected: channelSchema,
    delivered: channelSchema,
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
  allowedSectors?: SectorPrivilege[]; // If set, only these sectors can see this event
}

interface NotificationSection {
  id: string;
  title: string;
  icon: typeof ClipboardList;
  events: NotificationEvent[];
  allowedSectors?: SectorPrivilege[]; // If set, only these sectors can see this section
}

// =====================
// Sector-based Access Control
// =====================

// Sectors that can see each notification category (matches backend notification-filter.service.ts)
const CATEGORY_ALLOWED_SECTORS: Record<string, SectorPrivilege[]> = {
  // TASK: All sectors can see task notifications (but individual events are filtered)
  task: [],
  // ORDER: Only ADMIN and WAREHOUSE
  order: ["ADMIN", "WAREHOUSE"],
  // SERVICE_ORDER: ADMIN, DESIGNER, PRODUCTION, FINANCIAL, LOGISTIC, COMMERCIAL
  service_order: ["ADMIN", "DESIGNER", "PRODUCTION", "FINANCIAL", "LOGISTIC", "COMMERCIAL"],
  // STOCK: Only ADMIN and WAREHOUSE
  stock: ["ADMIN", "WAREHOUSE"],
  // CUT: ADMIN, PLOTTING, PRODUCTION
  cut: ["ADMIN", "PLOTTING", "PRODUCTION"],
  // PPE: Only ADMIN, HUMAN_RESOURCES, WAREHOUSE can configure PPE preferences
  // (other users still receive notifications about their own requests via backend)
  ppe: ["ADMIN", "HUMAN_RESOURCES", "WAREHOUSE"],
  // SYSTEM: All users
  system: [],
  // VACATION: Only ADMIN and HUMAN_RESOURCES can configure vacation preferences
  // (other users still receive notifications about their own vacations via backend)
  vacation: ["ADMIN", "HUMAN_RESOURCES"],
};

// Task event-specific sector restrictions (matches backend task-notification.config.ts FIELD_ALLOWED_ROLES)
const TASK_EVENT_ALLOWED_SECTORS: Record<string, SectorPrivilege[]> = {
  // created: ADMIN, FINANCIAL, COMMERCIAL (production gets notified separately when status changes to WAITING_PRODUCTION)
  created: ["ADMIN", "FINANCIAL", "COMMERCIAL", "DESIGNER", "LOGISTIC"],
  // status: All sectors that can access tasks
  status: [],
  // finishedAt: ADMIN, PRODUCTION, FINANCIAL, LOGISTIC
  finishedAt: ["ADMIN", "PRODUCTION", "FINANCIAL", "LOGISTIC"],
  // overdue: ADMIN, PRODUCTION, FINANCIAL
  overdue: ["ADMIN", "PRODUCTION", "FINANCIAL"],
  // term: ADMIN, PRODUCTION, FINANCIAL, LOGISTIC
  term: ["ADMIN", "PRODUCTION", "FINANCIAL", "LOGISTIC"],
  // deadline: ADMIN, PRODUCTION, LOGISTIC, COMMERCIAL
  deadline: ["ADMIN", "PRODUCTION", "LOGISTIC", "COMMERCIAL"],
  // forecastDate: ADMIN, FINANCIAL, LOGISTIC
  forecastDate: ["ADMIN", "FINANCIAL", "LOGISTIC"],
  // details: All sectors
  details: [],
  // serialNumber: All sectors
  serialNumber: [],
  // sector: ADMIN, PRODUCTION, FINANCIAL, LOGISTIC
  sector: ["ADMIN", "PRODUCTION", "FINANCIAL", "LOGISTIC"],
  // artworks: ADMIN, PRODUCTION, DESIGNER, COMMERCIAL
  artworks: ["ADMIN", "PRODUCTION", "DESIGNER", "COMMERCIAL"],
  // representatives: ADMIN, PRODUCTION, FINANCIAL, LOGISTIC
  representatives: ["ADMIN", "PRODUCTION", "FINANCIAL", "LOGISTIC"],
  // paint: ADMIN, PRODUCTION, WAREHOUSE
  paint: ["ADMIN", "PRODUCTION", "WAREHOUSE"],
  // logoPaints: ADMIN, PRODUCTION, WAREHOUSE
  logoPaints: ["ADMIN", "PRODUCTION", "WAREHOUSE"],
  // observation: ADMIN, PRODUCTION, COMMERCIAL
  observation: ["ADMIN", "PRODUCTION", "COMMERCIAL"],
  // commission: ADMIN, FINANCIAL, PRODUCTION, WAREHOUSE
  commission: ["ADMIN", "FINANCIAL", "PRODUCTION", "WAREHOUSE"],
};

// Service Order event-specific sector restrictions
const SERVICE_ORDER_EVENT_ALLOWED_SECTORS: Record<string, SectorPrivilege[]> = {
  // created: Only ADMIN should see all new service orders
  created: ["ADMIN"],
  // assigned: All sectors that can access service orders (when assigned to them)
  assigned: [],
  // assigned_updated: All sectors (when a service order assigned to them is updated)
  assigned_updated: [],
  // my_updated: All sectors (when a service order they created is updated)
  my_updated: [],
  // my_completed: All sectors (when a service order they created is completed)
  my_completed: [],
};

/**
 * Check if a user can access a notification category
 */
function canAccessCategory(categoryId: string, userPrivilege: SectorPrivilege | null): boolean {
  if (!userPrivilege) return false;
  if (userPrivilege === "ADMIN") return true;

  const allowedSectors = CATEGORY_ALLOWED_SECTORS[categoryId];
  // Empty array means all sectors can access
  if (!allowedSectors || allowedSectors.length === 0) return true;

  return allowedSectors.includes(userPrivilege);
}

/**
 * Check if a user can access a specific task event
 */
function canAccessTaskEvent(eventKey: string, userPrivilege: SectorPrivilege | null): boolean {
  if (!userPrivilege) return false;
  if (userPrivilege === "ADMIN") return true;

  const allowedSectors = TASK_EVENT_ALLOWED_SECTORS[eventKey];
  // Empty array means all sectors can access
  if (!allowedSectors || allowedSectors.length === 0) return true;

  return allowedSectors.includes(userPrivilege);
}

/**
 * Check if a user can access a specific service order event
 */
function canAccessServiceOrderEvent(eventKey: string, userPrivilege: SectorPrivilege | null): boolean {
  if (!userPrivilege) return false;
  if (userPrivilege === "ADMIN") return true;

  const allowedSectors = SERVICE_ORDER_EVENT_ALLOWED_SECTORS[eventKey];
  // Empty array means all sectors can access
  if (!allowedSectors || allowedSectors.length === 0) return true;

  return allowedSectors.includes(userPrivilege);
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
      { key: "representatives", label: "Representantes", description: "Quando os representantes da tarefa são alterados", mandatoryChannels: [] },
      // Production - optional
      { key: "paint", label: "Pintura Geral", description: "Quando a pintura geral é definida ou alterada", mandatoryChannels: [] },
      { key: "logoPaints", label: "Pinturas do Logotipo", description: "Quando as cores do logotipo são alteradas", mandatoryChannels: [] },
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
    id: "service_order",
    title: "Ordens de Serviço",
    icon: ClipboardCheck,
    events: [
      { key: "created", label: "Nova Ordem de Serviço", description: "Quando uma nova ordem de serviço é criada", mandatoryChannels: ["IN_APP", "PUSH"] },
      { key: "assigned", label: "Atribuída a Mim", description: "Quando uma ordem de serviço é atribuída a você", mandatoryChannels: ["IN_APP", "PUSH", "WHATSAPP"] },
      { key: "assigned_updated", label: "Atribuída a Mim Atualizada", description: "Quando uma ordem de serviço atribuída a você é atualizada", mandatoryChannels: ["IN_APP", "PUSH"] },
      { key: "my_updated", label: "Que Criei Atualizada", description: "Quando uma ordem de serviço que você criou é atualizada", mandatoryChannels: ["IN_APP", "PUSH"] },
      { key: "my_completed", label: "Que Criei Concluída", description: "Quando uma ordem de serviço que você criou é concluída", mandatoryChannels: ["IN_APP", "PUSH", "WHATSAPP"] },
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
    id: "cut",
    title: "Recortes",
    icon: Scissors,
    events: [
      { key: "created", label: "Novo Recorte", description: "Quando um novo recorte é adicionado à tarefa", mandatoryChannels: ["IN_APP"] },
      { key: "started", label: "Recorte Iniciado", description: "Quando o corte de um recorte é iniciado", mandatoryChannels: ["IN_APP"] },
      { key: "completed", label: "Recorte Concluído", description: "Quando o corte de um recorte é finalizado", mandatoryChannels: ["IN_APP"] },
      { key: "request", label: "Solicitação de Recorte", description: "Quando é solicitado um novo recorte (retrabalho)", mandatoryChannels: ["IN_APP", "PUSH"] },
    ],
  },
  {
    id: "ppe",
    title: "Entrega de EPI",
    icon: HardHat,
    events: [
      { key: "requested", label: "Nova Solicitação", description: "Quando um EPI é solicitado", mandatoryChannels: ["IN_APP", "PUSH"] },
      { key: "approved", label: "Solicitação Aprovada", description: "Quando sua solicitação de EPI é aprovada", mandatoryChannels: ["IN_APP", "PUSH"] },
      { key: "rejected", label: "Solicitação Reprovada", description: "Quando sua solicitação de EPI é reprovada", mandatoryChannels: ["IN_APP", "PUSH"] },
      { key: "delivered", label: "EPI Entregue", description: "Quando o EPI é entregue a você", mandatoryChannels: ["IN_APP", "PUSH"] },
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
    created: createDefaultPreference(["IN_APP", "PUSH", "WHATSAPP"], ["IN_APP", "PUSH", "WHATSAPP"]),
    status: createDefaultPreference(["IN_APP", "PUSH"], ["IN_APP", "PUSH"]),
    finishedAt: createDefaultPreference(["IN_APP", "PUSH"], ["IN_APP", "PUSH"]),
    overdue: createDefaultPreference(["IN_APP", "PUSH", "WHATSAPP"], ["IN_APP", "PUSH", "WHATSAPP"]),
    // Dates
    term: createDefaultPreference(["IN_APP", "PUSH", "WHATSAPP"], ["IN_APP", "PUSH", "WHATSAPP"]),
    deadline: createDefaultPreference(["IN_APP", "PUSH", "WHATSAPP"], ["IN_APP", "PUSH", "WHATSAPP"]),
    forecastDate: createDefaultPreference(["IN_APP"], []),
    // Basic info
    details: createDefaultPreference(["IN_APP"], []),
    serialNumber: createDefaultPreference(["IN_APP"], []),
    // Assignment
    sector: createDefaultPreference(["IN_APP", "PUSH"], ["IN_APP", "PUSH"]),
    // Artwork
    artworks: createDefaultPreference(["IN_APP", "PUSH"], ["IN_APP", "PUSH"]),
    // Representatives
    representatives: createDefaultPreference(["IN_APP"], []),
    // Production
    paint: createDefaultPreference(["IN_APP"], []),
    logoPaints: createDefaultPreference(["IN_APP"], []),
    observation: createDefaultPreference(["IN_APP"], []),
    // Financial
    commission: createDefaultPreference(["IN_APP"], []),
  },
  order: {
    created: createDefaultPreference(["IN_APP"], []),
    status: createDefaultPreference(["IN_APP"], []),
    fulfilled: createDefaultPreference(["IN_APP"], []),
    cancelled: createDefaultPreference(["IN_APP"], []),
    overdue: createDefaultPreference(["IN_APP", "PUSH"], []),
  },
  service_order: {
    created: createDefaultPreference(["IN_APP", "PUSH"], ["IN_APP", "PUSH"]),
    assigned: createDefaultPreference(["IN_APP", "PUSH", "WHATSAPP"], ["IN_APP", "PUSH", "WHATSAPP"]),
    assigned_updated: createDefaultPreference(["IN_APP", "PUSH"], ["IN_APP", "PUSH"]),
    my_updated: createDefaultPreference(["IN_APP", "PUSH"], ["IN_APP", "PUSH"]),
    my_completed: createDefaultPreference(["IN_APP", "PUSH", "WHATSAPP"], ["IN_APP", "PUSH", "WHATSAPP"]),
  },
  stock: {
    low: createDefaultPreference(["IN_APP"], []),
    out: createDefaultPreference(["IN_APP"], []),
    restock: createDefaultPreference(["IN_APP"], []),
  },
  cut: {
    created: createDefaultPreference(["IN_APP", "PUSH"], ["IN_APP"]),
    started: createDefaultPreference(["IN_APP", "PUSH"], ["IN_APP"]),
    completed: createDefaultPreference(["IN_APP", "PUSH"], ["IN_APP"]),
    request: createDefaultPreference(["IN_APP", "PUSH"], ["IN_APP", "PUSH"]),
  },
  ppe: {
    requested: createDefaultPreference(["IN_APP", "PUSH"], ["IN_APP", "PUSH"]),
    approved: createDefaultPreference(["IN_APP", "PUSH", "WHATSAPP"], ["IN_APP", "PUSH"]),
    rejected: createDefaultPreference(["IN_APP", "PUSH", "WHATSAPP"], ["IN_APP", "PUSH"]),
    delivered: createDefaultPreference(["IN_APP", "PUSH"], ["IN_APP", "PUSH"]),
  },
  system: {
    maintenance: createDefaultPreference(["IN_APP"], []),
    update: createDefaultPreference(["IN_APP"], []),
    security: createDefaultPreference(["IN_APP"], []),
  },
  vacation: {
    requested: createDefaultPreference(["IN_APP"], []),
    approved: createDefaultPreference(["IN_APP", "PUSH"], []),
    rejected: createDefaultPreference(["IN_APP", "PUSH"], []),
    reminder: createDefaultPreference(["IN_APP"], []),
  },
};

// =====================
// Main Component
// =====================

export function NotificationPreferencesPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userSectorPrivilege, setUserSectorPrivilege] = useState<SectorPrivilege | null>(null);
  const [openAccordions, setOpenAccordions] = useState<string[]>([]);

  const form = useForm<NotificationPreferencesFormData>({
    resolver: zodResolver(notificationPreferencesSchema),
    defaultValues: defaultPreferences,
  });

  useEffect(() => {
    loadPreferences();
  }, []);

  /**
   * Clean channel data from API - removes invalid channels and converts legacy values
   * IMPORTANT: Only 4 channels are valid in preferences: IN_APP, PUSH, EMAIL, WHATSAPP
   * MOBILE_PUSH, DESKTOP_PUSH, and SMS are NOT valid in preferences
   */
  const cleanChannelData = (channels: string[]): NotificationChannel[] => {
    if (!Array.isArray(channels)) return [];

    return channels
      .map((ch): NotificationChannel | null => {
        // Convert legacy MOBILE_PUSH/DESKTOP_PUSH to unified PUSH
        if (ch === 'MOBILE_PUSH' || ch === 'DESKTOP_PUSH') {
          return 'PUSH';
        }
        // Remove SMS completely (only used for password recovery)
        if (ch === 'SMS') {
          return null;
        }
        // Validate against allowed channels
        if (['IN_APP', 'EMAIL', 'PUSH', 'WHATSAPP'].includes(ch)) {
          return ch as NotificationChannel;
        }
        return null;
      })
      .filter((ch): ch is NotificationChannel => ch !== null)
      .filter((ch, idx, arr) => arr.indexOf(ch) === idx); // Remove duplicates
  };

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
          channels: cleanChannelData(pref.channels as string[]),
          mandatoryChannels: cleanChannelData(pref.mandatoryChannels as string[]),
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

        // Get user's sector privilege for filtering
        const sectorPrivilege = profileResponse.data.sector?.privileges as SectorPrivilege | undefined;
        setUserSectorPrivilege(sectorPrivilege || null);

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

  const handleSave = async () => {
    await form.handleSubmit(
      (data) => onSubmit(data),
      (errors) => {
        console.error('Form validation failed:', errors);
        toast.error('Erro de validação. Por favor, verifique os campos e tente novamente.');
      }
    )();
  };

  const handleReset = () => {
    form.reset(defaultPreferences);
    toast.success("Preferências restauradas para o padrão");
  };

  // Filter notification sections based on user's sector privilege
  const filteredSections = useMemo(() => {
    if (!userSectorPrivilege) return [];

    return notificationSections
      .filter((section) => canAccessCategory(section.id, userSectorPrivilege))
      .map((section) => {
        // For task section, filter individual events based on sector
        if (section.id === "task") {
          return {
            ...section,
            events: section.events.filter((event) =>
              canAccessTaskEvent(event.key, userSectorPrivilege)
            ),
          };
        }
        // For service_order section, filter individual events based on sector
        if (section.id === "service_order") {
          return {
            ...section,
            events: section.events.filter((event) =>
              canAccessServiceOrderEvent(event.key, userSectorPrivilege)
            ),
          };
        }
        return section;
      })
      .filter((section) => section.events.length > 0); // Remove empty sections
  }, [userSectorPrivilege]);

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
            {filteredSections.map((section) => {
              const Icon = section.icon;
              const sectionKey = section.id as keyof NotificationPreferencesFormData;

              return (
                <AccordionItem
                  key={section.id}
                  value={section.id}
                  className="border border-border/40 rounded-lg px-4 bg-card"
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
