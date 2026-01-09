// packages/api-client/src/message.ts

import { apiClient } from "./axiosClient";
import type {
  // Schema types (for parameters)
  MessageGetManyFormData,
  MessageGetByIdFormData,
  MessageCreateFormData,
  MessageUpdateFormData,
  MessageBatchCreateFormData,
  MessageBatchUpdateFormData,
  MessageBatchDeleteFormData,
  MessageQueryFormData,
  ViewedMessageGetManyFormData,
  ViewedMessageGetByIdFormData,
  ViewedMessageCreateFormData,
  ViewedMessageUpdateFormData,
  ViewedMessageBatchCreateFormData,
  ViewedMessageBatchUpdateFormData,
  ViewedMessageBatchDeleteFormData,
  ViewedMessageQueryFormData,
} from "../schemas";
import type {
  // Interface types (for responses)
  Message,
  ViewedMessage,
  MessageGetUniqueResponse,
  MessageGetManyResponse,
  MessageCreateResponse,
  MessageUpdateResponse,
  MessageDeleteResponse,
  MessageBatchCreateResponse,
  MessageBatchUpdateResponse,
  MessageBatchDeleteResponse,
  ViewedMessageGetUniqueResponse,
  ViewedMessageGetManyResponse,
  ViewedMessageCreateResponse,
  ViewedMessageUpdateResponse,
  ViewedMessageDeleteResponse,
  ViewedMessageBatchCreateResponse,
  ViewedMessageBatchUpdateResponse,
  ViewedMessageBatchDeleteResponse,
} from "../types";

// =====================
// Message Service Class
// =====================

export class MessageService {
  private readonly basePath = "/messages";

  // =====================
  // Query Operations
  // =====================

  async getMessages(params: MessageGetManyFormData = {}): Promise<MessageGetManyResponse> {
    const response = await apiClient.get<MessageGetManyResponse>(this.basePath, { params });
    return response.data;
  }

  async getMessageById(id: string, params?: Omit<MessageGetByIdFormData, "id">): Promise<MessageGetUniqueResponse> {
    const response = await apiClient.get<MessageGetUniqueResponse>(`${this.basePath}/${id}`, {
      params,
    });
    return response.data;
  }

  // =====================
  // CRUD Operations
  // =====================

  async createMessage(data: MessageCreateFormData, params?: MessageQueryFormData): Promise<MessageCreateResponse> {
    const response = await apiClient.post<MessageCreateResponse>(this.basePath, data, { params });
    return response.data;
  }

  async updateMessage(id: string, data: MessageUpdateFormData, params?: MessageQueryFormData): Promise<MessageUpdateResponse> {
    const response = await apiClient.put<MessageUpdateResponse>(`${this.basePath}/${id}`, data, { params });
    return response.data;
  }

  async deleteMessage(id: string): Promise<MessageDeleteResponse> {
    const response = await apiClient.delete<MessageDeleteResponse>(`${this.basePath}/${id}`);
    return response.data;
  }

  // =====================
  // Batch Operations
  // =====================

  async batchCreateMessages(data: MessageBatchCreateFormData, params?: MessageQueryFormData): Promise<MessageBatchCreateResponse<Message>> {
    const response = await apiClient.post<MessageBatchCreateResponse<Message>>(`${this.basePath}/batch`, data, { params });
    return response.data;
  }

  async batchUpdateMessages(data: MessageBatchUpdateFormData, params?: MessageQueryFormData): Promise<MessageBatchUpdateResponse<Message>> {
    const response = await apiClient.put<MessageBatchUpdateResponse<Message>>(`${this.basePath}/batch`, data, { params });
    return response.data;
  }

  async batchDeleteMessages(data: MessageBatchDeleteFormData): Promise<MessageBatchDeleteResponse> {
    const response = await apiClient.delete<MessageBatchDeleteResponse>(`${this.basePath}/batch`, { data });
    return response.data;
  }

  // =====================
  // Specialized Operations
  // =====================

  async getMessagesByRecipient(recipientId: string, params: MessageGetManyFormData = {}): Promise<MessageGetManyResponse> {
    return this.getMessages({ ...params, recipientIds: [recipientId] });
  }

  async getMessagesBySender(senderId: string, params: MessageGetManyFormData = {}): Promise<MessageGetManyResponse> {
    return this.getMessages({ ...params, senderIds: [senderId] });
  }

  async getUnviewedMessages(): Promise<Message[]> {
    const response = await apiClient.get<{ success: boolean; data: Message[]; meta: { count: number } }>(`${this.basePath}/unviewed`);
    return response.data.data;
  }

  async markAsViewed(messageId: string): Promise<ViewedMessageCreateResponse> {
    const response = await apiClient.post<ViewedMessageCreateResponse>(`${this.basePath}/${messageId}/mark-viewed`);
    return response.data;
  }

  async markAllAsViewed(userId: string): Promise<{ count: number }> {
    const response = await apiClient.post<{ count: number }>(`${this.basePath}/mark-all-as-viewed`, { userId });
    return response.data;
  }

  async getMessageStats(messageId: string): Promise<{
    success: boolean;
    data: {
      totalViews: number;
      uniqueViewers: number;
      targetedUsers: number;
      totalDismissals: number;
    };
    message: string;
  }> {
    const response = await apiClient.get(`${this.basePath}/${messageId}/stats`);
    return response.data;
  }

  async dismissMessage(messageId: string): Promise<{
    success: boolean;
    data: any;
    message: string;
  }> {
    const response = await apiClient.post(`${this.basePath}/${messageId}/dismiss`);
    return response.data;
  }

  async archiveMessage(messageId: string): Promise<MessageUpdateResponse> {
    const response = await apiClient.patch<MessageUpdateResponse>(`${this.basePath}/${messageId}/archive`);
    return response.data;
  }

  async activateMessage(messageId: string): Promise<MessageUpdateResponse> {
    const response = await apiClient.patch<MessageUpdateResponse>(`${this.basePath}/${messageId}/activate`);
    return response.data;
  }
}

// =====================
// ViewedMessage Service Class
// =====================

export class ViewedMessageService {
  private readonly basePath = "/viewed-messages";

  // =====================
  // Query Operations
  // =====================

  async getViewedMessages(params: ViewedMessageGetManyFormData = {}): Promise<ViewedMessageGetManyResponse> {
    const response = await apiClient.get<ViewedMessageGetManyResponse>(this.basePath, { params });
    return response.data;
  }

  async getViewedMessageById(params: ViewedMessageGetByIdFormData): Promise<ViewedMessageGetUniqueResponse> {
    const { id, ...queryParams } = params;
    const response = await apiClient.get<ViewedMessageGetUniqueResponse>(`${this.basePath}/${id}`, {
      params: queryParams,
    });
    return response.data;
  }

  // =====================
  // CRUD Operations
  // =====================

  async createViewedMessage(data: ViewedMessageCreateFormData, params?: ViewedMessageQueryFormData): Promise<ViewedMessageCreateResponse> {
    const response = await apiClient.post<ViewedMessageCreateResponse>(this.basePath, data, { params });
    return response.data;
  }

  async updateViewedMessage(id: string, data: ViewedMessageUpdateFormData, params?: ViewedMessageQueryFormData): Promise<ViewedMessageUpdateResponse> {
    const response = await apiClient.put<ViewedMessageUpdateResponse>(`${this.basePath}/${id}`, data, { params });
    return response.data;
  }

  async deleteViewedMessage(id: string): Promise<ViewedMessageDeleteResponse> {
    const response = await apiClient.delete<ViewedMessageDeleteResponse>(`${this.basePath}/${id}`);
    return response.data;
  }

  // =====================
  // Batch Operations
  // =====================

  async batchCreateViewedMessages(
    data: ViewedMessageBatchCreateFormData,
    params?: ViewedMessageQueryFormData,
  ): Promise<ViewedMessageBatchCreateResponse<ViewedMessage>> {
    const response = await apiClient.post<ViewedMessageBatchCreateResponse<ViewedMessage>>(`${this.basePath}/batch`, data, { params });
    return response.data;
  }

  async batchUpdateViewedMessages(
    data: ViewedMessageBatchUpdateFormData,
    params?: ViewedMessageQueryFormData,
  ): Promise<ViewedMessageBatchUpdateResponse<ViewedMessage>> {
    const response = await apiClient.put<ViewedMessageBatchUpdateResponse<ViewedMessage>>(`${this.basePath}/batch`, data, { params });
    return response.data;
  }

  async batchDeleteViewedMessages(data: ViewedMessageBatchDeleteFormData): Promise<ViewedMessageBatchDeleteResponse> {
    const response = await apiClient.delete<ViewedMessageBatchDeleteResponse>(`${this.basePath}/batch`, { data });
    return response.data;
  }

  // =====================
  // Specialized Operations
  // =====================

  async getViewedMessagesByUser(userId: string, params: ViewedMessageGetManyFormData = {}): Promise<ViewedMessageGetManyResponse> {
    return this.getViewedMessages({ ...params, userIds: [userId] });
  }

  async getViewedMessagesByMessage(messageId: string, params: ViewedMessageGetManyFormData = {}): Promise<ViewedMessageGetManyResponse> {
    return this.getViewedMessages({ ...params, messageIds: [messageId] });
  }
}

// =====================
// Service Instances & Exports
// =====================

export const messageService = new MessageService();
export const viewedMessageService = new ViewedMessageService();

// Message exports
export const getMessages = (params?: MessageGetManyFormData) => messageService.getMessages(params || {});
export const getMessageById = (id: string, params?: Omit<MessageGetByIdFormData, "id">) => messageService.getMessageById(id, params);
export const createMessage = (data: MessageCreateFormData, params?: MessageQueryFormData) => messageService.createMessage(data, params);
export const updateMessage = (id: string, data: MessageUpdateFormData, params?: MessageQueryFormData) => messageService.updateMessage(id, data, params);
export const deleteMessage = (id: string) => messageService.deleteMessage(id);
export const batchCreateMessages = (data: MessageBatchCreateFormData, params?: MessageQueryFormData) => messageService.batchCreateMessages(data, params);
export const batchUpdateMessages = (data: MessageBatchUpdateFormData, params?: MessageQueryFormData) => messageService.batchUpdateMessages(data, params);
export const batchDeleteMessages = (data: MessageBatchDeleteFormData) => messageService.batchDeleteMessages(data);
export const getMessagesByRecipient = (recipientId: string, params?: MessageGetManyFormData) => messageService.getMessagesByRecipient(recipientId, params || {});
export const getMessagesBySender = (senderId: string, params?: MessageGetManyFormData) => messageService.getMessagesBySender(senderId, params || {});
export const getUnviewedMessages = (recipientId: string, params?: MessageGetManyFormData) => messageService.getUnviewedMessages(recipientId, params || {});
export const markAsViewed = (messageId: string, userId: string) => messageService.markAsViewed(messageId, userId);
export const markAllAsViewed = (userId: string) => messageService.markAllAsViewed(userId);

// ViewedMessage exports
export const getViewedMessages = (params?: ViewedMessageGetManyFormData) => viewedMessageService.getViewedMessages(params || {});
export const getViewedMessageById = (id: string, params?: Omit<ViewedMessageGetByIdFormData, "id">) => viewedMessageService.getViewedMessageById({ id, ...params });
export const createViewedMessage = (data: ViewedMessageCreateFormData, params?: ViewedMessageQueryFormData) =>
  viewedMessageService.createViewedMessage(data, params);
export const updateViewedMessage = (id: string, data: ViewedMessageUpdateFormData, params?: ViewedMessageQueryFormData) =>
  viewedMessageService.updateViewedMessage(id, data, params);
export const deleteViewedMessage = (id: string) => viewedMessageService.deleteViewedMessage(id);
export const batchCreateViewedMessages = (data: ViewedMessageBatchCreateFormData, params?: ViewedMessageQueryFormData) =>
  viewedMessageService.batchCreateViewedMessages(data, params);
export const batchUpdateViewedMessages = (data: ViewedMessageBatchUpdateFormData, params?: ViewedMessageQueryFormData) =>
  viewedMessageService.batchUpdateViewedMessages(data, params);
export const batchDeleteViewedMessages = (data: ViewedMessageBatchDeleteFormData) => viewedMessageService.batchDeleteViewedMessages(data);
export const getViewedMessagesByUser = (userId: string, params?: ViewedMessageGetManyFormData) => viewedMessageService.getViewedMessagesByUser(userId, params || {});
export const getViewedMessagesByMessage = (messageId: string, params?: ViewedMessageGetManyFormData) =>
  viewedMessageService.getViewedMessagesByMessage(messageId, params || {});
