// Notification Configuration Types
// Based on API implementation at /api/notification-configurations

import type { BaseEntity, BaseGetUniqueResponse, BaseGetManyResponse, BaseCreateResponse, BaseUpdateResponse, BaseDeleteResponse } from "./common";
import type { NOTIFICATION_TYPE, NOTIFICATION_CHANNEL, NOTIFICATION_IMPORTANCE, SECTOR_PRIVILEGES } from "../constants";

// =====================
// Notification Configuration Entity
// =====================

export interface NotificationConfiguration extends BaseEntity {
  key: string;
  name?: string | null;
  notificationType: NOTIFICATION_TYPE;
  eventType: string;
  description?: string | null;
  enabled: boolean;
  importance: NOTIFICATION_IMPORTANCE;
  workHoursOnly: boolean;
  batchingEnabled: boolean;
  maxFrequencyPerDay?: number | null;
  deduplicationWindow?: number | null;
  templates?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;

  // Relations
  channelConfigs: NotificationChannelConfig[];
  sectorOverrides: NotificationSectorOverride[];
  targetRule?: NotificationTargetRule | null;
  rules?: NotificationRule[];
}

export interface NotificationChannelConfig extends BaseEntity {
  configurationId: string;
  channel: NOTIFICATION_CHANNEL;
  enabled: boolean;
  mandatory: boolean;
  defaultOn: boolean;
  minImportance?: NOTIFICATION_IMPORTANCE | null;
}

export interface NotificationSectorOverride extends BaseEntity {
  configurationId: string;
  sector: SECTOR_PRIVILEGES;
  channelOverrides?: Record<string, unknown> | null;
  importanceOverride?: NOTIFICATION_IMPORTANCE | null;
}

export interface NotificationTargetRule extends BaseEntity {
  configurationId: string;
  allowedSectors: SECTOR_PRIVILEGES[];
  excludeInactive: boolean;
  excludeOnVacation: boolean;
  customFilter?: string | null;
}

export interface NotificationRule extends BaseEntity {
  configurationId: string;
  ruleType: string;
  ruleConfig: Record<string, unknown>;
  priority: number;
}

// =====================
// User Preference Types (new API)
// =====================

export interface ChannelPreferenceDetail {
  channel: NOTIFICATION_CHANNEL;
  enabled: boolean;
  mandatory: boolean;
  defaultOn: boolean;
  userEnabled: boolean;
}

export interface UserPreferenceResponse {
  configKey: string;
  description: string;
  importance: NOTIFICATION_IMPORTANCE;
  channels: ChannelPreferenceDetail[];
}

export interface GroupedConfigurationsResponse {
  [notificationType: string]: UserPreferenceResponse[];
}

// =====================
// Request DTOs
// =====================

export interface CreateNotificationConfigurationDto {
  key: string;
  notificationType: NOTIFICATION_TYPE;
  eventType: string;
  description?: string;
  enabled?: boolean;
  importance?: NOTIFICATION_IMPORTANCE;
  workHoursOnly?: boolean;
  batchingEnabled?: boolean;
  maxFrequencyPerDay?: number;
  deduplicationWindow?: number;
  templates?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  channels?: Array<{
    channel: NOTIFICATION_CHANNEL;
    enabled: boolean;
    mandatory: boolean;
    defaultOn: boolean;
    minImportance?: NOTIFICATION_IMPORTANCE;
  }>;
  targetRules?: {
    allowedSectors?: SECTOR_PRIVILEGES[];
    excludeInactive?: boolean;
    excludeOnVacation?: boolean;
    customFilter?: string;
  };
}

export interface UpdateNotificationConfigurationDto {
  key?: string;
  notificationType?: NOTIFICATION_TYPE;
  eventType?: string;
  description?: string;
  enabled?: boolean;
  importance?: NOTIFICATION_IMPORTANCE;
  workHoursOnly?: boolean;
  batchingEnabled?: boolean;
  maxFrequencyPerDay?: number;
  deduplicationWindow?: number;
  templates?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface UpdateChannelConfigDto {
  enabled?: boolean;
  mandatory?: boolean;
  defaultOn?: boolean;
  minImportance?: NOTIFICATION_IMPORTANCE;
}

export interface UpdateSectorOverrideDto {
  channelOverrides?: Record<string, unknown>;
  importanceOverride?: NOTIFICATION_IMPORTANCE;
}

export interface TestConfigurationDto {
  templateVariables?: Record<string, unknown>;
  targetUserIds?: string[];
  targetSectorIds?: string[];
}

export interface SendByConfigurationDto {
  userId?: string;
  userIds?: string[];
  sectorId?: string;
  sectorIds?: string[];
  templateVariables?: Record<string, unknown>;
  actionUrl?: string;
  importanceOverride?: NOTIFICATION_IMPORTANCE;
  channelOverride?: NOTIFICATION_CHANNEL[];
  forceSend?: boolean;
  scheduledAt?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateUserPreferenceDto {
  channels: NOTIFICATION_CHANNEL[];
}

// =====================
// Query Parameters
// =====================

export interface NotificationConfigurationQueryParams {
  notificationType?: NOTIFICATION_TYPE;
  enabled?: boolean;
  importance?: NOTIFICATION_IMPORTANCE;
  search?: string;
  page?: number;
  limit?: number;
}

// =====================
// Response Types
// =====================

export interface NotificationConfigurationGetUniqueResponse extends BaseGetUniqueResponse<NotificationConfiguration> {}

export interface NotificationConfigurationGetManyResponse extends BaseGetManyResponse<NotificationConfiguration> {}

export interface NotificationConfigurationCreateResponse extends BaseCreateResponse<NotificationConfiguration> {}

export interface NotificationConfigurationUpdateResponse extends BaseUpdateResponse<NotificationConfiguration> {}

export interface NotificationConfigurationDeleteResponse extends BaseDeleteResponse {}

export interface TestConfigurationResponse {
  success: boolean;
  message: string;
  data?: {
    configuration: {
      key: string;
      notificationType: NOTIFICATION_TYPE;
      eventType: string;
      importance: NOTIFICATION_IMPORTANCE;
      enabled: boolean;
    };
    testResults: {
      totalRecipients: number;
      recipients: Array<{
        user: {
          id: string;
          name: string;
          email: string;
          sector?: string;
        };
        channels: Array<{
          channel: NOTIFICATION_CHANNEL;
          mandatory: boolean;
          defaultOn: boolean;
          userEnabled: boolean;
          wouldSend: boolean;
        }>;
      }>;
      renderedTemplates?: Record<string, unknown>;
      channelSummary: Record<string, { total: number; wouldReceive: number }>;
    };
  };
}

export interface SendByConfigurationResponse {
  success: boolean;
  message: string;
  data?: {
    configurationKey: string;
    notificationsCreated: number;
    targetUserIds: string[];
    channels: NOTIFICATION_CHANNEL[];
    scheduledAt?: string | null;
  };
}

export interface UserPreferencesListResponse {
  success: boolean;
  message: string;
  data?: UserPreferenceResponse[];
}

export interface AvailableConfigurationsResponse {
  success: boolean;
  message: string;
  data?: GroupedConfigurationsResponse;
}

// =====================
// Constants
// =====================

export const NOTIFICATION_TYPE_LABELS: Record<string, string> = {
  SYSTEM: "Sistema",
  PRODUCTION: "Produção",
  STOCK: "Estoque",
  USER: "Usuário",
  GENERAL: "Geral",
};

export const NOTIFICATION_CHANNEL_LABELS: Record<string, string> = {
  IN_APP: "No App",
  PUSH: "Push",
  EMAIL: "E-mail",
  WHATSAPP: "WhatsApp",
};

export const NOTIFICATION_IMPORTANCE_LABELS: Record<string, string> = {
  LOW: "Baixa",
  NORMAL: "Normal",
  HIGH: "Alta",
  URGENT: "Urgente",
};

export const NOTIFICATION_CHANNEL_COLORS: Record<string, string> = {
  IN_APP: "#f97316", // Orange
  PUSH: "#3b82f6",   // Blue
  EMAIL: "#a855f7",  // Purple
  WHATSAPP: "#22c55e", // Green
};

export const NOTIFICATION_IMPORTANCE_COLORS: Record<string, string> = {
  LOW: "#9CA3AF",    // Gray
  NORMAL: "#3B82F6", // Blue
  HIGH: "#F59E0B",   // Orange
  URGENT: "#EF4444", // Red
};
