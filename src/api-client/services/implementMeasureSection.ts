// packages/api-client/src/services/implementMeasureSection.ts

import { apiClient } from "../axiosClient";
import type {
  ImplementMeasureSection,
  BaseGetManyResponse,
  BaseGetUniqueResponse,
  BaseCreateResponse,
  BaseUpdateResponse,
  BaseDeleteResponse,
  BatchOperationResult,
  ImplementMeasureSectionCreateInput,
  ImplementMeasureSectionUpdateInput
} from "../../types";

// Response Types
type ImplementMeasureSectionGetManyResponse = BaseGetManyResponse<ImplementMeasureSection>;
type ImplementMeasureSectionGetUniqueResponse = BaseGetUniqueResponse<ImplementMeasureSection>;
type ImplementMeasureSectionCreateResponse = BaseCreateResponse<ImplementMeasureSection>;
type ImplementMeasureSectionUpdateResponse = BaseUpdateResponse<ImplementMeasureSection>;
type ImplementMeasureSectionDeleteResponse = BaseDeleteResponse;

// Request Parameters
interface ImplementMeasureSectionGetManyParams {
  page?: number;
  limit?: number;
  implementMeasureId?: string;
  searchingFor?: string;
  where?: any;
  orderBy?: any;
  include?: any;
}

interface ImplementMeasureSectionGetByIdParams {
  include?: any;
}

// Implement Measure Section Service
export const implementMeasureSectionService = {
  // Get sections by implement measure ID
  getByImplementMeasureId: (implementMeasureId: string, params?: Omit<ImplementMeasureSectionGetManyParams, 'implementMeasureId'>) =>
    apiClient.get<ImplementMeasureSectionGetManyResponse>(`/implement-measure-section/implement-measure/${implementMeasureId}`, { params }),

  // Get section by ID
  getById: (id: string, params?: ImplementMeasureSectionGetByIdParams) =>
    apiClient.get<ImplementMeasureSectionGetUniqueResponse>(`/implement-measure-section/${id}`, { params }),

  // Create section
  create: (data: ImplementMeasureSectionCreateInput & { implementMeasureId: string }) =>
    apiClient.post<ImplementMeasureSectionCreateResponse>("/implement-measure-section", data),

  // Update section
  update: (id: string, data: ImplementMeasureSectionUpdateInput) =>
    apiClient.put<ImplementMeasureSectionUpdateResponse>(`/implement-measure-section/${id}`, data),

  // Delete section
  delete: (id: string) =>
    apiClient.delete<ImplementMeasureSectionDeleteResponse>(`/implement-measure-section/${id}`),

  // Batch operations
  batchCreate: (data: (ImplementMeasureSectionCreateInput & { implementMeasureId: string })[]) =>
    apiClient.post<BatchOperationResult<ImplementMeasureSection>>("/implement-measure-section/batch", data),

  batchUpdate: (data: { id: string; data: ImplementMeasureSectionUpdateInput }[]) =>
    apiClient.put<BatchOperationResult<ImplementMeasureSection>>("/implement-measure-section/batch", { updates: data }),

  batchDelete: (ids: string[]) =>
    apiClient.delete<BatchOperationResult<ImplementMeasureSection>>("/implement-measure-section/batch", { data: { ids } }),
};

// Export types
export type {
  ImplementMeasureSectionGetManyResponse,
  ImplementMeasureSectionGetUniqueResponse,
  ImplementMeasureSectionCreateResponse,
  ImplementMeasureSectionUpdateResponse,
  ImplementMeasureSectionDeleteResponse,
  ImplementMeasureSectionGetManyParams,
  ImplementMeasureSectionGetByIdParams,
};
