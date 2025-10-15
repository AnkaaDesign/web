// packages/api-client/src/cut.ts

import { apiClient } from "./axiosClient";
import type {
  // Schema types (for parameters)
  CutGetManyFormData,
  CutQueryFormData,
  CutCreateFormData,
  CutUpdateFormData,
  CutBatchCreateFormData,
  CutBatchUpdateFormData,
  CutBatchDeleteFormData,
} from "../schemas";
import type {
  // Interface types (for responses)
  Cut,
  CutGetUniqueResponse,
  CutGetManyResponse,
  CutCreateResponse,
  CutUpdateResponse,
  CutDeleteResponse,
  CutBatchCreateResponse,
  CutBatchUpdateResponse,
  CutBatchDeleteResponse,
} from "../types";

// =====================
// Cut Service Class
// =====================

export class CutService {
  private readonly basePath = "/cuts";

  // =====================
  // Query Operations
  // =====================

  async getCuts(params?: CutGetManyFormData): Promise<CutGetManyResponse> {
    const response = await apiClient.get<CutGetManyResponse>(this.basePath, { params });
    return response.data;
  }

  async getCutById(id: string, params?: CutQueryFormData): Promise<CutGetUniqueResponse> {
    const response = await apiClient.get<CutGetUniqueResponse>(`${this.basePath}/${id}`, {
      params,
    });
    return response.data;
  }

  // =====================
  // Mutation Operations
  // =====================

  async createCut(data: CutCreateFormData | FormData, query?: CutQueryFormData): Promise<CutCreateResponse> {
    const headers = data instanceof FormData ? { 'Content-Type': 'multipart/form-data' } : {};
    const response = await apiClient.post<CutCreateResponse>(this.basePath, data, {
      params: query,
      headers,
    });
    return response.data;
  }

  async updateCut(id: string, data: CutUpdateFormData | FormData, query?: CutQueryFormData): Promise<CutUpdateResponse> {
    const headers = data instanceof FormData ? { 'Content-Type': 'multipart/form-data' } : {};
    const response = await apiClient.put<CutUpdateResponse>(`${this.basePath}/${id}`, data, {
      params: query,
      headers,
    });
    return response.data;
  }

  async deleteCut(id: string): Promise<CutDeleteResponse> {
    const response = await apiClient.delete<CutDeleteResponse>(`${this.basePath}/${id}`);
    return response.data;
  }

  // =====================
  // Batch Operations
  // =====================

  async batchCreateCuts(data: CutBatchCreateFormData, query?: CutQueryFormData): Promise<CutBatchCreateResponse<Cut>> {
    const response = await apiClient.post<CutBatchCreateResponse<Cut>>(`${this.basePath}/batch`, data, { params: query });
    return response.data;
  }

  async batchUpdateCuts(data: CutBatchUpdateFormData, query?: CutQueryFormData): Promise<CutBatchUpdateResponse<Cut>> {
    const response = await apiClient.put<CutBatchUpdateResponse<Cut>>(`${this.basePath}/batch`, data, { params: query });
    return response.data;
  }

  async batchDeleteCuts(data: CutBatchDeleteFormData): Promise<CutBatchDeleteResponse> {
    const response = await apiClient.delete<CutBatchDeleteResponse>(`${this.basePath}/batch`, { data });
    return response.data;
  }
}

// =====================
// Export Service Instances
// =====================

export const cutService = new CutService();

// =====================
// Export individual functions (for backward compatibility)
// =====================

export const getCuts = (params?: CutGetManyFormData) => cutService.getCuts(params);
export const getCutById = (id: string, params?: CutQueryFormData) => cutService.getCutById(id, params);
export const createCut = (data: CutCreateFormData | FormData, query?: CutQueryFormData) => cutService.createCut(data, query);
export const updateCut = (id: string, data: CutUpdateFormData | FormData, query?: CutQueryFormData) => cutService.updateCut(id, data, query);
export const deleteCut = (id: string) => cutService.deleteCut(id);
export const batchCreateCuts = (data: CutBatchCreateFormData, query?: CutQueryFormData) => cutService.batchCreateCuts(data, query);
export const batchUpdateCuts = (data: CutBatchUpdateFormData, query?: CutQueryFormData) => cutService.batchUpdateCuts(data, query);
export const batchDeleteCuts = (data: CutBatchDeleteFormData) => cutService.batchDeleteCuts(data);
