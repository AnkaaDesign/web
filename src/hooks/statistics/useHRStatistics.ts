import { useQuery, useMutation, type UseQueryOptions } from '@tanstack/react-query';
import { statisticsHRService } from '../../api-client/statistics-hr.service';
import type {
  HROverview,
  ProductivityMetrics,
  AttendanceMetrics,
  PerformanceMetrics,
  TrainingMetrics,
  CompensationMetrics,
  TurnoverMetrics,
  ApiResponse,
} from '../../api-client/statistics-hr.service';
import type { StatisticsFilters } from '../../api-client/statistics-inventory.service';

export const hrStatisticsKeys = {
  all: ['statistics', 'hr'] as const,
  overview: (filters: StatisticsFilters) => [...hrStatisticsKeys.all, 'overview', filters] as const,
  productivity: (filters: StatisticsFilters) => [...hrStatisticsKeys.all, 'productivity', filters] as const,
  attendance: (filters: StatisticsFilters) => [...hrStatisticsKeys.all, 'attendance', filters] as const,
  performance: (filters: StatisticsFilters) => [...hrStatisticsKeys.all, 'performance', filters] as const,
  training: (filters: StatisticsFilters) => [...hrStatisticsKeys.all, 'training', filters] as const,
  compensation: (filters: StatisticsFilters) => [...hrStatisticsKeys.all, 'compensation', filters] as const,
  turnover: (filters: StatisticsFilters) => [...hrStatisticsKeys.all, 'turnover', filters] as const,
};

export const useHROverview = (filters: StatisticsFilters, options?: Omit<UseQueryOptions<ApiResponse<HROverview>, Error>, 'queryKey' | 'queryFn'>) => {
  return useQuery({
    queryKey: hrStatisticsKeys.overview(filters),
    queryFn: () => statisticsHRService.getOverview(filters),
    staleTime: 10 * 60 * 1000,
    ...options,
  });
};

export const useProductivityMetrics = (filters: StatisticsFilters, options?: Omit<UseQueryOptions<ApiResponse<ProductivityMetrics>, Error>, 'queryKey' | 'queryFn'>) => {
  return useQuery({
    queryKey: hrStatisticsKeys.productivity(filters),
    queryFn: () => statisticsHRService.getProductivityMetrics(filters),
    staleTime: 10 * 60 * 1000,
    ...options,
  });
};

export const useAttendanceMetrics = (filters: StatisticsFilters, options?: Omit<UseQueryOptions<ApiResponse<AttendanceMetrics>, Error>, 'queryKey' | 'queryFn'>) => {
  return useQuery({
    queryKey: hrStatisticsKeys.attendance(filters),
    queryFn: () => statisticsHRService.getAttendanceMetrics(filters),
    staleTime: 5 * 60 * 1000,
    ...options,
  });
};

export const usePerformanceMetrics = (filters: StatisticsFilters, options?: Omit<UseQueryOptions<ApiResponse<PerformanceMetrics>, Error>, 'queryKey' | 'queryFn'>) => {
  return useQuery({
    queryKey: hrStatisticsKeys.performance(filters),
    queryFn: () => statisticsHRService.getPerformanceMetrics(filters),
    staleTime: 15 * 60 * 1000,
    ...options,
  });
};

export const useTrainingMetrics = (filters: StatisticsFilters, options?: Omit<UseQueryOptions<ApiResponse<TrainingMetrics>, Error>, 'queryKey' | 'queryFn'>) => {
  return useQuery({
    queryKey: hrStatisticsKeys.training(filters),
    queryFn: () => statisticsHRService.getTrainingMetrics(filters),
    staleTime: 15 * 60 * 1000,
    ...options,
  });
};

export const useCompensationMetrics = (filters: StatisticsFilters, options?: Omit<UseQueryOptions<ApiResponse<CompensationMetrics>, Error>, 'queryKey' | 'queryFn'>) => {
  return useQuery({
    queryKey: hrStatisticsKeys.compensation(filters),
    queryFn: () => statisticsHRService.getCompensationMetrics(filters),
    staleTime: 30 * 60 * 1000,
    ...options,
  });
};

export const useTurnoverMetrics = (filters: StatisticsFilters, options?: Omit<UseQueryOptions<ApiResponse<TurnoverMetrics>, Error>, 'queryKey' | 'queryFn'>) => {
  return useQuery({
    queryKey: hrStatisticsKeys.turnover(filters),
    queryFn: () => statisticsHRService.getTurnoverMetrics(filters),
    staleTime: 20 * 60 * 1000,
    ...options,
  });
};

export const useExportHRStatistics = () => {
  return useMutation({
    mutationFn: ({ filters, format = 'xlsx' }: { filters: StatisticsFilters; format?: 'csv' | 'xlsx' | 'pdf' }) =>
      statisticsHRService.exportStatistics(filters, format),
    onSuccess: (blob, variables) => {
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `hr-statistics-${new Date().toISOString().split('T')[0]}.${variables.format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    },
  });
};

export const useHRStatistics = (filters: StatisticsFilters) => {
  const overview = useHROverview(filters);
  const productivity = useProductivityMetrics(filters);
  const attendance = useAttendanceMetrics(filters);
  const performance = usePerformanceMetrics(filters);

  return {
    overview,
    productivity,
    attendance,
    performance,
    isLoading: overview.isLoading || productivity.isLoading || attendance.isLoading || performance.isLoading,
    isError: overview.isError || productivity.isError || attendance.isError || performance.isError,
  };
};
