import { useQuery } from '@tanstack/react-query';
import { getPayrollTrends, getTeamPerformance } from '@/api-client/hr-analytics';
import type {
  HrAnalyticsFilters,
  PayrollTrendsResponse,
  TeamPerformanceResponse,
} from '@/types/hr-analytics';

export const hrAnalyticsKeys = {
  all: ['hr-analytics'] as const,
  payrollTrends: (filters: HrAnalyticsFilters) => [...hrAnalyticsKeys.all, 'payroll-trends', filters] as const,
  teamPerformance: (filters: HrAnalyticsFilters) => [...hrAnalyticsKeys.all, 'team-performance', filters] as const,
};

export function usePayrollTrends(filters: HrAnalyticsFilters) {
  return useQuery<PayrollTrendsResponse, Error>({
    queryKey: hrAnalyticsKeys.payrollTrends(filters),
    queryFn: () => getPayrollTrends(filters),
    staleTime: 3 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 2,
  });
}

export function useTeamPerformance(filters: HrAnalyticsFilters) {
  return useQuery<TeamPerformanceResponse, Error>({
    queryKey: hrAnalyticsKeys.teamPerformance(filters),
    queryFn: () => getTeamPerformance(filters),
    staleTime: 3 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 2,
  });
}

export function getHrComparisonType(
  filters: HrAnalyticsFilters,
): 'simple' | 'sectors' | 'periods' {
  if (filters.periods && filters.periods.length >= 2) return 'periods';
  if (filters.sectorIds && filters.sectorIds.length >= 2) return 'sectors';
  return 'simple';
}
