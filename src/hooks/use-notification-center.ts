import { useState, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { useNotifications, useMarkAsRead, useMarkAllAsRead } from "./useNotification";
import { toast } from "@/components/ui/sonner";
import { socketService } from "@/lib/socket";
import { getLocalStorage } from "@/lib/storage";
import type { Notification } from "@/types";

interface UseNotificationCenterReturn {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
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

  // Fetch recent notifications with pagination support
  const { data: notificationsData, isLoading } = useNotifications({
    take,
    orderBy: { createdAt: "desc" },
    include: {
      seenBy: {
        include: {
          user: true,
        },
      },
    },
  });

  const markAsReadMutation = useMarkAsRead();
  const markAllAsReadMutation = useMarkAllAsRead();

  const notifications = notificationsData?.data || [];
  const totalRecords = notificationsData?.meta?.totalRecords || 0;
  const hasMore = notifications.length < totalRecords;

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

  // Socket.io real-time notifications setup
  useEffect(() => {
    if (!user) {
      setIsConnected(false);
      return;
    }

    const token = getLocalStorage("token");
    if (!token) {
      setIsConnected(false);
      return;
    }

    // Connect to Socket.io server with authentication
    const socket = socketService.connect(token);

    // Track connection status
    const handleConnect = () => {
      setIsConnected(true);
    };

    const handleDisconnect = () => {
      setIsConnected(false);
    };

    // Listen for new notifications
    const handleNewNotification = (notification: Notification) => {

      // Invalidate ALL notification queries using partial key match
      // This ensures we catch the query regardless of the exact key structure
      queryClient.invalidateQueries({
        queryKey: ["notifications"],
        refetchType: 'active', // Only refetch active queries
      });

      // Show toast notification
      toast.info(notification.title, notification.body);

      // Update count (will be corrected by refetch if needed)
      setUnreadCount((prev) => prev + 1);
    };

    // Listen for notification count updates
    const handleNotificationCount = (data: { count: number }) => {
      setUnreadCount(data.count);
    };

    // Listen for notification updates (e.g., marked as read)
    const handleNotificationUpdate = (updatedNotification: Notification) => {
      // Invalidate ALL notification queries
      queryClient.invalidateQueries({
        queryKey: ["notifications"],
        refetchType: 'active',
      });
    };

    // Listen for notification deletions
    const handleNotificationDelete = (notificationId: string) => {
      // Invalidate ALL notification queries
      queryClient.invalidateQueries({
        queryKey: ["notifications"],
        refetchType: 'active',
      });
    };

    // Register event listeners
    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("notification:new", handleNewNotification);
    socket.on("notification:count", handleNotificationCount);
    socket.on("notification:update", handleNotificationUpdate);
    socket.on("notification:delete", handleNotificationDelete);

    // Note: socket:reconnect-failed is handled by SocketReconnectHandler component
    // to avoid duplicate toasts. It shows a persistent toast with an action button.

    // Set initial connection state
    setIsConnected(socketService.isConnected());

    // Cleanup on unmount
    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("notification:new", handleNewNotification);
      socket.off("notification:count", handleNotificationCount);
      socket.off("notification:update", handleNotificationUpdate);
      socket.off("notification:delete", handleNotificationDelete);

      // Don't disconnect socket on unmount - let it persist for the session
      // socketService.disconnect();
    };
  }, [user, queryClient, notifications]);

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
    // Increase the take count to load more notifications
    setTake((prev) => prev + 20);
  }, []);

  return {
    notifications,
    unreadCount,
    isLoading,
    isConnected,
    markAsRead,
    markAllAsRead,
    dismissNotification,
    refreshNotifications,
    hasMore,
    loadMore,
  };
}
