import { useEffect, useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast as sonnerToast } from 'sonner';
import { useSocket } from './use-socket';
import { notificationKeys } from './query-keys';
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

    // Handler for new notifications
    const handleNewNotification = (notification: Notification) => {

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

      // Show toast notification - entire toast is clickable when actionUrl exists
      const getDuration = () => {
        switch (notification.importance) {
          case 'URGENT': return 10000;
          case 'HIGH': return 7000;
          case 'NORMAL': return 5000;
          default: return 4000;
        }
      };

      if (notification.actionUrl) {
        const actionUrl = notification.actionUrl;
        const importanceColors: Record<string, string> = {
          URGENT: 'bg-destructive/95 text-destructive-foreground border-destructive/50',
          HIGH: 'bg-yellow-500/95 text-white border-yellow-500/50',
          NORMAL: 'bg-blue-500/95 text-white border-blue-500/50',
        };
        const colorClass = importanceColors[notification.importance || ''] || 'bg-background text-foreground border-border';

        sonnerToast.custom(
          (id) => (
            <div
              className={`cursor-pointer w-full rounded-lg border p-4 shadow-sm ${colorClass}`}
              onClick={() => {
                navigate(actionUrl);
                sonnerToast.dismiss(id);
              }}
            >
              <div className="font-medium text-sm">{notification.title}</div>
              {notification.body && (
                <div className="text-sm opacity-80 mt-1">{notification.body}</div>
              )}
            </div>
          ),
          { duration: getDuration() }
        );
      } else {
        const toastOptions = {
          description: notification.body,
          duration: getDuration(),
        };

        switch (notification.importance) {
          case 'URGENT':
            sonnerToast.error(notification.title, toastOptions);
            break;
          case 'HIGH':
            sonnerToast.warning(notification.title, toastOptions);
            break;
          case 'NORMAL':
            sonnerToast.info(notification.title, toastOptions);
            break;
          case 'LOW':
          default:
            sonnerToast(notification.title, toastOptions);
            break;
        }
      }

      // Invalidate unread count
      queryClient.invalidateQueries({
        queryKey: ['notifications', 'unread'],
      });
    };

    // Handler for notification updates
    const handleNotificationUpdate = (notification: Notification) => {
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
      // Invalidate all notification queries to refetch
      queryClient.invalidateQueries({
        queryKey: notificationKeys.all,
      });

      // Show toast if there are missed notifications
      if (data.notifications && data.notifications.length > 0) {
        sonnerToast.info('Notificações sincronizadas', {
          description: `${data.notifications.length} ${data.notifications.length === 1 ? 'notificação recebida' : 'notificações recebidas'} enquanto você estava offline.`,
        });
      }
    };

    // Handler for notification count updates
    const handleNotificationCount = (data: { count: number }) => {
      setUnreadCount(data.count);
    };

    // Handler for connection events
    const handleConnect = () => {
      // Request initial notification count
      socketService.requestNotificationCount();
    };

    const handleDisconnect = (_reason: string) => {
      // Socket disconnected
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
      return;
    }

    socket.emit('sync:request', { timestamp: Date.now() });
  };
}
