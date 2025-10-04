// packages/api-client/src/garage-lane.ts

import { apiClient } from "./axiosClient";
import type {
  // Schema types (for parameters)
  GarageLaneGetManyFormData,
  GarageLaneGetByIdFormData,
  GarageLaneCreateFormData,
  GarageLaneUpdateFormData,
  GarageLaneBatchCreateFormData,
  GarageLaneBatchUpdateFormData,
  GarageLaneBatchDeleteFormData,
  GarageLaneQueryFormData,
} from "../schemas";
import type {
  // Interface types (for responses)
  GarageLane,
  GarageLaneGetUniqueResponse,
  GarageLaneGetManyResponse,
  GarageLaneCreateResponse,
  GarageLaneUpdateResponse,
  GarageLaneDeleteResponse,
  GarageLaneBatchCreateResponse,
  GarageLaneBatchUpdateResponse,
  GarageLaneBatchDeleteResponse,
} from "../types";

// =====================
// GarageLane Service Class
// =====================

export class GarageLaneService {
  private readonly basePath = "/garage-lanes";

  // =====================
  // Query Operations
  // =====================

  async getGarageLanes(params?: GarageLaneGetManyFormData): Promise<GarageLaneGetManyResponse> {
    const response = await apiClient.get<GarageLaneGetManyResponse>(this.basePath, {
      params,
    });
    return response.data;
  }

  async getGarageLaneById(params: GarageLaneGetByIdFormData): Promise<GarageLaneGetUniqueResponse> {
    const { id, ...queryParams } = params;
    const response = await apiClient.get<GarageLaneGetUniqueResponse>(`${this.basePath}/${id}`, {
      params: queryParams,
    });
    return response.data;
  }

  // =====================
  // Mutation Operations
  // =====================

  async createGarageLane(data: GarageLaneCreateFormData, query?: GarageLaneQueryFormData): Promise<GarageLaneCreateResponse> {
    const response = await apiClient.post<GarageLaneCreateResponse>(this.basePath, data, {
      params: query,
    });
    return response.data;
  }

  async updateGarageLane(id: string, data: GarageLaneUpdateFormData, query?: GarageLaneQueryFormData): Promise<GarageLaneUpdateResponse> {
    const response = await apiClient.put<GarageLaneUpdateResponse>(`${this.basePath}/${id}`, data, {
      params: query,
    });
    return response.data;
  }

  async deleteGarageLane(id: string): Promise<GarageLaneDeleteResponse> {
    const response = await apiClient.delete<GarageLaneDeleteResponse>(`${this.basePath}/${id}`);
    return response.data;
  }

  // =====================
  // Batch Operations
  // =====================

  async batchCreateGarageLanes(data: GarageLaneBatchCreateFormData, query?: GarageLaneQueryFormData): Promise<GarageLaneBatchCreateResponse<GarageLane>> {
    const response = await apiClient.post<GarageLaneBatchCreateResponse<GarageLane>>(`${this.basePath}/batch`, data, {
      params: query,
    });
    return response.data;
  }

  async batchUpdateGarageLanes(data: GarageLaneBatchUpdateFormData, query?: GarageLaneQueryFormData): Promise<GarageLaneBatchUpdateResponse<GarageLane>> {
    const response = await apiClient.put<GarageLaneBatchUpdateResponse<GarageLane>>(`${this.basePath}/batch`, data, {
      params: query,
    });
    return response.data;
  }

  async batchDeleteGarageLanes(data: GarageLaneBatchDeleteFormData, query?: GarageLaneQueryFormData): Promise<GarageLaneBatchDeleteResponse> {
    const response = await apiClient.delete<GarageLaneBatchDeleteResponse>(`${this.basePath}/batch`, {
      data,
      params: query,
    });
    return response.data;
  }
}

// =====================
// Export service instance
// =====================

export const garageLaneService = new GarageLaneService();

// =====================
// Export individual functions
// =====================

// Query Operations
export const getGarageLanes = (params?: GarageLaneGetManyFormData) => garageLaneService.getGarageLanes(params);
export const getGarageLaneById = (params: GarageLaneGetByIdFormData) => garageLaneService.getGarageLaneById(params);

// Mutation Operations
export const createGarageLane = (data: GarageLaneCreateFormData, query?: GarageLaneQueryFormData) => garageLaneService.createGarageLane(data, query);
export const updateGarageLane = (id: string, data: GarageLaneUpdateFormData, query?: GarageLaneQueryFormData) => garageLaneService.updateGarageLane(id, data, query);
export const deleteGarageLane = (id: string) => garageLaneService.deleteGarageLane(id);

// Batch Operations
export const batchCreateGarageLanes = (data: GarageLaneBatchCreateFormData, query?: GarageLaneQueryFormData) => garageLaneService.batchCreateGarageLanes(data, query);
export const batchUpdateGarageLanes = (data: GarageLaneBatchUpdateFormData, query?: GarageLaneQueryFormData) => garageLaneService.batchUpdateGarageLanes(data, query);
export const batchDeleteGarageLanes = (data: GarageLaneBatchDeleteFormData, query?: GarageLaneQueryFormData) => garageLaneService.batchDeleteGarageLanes(data, query);
