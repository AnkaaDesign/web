import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { IconX } from '@tabler/icons-react';
import { toast, TOAST_Z_NOTIFICATION } from '@/components/ui/sonner';
import { useSocket } from './use-socket';
import { notificationKeys } from './query-keys';
import { socketService, type ConnectionState } from '@/lib/socket';
import { shouldShowNotification } from '@/lib/notification-dedup';
import { useAuth } from '@/contexts/auth-context';
import type { Notification } from '@/types';

/** Coalesce bursts (a dispatch fan-out delivers several `notification:new` in a row)
 * into a single refetch per window. */
const INVALIDATE_DEBOUNCE_MS = 300;

/**
 * Parse actionUrl which may be a JSON string containing web, mobile, webPath URLs.
 * Returns the internal webPath for navigation, or extracts path from web URL.
 */
function parseActionUrl(actionUrl: string): string | null {
  if (!actionUrl || actionUrl === 'null' || actionUrl === 'undefined') return null;
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
    return null;
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
  const { user } = useAuth();
  const userId = user?.id;
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    socketService.getConnectionState()
  );
  const [unreadCount, setUnreadCount] = useState<number>(0);

  // Subscribe to connection state changes
  useEffect(() => {
    const unsubscribe = socketService.onConnectionStateChange(setConnectionState);
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!socket) {
      return;
    }

    // Every socket handler below goes through this instead of `setQueryData`.
    // `setQueryData` needs an EXACT key match, and the notification center's real key
    // is ["notifications","list",{take,orderBy,include}] — writing to
    // notificationKeys.list() (no params) matched nothing, so every cache write was a
    // no-op. Invalidating the ["notifications"] PREFIX subsumes every filtered variant
    // (list, byUser, unread, count).
    let flushTimer: ReturnType<typeof setTimeout> | null = null;
    const invalidateNotifications = () => {
      if (flushTimer) return;
      flushTimer = setTimeout(() => {
        flushTimer = null;
        queryClient.invalidateQueries({ queryKey: notificationKeys.all });
      }, INVALIDATE_DEBOUNCE_MS);
    };

    // Handler for new notifications
    const handleNewNotification = (notification: Notification) => {
      // Skip if this notification was already shown (prevents duplicates from socket + push)
      if (!shouldShowNotification(notification.id)) {
        return;
      }

      invalidateNotifications();

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
              style={{ zIndex: TOAST_Z_NOTIFICATION, width: "17.5rem", maxHeight: "8rem" }}
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

    };

    // Handler for notification updates
    const handleNotificationUpdate = (notification: Notification) => {
      invalidateNotifications();
      queryClient.invalidateQueries({
        queryKey: notificationKeys.detail(notification.id),
      });
    };

    // Handler for notification deletion
    const handleNotificationDelete = (_notificationId: string) => {
      invalidateNotifications();
    };

    // Handler for mark as read (this user, from another tab/device)
    const handleMarkAsRead = (_data: { notificationId: string; userId: string }) => {
      invalidateNotifications();
    };

    // Handler for mark all as read
    const handleMarkAllAsRead = () => {
      invalidateNotifications();
    };

    // Handler for notification count updates. The gateway pushes this on connect and
    // after every dispatch, so it is the freshest unread count available — mirror it
    // into the query cache so the badge (a different component tree) sees it too.
    const handleNotificationCount = (data: { count: number }) => {
      if (typeof data?.count !== 'number') return;
      setUnreadCount(data.count);
      if (userId) {
        queryClient.setQueryData<number>(notificationKeys.count(userId), data.count);
      }
    };

    // Handler for connection events. A dropped socket misses every notification in the
    // gap, so refresh the whole prefix on (re)connect. The gateway also pushes an
    // unprompted `notification:count` on connect — no request emit needed.
    const handleConnect = () => {
      invalidateNotifications();
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

    // If the socket connected before this effect ran, its `connect` event has already
    // come and gone — close the same gap now.
    if (socket.connected) {
      invalidateNotifications();
    }

    // Cleanup function - remove all listeners
    return () => {
      if (flushTimer) clearTimeout(flushTimer);
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('notification:new', handleNewNotification);
      socket.off('notification:update', handleNotificationUpdate);
      socket.off('notification:delete', handleNotificationDelete);
      socket.off('notification:read', handleMarkAsRead);
      socket.off('notification:read-all', handleMarkAllAsRead);
      socket.off('notification:count', handleNotificationCount);
    };
  }, [socket, queryClient, navigate, userId]);

  return {
    connectionState,
    isConnected: connectionState === 'connected',
    unreadCount,
  };
}
