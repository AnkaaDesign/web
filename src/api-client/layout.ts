// packages/api-client/src/layout.ts

import { apiClient } from "./axiosClient";
import type { Layout, BaseGetUniqueResponse, BaseCreateResponse, BaseUpdateResponse, BaseDeleteResponse } from "../types";
import type { LayoutCreateFormData, LayoutUpdateFormData } from "../schemas";
import { safeFileDownload } from "./platform-utils";

// Response Types
type LayoutGetUniqueResponse = BaseGetUniqueResponse<Layout>;
type LayoutCreateResponse = BaseCreateResponse<Layout>;
type LayoutUpdateResponse = BaseUpdateResponse<Layout>;
type LayoutDeleteResponse = BaseDeleteResponse;

interface LayoutsByTruckResponse {
  success: boolean;
  message: string;
  data: {
    leftSideLayout: Layout | null;
    rightSideLayout: Layout | null;
    backSideLayout: Layout | null;
  };
}

interface LayoutListResponse {
  success: boolean;
  message: string;
  data: Layout[];
}

interface LayoutUsageResponse {
  success: boolean;
  message: string;
  data: {
    layoutId: string;
    trucks: Array<{
      truckId: string;
      side: "left" | "right" | "back";
    }>;
  };
}

interface LayoutAssignResponse {
  success: boolean;
  message: string;
  data: Layout;
}

// Layout Service
export const layoutService = {
  // Get layout by ID
  getById: (id: string, params?: { include?: any }) => apiClient.get<LayoutGetUniqueResponse>(`/layout/${id}`, { params }),

  // List all layouts
  listLayouts: (options?: { includeUsage?: boolean; includeSections?: boolean }) =>
    apiClient.get<LayoutListResponse>("/layout", { params: options }),

  // Get layout usage
  getLayoutUsage: (layoutId: string) => apiClient.get<LayoutUsageResponse>(`/layout/${layoutId}/usage`),

  // Assign layout to truck
  assignLayoutToTruck: (layoutId: string, data: { truckId: string; side: "left" | "right" | "back" }) =>
    apiClient.post<LayoutAssignResponse>(`/layout/${layoutId}/assign-to-truck`, data),

  // Get layouts by truck ID
  getByTruckId: (truckId: string) => apiClient.get<LayoutsByTruckResponse>(`/layout/truck/${truckId}`),

  // Create layout
  create: (data: LayoutCreateFormData) => apiClient.post<LayoutCreateResponse>("/layout", data),

  // Update layout
  update: (id: string, data: LayoutUpdateFormData) => apiClient.put<LayoutUpdateResponse>(`/layout/${id}`, data),

  // Delete layout
  delete: (id: string) => apiClient.delete<LayoutDeleteResponse>(`/layout/${id}`),

  // Create or update truck layout for specific side
  createOrUpdateTruckLayout: (truckId: string, side: "left" | "right" | "back", data: LayoutCreateFormData) =>
    apiClient.post<LayoutCreateResponse>(`/layout/truck/${truckId}/${side}`, data),

  // Generate SVG for layout
  generateSVG: (id: string) => apiClient.get(`/layout/${id}/svg`, { responseType: "blob" }),

  // Download SVG for layout
  downloadSVG: async (id: string, filename?: string) => {
    const response = await layoutService.generateSVG(id);
    const blob = response.data;

    const success = safeFileDownload(blob, filename || `layout-${id}.svg`);

    // Return the blob for React Native or other environments to handle
    return success ? undefined : blob;
  },
};

// Export types
export type {
  LayoutGetUniqueResponse,
  LayoutCreateResponse,
  LayoutUpdateResponse,
  LayoutDeleteResponse,
  LayoutsByTruckResponse,
  LayoutListResponse,
  LayoutUsageResponse,
  LayoutAssignResponse,
};
