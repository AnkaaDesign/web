// packages/api-client/src/warning.ts

import { apiClient } from "./axiosClient";
import type {
  // Schema types (for parameters)
  WarningGetManyFormData,
  WarningGetByIdFormData,
  WarningCreateFormData,
  WarningUpdateFormData,
  WarningBatchCreateFormData,
  WarningBatchUpdateFormData,
  WarningBatchDeleteFormData,
  WarningQueryFormData,
} from "../schemas";
import type {
  // Interface types (for responses)
  Warning,
  WarningGetUniqueResponse,
  WarningGetManyResponse,
  WarningCreateResponse,
  WarningUpdateResponse,
  WarningDeleteResponse,
  WarningBatchCreateResponse,
  WarningBatchUpdateResponse,
  WarningBatchDeleteResponse,
} from "../types";

// =====================
// Warning Service Class
// =====================

export class WarningService {
  private readonly basePath = "/warnings";

  // =====================
  // Query Operations
  // =====================

  async getWarnings(params?: WarningGetManyFormData): Promise<WarningGetManyResponse> {
    const response = await apiClient.get<WarningGetManyResponse>(this.basePath, {
      params,
    });
    return response.data;
  }

  async getWarningById(id: string, params?: Omit<WarningGetByIdFormData, "id">): Promise<WarningGetUniqueResponse> {
    const response = await apiClient.get<WarningGetUniqueResponse>(`${this.basePath}/${id}`, {
      params,
    });
    return response.data;
  }

  // =====================
  // Mutation Operations
  // =====================

  async createWarning(data: WarningCreateFormData | FormData, query?: WarningQueryFormData): Promise<WarningCreateResponse> {
    const headers = data instanceof FormData ? { 'Content-Type': 'multipart/form-data' } : {};
    const response = await apiClient.post<WarningCreateResponse>(this.basePath, data, {
      params: query,
      headers,
    });
    return response.data;
  }

  async updateWarning(id: string, data: WarningUpdateFormData | FormData, query?: WarningQueryFormData): Promise<WarningUpdateResponse> {
    const headers = data instanceof FormData ? { 'Content-Type': 'multipart/form-data' } : {};
    const response = await apiClient.put<WarningUpdateResponse>(`${this.basePath}/${id}`, data, {
      params: query,
      headers,
    });
    return response.data;
  }

  async deleteWarning(id: string): Promise<WarningDeleteResponse> {
    const response = await apiClient.delete<WarningDeleteResponse>(`${this.basePath}/${id}`);
    return response.data;
  }

  // =====================
  // Batch Operations
  // =====================

  async batchCreateWarnings(data: WarningBatchCreateFormData, query?: WarningQueryFormData): Promise<WarningBatchCreateResponse<Warning>> {
    const response = await apiClient.post<WarningBatchCreateResponse<Warning>>(`${this.basePath}/batch`, data, {
      params: query,
    });
    return response.data;
  }

  async batchUpdateWarnings(data: WarningBatchUpdateFormData, query?: WarningQueryFormData): Promise<WarningBatchUpdateResponse<Warning>> {
    const response = await apiClient.put<WarningBatchUpdateResponse<Warning>>(`${this.basePath}/batch`, data, {
      params: query,
    });
    return response.data;
  }

  async batchDeleteWarnings(data: WarningBatchDeleteFormData, query?: WarningQueryFormData): Promise<WarningBatchDeleteResponse> {
    const response = await apiClient.delete<WarningBatchDeleteResponse>(`${this.basePath}/batch`, {
      data,
      params: query,
    });
    return response.data;
  }
}

// =====================
// Export service instance
// =====================

export const warningService = new WarningService();

// =====================
// Export individual functions
// =====================

// Query Operations
export const getWarnings = (params?: WarningGetManyFormData) => warningService.getWarnings(params);
export const getWarningById = (id: string, params?: Omit<WarningGetByIdFormData, "id">) => warningService.getWarningById(id, params);

// Mutation Operations
export const createWarning = (data: WarningCreateFormData | FormData, query?: WarningQueryFormData) => warningService.createWarning(data, query);
export const updateWarning = (id: string, data: WarningUpdateFormData | FormData, query?: WarningQueryFormData) => warningService.updateWarning(id, data, query);
export const deleteWarning = (id: string) => warningService.deleteWarning(id);

// Batch Operations
export const batchCreateWarnings = (data: WarningBatchCreateFormData, query?: WarningQueryFormData) => warningService.batchCreateWarnings(data, query);
export const batchUpdateWarnings = (data: WarningBatchUpdateFormData, query?: WarningQueryFormData) => warningService.batchUpdateWarnings(data, query);
export const batchDeleteWarnings = (data: WarningBatchDeleteFormData, query?: WarningQueryFormData) => warningService.batchDeleteWarnings(data, query);
