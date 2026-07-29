import { useState, useEffect, useCallback, useMemo } from "react";
import { useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { useNotifications, useMarkAsRead, useMarkAllAsRead, useUnseenNotificationCount } from "../administration/use-notification";
import { toast } from "@/components/ui/sonner";
import { socketService, type ConnectionState } from "@/lib/socket";
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
  const [isConnected, setIsConnected] = useState(() => socketService.isConnected());
  const [take, setTake] = useState(20);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Fetch recent notifications with pagination support.
  // `seenBy: true` (not the nested `{ include: { user: true } }` it used to request):
  // the only thing read off a seen-record is `seen.userId`, and the nested form shipped
  // a full User object per seen-record per notification.
  const { data: notificationsData, isLoading } = useNotifications(
    {
      take,
      orderBy: { createdAt: "desc" },
      include: {
        seenBy: true,
      },
    },
    {
      placeholderData: keepPreviousData,
    }
  );

  // Authoritative unread count (counts ALL unseen rows server-side, not just the
  // loaded page). Socket `notification:count` pushes write straight into this key.
  const { data: serverUnseenCount } = useUnseenNotificationCount(user?.id ?? "", {
    enabled: !!user?.id,
  });

  const markAsReadMutation = useMarkAsRead();
  const markAllAsReadMutation = useMarkAllAsRead();

  const notifications = notificationsData?.data || [];
  const totalRecords = notificationsData?.meta?.totalRecords || 0;
  const hasMore = notifications.length < totalRecords;

  // Reset loading more state when notifications data changes
  useEffect(() => {
    setIsLoadingMore(false);
  }, [notifications.length]);

  // Page-derived unread count — only a FALLBACK for when the server count hasn't
  // arrived (first paint / offline). On its own it can never exceed `take`.
  const pageUnreadCount = useMemo(() => {
    if (!user) return 0;
    return notifications.filter((notification) => !notification.seenBy?.some((seen) => seen.userId === user.id)).length;
  }, [notifications, user]);

  const unreadCount = typeof serverUnseenCount === "number" ? serverUnseenCount : pageUnreadCount;

  // Socket connection status tracking.
  // Real-time events are handled by SocketNotificationsListener; this only mirrors the
  // connection state (push-based — the old 5s polling interval ran forever for a value
  // that changes a handful of times per session).
  useEffect(() => {
    if (!user) {
      setIsConnected(false);
      return;
    }

    setIsConnected(socketService.isConnected());
    return socketService.onConnectionStateChange((state: ConnectionState) => {
      setIsConnected(state === "connected");
    });
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
      // Success toast is raised by useMarkAllAsRead — the axios interceptor suppresses
      // every /notifications* success toast, so it cannot come from there.
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
