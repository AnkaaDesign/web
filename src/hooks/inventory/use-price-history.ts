// packages/hooks/src/usePriceHistory.ts

import { useQuery } from "@tanstack/react-query";
import { getPriceHistory } from "../../api-client";
import type { PriceGetManyResponse } from "../../types";

// Query keys
export const priceHistoryQueryKeys = {
  all: ["priceHistory"] as const,
  byItem: (itemId: string) => ["priceHistory", "item", itemId] as const,
};

// Get price history for an item
export const usePriceHistory = (
  itemId: string,
  limit?: number,
  options?: {
    enabled?: boolean;
  },
) => {
  return useQuery({
    queryKey: priceHistoryQueryKeys.byItem(itemId),
    queryFn: async (): Promise<PriceGetManyResponse> => {
      const response = await getPriceHistory(itemId, limit);
      return response;
    },
    enabled: options?.enabled !== false && !!itemId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};
