// packages/api-client/src/layout.ts

import { apiClient } from "./axiosClient";
import type { Layout, BaseGetUniqueResponse, BaseCreateResponse, BaseUpdateResponse, BaseDeleteResponse } from "../types";
import type { LayoutCreateFormData, LayoutUpdateFormData } from "../schemas";
import { safeFileDownload } from "./platform-utils";

// Response Types
export type LayoutGetUniqueResponse = BaseGetUniqueResponse<Layout>;
export type LayoutCreateResponse = BaseCreateResponse<Layout>;
export type LayoutUpdateResponse = BaseUpdateResponse<Layout>;
export type LayoutDeleteResponse = BaseDeleteResponse;

export interface LayoutsByTruckResponse {
  success: boolean;
  message: string;
  data: {
    leftSideLayout: Layout | null;
    rightSideLayout: Layout | null;
    backSideLayout: Layout | null;
  };
}

// Layout Service
export const layoutService = {
  // Get layout by ID
  getById: (id: string, params?: { include?: any }) => apiClient.get<LayoutGetUniqueResponse>(`/layout/${id}`, { params }),

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
