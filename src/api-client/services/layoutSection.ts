// packages/api-client/src/services/layoutSection.ts

import { apiClient } from "../axiosClient";
import type {
  LayoutSection,
  BaseGetManyResponse,
  BaseGetUniqueResponse,
  BaseCreateResponse,
  BaseUpdateResponse,
  BaseDeleteResponse,
  BatchOperationResult,
  LayoutSectionCreateInput,
  LayoutSectionUpdateInput
} from "../../types";

// Response Types
type LayoutSectionGetManyResponse = BaseGetManyResponse<LayoutSection>;
type LayoutSectionGetUniqueResponse = BaseGetUniqueResponse<LayoutSection>;
type LayoutSectionCreateResponse = BaseCreateResponse<LayoutSection>;
type LayoutSectionUpdateResponse = BaseUpdateResponse<LayoutSection>;
type LayoutSectionDeleteResponse = BaseDeleteResponse;

// Request Parameters
interface LayoutSectionGetManyParams {
  page?: number;
  limit?: number;
  layoutId?: string;
  searchingFor?: string;
  where?: any;
  orderBy?: any;
  include?: any;
}

interface LayoutSectionGetByIdParams {
  include?: any;
}

// Layout Section Service
export const layoutSectionService = {
  // Get sections by layout ID
  getByLayoutId: (layoutId: string, params?: Omit<LayoutSectionGetManyParams, 'layoutId'>) =>
    apiClient.get<LayoutSectionGetManyResponse>(`/layout-section/layout/${layoutId}`, { params }),

  // Get section by ID
  getById: (id: string, params?: LayoutSectionGetByIdParams) =>
    apiClient.get<LayoutSectionGetUniqueResponse>(`/layout-section/${id}`, { params }),

  // Create section
  create: (data: LayoutSectionCreateInput & { layoutId: string }) =>
    apiClient.post<LayoutSectionCreateResponse>("/layout-section", data),

  // Update section
  update: (id: string, data: LayoutSectionUpdateInput) =>
    apiClient.put<LayoutSectionUpdateResponse>(`/layout-section/${id}`, data),

  // Delete section
  delete: (id: string) =>
    apiClient.delete<LayoutSectionDeleteResponse>(`/layout-section/${id}`),

  // Batch operations
  batchCreate: (data: (LayoutSectionCreateInput & { layoutId: string })[]) =>
    apiClient.post<BatchOperationResult<LayoutSection>>("/layout-section/batch", data),

  batchUpdate: (data: { id: string; data: LayoutSectionUpdateInput }[]) =>
    apiClient.put<BatchOperationResult<LayoutSection>>("/layout-section/batch", { updates: data }),

  batchDelete: (ids: string[]) =>
    apiClient.delete<BatchOperationResult<LayoutSection>>("/layout-section/batch", { data: { ids } }),
};

// Export types
export type {
  LayoutSectionGetManyResponse,
  LayoutSectionGetUniqueResponse,
  LayoutSectionCreateResponse,
  LayoutSectionUpdateResponse,
  LayoutSectionDeleteResponse,
  LayoutSectionGetManyParams,
  LayoutSectionGetByIdParams,
};