// packages/hooks/src/useImplementMeasureList.ts

import { useQuery } from "@tanstack/react-query";
import { implementMeasureService } from "../../api-client";
import type { ImplementMeasure } from "../../types";

// Response type for implement measure list
interface ImplementMeasureListQueryResponse {
  success: boolean;
  message: string;
  data: ImplementMeasure[];
}

// Query keys
export const implementMeasureListQueryKeys = {
  all: ["implementMeasureList"] as const,
  lists: () => ["implementMeasureList", "lists"] as const,
};

// Get list of all implement measures
export const useImplementMeasureList = (
  options?: {
    limit?: number;
    offset?: number;
    orderBy?: any;
    include?: any;
    enabled?: boolean;
  },
) => {
  return useQuery({
    queryKey: implementMeasureListQueryKeys.all,
    queryFn: async () => {
      const response = await implementMeasureService.listImplementMeasures({
        includeUsage: options?.include?.includeUsage,
        includeSections: options?.include?.includeSections,
      });
      // Transform the response to match expected format with data wrapper
      return {
        success: response.data.success,
        message: response.data.message,
        data: response.data.data,
      } as ImplementMeasureListQueryResponse;
    },
    enabled: options?.enabled !== false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};
