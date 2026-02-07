import { useState, useEffect, useCallback } from "react";
import { useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { useNotifications, useMarkAsRead, useMarkAllAsRead } from "./use-notification";
import { toast } from "@/components/ui/sonner";
import { socketService } from "@/lib/socket";
import type { Notification } from "@/types";

interface UseNotificationCenterReturn {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  isLoadingMore: boolean;
  isConnected: boolean;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  dismissNotification: (notificationId: string) => Promise<void>;
  refreshNotifications: () => void;
  hasMore: boolean;
  loadMore: () => Promise<void>;
}

export function useNotificationCenter(): UseNotificationCenterReturn {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [unreadCount, setUnreadCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [take, setTake] = useState(20);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Fetch recent notifications with pagination support
  const { data: notificationsData, isLoading } = useNotifications(
    {
      take,
      orderBy: { createdAt: "desc" },
      include: {
        seenBy: {
          include: {
            user: true,
          },
        },
      },
    },
    {
      placeholderData: keepPreviousData,
    }
  );

  const markAsReadMutation = useMarkAsRead();
  const markAllAsReadMutation = useMarkAllAsRead();

  const notifications = notificationsData?.data || [];
  const totalRecords = notificationsData?.meta?.totalRecords || 0;
  const hasMore = notifications.length < totalRecords;

  // Reset loading more state when notifications data changes
  useEffect(() => {
    setIsLoadingMore(false);
  }, [notifications.length]);

  // Calculate unread count
  useEffect(() => {
    if (!user) return;

    const count = notifications.filter(
      (notification) =>
        !notification.seenBy ||
        notification.seenBy.length === 0 ||
        !notification.seenBy.some((seen) => seen.userId === user.id)
    ).length;

    setUnreadCount(count);
  }, [notifications, user]);

  // Socket connection status tracking
  // Real-time events are handled by SocketNotificationsListener component
  // to avoid duplicate listeners and toasts
  useEffect(() => {
    if (!user) {
      setIsConnected(false);
      return;
    }

    const checkConnection = () => setIsConnected(socketService.isConnected());
    const interval = setInterval(checkConnection, 5000);
    checkConnection();

    return () => clearInterval(interval);
  }, [user]);

  const markAsRead = useCallback(
    async (notificationId: string) => {
      if (!user) return;

      try {
        await markAsReadMutation.mutateAsync({
          notificationId,
          userId: user.id,
        });
      } catch (error) {
        console.error("Failed to mark notification as read:", error);
        toast.error("Erro", "Não foi possível marcar a notificação como lida");
      }
    },
    [user, markAsReadMutation]
  );

  const markAllAsRead = useCallback(async () => {
    if (!user) return;

    try {
      await markAllAsReadMutation.mutateAsync(user.id);
      // Note: Toast is shown by axios interceptor based on API response message
    } catch (error) {
      console.error("Failed to mark all notifications as read:", error);
      toast.error("Erro", "Não foi possível marcar todas as notificações como lidas");
    }
  }, [user, markAllAsReadMutation]);

  const dismissNotification = useCallback(
    async (notificationId: string) => {
      // Mark as read when dismissing
      await markAsRead(notificationId);
    },
    [markAsRead]
  );

  const refreshNotifications = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
  }, [queryClient]);

  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    // Increase the take count to load more notifications
    setTake((prev) => prev + 20);
  }, [isLoadingMore, hasMore]);

  return {
    notifications,
    unreadCount,
    isLoading,
    isLoadingMore,
    isConnected,
    markAsRead,
    markAllAsRead,
    dismissNotification,
    refreshNotifications,
    hasMore,
    loadMore,
  };
}
