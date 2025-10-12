import { useQuery, useMutation, type UseQueryOptions } from '@tanstack/react-query';
import { statisticsProductionService } from '../../api-client/statistics-production.service';
import type {
  ProductionOverview,
  ProductionTrend,
  OrderMetrics,
  ProductionByItem,
  ProductionByCustomer,
  ResourceUtilization,
  QualityMetrics,
  BottleneckAnalysis,
  ApiResponse,
} from '../../api-client/statistics-production.service';
import type { StatisticsFilters } from '../../api-client/statistics-inventory.service';

// Query Keys
export const productionStatisticsKeys = {
  all: ['statistics', 'production'] as const,
  overview: (filters: StatisticsFilters) => [...productionStatisticsKeys.all, 'overview', filters] as const,
  trends: (filters: StatisticsFilters) => [...productionStatisticsKeys.all, 'trends', filters] as const,
  orderMetrics: (filters: StatisticsFilters) => [...productionStatisticsKeys.all, 'order-metrics', filters] as const,
  byItem: (filters: StatisticsFilters, limit: number) => [...productionStatisticsKeys.all, 'by-item', filters, limit] as const,
  byCustomer: (filters: StatisticsFilters, limit: number) => [...productionStatisticsKeys.all, 'by-customer', filters, limit] as const,
  resourceUtilization: (filters: StatisticsFilters) => [...productionStatisticsKeys.all, 'resource-utilization', filters] as const,
  qualityMetrics: (filters: StatisticsFilters) => [...productionStatisticsKeys.all, 'quality-metrics', filters] as const,
  bottleneckAnalysis: (filters: StatisticsFilters) => [...productionStatisticsKeys.all, 'bottleneck-analysis', filters] as const,
};

// Hooks
export const useProductionOverview = (
  filters: StatisticsFilters,
  options?: Omit<UseQueryOptions<ApiResponse<ProductionOverview>, Error>, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey: productionStatisticsKeys.overview(filters),
    queryFn: () => statisticsProductionService.getOverview(filters),
    staleTime: 5 * 60 * 1000,
    ...options,
  });
};

export const useProductionTrends = (
  filters: StatisticsFilters,
  options?: Omit<UseQueryOptions<ApiResponse<ProductionTrend[]>, Error>, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey: productionStatisticsKeys.trends(filters),
    queryFn: () => statisticsProductionService.getProductionTrends(filters),
    staleTime: 5 * 60 * 1000,
    ...options,
  });
};

export const useOrderMetrics = (
  filters: StatisticsFilters,
  options?: Omit<UseQueryOptions<ApiResponse<OrderMetrics>, Error>, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey: productionStatisticsKeys.orderMetrics(filters),
    queryFn: () => statisticsProductionService.getOrderMetrics(filters),
    staleTime: 3 * 60 * 1000,
    ...options,
  });
};

export const useProductionByItem = (
  filters: StatisticsFilters,
  limit: number = 50,
  options?: Omit<UseQueryOptions<ApiResponse<ProductionByItem[]>, Error>, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey: productionStatisticsKeys.byItem(filters, limit),
    queryFn: () => statisticsProductionService.getProductionByItem(filters, limit),
    staleTime: 10 * 60 * 1000,
    ...options,
  });
};

export const useProductionByCustomer = (
  filters: StatisticsFilters,
  limit: number = 50,
  options?: Omit<UseQueryOptions<ApiResponse<ProductionByCustomer[]>, Error>, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey: productionStatisticsKeys.byCustomer(filters, limit),
    queryFn: () => statisticsProductionService.getProductionByCustomer(filters, limit),
    staleTime: 10 * 60 * 1000,
    ...options,
  });
};

export const useResourceUtilization = (
  filters: StatisticsFilters,
  options?: Omit<UseQueryOptions<ApiResponse<ResourceUtilization>, Error>, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey: productionStatisticsKeys.resourceUtilization(filters),
    queryFn: () => statisticsProductionService.getResourceUtilization(filters),
    staleTime: 10 * 60 * 1000,
    ...options,
  });
};

export const useQualityMetrics = (
  filters: StatisticsFilters,
  options?: Omit<UseQueryOptions<ApiResponse<QualityMetrics>, Error>, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey: productionStatisticsKeys.qualityMetrics(filters),
    queryFn: () => statisticsProductionService.getQualityMetrics(filters),
    staleTime: 15 * 60 * 1000,
    ...options,
  });
};

export const useBottleneckAnalysis = (
  filters: StatisticsFilters,
  options?: Omit<UseQueryOptions<ApiResponse<BottleneckAnalysis>, Error>, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey: productionStatisticsKeys.bottleneckAnalysis(filters),
    queryFn: () => statisticsProductionService.getBottleneckAnalysis(filters),
    staleTime: 15 * 60 * 1000,
    ...options,
  });
};

export const useExportProductionStatistics = () => {
  return useMutation({
    mutationFn: ({ filters, format = 'xlsx' }: { filters: StatisticsFilters; format?: 'csv' | 'xlsx' | 'pdf' }) =>
      statisticsProductionService.exportStatistics(filters, format),
    onSuccess: (blob, variables) => {
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `production-statistics-${new Date().toISOString().split('T')[0]}.${variables.format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    },
  });
};

export const useProductionStatistics = (filters: StatisticsFilters) => {
  const overview = useProductionOverview(filters);
  const trends = useProductionTrends(filters);
  const orderMetrics = useOrderMetrics(filters);
  const qualityMetrics = useQualityMetrics(filters);

  return {
    overview,
    trends,
    orderMetrics,
    qualityMetrics,
    isLoading: overview.isLoading || trends.isLoading || orderMetrics.isLoading || qualityMetrics.isLoading,
    isError: overview.isError || trends.isError || orderMetrics.isError || qualityMetrics.isError,
  };
};
