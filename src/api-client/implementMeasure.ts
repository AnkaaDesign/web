// packages/api-client/src/implementMeasure.ts

import { apiClient } from "./axiosClient";
import type { ImplementMeasure, BaseGetUniqueResponse, BaseCreateResponse, BaseUpdateResponse, BaseDeleteResponse } from "../types";
import type { ImplementMeasureCreateFormData, ImplementMeasureUpdateFormData } from "../schemas";
import { safeFileDownload } from "./platform-utils";
import type { ImplementFace } from "@/constants/implement-faces";

// Response Types
type ImplementMeasureGetUniqueResponse = BaseGetUniqueResponse<ImplementMeasure>;
type ImplementMeasureCreateResponse = BaseCreateResponse<ImplementMeasure>;
type ImplementMeasureUpdateResponse = BaseUpdateResponse<ImplementMeasure>;
type ImplementMeasureDeleteResponse = BaseDeleteResponse;

interface ImplementMeasuresByImplementResponse {
  success: boolean;
  message: string;
  data: {
    leftSideMeasure: ImplementMeasure | null;
    rightSideMeasure: ImplementMeasure | null;
    backSideMeasure: ImplementMeasure | null;
  };
}

interface ImplementMeasureListResponse {
  success: boolean;
  message: string;
  data: ImplementMeasure[];
}

/** Quem usa a medida, por face (`GET /implement-measure/:id/usage`). */
interface ImplementMeasureUser {
  implementId: string;
  taskId: string;
  plate: string | null;
}

interface ImplementMeasureUsageResponse {
  success: boolean;
  message: string;
  data: {
    backSide: ImplementMeasureUser[];
    leftSide: ImplementMeasureUser[];
    rightSide: ImplementMeasureUser[];
    totalCount: number;
  };
}

interface ImplementMeasureAssignResponse {
  success: boolean;
  message: string;
  data: ImplementMeasure;
}

// Implement Measure Service
export const implementMeasureService = {
  // Get implement measure by ID
  getById: (id: string, params?: { include?: any }) => apiClient.get<ImplementMeasureGetUniqueResponse>(`/implement-measure/${id}`, { params }),

  // List all implement measures
  listImplementMeasures: (options?: { includeUsage?: boolean; includeSections?: boolean }) =>
    apiClient.get<ImplementMeasureListResponse>("/implement-measure", { params: options }),

  // Get implement measure usage
  getImplementMeasureUsage: (implementMeasureId: string) => apiClient.get<ImplementMeasureUsageResponse>(`/implement-measure/${implementMeasureId}/usage`),

  // Assign implement measure to implement
  assignImplementMeasureToImplement: (implementMeasureId: string, data: { implementId: string; side: ImplementFace }) =>
    apiClient.post<ImplementMeasureAssignResponse>(`/implement-measure/${implementMeasureId}/assign-to-implement`, data),

  // Get implement measures by implement ID
  getByImplementId: (implementId: string, options?: { includePhoto?: boolean }) =>
    apiClient.get<ImplementMeasuresByImplementResponse>(`/implement-measure/implement/${implementId}`, {
      params: options?.includePhoto ? { includePhoto: 'true' } : undefined,
    }),

  // Create implement measure
  create: (data: ImplementMeasureCreateFormData) => apiClient.post<ImplementMeasureCreateResponse>("/implement-measure", data),

  // Update implement measure
  update: (id: string, data: ImplementMeasureUpdateFormData) => apiClient.put<ImplementMeasureUpdateResponse>(`/implement-measure/${id}`, data),

  // Delete implement measure
  delete: (id: string) => apiClient.delete<ImplementMeasureDeleteResponse>(`/implement-measure/${id}`),

  // Create or update implement measure for specific side
  createOrUpdateImplementMeasure: (implementId: string, side: ImplementFace, data: ImplementMeasureCreateFormData) =>
    apiClient.post<ImplementMeasureCreateResponse>(`/implement-measure/implement/${implementId}/${side}`, data),

  // Generate SVG for implement measure
  generateSVG: (id: string) => apiClient.get(`/implement-measure/${id}/svg`, { responseType: "blob" }),

  // Download SVG for implement measure
  downloadSVG: async (id: string, filename?: string) => {
    const response = await implementMeasureService.generateSVG(id);
    const blob = response.data;

    const success = safeFileDownload(blob, filename || `implement-measure-${id}.svg`);

    // Return the blob for React Native or other environments to handle
    return success ? undefined : blob;
  },
};

// Export types
export type {
  ImplementMeasureGetUniqueResponse,
  ImplementMeasureCreateResponse,
  ImplementMeasureUpdateResponse,
  ImplementMeasureDeleteResponse,
  ImplementMeasuresByImplementResponse,
  ImplementMeasureListResponse,
  ImplementMeasureUsageResponse,
  ImplementMeasureAssignResponse,
};
