import { useQuery } from '@tanstack/react-query';
import {
  getPayrollTrends,
  getTeamPerformance,
  getHeadcount,
  getTurnover,
  getAbsenteeism,
  getSalaryCost,
} from '@/api-client/hr-analytics';
import type {
  HrAnalyticsFilters,
  PayrollTrendsResponse,
  TeamPerformanceResponse,
  HeadcountFilters,
  HeadcountResponse,
  TurnoverFilters,
  TurnoverResponse,
  AbsenteeismFilters,
  AbsenteeismResponse,
  SalaryCostResponse,
} from '@/types/hr-analytics';

export const hrAnalyticsKeys = {
  all: ['hr-analytics'] as const,
  payrollTrends: (filters: HrAnalyticsFilters) => [...hrAnalyticsKeys.all, 'payroll-trends', filters] as const,
  teamPerformance: (filters: HrAnalyticsFilters) => [...hrAnalyticsKeys.all, 'team-performance', filters] as const,
  headcount: (filters: HeadcountFilters) => [...hrAnalyticsKeys.all, 'headcount', filters] as const,
  turnover: (filters: TurnoverFilters) => [...hrAnalyticsKeys.all, 'turnover', filters] as const,
  absenteeism: (filters: AbsenteeismFilters) => [...hrAnalyticsKeys.all, 'absenteeism', filters] as const,
  salaryCost: (filters: HeadcountFilters) => [...hrAnalyticsKeys.all, 'salary-cost', filters] as const,
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

export function useHeadcountAnalytics(filters: HeadcountFilters) {
  return useQuery<HeadcountResponse, Error>({
    queryKey: hrAnalyticsKeys.headcount(filters),
    queryFn: () => getHeadcount(filters),
    staleTime: 3 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 2,
  });
}

export function useTurnoverAnalytics(filters: TurnoverFilters) {
  return useQuery<TurnoverResponse, Error>({
    queryKey: hrAnalyticsKeys.turnover(filters),
    queryFn: () => getTurnover(filters),
    staleTime: 3 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 2,
  });
}

export function useAbsenteeismAnalytics(filters: AbsenteeismFilters) {
  return useQuery<AbsenteeismResponse, Error>({
    queryKey: hrAnalyticsKeys.absenteeism(filters),
    queryFn: () => getAbsenteeism(filters),
    // Absenteeism aggregates Secullum data live (no local persistence); page
    // loads may take 3–8s. Cache aggressively so re-visits feel instant.
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    retry: 1,
  });
}

// Custo de folha / salário ao longo do tempo (Part F) — resolve salários
// históricos por colaborador (UserPositionHistory × valor do cargo na data).
export function useSalaryCostAnalytics(filters: HeadcountFilters) {
  return useQuery<SalaryCostResponse, Error>({
    queryKey: hrAnalyticsKeys.salaryCost(filters),
    queryFn: () => getSalaryCost(filters),
    staleTime: 3 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 2,
  });
}
