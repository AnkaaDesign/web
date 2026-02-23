import { useEffect, useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { IconX } from '@tabler/icons-react';
import { toast, TOAST_Z_NOTIFICATION } from '@/components/ui/sonner';
import { useSocket } from './use-socket';
import { notificationKeys } from './query-keys';
import { socketService, type ConnectionState } from '@/lib/socket';
import { shouldShowNotification } from '@/lib/notification-dedup';
import type { Notification } from '@/types';

/**
 * Parse actionUrl which may be a JSON string containing web, mobile, webPath URLs.
 * Returns the internal webPath for navigation, or extracts path from web URL.
 */
function parseActionUrl(actionUrl: string): string | null {
  if (actionUrl.startsWith('{')) {
    try {
      const parsed = JSON.parse(actionUrl);
      if (parsed && typeof parsed === 'object') {
        if (parsed.webPath) return parsed.webPath;
        if (parsed.web) {
          try {
            const url = new URL(parsed.web);
            return url.pathname;
          } catch {
            return parsed.web;
          }
        }
      }
    } catch {
      // Not valid JSON, fall through
    }
  }
  return actionUrl;
}

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
      // Skip if this notification was already shown (prevents duplicates from socket + push)
      if (!shouldShowNotification(notification.id)) {
        return;
      }

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
      const getDuration = () => {
        switch (notification.importance) {
          case 'URGENT': return 10000;
          case 'HIGH': return 7000;
          case 'NORMAL': return 5000;
          default: return 4000;
        }
      };

      const actionUrl = notification.actionUrl ? parseActionUrl(notification.actionUrl) : null;

      if (actionUrl) {
        // Clickable notification toast with close button
        const importanceColors: Record<string, string> = {
          URGENT: 'bg-destructive/95 text-destructive-foreground border-destructive/50',
          HIGH: 'bg-yellow-500/95 text-white border-yellow-500/50',
          NORMAL: 'bg-blue-500/95 text-white border-blue-500/50',
        };
        const colorClass = importanceColors[notification.importance || ''] || 'bg-background text-foreground border-border';

        toast.custom(
          (_id) => (
            <div
              className={`cursor-pointer rounded-lg border p-4 shadow-sm relative overflow-hidden ${colorClass}`}
              style={{ zIndex: TOAST_Z_NOTIFICATION, width: 280, maxHeight: 128 }}
              onClick={() => {
                if (actionUrl.startsWith('http://') || actionUrl.startsWith('https://')) {
                  window.open(actionUrl, '_blank');
                } else {
                  navigate(actionUrl);
                }
                toast.clearAll();
              }}
            >
              <button
                className="absolute top-2 right-2 p-0.5 rounded-full opacity-60 hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  toast.clearAll();
                }}
              >
                <IconX className="h-3.5 w-3.5" />
              </button>
              <div className="font-medium text-sm pr-5 truncate">{notification.title}</div>
              {notification.body && (
                <div className="text-sm opacity-80 mt-1 line-clamp-4">{notification.body}</div>
              )}
            </div>
          ),
          { duration: getDuration() }
        );
      } else {
        // Standard toast for notifications without action URL
        const toastOptions = {
          duration: getDuration(),
        };

        switch (notification.importance) {
          case 'URGENT':
            toast.error(notification.title, notification.body, toastOptions);
            break;
          case 'HIGH':
            toast.warning(notification.title, notification.body, toastOptions);
            break;
          case 'NORMAL':
            toast.info(notification.title, notification.body, toastOptions);
            break;
          case 'LOW':
          default:
            toast.info(notification.title, notification.body, toastOptions);
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
        toast.info('Notificações sincronizadas', `${data.notifications.length} ${data.notifications.length === 1 ? 'notificação recebida' : 'notificações recebidas'} enquanto você estava offline.`);
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
