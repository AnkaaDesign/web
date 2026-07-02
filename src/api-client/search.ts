// packages/api-client/src/search.ts

import { apiClient } from "./axiosClient";
import type { GlobalSearchResponse } from "../types";

export interface GlobalSearchParams {
  searchingFor: string;
  limit?: number;
}

// =====================
// Search Service Class
// =====================

export class SearchService {
  private readonly basePath = "/search";

  async globalSearch(params: GlobalSearchParams): Promise<GlobalSearchResponse> {
    const response = await apiClient.get<GlobalSearchResponse>(this.basePath, { params });
    return response.data;
  }
}

// =====================
// Export service instance
// =====================

export const searchService = new SearchService();

// =====================
// Convenience function exports
// =====================

export const globalSearch = (params: GlobalSearchParams) => searchService.globalSearch(params);
