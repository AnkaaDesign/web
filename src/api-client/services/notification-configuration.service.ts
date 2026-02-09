// Notification Configuration Service
// API client for notification configuration endpoints

import { apiClient } from "../axiosClient";
import type {
  NotificationConfigurationGetManyResponse,
  NotificationConfigurationGetUniqueResponse,
  NotificationConfigurationCreateResponse,
  NotificationConfigurationUpdateResponse,
  NotificationConfigurationDeleteResponse,
  NotificationConfigurationQueryParams,
  CreateNotificationConfigurationDto,
  UpdateNotificationConfigurationDto,
  UpdateChannelConfigDto,
  UpdateSectorOverrideDto,
  TestConfigurationDto,
  TestConfigurationResponse,
  SendByConfigurationDto,
  SendByConfigurationResponse,
  UserPreferencesListResponse,
  UserPreferenceResponse,
  AvailableConfigurationsResponse,
  UpdateUserPreferenceDto,
  NotificationChannelConfig,
  NotificationSectorOverride,
} from "../../types/notification-configuration";
import type { NOTIFICATION_CHANNEL, SECTOR_PRIVILEGES } from "../../constants";

// =====================
// Admin Configuration Service
// =====================

export class NotificationConfigurationService {
  private readonly basePath = "/api/notification-configurations";

  // =====================
  // CRUD Operations
  // =====================

  /**
   * Get all notification configurations with optional filters
   */
  async getConfigurations(params: NotificationConfigurationQueryParams = {}): Promise<NotificationConfigurationGetManyResponse> {
    const response = await apiClient.get<NotificationConfigurationGetManyResponse>(this.basePath, { params });
    return response.data;
  }

  /**
   * Get a single notification configuration by key
   */
  async getConfigurationByKey(key: string): Promise<NotificationConfigurationGetUniqueResponse> {
    const response = await apiClient.get<NotificationConfigurationGetUniqueResponse>(`${this.basePath}/${key}`);
    return response.data;
  }

  /**
   * Create a new notification configuration
   */
  async createConfiguration(data: CreateNotificationConfigurationDto): Promise<NotificationConfigurationCreateResponse> {
    const response = await apiClient.post<NotificationConfigurationCreateResponse>(this.basePath, data);
    return response.data;
  }

  /**
   * Update an existing notification configuration
   */
  async updateConfiguration(id: string, data: UpdateNotificationConfigurationDto): Promise<NotificationConfigurationUpdateResponse> {
    const response = await apiClient.put<NotificationConfigurationUpdateResponse>(`${this.basePath}/${id}`, data);
    return response.data;
  }

  /**
   * Delete a notification configuration
   */
  async deleteConfiguration(id: string): Promise<NotificationConfigurationDeleteResponse> {
    const response = await apiClient.delete<NotificationConfigurationDeleteResponse>(`${this.basePath}/${id}`);
    return response.data;
  }

  // =====================
  // Channel Operations
  // =====================

  /**
   * Update channel configuration for a notification configuration
   */
  async updateChannelConfig(
    configId: string,
    channel: NOTIFICATION_CHANNEL,
    data: UpdateChannelConfigDto
  ): Promise<{ success: boolean; message: string; data?: NotificationChannelConfig }> {
    const response = await apiClient.put<{ success: boolean; message: string; data?: NotificationChannelConfig }>(
      `${this.basePath}/${configId}/channels/${channel}`,
      data
    );
    return response.data;
  }

  // =====================
  // Sector Override Operations
  // =====================

  /**
   * Update sector override for a notification configuration
   */
  async updateSectorOverride(
    configId: string,
    sector: SECTOR_PRIVILEGES,
    data: UpdateSectorOverrideDto
  ): Promise<{ success: boolean; message: string; data?: NotificationSectorOverride }> {
    const response = await apiClient.put<{ success: boolean; message: string; data?: NotificationSectorOverride }>(
      `${this.basePath}/${configId}/sectors/${sector}`,
      data
    );
    return response.data;
  }

  // =====================
  // Test & Send Operations
  // =====================

  /**
   * Test a notification configuration (dry run)
   */
  async testConfiguration(key: string, data: TestConfigurationDto = {}): Promise<TestConfigurationResponse> {
    const response = await apiClient.post<TestConfigurationResponse>(`${this.basePath}/${key}/test`, data);
    return response.data;
  }

  /**
   * Send notifications using a configuration
   */
  async sendByConfiguration(key: string, data: SendByConfigurationDto): Promise<SendByConfigurationResponse> {
    const response = await apiClient.post<SendByConfigurationResponse>(`${this.basePath}/${key}/send`, data);
    return response.data;
  }
}

// =====================
// User Preference Service
// =====================

export class NotificationUserPreferenceService {
  private readonly basePath = "/api/notifications/preferences";

  /**
   * Get all user preferences for the authenticated user
   */
  async getMyPreferences(): Promise<UserPreferencesListResponse> {
    const response = await apiClient.get<UserPreferencesListResponse>(`${this.basePath}/my-preferences`);
    return response.data;
  }

  /**
   * Get user preference for a specific configuration
   */
  async getMyPreference(configKey: string): Promise<{ success: boolean; message: string; data?: UserPreferenceResponse }> {
    const response = await apiClient.get<{ success: boolean; message: string; data?: UserPreferenceResponse }>(
      `${this.basePath}/my-preferences/${configKey}`
    );
    return response.data;
  }

  /**
   * Update user preference for a specific configuration
   */
  async updateMyPreference(
    configKey: string,
    data: UpdateUserPreferenceDto
  ): Promise<{ success: boolean; message: string; data?: UserPreferenceResponse }> {
    const response = await apiClient.put<{ success: boolean; message: string; data?: UserPreferenceResponse }>(
      `${this.basePath}/my-preferences/${configKey}`,
      data
    );
    return response.data;
  }

  /**
   * Reset user preference to defaults for a specific configuration
   */
  async resetMyPreference(configKey: string): Promise<{ success: boolean; message: string; data?: UserPreferenceResponse }> {
    const response = await apiClient.post<{ success: boolean; message: string; data?: UserPreferenceResponse }>(
      `${this.basePath}/my-preferences/${configKey}/reset`
    );
    return response.data;
  }

  /**
   * Get available configurations for the authenticated user (grouped by type)
   */
  async getAvailableConfigurations(): Promise<AvailableConfigurationsResponse> {
    const response = await apiClient.get<AvailableConfigurationsResponse>(`${this.basePath}/available-configurations`);
    return response.data;
  }
}

// =====================
// Service Instances & Exports
// =====================

export const notificationConfigurationService = new NotificationConfigurationService();
export const notificationUserPreferenceService = new NotificationUserPreferenceService();

// Admin configuration exports
export const getConfigurations = (params?: NotificationConfigurationQueryParams) =>
  notificationConfigurationService.getConfigurations(params || {});
export const getConfigurationByKey = (key: string) =>
  notificationConfigurationService.getConfigurationByKey(key);
export const createConfiguration = (data: CreateNotificationConfigurationDto) =>
  notificationConfigurationService.createConfiguration(data);
export const updateConfiguration = (id: string, data: UpdateNotificationConfigurationDto) =>
  notificationConfigurationService.updateConfiguration(id, data);
export const deleteConfiguration = (id: string) =>
  notificationConfigurationService.deleteConfiguration(id);
export const updateChannelConfig = (configId: string, channel: NOTIFICATION_CHANNEL, data: UpdateChannelConfigDto) =>
  notificationConfigurationService.updateChannelConfig(configId, channel, data);
export const updateSectorOverride = (configId: string, sector: SECTOR_PRIVILEGES, data: UpdateSectorOverrideDto) =>
  notificationConfigurationService.updateSectorOverride(configId, sector, data);
export const testConfiguration = (key: string, data?: TestConfigurationDto) =>
  notificationConfigurationService.testConfiguration(key, data);
export const sendByConfiguration = (key: string, data: SendByConfigurationDto) =>
  notificationConfigurationService.sendByConfiguration(key, data);

// User preference exports
export const getMyPreferences = () =>
  notificationUserPreferenceService.getMyPreferences();
export const getMyPreference = (configKey: string) =>
  notificationUserPreferenceService.getMyPreference(configKey);
export const updateMyPreference = (configKey: string, data: UpdateUserPreferenceDto) =>
  notificationUserPreferenceService.updateMyPreference(configKey, data);
export const resetMyPreference = (configKey: string) =>
  notificationUserPreferenceService.resetMyPreference(configKey);
export const getAvailableConfigurations = () =>
  notificationUserPreferenceService.getAvailableConfigurations();
