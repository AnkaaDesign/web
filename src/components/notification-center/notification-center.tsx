import * as React from "react";
import { useNavigate } from "react-router-dom";
import { IconBell, IconCheck } from "@tabler/icons-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { NotificationBadge } from "./notification-badge";
import { NotificationList } from "./notification-list";
import { useNotificationCenter } from "@/hooks/use-notification-center";
import { cn } from "@/lib/utils";
import type { Notification } from "@/types";
import { apiClient } from "@/api-client";
import { toast } from "@/components/ui/sonner";

interface NotificationCenterProps {
  className?: string;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ className }) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const navigate = useNavigate();

  const {
    notifications,
    unreadCount,
    isLoading,
    isConnected,
    markAsRead,
    markAllAsRead,
    dismissNotification,
    hasMore,
    loadMore,
  } = useNotificationCenter();

  const handleNotificationClick = async (notification: Notification) => {
    // Debug: log notification data to help diagnose navigation issues
    console.log("[NotificationCenter] Clicked notification:", {
      id: notification.id,
      title: notification.title,
      actionUrl: notification.actionUrl,
      link: (notification as any).link,
      type: notification.type,
    });

    // Mark as read
    await markAsRead(notification.id);

    // Navigate to notification target if available (using actionUrl field)
    let targetUrl = (notification as any).link || notification.actionUrl;

    // Debug: log resolved URL
    console.log("[NotificationCenter] Target URL:", targetUrl);

    if (targetUrl) {
      // Handle legacy /tasks/:id URLs - convert to new /producao/agenda/detalhes/:id
      // This handles old notifications that were created before the URL fix
      if (targetUrl.startsWith("/tasks/")) {
        const taskId = targetUrl.replace("/tasks/", "");
        // Default to agenda for old URLs (user can navigate to correct page from there)
        targetUrl = `/producao/agenda/detalhes/${taskId}`;
        console.log("[NotificationCenter] Converted legacy URL to:", targetUrl);
      }

      // Handle both internal routes and external URLs
      if (targetUrl.startsWith("http://") || targetUrl.startsWith("https://")) {
        window.open(targetUrl, "_blank");
      } else {
        console.log("[NotificationCenter] Navigating to:", targetUrl);
        navigate(targetUrl);
      }
      setIsOpen(false);
    } else {
      console.warn("[NotificationCenter] No actionUrl found for notification:", notification.id);
    }
  };

  const handleMarkAllAsRead = async () => {
    await markAllAsRead();
  };

  const handleLoadMore = async () => {
    await loadMore();
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
    } catch (error) {
      console.error("❌ Failed to schedule reminder:", error);
      toast.error("Erro ao agendar lembrete");
    }
  };

  const handleDismiss = async (notification: Notification) => {
    await dismissNotification(notification.id);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
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
      </PopoverTrigger>

      <PopoverContent
        className="w-[420px] p-0"
        align="end"
        sideOffset={8}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold">Notificações</h2>
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

        {/* Notification List */}
        <div className="relative">
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
              maxHeight="500px"
            />
          )}
        </div>

        {/* Footer - Load More */}
        {hasMore && notifications.length > 0 && (
          <>
            <Separator />
            <div className="p-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLoadMore}
                className="w-full justify-center text-xs"
              >
                Carregar mais
              </Button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
};
