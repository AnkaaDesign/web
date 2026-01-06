import { useEffect, useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useSocket } from './use-socket';
import { notificationKeys } from './queryKeys';
import { socketService, type ConnectionState } from '@/lib/socket';
import type { Notification } from '@/types';

/**
 * Hook to handle real-time notification events via Socket.io
 * Automatically updates React Query cache and shows toast notifications
 */
export function useNotificationSocket() {
  const socket = useSocket();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    socketService.getConnectionState()
  );
  const [unreadCount, setUnreadCount] = useState<number>(0);

  // Subscribe to connection state changes
  useEffect(() => {
    const unsubscribe = socketService.onConnectionStateChange(setConnectionState);
    return unsubscribe;
  }, []);

  // Callback to mark notification as read
  const markAsRead = useCallback((notificationId: string) => {
    socketService.markNotificationAsRead(notificationId);
  }, []);

  // Callback to mark notification as delivered
  const markAsDelivered = useCallback((notificationId: string) => {
    socketService.markNotificationAsDelivered(notificationId);
  }, []);

  useEffect(() => {
    if (!socket) {
      return;
    }

    console.log('[useNotificationSocket] Setting up notification listeners');

    // Handler for new notifications
    const handleNewNotification = (notification: Notification) => {
      console.log('[useNotificationSocket] New notification received:', notification);

      // Update React Query cache - add to beginning of list
      queryClient.setQueryData<{ data: Notification[] }>(
        notificationKeys.list(),
        (old) => {
          if (!old) {
            return { data: [notification] };
          }
          return {
            ...old,
            data: [notification, ...old.data],
          };
        }
      );

      // Show toast notification
      const toastAction = notification.actionUrl
        ? {
            label: 'Ver',
            onClick: () => {
              navigate(notification.actionUrl!);
            },
          }
        : undefined;

      // Determine toast type based on importance
      switch (notification.importance) {
        case 'URGENT':
          toast.error(notification.title, {
            description: notification.body,
            action: toastAction,
            duration: 10000, // 10 seconds for urgent
          });
          break;
        case 'HIGH':
          toast.warning(notification.title, {
            description: notification.body,
            action: toastAction,
            duration: 7000,
          });
          break;
        case 'MEDIUM':
          toast.info(notification.title, {
            description: notification.body,
            action: toastAction,
            duration: 5000,
          });
          break;
        case 'LOW':
        default:
          toast(notification.title, {
            description: notification.body,
            action: toastAction,
            duration: 4000,
          });
          break;
      }

      // Invalidate unread count
      queryClient.invalidateQueries({
        queryKey: ['notifications', 'unread'],
      });
    };

    // Handler for notification updates
    const handleNotificationUpdate = (notification: Notification) => {
      console.log('[useNotificationSocket] Notification updated:', notification.id);

      // Update notification in cache
      queryClient.setQueryData<{ data: Notification[] }>(
        notificationKeys.list(),
        (old) => {
          if (!old) {
            return old;
          }
          return {
            ...old,
            data: old.data.map((n) =>
              n.id === notification.id ? notification : n
            ),
          };
        }
      );

      // Invalidate queries to refetch fresh data
      queryClient.invalidateQueries({
        queryKey: notificationKeys.detail(notification.id),
      });
    };

    // Handler for notification deletion
    const handleNotificationDelete = (notificationId: string) => {
      console.log('[useNotificationSocket] Notification deleted:', notificationId);

      // Remove notification from cache
      queryClient.setQueryData<{ data: Notification[] }>(
        notificationKeys.list(),
        (old) => {
          if (!old) {
            return old;
          }
          return {
            ...old,
            data: old.data.filter((n) => n.id !== notificationId),
          };
        }
      );

      // Invalidate unread count
      queryClient.invalidateQueries({
        queryKey: ['notifications', 'unread'],
      });
    };

    // Handler for mark as read
    const handleMarkAsRead = (data: { notificationId: string; userId: string }) => {
      console.log('[useNotificationSocket] Notification marked as read:', data.notificationId);

      // Update notification in cache
      queryClient.setQueryData<{ data: Notification[] }>(
        notificationKeys.list(),
        (old) => {
          if (!old) {
            return old;
          }
          return {
            ...old,
            data: old.data.map((n) =>
              n.id === data.notificationId
                ? { ...n, isSeenByUser: true }
                : n
            ),
          };
        }
      );

      // Invalidate unread count
      queryClient.invalidateQueries({
        queryKey: ['notifications', 'unread'],
      });
    };

    // Handler for mark all as read
    const handleMarkAllAsRead = () => {
      console.log('[useNotificationSocket] All notifications marked as read');

      // Update all notifications in cache
      queryClient.setQueryData<{ data: Notification[] }>(
        notificationKeys.list(),
        (old) => {
          if (!old) {
            return old;
          }
          return {
            ...old,
            data: old.data.map((n) => ({ ...n, isSeenByUser: true })),
          };
        }
      );

      // Invalidate unread count
      queryClient.invalidateQueries({
        queryKey: ['notifications', 'unread'],
      });
    };

    // Handler for sync response (when reconnecting)
    const handleSyncResponse = (data: { notifications: Notification[] }) => {
      console.log('[useNotificationSocket] Sync response received, syncing notifications');

      // Invalidate all notification queries to refetch
      queryClient.invalidateQueries({
        queryKey: notificationKeys.all,
      });

      // Show toast if there are missed notifications
      if (data.notifications && data.notifications.length > 0) {
        toast.info('Notificações sincronizadas', {
          description: `${data.notifications.length} notificação(ões) recebida(s) enquanto você estava offline.`,
        });
      }
    };

    // Handler for notification count updates
    const handleNotificationCount = (data: { count: number }) => {
      console.log('[useNotificationSocket] Notification count updated:', data.count);
      setUnreadCount(data.count);
    };

    // Handler for connection events
    const handleConnect = () => {
      console.log('[useNotificationSocket] Socket connected');
      // Request initial notification count
      socketService.requestNotificationCount();
    };

    const handleDisconnect = (reason: string) => {
      console.log('[useNotificationSocket] Socket disconnected:', reason);
    };

    // Register event listeners
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('notification:new', handleNewNotification);
    socket.on('notification:update', handleNotificationUpdate);
    socket.on('notification:delete', handleNotificationDelete);
    socket.on('notification:read', handleMarkAsRead);
    socket.on('notification:read-all', handleMarkAllAsRead);
    socket.on('notification:count', handleNotificationCount);
    socket.on('sync:notifications', handleSyncResponse);

    // Request initial count if already connected
    if (socket.connected) {
      socketService.requestNotificationCount();
    }

    // Cleanup function - remove all listeners
    return () => {
      console.log('[useNotificationSocket] Cleaning up notification listeners');
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('notification:new', handleNewNotification);
      socket.off('notification:update', handleNotificationUpdate);
      socket.off('notification:delete', handleNotificationDelete);
      socket.off('notification:read', handleMarkAsRead);
      socket.off('notification:read-all', handleMarkAllAsRead);
      socket.off('notification:count', handleNotificationCount);
      socket.off('sync:notifications', handleSyncResponse);
    };
  }, [socket, queryClient, navigate]);

  return {
    connectionState,
    isConnected: connectionState === 'connected',
    unreadCount,
    markAsRead,
    markAsDelivered,
  };
}

/**
 * Hook to manually request notification sync
 * Useful after reconnection to fetch missed notifications
 */
export function useNotificationSync(): () => void {
  const socket = useSocket();

  return () => {
    if (!socket) {
      console.warn('[useNotificationSync] Cannot sync - socket not connected');
      return;
    }

    console.log('[useNotificationSync] Requesting notification sync');
    socket.emit('sync:request', { timestamp: Date.now() });
  };
}
