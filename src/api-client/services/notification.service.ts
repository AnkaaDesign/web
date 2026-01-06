import { apiClient } from "../axiosClient";
import type { UserNotificationPreference } from "../../types";

// =====================
// Request/Response Types
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
    eventType: string | null;
    channels: string[];
  }>;
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
};
