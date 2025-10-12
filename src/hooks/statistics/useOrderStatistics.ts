import { useQuery, useMutation, type UseQueryOptions } from '@tanstack/react-query';
import { statisticsOrdersService } from '../../api-client/statistics-orders.service';
import type {
  OrdersOverview,
  OrderTrend,
  OrdersByStatus,
  OrdersBySupplier,
  OrdersByItem,
  OrderDeliveryMetrics,
  OrderCostAnalysis,
  OrderFrequencyAnalysis,
  ApiResponse,
} from '../../api-client/statistics-orders.service';
import type { StatisticsFilters } from '../../api-client/statistics-inventory.service';

export const orderStatisticsKeys = {
  all: ['statistics', 'orders'] as const,
  overview: (filters: StatisticsFilters) => [...orderStatisticsKeys.all, 'overview', filters] as const,
  trends: (filters: StatisticsFilters) => [...orderStatisticsKeys.all, 'trends', filters] as const,
  byStatus: (filters: StatisticsFilters) => [...orderStatisticsKeys.all, 'by-status', filters] as const,
  bySupplier: (filters: StatisticsFilters, limit: number) => [...orderStatisticsKeys.all, 'by-supplier', filters, limit] as const,
  byItem: (filters: StatisticsFilters, limit: number) => [...orderStatisticsKeys.all, 'by-item', filters, limit] as const,
  deliveryMetrics: (filters: StatisticsFilters) => [...orderStatisticsKeys.all, 'delivery-metrics', filters] as const,
  costAnalysis: (filters: StatisticsFilters) => [...orderStatisticsKeys.all, 'cost-analysis', filters] as const,
  frequencyAnalysis: (filters: StatisticsFilters) => [...orderStatisticsKeys.all, 'frequency-analysis', filters] as const,
};

export const useOrdersOverview = (filters: StatisticsFilters, options?: Omit<UseQueryOptions<ApiResponse<OrdersOverview>, Error>, 'queryKey' | 'queryFn'>) => {
  return useQuery({
    queryKey: orderStatisticsKeys.overview(filters),
    queryFn: () => statisticsOrdersService.getOverview(filters),
    staleTime: 5 * 60 * 1000,
    ...options,
  });
};

export const useOrderTrends = (filters: StatisticsFilters, options?: Omit<UseQueryOptions<ApiResponse<OrderTrend[]>, Error>, 'queryKey' | 'queryFn'>) => {
  return useQuery({
    queryKey: orderStatisticsKeys.trends(filters),
    queryFn: () => statisticsOrdersService.getOrderTrends(filters),
    staleTime: 5 * 60 * 1000,
    ...options,
  });
};

export const useOrdersByStatus = (filters: StatisticsFilters, options?: Omit<UseQueryOptions<ApiResponse<OrdersByStatus[]>, Error>, 'queryKey' | 'queryFn'>) => {
  return useQuery({
    queryKey: orderStatisticsKeys.byStatus(filters),
    queryFn: () => statisticsOrdersService.getOrdersByStatus(filters),
    staleTime: 3 * 60 * 1000,
    ...options,
  });
};

export const useOrdersBySupplier = (filters: StatisticsFilters, limit: number = 50, options?: Omit<UseQueryOptions<ApiResponse<OrdersBySupplier[]>, Error>, 'queryKey' | 'queryFn'>) => {
  return useQuery({
    queryKey: orderStatisticsKeys.bySupplier(filters, limit),
    queryFn: () => statisticsOrdersService.getOrdersBySupplier(filters, limit),
    staleTime: 10 * 60 * 1000,
    ...options,
  });
};

export const useOrdersByItem = (filters: StatisticsFilters, limit: number = 50, options?: Omit<UseQueryOptions<ApiResponse<OrdersByItem[]>, Error>, 'queryKey' | 'queryFn'>) => {
  return useQuery({
    queryKey: orderStatisticsKeys.byItem(filters, limit),
    queryFn: () => statisticsOrdersService.getOrdersByItem(filters, limit),
    staleTime: 10 * 60 * 1000,
    ...options,
  });
};

export const useOrderDeliveryMetrics = (filters: StatisticsFilters, options?: Omit<UseQueryOptions<ApiResponse<OrderDeliveryMetrics>, Error>, 'queryKey' | 'queryFn'>) => {
  return useQuery({
    queryKey: orderStatisticsKeys.deliveryMetrics(filters),
    queryFn: () => statisticsOrdersService.getDeliveryMetrics(filters),
    staleTime: 10 * 60 * 1000,
    ...options,
  });
};

export const useOrderCostAnalysis = (filters: StatisticsFilters, options?: Omit<UseQueryOptions<ApiResponse<OrderCostAnalysis>, Error>, 'queryKey' | 'queryFn'>) => {
  return useQuery({
    queryKey: orderStatisticsKeys.costAnalysis(filters),
    queryFn: () => statisticsOrdersService.getCostAnalysis(filters),
    staleTime: 15 * 60 * 1000,
    ...options,
  });
};

export const useOrderFrequencyAnalysis = (filters: StatisticsFilters, options?: Omit<UseQueryOptions<ApiResponse<OrderFrequencyAnalysis>, Error>, 'queryKey' | 'queryFn'>) => {
  return useQuery({
    queryKey: orderStatisticsKeys.frequencyAnalysis(filters),
    queryFn: () => statisticsOrdersService.getFrequencyAnalysis(filters),
    staleTime: 15 * 60 * 1000,
    ...options,
  });
};

export const useExportOrderStatistics = () => {
  return useMutation({
    mutationFn: ({ filters, format = 'xlsx' }: { filters: StatisticsFilters; format?: 'csv' | 'xlsx' | 'pdf' }) =>
      statisticsOrdersService.exportStatistics(filters, format),
    onSuccess: (blob, variables) => {
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `order-statistics-${new Date().toISOString().split('T')[0]}.${variables.format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    },
  });
};

export const useOrderStatistics = (filters: StatisticsFilters) => {
  const overview = useOrdersOverview(filters);
  const trends = useOrderTrends(filters);
  const byStatus = useOrdersByStatus(filters);
  const deliveryMetrics = useOrderDeliveryMetrics(filters);

  return {
    overview,
    trends,
    byStatus,
    deliveryMetrics,
    isLoading: overview.isLoading || trends.isLoading || byStatus.isLoading || deliveryMetrics.isLoading,
    isError: overview.isError || trends.isError || byStatus.isError || deliveryMetrics.isError,
  };
};
