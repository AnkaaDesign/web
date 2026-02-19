import { messaging, getToken, onMessage } from './firebase';
import { registerDeviceToken as registerToken } from '@/api-client/push-notifications';
import { toast } from '@/components/ui/sonner';
import { shouldShowNotification } from './notification-dedup';

// Track if push notification handler is already set up (prevents duplicate listeners)
let pushHandlerInitialized = false;

/**
 * Request notification permission and get FCM token
 * @returns FCM token if successful, null otherwise
 */
export async function requestPermission(): Promise<string | null> {
  // Check if Firebase messaging is available
  if (!messaging) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[Push Notifications] Firebase messaging not initialized');
    }
    return null;
  }

  // Check if browser supports notifications
  if (!('Notification' in window)) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[Push Notifications] Browser does not support notifications');
    }
    return null;
  }

  try {
    // Request permission
    const permission = await Notification.requestPermission();

    if (permission !== 'granted') {
      if (process.env.NODE_ENV !== 'production') {
        console.log('[Push Notifications] Permission denied');
      }
      return null;
    }

    // Get FCM token
    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;

    if (!vapidKey) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[Push Notifications] VAPID key not configured');
      }
      return null;
    }

    const token = await getToken(messaging, { vapidKey });

    if (token) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('[Push Notifications] FCM Token obtained:', token);
      }
      return token;
    } else {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[Push Notifications] No registration token available');
      }
      return null;
    }
  } catch (error) {
    console.error('[Push Notifications] Error requesting permission:', error);
    return null;
  }
}

/**
 * Register device token with backend
 * @param token FCM token
 */
export async function registerDeviceToken(token: string): Promise<void> {
  try {
    await registerToken(token);
    if (process.env.NODE_ENV !== 'production') {
      console.log('[Push Notifications] Token registered with backend');
    }
  } catch (error) {
    console.error('[Push Notifications] Failed to register token:', error);
    throw error;
  }
}

/**
 * Setup foreground message handler
 * @param callback Function to call when message is received
 */
export function onForegroundMessage(callback: (payload: any) => void): void {
  if (!messaging) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[Push Notifications] Firebase messaging not initialized');
    }
    return;
  }

  onMessage(messaging, (payload) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log('[Push Notifications] Foreground message received:', payload);
    }
    callback(payload);
  });
}

/**
 * Setup push notifications with toast display for foreground messages
 * @param onNotificationClick Optional callback when notification is clicked
 */
export function setupPushNotifications(
  onNotificationClick?: (url?: string) => void
): void {
  // Prevent registering multiple listeners (React StrictMode, component remounts)
  if (pushHandlerInitialized) {
    return;
  }
  pushHandlerInitialized = true;

  onForegroundMessage((payload) => {
    const { notification, data } = payload;

    if (!notification) return;

    const title = notification.title || 'Notificação';
    const body = notification.body || '';
    const url = data?.url;

    // Use notification ID from data if available, otherwise generate from content
    const notificationId = data?.notificationId || data?.id || `push:${title}:${body}`;

    // Skip if this notification was already shown (e.g., via socket)
    if (!shouldShowNotification(notificationId)) {
      return;
    }

    // Show toast with click action
    toast.info(title, body, {
      duration: 8000,
      action: url
        ? {
            label: 'Abrir',
            onClick: () => {
              if (onNotificationClick) {
                onNotificationClick(url);
              } else if (url) {
                window.location.href = url;
              }
            },
          }
        : undefined,
    });

    // Play notification sound (optional)
    try {
      const audio = new Audio('/notification.mp3');
      audio.play().catch(() => {
        // Ignore audio play errors (user might not have interacted with page yet)
      });
    } catch (error) {
      // Ignore audio errors
    }
  });
}

/**
 * Check if notification permission is granted
 */
export function hasNotificationPermission(): boolean {
  if (!('Notification' in window)) {
    return false;
  }
  return Notification.permission === 'granted';
}

/**
 * Check if notification permission was denied
 */
export function isNotificationPermissionDenied(): boolean {
  if (!('Notification' in window)) {
    return false;
  }
  return Notification.permission === 'denied';
}

/**
 * Initialize push notifications (request permission and register token)
 * @returns true if successful, false otherwise
 */
export async function initializePushNotifications(): Promise<boolean> {
  try {
    // Check if already granted
    if (hasNotificationPermission()) {
      const token = await requestPermission();
      if (token) {
        await registerDeviceToken(token);
        return true;
      }
      return false;
    }

    // Request permission
    const token = await requestPermission();

    if (!token) {
      return false;
    }

    // Register with backend
    await registerDeviceToken(token);

    return true;
  } catch (error) {
    console.error('[Push Notifications] Failed to initialize:', error);
    return false;
  }
}
