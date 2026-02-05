import { apiClient } from "../axiosClient";
import type { UserNotificationPreference } from "../../types";

// =====================
// Notification Channel Types
// =====================

export type NotificationChannel = "IN_APP" | "EMAIL" | "PUSH" | "WHATSAPP";
export type NotificationImportance = "LOW" | "NORMAL" | "HIGH" | "URGENT";

// =====================
// Configuration-Driven API Types (New)
// =====================

export interface ChannelPreferenceDetail {
  channel: NotificationChannel;
  enabled: boolean;
  mandatory: boolean;
  defaultOn: boolean;
  userEnabled: boolean;
}

export interface UserPreferenceConfig {
  configKey: string;
  name: string | null;
  description: string;
  importance: NotificationImportance;
  channels: ChannelPreferenceDetail[];
}

export interface NotificationTypeGroup {
  notificationType: string;
  configurations: UserPreferenceConfig[];
}

export type GroupedConfigurationsResponse = NotificationTypeGroup[];

export interface AvailableConfigurationsApiResponse {
  success: boolean;
  message: string;
  data?: GroupedConfigurationsResponse;
}

export interface UpdateUserPreferencePayload {
  channels: NotificationChannel[];
}

export interface UpdateUserPreferenceApiResponse {
  success: boolean;
  message: string;
  data?: {
    configKey: string;
    channels: NotificationChannel[];
  };
}

export interface ResetPreferenceApiResponse {
  success: boolean;
  message: string;
}

// =====================
// Legacy Request/Response Types
// =====================

export interface UserNotificationPreferenceGetManyResponse {
  success: boolean;
  message: string;
  data?: UserNotificationPreference[];
  meta?: {
    totalRecords: number;
    page: number;
    hasNextPage: boolean;
  };
}

export interface UserNotificationPreferenceUpdateResponse {
  success: boolean;
  message: string;
  data?: UserNotificationPreference;
}

export interface UpdatePreferencePayload {
  eventType: string;
  channels: string[];
}

export interface BatchUpdatePreferencesPayload {
  preferences: Array<{
    type: string;
    eventType: string;
    channels: string[];
  }>;
}

export interface BatchUpdatePreferencesResponse {
  success: boolean;
  message: string;
  data: { updated: number };
}

// =====================
// Notification Preference Service
// =====================

export const notificationPreferenceService = {
  /**
   * Get all notification preferences for a user
   */
  getPreferences: (userId: string) =>
    apiClient.get<UserNotificationPreferenceGetManyResponse>(
      `/users/${userId}/notification-preferences`
    ),

  /**
   * Update a single notification preference
   */
  updatePreference: (
    userId: string,
    type: string,
    data: UpdatePreferencePayload
  ) =>
    apiClient.put<UserNotificationPreferenceUpdateResponse>(
      `/users/${userId}/notification-preferences/${type}`,
      data
    ),

  /**
   * Batch update notification preferences
   */
  batchUpdatePreferences: (userId: string, data: BatchUpdatePreferencesPayload) => {
    // Ensure arrays are properly serialized (not as objects with numeric keys)
    const cleanData = {
      preferences: Array.isArray(data.preferences)
        ? data.preferences.map(p => ({
            type: p.type,
            eventType: p.eventType,
            channels: Array.isArray(p.channels) ? [...p.channels] : Object.values(p.channels as any),
          }))
        : Object.values(data.preferences as any).map((p: any) => ({
            type: p.type,
            eventType: p.eventType,
            channels: Array.isArray(p.channels) ? [...p.channels] : Object.values(p.channels),
          })),
    };

    return apiClient.put<BatchUpdatePreferencesResponse>(
      `/users/${userId}/notification-preferences/batch`,
      cleanData,
      {
        headers: {
          'Content-Type': 'application/json',
        },
        transformRequest: [(data) => JSON.stringify(data)],
      }
    );
  },

  /**
   * Reset preferences to defaults
   */
  resetPreferences: (userId: string) =>
    apiClient.post<{ success: boolean; message: string }>(
      `/users/${userId}/notification-preferences/reset`,
      { confirm: true }
    ),

  /**
   * Get default preferences (public endpoint)
   */
  getDefaults: () =>
    apiClient.get<{
      success: boolean;
      message: string;
      data: Array<{
        type: string;
        eventType: string | null;
        channels: string[];
        mandatory: boolean;
      }>;
    }>("/notification-preferences/defaults"),
};

// =====================
// Configuration-Driven User Preference Service (New)
// =====================

export const notificationUserPreferenceService = {
  /**
   * Get all available notification configurations grouped by type.
   * This returns the user's current preference state for each configuration.
   */
  getAvailableConfigurations: () =>
    apiClient.get<AvailableConfigurationsApiResponse>("/api/notifications/preferences/available-configurations"),

  /**
   * Update user preference for a specific configuration.
   * The channels array should contain the channels the user wants enabled.
   */
  updatePreference: (configKey: string, data: UpdateUserPreferencePayload) =>
    apiClient.put<UpdateUserPreferenceApiResponse>(
      `/api/notifications/preferences/my-preferences/${configKey}`,
      data
    ),

  /**
   * Reset user preference for a specific configuration to defaults.
   */
  resetPreference: (configKey: string) =>
    apiClient.post<ResetPreferenceApiResponse>(
      `/api/notifications/preferences/my-preferences/${configKey}/reset`
    ),
};

// =====================
// WhatsApp QR Code Types
// =====================

export type WhatsAppStatus = "CONNECTING" | "QR_READY" | "AUTHENTICATED" | "READY" | "AUTH_FAILURE" | "DISCONNECTED";

export interface WhatsAppQRResponse {
  success: boolean;
  message?: string;
  data?: {
    qr: string; // Base64 encoded QR code image or URL
    generatedAt: string; // ISO date string
    expiresAt: string; // ISO date string
    message?: string;
  };
}

export interface WhatsAppStatusResponse {
  success: boolean;
  message?: string;
  data?: {
    status: WhatsAppStatus;
    ready: boolean;
    initializing: boolean;
    hasQRCode: boolean;
    qrCodeExpiry?: string | null;
    reconnectAttempts: number;
    lastUpdated?: string;
    message: string;
  };
}

export interface WhatsAppDisconnectResponse {
  success: boolean;
  message: string;
}

// =====================
// WhatsApp Service
// =====================

export const whatsAppService = {
  /**
   * Get WhatsApp QR code for authentication
   */
  getWhatsAppQR: () =>
    apiClient.get<WhatsAppQRResponse>("/whatsapp/qr"),

  /**
   * Get current WhatsApp connection status
   */
  getWhatsAppStatus: () =>
    apiClient.get<WhatsAppStatusResponse>("/whatsapp/connection-status"),

  /**
   * Regenerate WhatsApp QR code
   */
  regenerateQR: () =>
    apiClient.get<WhatsAppQRResponse>("/whatsapp/admin/qr-code"),

  /**
   * Reconnect WhatsApp client (destroys and recreates)
   */
  reconnect: () =>
    apiClient.post<{ success: boolean; message: string }>("/whatsapp/reconnect"),

  /**
   * Disconnect WhatsApp session
   */
  disconnect: () =>
    apiClient.post<WhatsAppDisconnectResponse>("/whatsapp/disconnect"),
};

// Export types for external use
export type {
  UserNotificationPreference,
  UserNotificationPreferenceGetManyResponse,
  UserNotificationPreferenceUpdateResponse,
  WhatsAppStatus,
  WhatsAppQRResponse,
  WhatsAppStatusResponse,
  WhatsAppDisconnectResponse,
  // New configuration-driven types
  NotificationChannel,
  NotificationImportance,
  ChannelPreferenceDetail,
  UserPreferenceConfig,
  GroupedConfigurationsResponse,
  AvailableConfigurationsApiResponse,
  UpdateUserPreferencePayload,
  UpdateUserPreferenceApiResponse,
  ResetPreferenceApiResponse,
};
