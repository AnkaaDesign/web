/**
 * Notification Administration Hooks
 *
 * TanStack Query hooks for notification analytics and administration
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { type DateRange } from "react-day-picker";
import {
  notificationAdminService,
  type NotificationListFilters,
  type NotificationListResponse,
  type NotificationDetailResponse,
  type NotificationStatsResponse,
  type AnalyticsOverview,
  type DeliveryReport,
  type ExportResponse,
} from "../../services/notification.service";

// =====================
// Query Keys
// =====================

export const notificationAdminKeys = {
  all: ["notification-admin"] as const,
  lists: () => [...notificationAdminKeys.all, "list"] as const,
  list: (filters: NotificationListFilters) => [...notificationAdminKeys.lists(), filters] as const,
  details: () => [...notificationAdminKeys.all, "detail"] as const,
  detail: (id: string) => [...notificationAdminKeys.details(), id] as const,
  stats: () => [...notificationAdminKeys.all, "stats"] as const,
  statsWithFilters: (filters: { dateFrom?: string; dateTo?: string }) =>
    [...notificationAdminKeys.stats(), filters] as const,
  analytics: () => [...notificationAdminKeys.all, "analytics"] as const,
  analyticsOverview: (filters: { dateFrom?: string; dateTo?: string }) =>
    [...notificationAdminKeys.analytics(), "overview", filters] as const,
  deliveryReport: (filters: { dateFrom?: string; dateTo?: string; groupBy?: string }) =>
    [...notificationAdminKeys.analytics(), "delivery-report", filters] as const,
};

// =====================
// Query Hooks
// =====================

/**
 * Hook to fetch paginated notifications list
 */
export function useNotifications(filters: NotificationListFilters = {}) {
  return useQuery({
    queryKey: notificationAdminKeys.list(filters),
    queryFn: () => notificationAdminService.getNotifications(filters),
    staleTime: 30000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to fetch notification detail by ID
 */
export function useNotificationDetail(id: string | null, enabled = true) {
  return useQuery({
    queryKey: notificationAdminKeys.detail(id || ""),
    queryFn: () => notificationAdminService.getNotificationById(id!),
    enabled: !!id && enabled,
    staleTime: 60000, // 1 minute
  });
}

/**
 * Hook to fetch notification statistics
 */
export function useNotificationStats(params?: {
  dateRange?: DateRange;
  dateFrom?: string;
  dateTo?: string;
}) {
  const dateParams = params?.dateRange
    ? notificationAdminService.formatDateRangeForApi(params.dateRange)
    : {
        dateFrom: params?.dateFrom,
        dateTo: params?.dateTo,
      };

  return useQuery({
    queryKey: notificationAdminKeys.statsWithFilters(dateParams),
    queryFn: () => notificationAdminService.getNotificationStats(dateParams),
    staleTime: 60000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to fetch analytics overview
 */
export function useAnalyticsOverview(params?: {
  dateRange?: DateRange;
  dateFrom?: string;
  dateTo?: string;
}) {
  const dateParams = params?.dateRange
    ? notificationAdminService.formatDateRangeForApi(params.dateRange)
    : {
        dateFrom: params?.dateFrom,
        dateTo: params?.dateTo,
      };

  return useQuery({
    queryKey: notificationAdminKeys.analyticsOverview(dateParams),
    queryFn: () => notificationAdminService.getAnalyticsOverview(dateParams),
    staleTime: 60000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to fetch delivery report with time series
 */
export function useDeliveryReport(params?: {
  dateRange?: DateRange;
  dateFrom?: string;
  dateTo?: string;
  groupBy?: 'day' | 'hour';
}) {
  const dateParams = params?.dateRange
    ? notificationAdminService.formatDateRangeForApi(params.dateRange)
    : {
        dateFrom: params?.dateFrom,
        dateTo: params?.dateTo,
      };

  const queryParams = {
    ...dateParams,
    groupBy: params?.groupBy,
  };

  return useQuery({
    queryKey: notificationAdminKeys.deliveryReport(queryParams),
    queryFn: () => notificationAdminService.getDeliveryReport(queryParams),
    staleTime: 60000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

// =====================
// Mutation Hooks
// =====================

/**
 * Hook to resend a failed notification
 */
export function useResendNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationId: string) =>
      notificationAdminService.resendNotification(notificationId),
    onSuccess: (_, notificationId) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: notificationAdminKeys.detail(notificationId) });
      queryClient.invalidateQueries({ queryKey: notificationAdminKeys.lists() });
      queryClient.invalidateQueries({ queryKey: notificationAdminKeys.stats() });
      queryClient.invalidateQueries({ queryKey: notificationAdminKeys.analytics() });
    },
  });
}

/**
 * Hook to export notifications
 */
export function useExportNotifications() {
  return useMutation({
    mutationFn: (filters: NotificationListFilters) =>
      notificationAdminService.exportNotifications(filters),
  });
}

// =====================
// Utility Hooks
// =====================

/**
 * Hook to prefetch notification detail (useful for hover/preview)
 */
export function usePrefetchNotificationDetail() {
  const queryClient = useQueryClient();

  return (id: string) => {
    queryClient.prefetchQuery({
      queryKey: notificationAdminKeys.detail(id),
      queryFn: () => notificationAdminService.getNotificationById(id),
      staleTime: 60000,
    });
  };
}

/**
 * Hook to invalidate all notification queries (useful after bulk operations)
 */
export function useInvalidateNotificationQueries() {
  const queryClient = useQueryClient();

  return () => {
    queryClient.invalidateQueries({ queryKey: notificationAdminKeys.all });
  };
}
