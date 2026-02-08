// web/src/hooks/use-consumption-analytics.ts

import { useQuery } from '@tanstack/react-query';
import { getConsumptionComparison } from '@/api-client';
import type {
  ConsumptionAnalyticsFilters,
  ConsumptionAnalyticsResponse,
} from '@/types/consumption-analytics';

export const consumptionAnalyticsKeys = {
  all: ['consumption-analytics'] as const,
  comparisons: () => [...consumptionAnalyticsKeys.all, 'comparisons'] as const,
  comparison: (filters: ConsumptionAnalyticsFilters) =>
    [...consumptionAnalyticsKeys.comparisons(), filters] as const,
};

export function useConsumptionAnalytics(
  filters: ConsumptionAnalyticsFilters,
) {
  return useQuery<ConsumptionAnalyticsResponse, Error>({
    queryKey: consumptionAnalyticsKeys.comparison(filters),
    queryFn: async () => {
      const response = await getConsumptionComparison(filters);
      return response;
    },
    staleTime: 3 * 60 * 1000, // 3 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 2,
  });
}

export function isComparisonMode(filters: ConsumptionAnalyticsFilters): boolean {
  const hasSectorComparison = filters.sectorIds && filters.sectorIds.length >= 2;
  const hasUserComparison = filters.userIds && filters.userIds.length >= 2;
  const hasPeriodComparison = filters.periods && filters.periods.length >= 2;
  return !!(hasSectorComparison || hasUserComparison || hasPeriodComparison);
}

export function getComparisonType(
  filters: ConsumptionAnalyticsFilters,
): 'simple' | 'sectors' | 'users' | 'periods' {
  if (filters.periods && filters.periods.length >= 2) return 'periods';
  if (filters.sectorIds && filters.sectorIds.length >= 2) return 'sectors';
  if (filters.userIds && filters.userIds.length >= 2) return 'users';
  return 'simple';
}

export function validateConsumptionFilters(filters: ConsumptionAnalyticsFilters): {
  valid: boolean;
  error?: string;
} {
  const hasSectorComparison = filters.sectorIds && filters.sectorIds.length >= 2;
  const hasUserComparison = filters.userIds && filters.userIds.length >= 2;
  const hasPeriodComparison = filters.periods && filters.periods.length >= 2;

  // Count active comparison modes
  const activeComparisons = [hasSectorComparison, hasUserComparison, hasPeriodComparison].filter(Boolean).length;

  if (activeComparisons > 1) {
    return {
      valid: false,
      error: 'Não é possível usar múltiplos modos de comparação simultaneamente',
    };
  }

  if (filters.endDate < filters.startDate) {
    return {
      valid: false,
      error: 'Data final deve ser maior ou igual à data inicial',
    };
  }

  return { valid: true };
}
