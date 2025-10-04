// packages/api-client/src/notification.ts

import { apiClient } from "./axiosClient";
import type {
  // Schema types (for parameters)
  NotificationGetManyFormData,
  NotificationGetByIdFormData,
  NotificationCreateFormData,
  NotificationUpdateFormData,
  NotificationBatchCreateFormData,
  NotificationBatchUpdateFormData,
  NotificationBatchDeleteFormData,
  NotificationQueryFormData,
  SeenNotificationGetManyFormData,
  SeenNotificationGetByIdFormData,
  SeenNotificationCreateFormData,
  SeenNotificationUpdateFormData,
  SeenNotificationBatchCreateFormData,
  SeenNotificationBatchUpdateFormData,
  SeenNotificationBatchDeleteFormData,
  SeenNotificationQueryFormData,
} from "../schemas";
import type {
  // Interface types (for responses)
  Notification,
  SeenNotification,
  NotificationGetUniqueResponse,
  NotificationGetManyResponse,
  NotificationCreateResponse,
  NotificationUpdateResponse,
  NotificationDeleteResponse,
  NotificationBatchCreateResponse,
  NotificationBatchUpdateResponse,
  NotificationBatchDeleteResponse,
  SeenNotificationGetUniqueResponse,
  SeenNotificationGetManyResponse,
  SeenNotificationCreateResponse,
  SeenNotificationUpdateResponse,
  SeenNotificationDeleteResponse,
  SeenNotificationBatchCreateResponse,
  SeenNotificationBatchUpdateResponse,
  SeenNotificationBatchDeleteResponse,
} from "../types";

// =====================
// Notification Service Class
// =====================

export class NotificationService {
  private readonly basePath = "/notifications";

  // =====================
  // Query Operations
  // =====================

  async getNotifications(params: NotificationGetManyFormData = {}): Promise<NotificationGetManyResponse> {
    const response = await apiClient.get<NotificationGetManyResponse>(this.basePath, { params });
    return response.data;
  }

  async getNotificationById(id: string, params?: Omit<NotificationGetByIdFormData, "id">): Promise<NotificationGetUniqueResponse> {
    const response = await apiClient.get<NotificationGetUniqueResponse>(`${this.basePath}/${id}`, {
      params,
    });
    return response.data;
  }

  // =====================
  // CRUD Operations
  // =====================

  async createNotification(data: NotificationCreateFormData, params?: NotificationQueryFormData): Promise<NotificationCreateResponse> {
    const response = await apiClient.post<NotificationCreateResponse>(this.basePath, data, { params });
    return response.data;
  }

  async updateNotification(id: string, data: NotificationUpdateFormData, params?: NotificationQueryFormData): Promise<NotificationUpdateResponse> {
    const response = await apiClient.put<NotificationUpdateResponse>(`${this.basePath}/${id}`, data, { params });
    return response.data;
  }

  async deleteNotification(id: string): Promise<NotificationDeleteResponse> {
    const response = await apiClient.delete<NotificationDeleteResponse>(`${this.basePath}/${id}`);
    return response.data;
  }

  // =====================
  // Batch Operations
  // =====================

  async batchCreateNotifications(data: NotificationBatchCreateFormData, params?: NotificationQueryFormData): Promise<NotificationBatchCreateResponse<Notification>> {
    const response = await apiClient.post<NotificationBatchCreateResponse<Notification>>(`${this.basePath}/batch`, data, { params });
    return response.data;
  }

  async batchUpdateNotifications(data: NotificationBatchUpdateFormData, params?: NotificationQueryFormData): Promise<NotificationBatchUpdateResponse<Notification>> {
    const response = await apiClient.put<NotificationBatchUpdateResponse<Notification>>(`${this.basePath}/batch`, data, { params });
    return response.data;
  }

  async batchDeleteNotifications(data: NotificationBatchDeleteFormData): Promise<NotificationBatchDeleteResponse> {
    const response = await apiClient.delete<NotificationBatchDeleteResponse>(`${this.basePath}/batch`, { data });
    return response.data;
  }

  // =====================
  // Specialized Operations
  // =====================

  async getNotificationsByUser(userId: string, params: NotificationGetManyFormData = {}): Promise<NotificationGetManyResponse> {
    return this.getNotifications({ ...params, userIds: [userId] });
  }

  async getUnreadNotifications(userId: string, params: NotificationGetManyFormData = {}): Promise<NotificationGetManyResponse> {
    return this.getNotifications({ ...params, userIds: [userId], unread: true });
  }

  async markAsRead(notificationId: string, userId: string): Promise<SeenNotificationCreateResponse> {
    const response = await apiClient.post<SeenNotificationCreateResponse>(`${this.basePath}/${notificationId}/mark-as-read`, { userId });
    return response.data;
  }

  async markAllAsRead(userId: string): Promise<{ count: number }> {
    const response = await apiClient.post<{ count: number }>(`${this.basePath}/mark-all-as-read`, { userId });
    return response.data;
  }

  async sendNotification(notificationId: string): Promise<NotificationUpdateResponse> {
    const response = await apiClient.post<NotificationUpdateResponse>(`${this.basePath}/${notificationId}/send`);
    return response.data;
  }
}

// =====================
// SeenNotification Service Class
// =====================

export class SeenNotificationService {
  private readonly basePath = "/seen-notifications";

  // =====================
  // Query Operations
  // =====================

  async getSeenNotifications(params: SeenNotificationGetManyFormData = {}): Promise<SeenNotificationGetManyResponse> {
    const response = await apiClient.get<SeenNotificationGetManyResponse>(this.basePath, { params });
    return response.data;
  }

  async getSeenNotificationById(params: SeenNotificationGetByIdFormData): Promise<SeenNotificationGetUniqueResponse> {
    const { id, ...queryParams } = params;
    const response = await apiClient.get<SeenNotificationGetUniqueResponse>(`${this.basePath}/${id}`, {
      params: queryParams,
    });
    return response.data;
  }

  // =====================
  // CRUD Operations
  // =====================

  async createSeenNotification(data: SeenNotificationCreateFormData, params?: SeenNotificationQueryFormData): Promise<SeenNotificationCreateResponse> {
    const response = await apiClient.post<SeenNotificationCreateResponse>(this.basePath, data, { params });
    return response.data;
  }

  async updateSeenNotification(id: string, data: SeenNotificationUpdateFormData, params?: SeenNotificationQueryFormData): Promise<SeenNotificationUpdateResponse> {
    const response = await apiClient.put<SeenNotificationUpdateResponse>(`${this.basePath}/${id}`, data, { params });
    return response.data;
  }

  async deleteSeenNotification(id: string): Promise<SeenNotificationDeleteResponse> {
    const response = await apiClient.delete<SeenNotificationDeleteResponse>(`${this.basePath}/${id}`);
    return response.data;
  }

  // =====================
  // Batch Operations
  // =====================

  async batchCreateSeenNotifications(
    data: SeenNotificationBatchCreateFormData,
    params?: SeenNotificationQueryFormData,
  ): Promise<SeenNotificationBatchCreateResponse<SeenNotification>> {
    const response = await apiClient.post<SeenNotificationBatchCreateResponse<SeenNotification>>(`${this.basePath}/batch`, data, { params });
    return response.data;
  }

  async batchUpdateSeenNotifications(
    data: SeenNotificationBatchUpdateFormData,
    params?: SeenNotificationQueryFormData,
  ): Promise<SeenNotificationBatchUpdateResponse<SeenNotification>> {
    const response = await apiClient.put<SeenNotificationBatchUpdateResponse<SeenNotification>>(`${this.basePath}/batch`, data, { params });
    return response.data;
  }

  async batchDeleteSeenNotifications(data: SeenNotificationBatchDeleteFormData): Promise<SeenNotificationBatchDeleteResponse> {
    const response = await apiClient.delete<SeenNotificationBatchDeleteResponse>(`${this.basePath}/batch`, { data });
    return response.data;
  }

  // =====================
  // Specialized Operations
  // =====================

  async getSeenNotificationsByUser(userId: string, params: SeenNotificationGetManyFormData = {}): Promise<SeenNotificationGetManyResponse> {
    return this.getSeenNotifications({ ...params, userIds: [userId] });
  }

  async getSeenNotificationsByNotification(notificationId: string, params: SeenNotificationGetManyFormData = {}): Promise<SeenNotificationGetManyResponse> {
    return this.getSeenNotifications({ ...params, notificationIds: [notificationId] });
  }
}

// =====================
// Service Instances & Exports
// =====================

export const notificationService = new NotificationService();
export const seenNotificationService = new SeenNotificationService();

// Notification exports
export const getNotifications = (params?: NotificationGetManyFormData) => notificationService.getNotifications(params || {});
export const getNotificationById = (id: string, params?: Omit<NotificationGetByIdFormData, "id">) => notificationService.getNotificationById(id, params);
export const createNotification = (data: NotificationCreateFormData, params?: NotificationQueryFormData) => notificationService.createNotification(data, params);
export const updateNotification = (id: string, data: NotificationUpdateFormData, params?: NotificationQueryFormData) => notificationService.updateNotification(id, data, params);
export const deleteNotification = (id: string) => notificationService.deleteNotification(id);
export const batchCreateNotifications = (data: NotificationBatchCreateFormData, params?: NotificationQueryFormData) => notificationService.batchCreateNotifications(data, params);
export const batchUpdateNotifications = (data: NotificationBatchUpdateFormData, params?: NotificationQueryFormData) => notificationService.batchUpdateNotifications(data, params);
export const batchDeleteNotifications = (data: NotificationBatchDeleteFormData) => notificationService.batchDeleteNotifications(data);
export const getNotificationsByUser = (userId: string, params?: NotificationGetManyFormData) => notificationService.getNotificationsByUser(userId, params || {});
export const getUnreadNotifications = (userId: string, params?: NotificationGetManyFormData) => notificationService.getUnreadNotifications(userId, params || {});
export const markAsRead = (notificationId: string, userId: string) => notificationService.markAsRead(notificationId, userId);
export const markAllAsRead = (userId: string) => notificationService.markAllAsRead(userId);
export const sendNotification = (notificationId: string) => notificationService.sendNotification(notificationId);

// SeenNotification exports
export const getSeenNotifications = (params?: SeenNotificationGetManyFormData) => seenNotificationService.getSeenNotifications(params || {});
export const getSeenNotificationById = (id: string, params?: Omit<SeenNotificationGetByIdFormData, "id">) => seenNotificationService.getSeenNotificationById({ id, ...params });
export const createSeenNotification = (data: SeenNotificationCreateFormData, params?: SeenNotificationQueryFormData) =>
  seenNotificationService.createSeenNotification(data, params);
export const updateSeenNotification = (id: string, data: SeenNotificationUpdateFormData, params?: SeenNotificationQueryFormData) =>
  seenNotificationService.updateSeenNotification(id, data, params);
export const deleteSeenNotification = (id: string) => seenNotificationService.deleteSeenNotification(id);
export const batchCreateSeenNotifications = (data: SeenNotificationBatchCreateFormData, params?: SeenNotificationQueryFormData) =>
  seenNotificationService.batchCreateSeenNotifications(data, params);
export const batchUpdateSeenNotifications = (data: SeenNotificationBatchUpdateFormData, params?: SeenNotificationQueryFormData) =>
  seenNotificationService.batchUpdateSeenNotifications(data, params);
export const batchDeleteSeenNotifications = (data: SeenNotificationBatchDeleteFormData) => seenNotificationService.batchDeleteSeenNotifications(data);
export const getSeenNotificationsByUser = (userId: string, params?: SeenNotificationGetManyFormData) => seenNotificationService.getSeenNotificationsByUser(userId, params || {});
export const getSeenNotificationsByNotification = (notificationId: string, params?: SeenNotificationGetManyFormData) =>
  seenNotificationService.getSeenNotificationsByNotification(notificationId, params || {});
