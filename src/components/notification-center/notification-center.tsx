import * as React from "react";
import { useNavigate } from "react-router-dom";
import { IconBell, IconCheck } from "@tabler/icons-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { NotificationBadge } from "./notification-badge";
import { NotificationList } from "./notification-list";
import { useNotificationCenter } from "@/hooks/common/use-notification-center";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";
import type { Notification } from "@/types";
import { apiClient } from "@/api-client";
import { toast } from "@/components/ui/sonner";

/**
 * Entity type to route mapping for notification navigation
 * Maps API entity types (uppercase) to web application routes
 */
const ENTITY_ROUTE_MAP: Record<string, string> = {
  // Task routes (default to agenda, user can navigate from there)
  TASK: "/producao/agenda/detalhes",
  Task: "/producao/agenda/detalhes",

  // Order routes
  ORDER: "/estoque/pedidos/detalhes",
  Order: "/estoque/pedidos/detalhes",

  // Item routes
  ITEM: "/estoque/produtos/detalhes",
  Item: "/estoque/produtos/detalhes",

  // Service Order routes (redirect handled separately to Task)
  SERVICE_ORDER: "/producao/ordens-de-servico/detalhes",
  ServiceOrder: "/producao/ordens-de-servico/detalhes",
  SERVICEORDER: "/producao/ordens-de-servico/detalhes",

  // User routes
  USER: "/administracao/usuarios/detalhes",
  User: "/administracao/usuarios/detalhes",

  // Employee routes
  EMPLOYEE: "/recursos-humanos/funcionarios/detalhes",
  Employee: "/recursos-humanos/funcionarios/detalhes",

  // Customer routes
  CUSTOMER: "/administracao/clientes/detalhes",
  Customer: "/administracao/clientes/detalhes",

  // Supplier routes
  SUPPLIER: "/estoque/fornecedores/detalhes",
  Supplier: "/estoque/fornecedores/detalhes",

  // Warning routes
  WARNING: "/recursos-humanos/advertencias/detalhes",
  Warning: "/recursos-humanos/advertencias/detalhes",

  // Bonus routes
  BONUS: "/recursos-humanos/bonus/detalhes",
  Bonus: "/recursos-humanos/bonus/detalhes",

  // Vacation routes
  VACATION: "/recursos-humanos/ferias/detalhes",
  Vacation: "/recursos-humanos/ferias/detalhes",

  // Financial routes
  FINANCIAL: "/financeiro/transacoes/detalhes",
  Financial: "/financeiro/transacoes/detalhes",

  // PPE (Personal Protective Equipment) routes
  PPE: "/estoque/epi/entregas",
  Ppe: "/estoque/epi/entregas",
  PPE_DELIVERY: "/estoque/epi/entregas",
  PpeDelivery: "/estoque/epi/entregas",

  // Cut routes (navigate to task since cuts are part of tasks)
  CUT: "/producao/recorte/detalhes",
  Cut: "/producao/recorte/detalhes",

  // Stock routes
  STOCK: "/estoque/produtos/detalhes",
  Stock: "/estoque/produtos/detalhes",

  // Activity/Movement routes
  ACTIVITY: "/estoque/movimentacoes/detalhes",
  Activity: "/estoque/movimentacoes/detalhes",

  // Borrow routes
  BORROW: "/estoque/emprestimos/detalhes",
  Borrow: "/estoque/emprestimos/detalhes",
};

/**
 * Get the route for a given entity type and ID
 */
function getRouteForEntity(entityType: string, entityId: string): string | null {
  const basePath = ENTITY_ROUTE_MAP[entityType];
  if (basePath) {
    return `${basePath}/${entityId}`;
  }
  return null;
}

interface NotificationCenterProps {
  className?: string;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ className }) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  const {
    notifications,
    unreadCount,
    isLoading,
    isLoadingMore,
    markAsRead,
    markAllAsRead,
    dismissNotification,
    hasMore,
    loadMore,
  } = useNotificationCenter();

  /**
   * Parse actionUrl which may be a JSON string containing web, mobile, and universalLink URLs
   * Returns the web URL if it's a JSON object, otherwise returns the original string
   */
  const parseActionUrl = (actionUrl: string | null | undefined): string | null => {
    if (!actionUrl) return null;

    // Check if it looks like a JSON string (starts with '{')
    if (actionUrl.startsWith('{')) {
      try {
        const parsed = JSON.parse(actionUrl);
        // Return the web URL from the parsed object
        if (parsed && typeof parsed === 'object' && parsed.web) {
          return parsed.web;
        }
      } catch {
        // Not valid JSON, continue with original value
      }
    }

    return actionUrl;
  };

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read
    await markAsRead(notification.id);

    let targetUrl: string | null = null;

    // Priority 1: Use metadata.webUrl if available (most reliable, set by API)
    if (notification.metadata?.webUrl) {
      targetUrl = notification.metadata.webUrl;
    }

    // Priority 2: Use actionUrl field (parse JSON if needed)
    if (!targetUrl) {
      const rawUrl = (notification as any).link || notification.actionUrl;
      targetUrl = parseActionUrl(rawUrl);
    }

    // Priority 3: Use relatedEntityType and relatedEntityId for entity-based navigation
    if (!targetUrl && notification.relatedEntityType && notification.relatedEntityId) {
      // Special handling for SERVICE_ORDER - navigate to parent Task instead
      // ServiceOrders don't have their own detail page, they're viewed within Task
      if (
        (notification.relatedEntityType === "SERVICE_ORDER" ||
          notification.relatedEntityType === "ServiceOrder" ||
          notification.relatedEntityType === "SERVICEORDER") &&
        notification.metadata?.taskId
      ) {
        targetUrl = getRouteForEntity("TASK", notification.metadata.taskId as string);
      } else {
        targetUrl = getRouteForEntity(notification.relatedEntityType, notification.relatedEntityId);
      }
    }

    if (targetUrl) {
      // Handle legacy /tasks/:id URLs - convert to new /producao/agenda/detalhes/:id
      // This handles old notifications that were created before the URL fix
      if (targetUrl.startsWith("/tasks/")) {
        const taskId = targetUrl.replace("/tasks/", "");
        // Default to agenda for old URLs (user can navigate to correct page from there)
        targetUrl = `/producao/agenda/detalhes/${taskId}`;
      }

      // Handle legacy /tarefas/:id URLs (from old DeepLinkService)
      if (targetUrl.startsWith("/tarefas/")) {
        const taskId = targetUrl.replace("/tarefas/", "");
        targetUrl = `/producao/agenda/detalhes/${taskId}`;
      }

      // Handle legacy /pedidos/:id URLs (from old DeepLinkService)
      if (targetUrl.startsWith("/pedidos/")) {
        const orderId = targetUrl.replace("/pedidos/", "");
        targetUrl = `/estoque/pedidos/detalhes/${orderId}`;
      }

      // Handle both internal routes and external URLs
      if (targetUrl.startsWith("http://") || targetUrl.startsWith("https://")) {
        window.open(targetUrl, "_blank");
      } else {
        navigate(targetUrl);
      }
      setIsOpen(false);
    }
  };

  const handleMarkAllAsRead = async () => {
    await markAllAsRead();
  };

  const handleRemindLater = async (notification: Notification) => {
    try {
      // Schedule a reminder for 1 hour from now
      const interval = "1hr"; // Default to 1 hour

      // Schedule the reminder (suppress toast by catching the response)
      await apiClient.post("/notifications/reminders/schedule", {
        notificationId: notification.id,
        interval,
      }, {
        // Suppress automatic success toast
        headers: { 'X-Suppress-Toast': 'true' }
      });

      // Mark as read so it disappears from the list (suppress toast)
      await markAsRead(notification.id);

      // Show single meaningful toast
      toast.success("Lembrete agendado para 1 hora");
    } catch (error: any) {
      console.error("❌ Failed to schedule reminder:", error);

      // Extract error message from response
      const errorMessage = error?.response?.data?.message || error?.message || "Erro desconhecido";

      // Show specific error message
      if (errorMessage.includes("not found") || errorMessage.includes("Notification not found")) {
        toast.error("Notificação não encontrada. Tente atualizar a página.");
      } else if (errorMessage.includes("Maximum") || errorMessage.includes("reminders reached")) {
        toast.error("Limite de 3 lembretes atingido para esta notificação.");
      } else {
        toast.error(`Erro ao agendar lembrete: ${errorMessage}`);
      }
    }
  };

  const handleDismiss = async (_notification: Notification) => {
    await dismissNotification(_notification.id);
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <button
          className={cn(
            "relative w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
            "hover:bg-muted text-foreground",
            isOpen && "bg-muted",
            className
          )}
          aria-label="Notificações"
        >
          <IconBell className="w-5 h-5" strokeWidth={1.5} />
          <NotificationBadge count={unreadCount} />
        </button>
      </SheetTrigger>

      <SheetContent
        side="right"
        size="md"
        className="p-0 flex flex-col"
        showCloseButton={false}
      >
        {/* Header */}
        <SheetHeader className="px-4 py-4 border-b border-border mb-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SheetTitle className="text-lg font-semibold">Notificações</SheetTitle>
              {unreadCount > 0 && (
                <span className="flex items-center justify-center min-w-5 h-5 px-1.5 text-xs font-medium text-white bg-red-600 rounded-full">
                  {unreadCount}
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMarkAllAsRead}
                className="h-8 px-2 text-xs"
              >
                <IconCheck className="w-4 h-4 mr-1" />
                Marcar todas como lidas
              </Button>
            )}
          </div>
        </SheetHeader>

        {/* Notification List */}
        <div className="flex-1 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="w-4 h-4 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
                Carregando...
              </div>
            </div>
          ) : (
            <NotificationList
              notifications={notifications}
              onNotificationClick={handleNotificationClick}
              onRemindLater={handleRemindLater}
              onDismiss={handleDismiss}
              maxHeight="calc(100vh - 140px)"
              currentUserId={user?.id}
              hasMore={hasMore}
              onLoadMore={loadMore}
              isLoadingMore={isLoadingMore}
            />
          )}
        </div>

      </SheetContent>
    </Sheet>
  );
};
