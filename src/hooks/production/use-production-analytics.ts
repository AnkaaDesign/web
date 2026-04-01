import { useQuery } from '@tanstack/react-query';
import { getProductionThroughput, getProductionBottlenecks, getProductionRevenue } from '@/api-client/production-analytics';
import type {
  ProductionAnalyticsFilters,
  ThroughputAnalyticsResponse,
  BottleneckAnalyticsResponse,
  RevenueAnalyticsResponse,
} from '@/types/production-analytics';

export const productionAnalyticsKeys = {
  all: ['production-analytics'] as const,
  throughput: (filters: ProductionAnalyticsFilters) => [...productionAnalyticsKeys.all, 'throughput', filters] as const,
  bottlenecks: (filters: any) => [...productionAnalyticsKeys.all, 'bottlenecks', filters] as const,
  revenue: (filters: ProductionAnalyticsFilters) => [...productionAnalyticsKeys.all, 'revenue', filters] as const,
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

export function getComparisonType(
  filters: ProductionAnalyticsFilters,
): 'simple' | 'sectors' | 'customers' | 'periods' {
  if (filters.periods && filters.periods.length >= 2) return 'periods';
  if (filters.sectorIds && filters.sectorIds.length >= 2) return 'sectors';
  if (filters.customerIds && filters.customerIds.length >= 2) return 'customers';
  return 'simple';
}
