/**
 * Push Notifications Type Definitions
 */

/**
 * Firebase Cloud Messaging payload structure
 */
export interface FCMPayload {
  notification?: {
    title?: string;
    body?: string;
    icon?: string;
    badge?: string;
    image?: string;
    tag?: string;
    requireInteraction?: boolean;
  };
  data?: {
    url?: string;
    [key: string]: any;
  };
  fcmOptions?: {
    link?: string;
  };
}

/**
 * Notification permission state
 */
export type NotificationPermission = 'default' | 'granted' | 'denied';

/**
 * Device types for push notifications
 */
export type DeviceType = 'web' | 'ios' | 'android';

/**
 * Registered device information
 */
export interface RegisteredDevice {
  id: number;
  userId: number;
  token: string;
  deviceType: DeviceType;
  deviceName?: string;
  createdAt: Date;
  lastUsedAt: Date;
}

/**
 * Push notification options
 */
export interface PushNotificationOptions {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  url?: string;
  requireInteraction?: boolean;
  vibrate?: number[];
  data?: Record<string, any>;
}

/**
 * Notification display configuration
 */
export interface NotificationDisplayConfig {
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
  cancel?: {
    label: string;
    onClick?: () => void;
  };
}

/**
 * Foreground message callback
 */
export type ForegroundMessageCallback = (payload: FCMPayload) => void;

/**
 * Notification click callback
 */
export type NotificationClickCallback = (url?: string) => void;

/**
 * Push notification service interface
 */
export interface PushNotificationService {
  requestPermission(): Promise<string | null>;
  registerDeviceToken(token: string): Promise<void>;
  onForegroundMessage(callback: ForegroundMessageCallback): void;
  setupPushNotifications(onNotificationClick?: NotificationClickCallback): void;
  hasNotificationPermission(): boolean;
  isNotificationPermissionDenied(): boolean;
  initializePushNotifications(): Promise<boolean>;
}

/**
 * Service worker message event
 */
export interface ServiceWorkerMessageEvent extends ExtendableEvent {
  data: FCMPayload;
}

/**
 * Service worker notification click event
 */
export interface ServiceWorkerNotificationClickEvent extends ExtendableEvent {
  notification: Notification;
  action: string;
}
