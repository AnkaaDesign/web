import { useQuery } from '@tanstack/react-query';
import { getPaintAnalyticsOverview } from '@/api-client/paint-analytics';
import type {
  PaintAnalyticsFilters,
  PaintAnalyticsResponse,
} from '@/types/paint-analytics';

export const paintAnalyticsKeys = {
  all: ['paint-analytics'] as const,
  overview: (filters: PaintAnalyticsFilters) => [...paintAnalyticsKeys.all, 'overview', filters] as const,
};

export function usePaintAnalytics(filters: PaintAnalyticsFilters) {
  return useQuery<PaintAnalyticsResponse, Error>({
    queryKey: paintAnalyticsKeys.overview(filters),
    queryFn: () => getPaintAnalyticsOverview(filters),
    staleTime: 3 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 2,
  });
}
