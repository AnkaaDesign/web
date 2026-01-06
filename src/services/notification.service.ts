/**
 * Notification Administration Service
 *
 * Provides API methods for notification analytics and administration
 */

import { apiClient } from "../api-client/axiosClient";
import { type DateRange } from "react-day-picker";

// =====================
// Types & Interfaces
// =====================

export interface NotificationListFilters {
  type?: string;
  channel?: string;
  status?: 'sent' | 'scheduled' | 'pending';
  deliveryStatus?: 'delivered' | 'failed' | 'pending';
  userId?: string;
  sectorId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
  orderBy?: string;
  order?: 'asc' | 'desc';
}

export interface NotificationStats {
  total: number;
  byType: Record<string, number>;
  byChannel: Record<string, number>;
  deliveryRate: {
    email: { sent: number; delivered: number; failed: number };
    sms: { sent: number; delivered: number; failed: number };
    push: { sent: number; delivered: number; failed: number };
    whatsapp: { sent: number; delivered: number; failed: number };
    inApp: { sent: number; seen: number };
  };
  seenRate: number;
  averageDeliveryTime: number;
  failureReasons: Record<string, number>;
}

export interface NotificationListItem {
  id: string;
  type: string;
  title: string;
  sentAt: string | null;
  channel: string[];
  deliveries: DeliveryInfo[];
  seenBy: SeenInfo[];
  user?: {
    id: string;
    name: string;
    email: string;
  };
  createdAt: string;
  scheduledAt: string | null;
}

export interface DeliveryInfo {
  id: string;
  channel: string;
  status: 'DELIVERED' | 'FAILED' | 'PENDING';
  sentAt: string | null;
  deliveredAt: string | null;
  failedAt: string | null;
  errorMessage: string | null;
}

export interface SeenInfo {
  userId: string;
  seenAt: string;
}

export interface NotificationListResponse {
  success: boolean;
  data: NotificationListItem[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
  message: string;
}

export interface NotificationDetail {
  id: string;
  type: string;
  title: string;
  body: string;
  sentAt: string | null;
  scheduledAt: string | null;
  channel: string[];
  importance: string;
  user?: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
  };
  deliveries: DeliveryInfo[];
  seenBy: Array<{
    userId: string;
    seenAt: string;
    user: {
      id: string;
      name: string;
      email: string;
    };
  }>;
  metrics: {
    delivery: {
      totalDeliveries: number;
      deliveredCount: number;
      failedCount: number;
      pendingCount: number;
      averageDeliveryTime: number;
    };
    seen: {
      totalSeen: number;
      firstSeenAt: string | null;
      lastSeenAt: string | null;
    };
  };
}

export interface NotificationStatsResponse {
  success: boolean;
  data: NotificationStats;
  message: string;
}

export interface NotificationDetailResponse {
  success: boolean;
  data: NotificationDetail;
  message: string;
}

export interface AnalyticsOverview {
  total: number;
  delivered: number;
  failed: number;
  seen: number;
  deliveryRate: number;
  seenRate: number;
  byType: Record<string, number>;
  byChannel: Record<string, number>;
}

export interface TimeSeriesPoint {
  date: string;
  sent: number;
  delivered: number;
  failed: number;
}

export interface DeliveryReport {
  timeSeries: TimeSeriesPoint[];
  channelPerformance: Array<{
    channel: string;
    sent: number;
    delivered: number;
    failed: number;
    successRate: number;
  }>;
  topFailureReasons: Array<{
    reason: string;
    count: number;
    percentage: number;
  }>;
  userEngagement: {
    totalSent: number;
    totalSeen: number;
    seenRate: number;
    averageSeenTime: number;
  };
}

export interface ExportResponse {
  success: boolean;
  data: {
    csv: string;
    count: number;
  };
  message: string;
}

// =====================
// Service Class
// =====================

export class NotificationAdminService {
  private readonly basePath = "/admin/notifications";

  /**
   * Get paginated list of notifications with filters
   */
  async getNotifications(filters: NotificationListFilters = {}): Promise<NotificationListResponse> {
    const response = await apiClient.get<NotificationListResponse>(this.basePath, {
      params: filters,
    });
    return response.data;
  }

  /**
   * Get detailed information about a specific notification
   */
  async getNotificationById(id: string): Promise<NotificationDetailResponse> {
    const response = await apiClient.get<NotificationDetailResponse>(`${this.basePath}/${id}`);
    return response.data;
  }

  /**
   * Get comprehensive notification statistics
   */
  async getNotificationStats(params?: {
    dateFrom?: string;
    dateTo?: string;
  }): Promise<NotificationStatsResponse> {
    const response = await apiClient.get<NotificationStatsResponse>(`${this.basePath}/stats/overview`, {
      params,
    });
    return response.data;
  }

  /**
   * Get analytics overview
   */
  async getAnalyticsOverview(params?: {
    dateFrom?: string;
    dateTo?: string;
  }): Promise<{ success: boolean; data: AnalyticsOverview; message: string }> {
    const response = await apiClient.get(`${this.basePath}/analytics/overview`, {
      params,
    });
    return response.data;
  }

  /**
   * Get delivery report with time series data
   */
  async getDeliveryReport(params?: {
    dateFrom?: string;
    dateTo?: string;
    groupBy?: 'day' | 'hour';
  }): Promise<{ success: boolean; data: DeliveryReport; message: string }> {
    const response = await apiClient.get(`${this.basePath}/reports/delivery`, {
      params,
    });
    return response.data;
  }

  /**
   * Resend a failed notification
   */
  async resendNotification(id: string): Promise<{ success: boolean; data: any; message: string }> {
    const response = await apiClient.post(`${this.basePath}/resend/${id}`);
    return response.data;
  }

  /**
   * Export notifications to CSV
   */
  async exportNotifications(filters: NotificationListFilters = {}): Promise<ExportResponse> {
    const response = await apiClient.get<ExportResponse>(`${this.basePath}/export/csv`, {
      params: { ...filters, format: 'csv' },
    });
    return response.data;
  }

  /**
   * Helper to format date range for API
   */
  formatDateRangeForApi(dateRange?: DateRange): { dateFrom?: string; dateTo?: string } {
    if (!dateRange) return {};

    return {
      dateFrom: dateRange.from?.toISOString(),
      dateTo: dateRange.to?.toISOString(),
    };
  }
}

// =====================
// Service Instance & Exports
// =====================

export const notificationAdminService = new NotificationAdminService();

// Convenience exports
export const getNotifications = (filters?: NotificationListFilters) =>
  notificationAdminService.getNotifications(filters);

export const getNotificationById = (id: string) =>
  notificationAdminService.getNotificationById(id);

export const getNotificationStats = (params?: { dateFrom?: string; dateTo?: string }) =>
  notificationAdminService.getNotificationStats(params);

export const getAnalyticsOverview = (params?: { dateFrom?: string; dateTo?: string }) =>
  notificationAdminService.getAnalyticsOverview(params);

export const getDeliveryReport = (params?: {
  dateFrom?: string;
  dateTo?: string;
  groupBy?: 'day' | 'hour';
}) => notificationAdminService.getDeliveryReport(params);

export const resendNotification = (id: string) =>
  notificationAdminService.resendNotification(id);

export const exportNotifications = (filters?: NotificationListFilters) =>
  notificationAdminService.exportNotifications(filters);
