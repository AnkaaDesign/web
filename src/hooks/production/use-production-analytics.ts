import { useQuery } from '@tanstack/react-query';
import {
  getProductionThroughput,
  getProductionBottlenecks,
  getProductionRevenue,
  getTaskProductionStats,
  getTaskPerformanceStats,
  getBonusValueTimeline,
} from '@/api-client/production-analytics';
import type {
  ProductionAnalyticsFilters,
  ThroughputAnalyticsResponse,
  BottleneckAnalyticsResponse,
  RevenueAnalyticsResponse,
  TaskProductionFilters,
  TaskProductionResponse,
  TaskPerformanceFilters,
  TaskPerformanceResponse,
  BonusValueTimelineFilters,
  BonusValueTimelineResponse,
} from '@/types/production-analytics';

export const productionAnalyticsKeys = {
  all: ['production-analytics'] as const,
  throughput: (filters: ProductionAnalyticsFilters) => [...productionAnalyticsKeys.all, 'throughput', filters] as const,
  bottlenecks: (filters: any) => [...productionAnalyticsKeys.all, 'bottlenecks', filters] as const,
  revenue: (filters: ProductionAnalyticsFilters) => [...productionAnalyticsKeys.all, 'revenue', filters] as const,
  taskProduction: (filters: TaskProductionFilters) => [...productionAnalyticsKeys.all, 'task-production', filters] as const,
  taskPerformance: (filters: TaskPerformanceFilters) => [...productionAnalyticsKeys.all, 'task-performance', filters] as const,
  bonusValueTimeline: (filters: BonusValueTimelineFilters) => [...productionAnalyticsKeys.all, 'bonus-value-timeline', filters] as const,
};

export function useProductionThroughput(filters: ProductionAnalyticsFilters) {
  return useQuery<ThroughputAnalyticsResponse, Error>({
    queryKey: productionAnalyticsKeys.throughput(filters),
    queryFn: () => getProductionThroughput(filters),
    staleTime: 3 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 2,
  });
}

export function useProductionBottlenecks(filters: Omit<ProductionAnalyticsFilters, 'customerIds' | 'periods'>) {
  return useQuery<BottleneckAnalyticsResponse, Error>({
    queryKey: productionAnalyticsKeys.bottlenecks(filters),
    queryFn: () => getProductionBottlenecks(filters),
    staleTime: 3 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 2,
  });
}

export function useProductionRevenue(filters: ProductionAnalyticsFilters) {
  return useQuery<RevenueAnalyticsResponse, Error>({
    queryKey: productionAnalyticsKeys.revenue(filters),
    queryFn: () => getProductionRevenue(filters),
    staleTime: 3 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 2,
  });
}

export function useTaskProductionStats(filters: TaskProductionFilters) {
  return useQuery<TaskProductionResponse, Error>({
    queryKey: productionAnalyticsKeys.taskProduction(filters),
    queryFn: () => getTaskProductionStats(filters),
    staleTime: 3 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 2,
  });
}

export function useTaskPerformanceStats(filters: TaskPerformanceFilters) {
  return useQuery<TaskPerformanceResponse, Error>({
    queryKey: productionAnalyticsKeys.taskPerformance(filters),
    queryFn: () => getTaskPerformanceStats(filters),
    staleTime: 3 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 2,
  });
}

export function useBonusValueTimeline(filters: BonusValueTimelineFilters) {
  return useQuery<BonusValueTimelineResponse, Error>({
    queryKey: productionAnalyticsKeys.bonusValueTimeline(filters),
    queryFn: () => getBonusValueTimeline(filters),
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 2,
  });
}

export function getComparisonType(
  filters: ProductionAnalyticsFilters,
): 'simple' | 'sectors' | 'customers' | 'periods' {
  if (filters.periods && filters.periods.length >= 2) return 'periods';
  if (filters.sectorIds && filters.sectorIds.length >= 2) return 'sectors';
  if (filters.customerIds && filters.customerIds.length >= 2) return 'customers';
  return 'simple';
}
