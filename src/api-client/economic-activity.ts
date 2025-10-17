// packages/api-client/src/economic-activity.ts

import { apiClient } from "./axiosClient";
import type {
  // Schema types (for parameters)
  EconomicActivityGetManyFormData,
  EconomicActivityGetByIdFormData,
  EconomicActivityCreateFormData,
  EconomicActivityUpdateFormData,
  EconomicActivityBatchCreateFormData,
  EconomicActivityBatchUpdateFormData,
  EconomicActivityBatchDeleteFormData,
  EconomicActivityQueryFormData,
} from "../schemas";
import type {
  // Interface types (for responses)
  EconomicActivity,
  EconomicActivityGetUniqueResponse,
  EconomicActivityGetManyResponse,
  EconomicActivityCreateResponse,
  EconomicActivityUpdateResponse,
  EconomicActivityDeleteResponse,
  EconomicActivityBatchCreateResponse,
  EconomicActivityBatchUpdateResponse,
  EconomicActivityBatchDeleteResponse,
} from "../types";

// =====================
// EconomicActivity Service Class
// =====================

export class EconomicActivityService {
  private readonly basePath = "/economic-activities";

  // =====================
  // Query Operations
  // =====================

  async getEconomicActivities(params?: EconomicActivityGetManyFormData): Promise<EconomicActivityGetManyResponse> {
    const response = await apiClient.get<EconomicActivityGetManyResponse>(this.basePath, {
      params,
    });
    return response.data;
  }

  async getEconomicActivityById(id: string, params?: EconomicActivityGetByIdFormData): Promise<EconomicActivityGetUniqueResponse> {
    const response = await apiClient.get<EconomicActivityGetUniqueResponse>(`${this.basePath}/${id}`, {
      params,
    });
    return response.data;
  }

  // =====================
  // Mutation Operations
  // =====================

  async createEconomicActivity(data: EconomicActivityCreateFormData, query?: EconomicActivityQueryFormData): Promise<EconomicActivityCreateResponse> {
    const response = await apiClient.post<EconomicActivityCreateResponse>(this.basePath, data, {
      params: query,
    });
    return response.data;
  }

  async updateEconomicActivity(id: string, data: EconomicActivityUpdateFormData, query?: EconomicActivityQueryFormData): Promise<EconomicActivityUpdateResponse> {
    const response = await apiClient.put<EconomicActivityUpdateResponse>(`${this.basePath}/${id}`, data, {
      params: query,
    });
    return response.data;
  }

  async deleteEconomicActivity(id: string): Promise<EconomicActivityDeleteResponse> {
    const response = await apiClient.delete<EconomicActivityDeleteResponse>(`${this.basePath}/${id}`);
    return response.data;
  }

  // =====================
  // Batch Operations
  // =====================

  async batchCreateEconomicActivities(data: EconomicActivityBatchCreateFormData, query?: EconomicActivityQueryFormData): Promise<EconomicActivityBatchCreateResponse<EconomicActivity>> {
    const response = await apiClient.post<EconomicActivityBatchCreateResponse<EconomicActivity>>(`${this.basePath}/batch`, data, {
      params: query,
    });
    return response.data;
  }

  async batchUpdateEconomicActivities(data: EconomicActivityBatchUpdateFormData, query?: EconomicActivityQueryFormData): Promise<EconomicActivityBatchUpdateResponse<EconomicActivity>> {
    const response = await apiClient.put<EconomicActivityBatchUpdateResponse<EconomicActivity>>(`${this.basePath}/batch`, data, {
      params: query,
    });
    return response.data;
  }

  async batchDeleteEconomicActivities(data: EconomicActivityBatchDeleteFormData, query?: EconomicActivityQueryFormData): Promise<EconomicActivityBatchDeleteResponse> {
    const response = await apiClient.delete<EconomicActivityBatchDeleteResponse>(`${this.basePath}/batch`, {
      data,
      params: query,
    });
    return response.data;
  }
}

// =====================
// Export service instance
// =====================

export const economicActivityService = new EconomicActivityService();

// =====================
// Export individual functions
// =====================

// Query Operations
export const getEconomicActivities = (params?: EconomicActivityGetManyFormData) => economicActivityService.getEconomicActivities(params);
export const getEconomicActivityById = (id: string, params?: EconomicActivityGetByIdFormData) => economicActivityService.getEconomicActivityById(id, params);

// Mutation Operations
export const createEconomicActivity = (data: EconomicActivityCreateFormData, query?: EconomicActivityQueryFormData) => economicActivityService.createEconomicActivity(data, query);
export const updateEconomicActivity = (id: string, data: EconomicActivityUpdateFormData, query?: EconomicActivityQueryFormData) => economicActivityService.updateEconomicActivity(id, data, query);
export const deleteEconomicActivity = (id: string) => economicActivityService.deleteEconomicActivity(id);

// Batch Operations
export const batchCreateEconomicActivities = (data: EconomicActivityBatchCreateFormData, query?: EconomicActivityQueryFormData) => economicActivityService.batchCreateEconomicActivities(data, query);
export const batchUpdateEconomicActivities = (data: EconomicActivityBatchUpdateFormData, query?: EconomicActivityQueryFormData) => economicActivityService.batchUpdateEconomicActivities(data, query);
export const batchDeleteEconomicActivities = (data: EconomicActivityBatchDeleteFormData, query?: EconomicActivityQueryFormData) => economicActivityService.batchDeleteEconomicActivities(data, query);
