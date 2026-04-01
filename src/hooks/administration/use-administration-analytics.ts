import { useQuery } from '@tanstack/react-query';
import { getAdministrationOverview } from '@/api-client/administration-analytics';
import type {
  AdministrationAnalyticsFilters,
  AdministrationAnalyticsResponse,
} from '@/types/administration-analytics';

export const administrationAnalyticsKeys = {
  all: ['administration-analytics'] as const,
  overview: (filters: AdministrationAnalyticsFilters) => [...administrationAnalyticsKeys.all, 'overview', filters] as const,
};

export function useAdministrationAnalytics(filters: AdministrationAnalyticsFilters) {
  return useQuery<AdministrationAnalyticsResponse, Error>({
    queryKey: administrationAnalyticsKeys.overview(filters),
    queryFn: () => getAdministrationOverview(filters),
    staleTime: 3 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 2,
  });
}
