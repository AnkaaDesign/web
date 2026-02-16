// packages/hooks/src/useLayoutList.ts

import { useQuery } from "@tanstack/react-query";
import { layoutService } from "../../api-client";
import type { Layout } from "../../types";

// Response type for layout list
interface LayoutListQueryResponse {
  success: boolean;
  message: string;
  data: Layout[];
}

// Query keys
export const layoutListQueryKeys = {
  all: ["layoutList"] as const,
  lists: () => ["layoutList", "lists"] as const,
};

// Get list of all layouts
export const useLayoutList = (
  options?: {
    limit?: number;
    offset?: number;
    orderBy?: any;
    include?: any;
    enabled?: boolean;
  },
) => {
  return useQuery({
    queryKey: layoutListQueryKeys.all,
    queryFn: async () => {
      const response = await layoutService.listLayouts({
        includeUsage: options?.include?.includeUsage,
        includeSections: options?.include?.includeSections,
      });
      // Transform the response to match expected format with data wrapper
      return {
        success: response.data.success,
        message: response.data.message,
        data: response.data.data,
      } as LayoutListQueryResponse;
    },
    enabled: options?.enabled !== false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};
