import { useQuery, useMutation, type UseQueryOptions } from '@tanstack/react-query';
import { statisticsDashboardService } from '../../api-client/statistics-dashboard.service';
import type {
  UnifiedDashboardData,
  KPIMetrics,
  PerformanceSnapshot,
  ExecutiveSummary,
  ComparisonReport,
  RealTimeMetrics,
  ApiResponse,
} from '../../api-client/statistics-dashboard.service';
import type { StatisticsFilters } from '../../api-client/statistics-inventory.service';

export const dashboardStatisticsKeys = {
  all: ['statistics', 'dashboard'] as const,
  unified: (filters: StatisticsFilters) => [...dashboardStatisticsKeys.all, 'unified', filters] as const,
  kpi: (filters: StatisticsFilters) => [...dashboardStatisticsKeys.all, 'kpi', filters] as const,
  performanceSnapshot: (filters: StatisticsFilters) => [...dashboardStatisticsKeys.all, 'performance-snapshot', filters] as const,
  executiveSummary: (filters: StatisticsFilters) => [...dashboardStatisticsKeys.all, 'executive-summary', filters] as const,
  comparison: (filters: StatisticsFilters, comparePeriod: string) => [...dashboardStatisticsKeys.all, 'comparison', filters, comparePeriod] as const,
  realTime: () => [...dashboardStatisticsKeys.all, 'real-time'] as const,
};

export const useUnifiedDashboard = (filters: StatisticsFilters, options?: Omit<UseQueryOptions<ApiResponse<UnifiedDashboardData>, Error>, 'queryKey' | 'queryFn'>) => {
  return useQuery({
    queryKey: dashboardStatisticsKeys.unified(filters),
    queryFn: () => statisticsDashboardService.getUnifiedDashboard(filters),
    staleTime: 5 * 60 * 1000,
    ...options,
  });
};

export const useKPIMetrics = (filters: StatisticsFilters, options?: Omit<UseQueryOptions<ApiResponse<KPIMetrics>, Error>, 'queryKey' | 'queryFn'>) => {
  return useQuery({
    queryKey: dashboardStatisticsKeys.kpi(filters),
    queryFn: () => statisticsDashboardService.getKPIMetrics(filters),
    staleTime: 3 * 60 * 1000,
    ...options,
  });
};

export const usePerformanceSnapshot = (filters: StatisticsFilters, options?: Omit<UseQueryOptions<ApiResponse<PerformanceSnapshot>, Error>, 'queryKey' | 'queryFn'>) => {
  return useQuery({
    queryKey: dashboardStatisticsKeys.performanceSnapshot(filters),
    queryFn: () => statisticsDashboardService.getPerformanceSnapshot(filters),
    staleTime: 5 * 60 * 1000,
    ...options,
  });
};

export const useExecutiveSummary = (filters: StatisticsFilters, options?: Omit<UseQueryOptions<ApiResponse<ExecutiveSummary>, Error>, 'queryKey' | 'queryFn'>) => {
  return useQuery({
    queryKey: dashboardStatisticsKeys.executiveSummary(filters),
    queryFn: () => statisticsDashboardService.getExecutiveSummary(filters),
    staleTime: 10 * 60 * 1000,
    ...options,
  });
};

export const useComparisonReport = (
  filters: StatisticsFilters,
  comparePeriod: 'previous' | 'year_ago' = 'previous',
  options?: Omit<UseQueryOptions<ApiResponse<ComparisonReport>, Error>, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey: dashboardStatisticsKeys.comparison(filters, comparePeriod),
    queryFn: () => statisticsDashboardService.getComparisonReport(filters, comparePeriod),
    staleTime: 15 * 60 * 1000,
    ...options,
  });
};

export const useRealTimeMetrics = (
  refreshInterval?: number,
  options?: Omit<UseQueryOptions<ApiResponse<RealTimeMetrics>, Error>, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey: dashboardStatisticsKeys.realTime(),
    queryFn: () => statisticsDashboardService.getRealTimeMetrics(),
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: refreshInterval || 60 * 1000, // Default 1 minute
    refetchIntervalInBackground: true,
    ...options,
  });
};

export const useRefreshDashboardCache = () => {
  return useMutation({
    mutationFn: (filters: StatisticsFilters) => statisticsDashboardService.refreshCache(filters),
  });
};

export const useExportDashboard = () => {
  return useMutation({
    mutationFn: ({ filters, format = 'pdf' }: { filters: StatisticsFilters; format?: 'csv' | 'xlsx' | 'pdf' }) =>
      statisticsDashboardService.exportDashboard(filters, format),
    onSuccess: (blob, variables) => {
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `dashboard-report-${new Date().toISOString().split('T')[0]}.${variables.format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    },
  });
};

export const useDashboardStatistics = (filters: StatisticsFilters) => {
  const unified = useUnifiedDashboard(filters);
  const kpi = useKPIMetrics(filters);
  const performanceSnapshot = usePerformanceSnapshot(filters);
  const executiveSummary = useExecutiveSummary(filters);

  return {
    unified,
    kpi,
    performanceSnapshot,
    executiveSummary,
    isLoading: unified.isLoading || kpi.isLoading || performanceSnapshot.isLoading || executiveSummary.isLoading,
    isError: unified.isError || kpi.isError || performanceSnapshot.isError || executiveSummary.isError,
  };
};
