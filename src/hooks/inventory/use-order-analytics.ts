// web/src/hooks/use-order-analytics.ts

import { useQuery } from '@tanstack/react-query';
import { getOrderAnalytics } from '@/api-client/order-analytics';
import type { OrderAnalyticsFilters, OrderAnalyticsResponse } from '@/types/order-analytics';

export const orderAnalyticsKeys = {
  all: ['order-analytics'] as const,
  analytics: () => [...orderAnalyticsKeys.all, 'analytics'] as const,
  byFilters: (filters: OrderAnalyticsFilters) =>
    [...orderAnalyticsKeys.analytics(), filters] as const,
};

export function useOrderAnalytics(filters: OrderAnalyticsFilters) {
  return useQuery<OrderAnalyticsResponse, Error>({
    queryKey: orderAnalyticsKeys.byFilters(filters),
    queryFn: async () => {
      const response = await getOrderAnalytics(filters);
      return response;
    },
    staleTime: 3 * 60 * 1000, // 3 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 2,
  });
}
