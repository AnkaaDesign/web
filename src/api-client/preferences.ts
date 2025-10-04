// packages/api-client/src/preferences.ts

import { apiClient } from "./axiosClient";
import type {
  // Schema types (for parameters)
  PreferencesGetManyFormData,
  PreferencesGetByIdFormData,
  PreferencesCreateFormData,
  PreferencesUpdateFormData,
  PreferencesBatchCreateFormData,
  PreferencesBatchUpdateFormData,
  PreferencesBatchDeleteFormData,
  PreferencesQueryFormData,
} from "../schemas";
import type {
  // Interface types (for responses)
  Preferences,
  PreferencesGetUniqueResponse,
  PreferencesGetManyResponse,
  PreferencesCreateResponse,
  PreferencesUpdateResponse,
  PreferencesDeleteResponse,
  PreferencesBatchCreateResponse,
  PreferencesBatchUpdateResponse,
  PreferencesBatchDeleteResponse,
} from "../types";

// =====================
// Preferences Service Class
// =====================

export class PreferencesService {
  private readonly basePath = "/preferences";

  // =====================
  // Query Operations
  // =====================

  async getPreferences(params?: PreferencesGetManyFormData): Promise<PreferencesGetManyResponse> {
    const response = await apiClient.get<PreferencesGetManyResponse>(this.basePath, {
      params,
    });
    return response.data;
  }

  async getPreferencesById(id: string, params?: Omit<PreferencesGetByIdFormData, "id">): Promise<PreferencesGetUniqueResponse> {
    const response = await apiClient.get<PreferencesGetUniqueResponse>(`${this.basePath}/${id}`, {
      params,
    });
    return response.data;
  }

  // =====================
  // Mutation Operations
  // =====================

  async createPreferences(data: PreferencesCreateFormData, query?: PreferencesQueryFormData): Promise<PreferencesCreateResponse> {
    const response = await apiClient.post<PreferencesCreateResponse>(this.basePath, data, {
      params: query,
    });
    return response.data;
  }

  async updatePreferences(id: string, data: PreferencesUpdateFormData, query?: PreferencesQueryFormData): Promise<PreferencesUpdateResponse> {
    const response = await apiClient.put<PreferencesUpdateResponse>(`${this.basePath}/${id}`, data, {
      params: query,
    });
    return response.data;
  }

  async deletePreferences(id: string, query?: PreferencesQueryFormData): Promise<PreferencesDeleteResponse> {
    const response = await apiClient.delete<PreferencesDeleteResponse>(`${this.basePath}/${id}`, {
      params: query,
    });
    return response.data;
  }

  // =====================
  // Batch Operations
  // =====================

  async batchCreatePreferences(data: PreferencesBatchCreateFormData, query?: PreferencesQueryFormData): Promise<PreferencesBatchCreateResponse<Preferences>> {
    const response = await apiClient.post<PreferencesBatchCreateResponse<Preferences>>(`${this.basePath}/batch`, data, {
      params: query,
    });
    return response.data;
  }

  async batchUpdatePreferences(data: PreferencesBatchUpdateFormData, query?: PreferencesQueryFormData): Promise<PreferencesBatchUpdateResponse<Preferences>> {
    const response = await apiClient.put<PreferencesBatchUpdateResponse<Preferences>>(`${this.basePath}/batch`, data, {
      params: query,
    });
    return response.data;
  }

  async batchDeletePreferences(data: PreferencesBatchDeleteFormData, query?: PreferencesQueryFormData): Promise<PreferencesBatchDeleteResponse> {
    const response = await apiClient.delete<PreferencesBatchDeleteResponse>(`${this.basePath}/batch`, {
      data,
      params: query,
    });
    return response.data;
  }
}

// =====================
// Export service instance
// =====================

export const preferencesService = new PreferencesService();

// =====================
// Export individual functions
// =====================

// Query Operations
export const getPreferences = (params?: PreferencesGetManyFormData) => preferencesService.getPreferences(params);
export const getPreferencesById = (id: string, params?: Omit<PreferencesGetByIdFormData, "id">) => preferencesService.getPreferencesById(id, params);

// Mutation Operations
export const createPreferences = (data: PreferencesCreateFormData, query?: PreferencesQueryFormData) => preferencesService.createPreferences(data, query);
export const updatePreferences = (id: string, data: PreferencesUpdateFormData, query?: PreferencesQueryFormData) => preferencesService.updatePreferences(id, data, query);
export const deletePreferences = (id: string, query?: PreferencesQueryFormData) => preferencesService.deletePreferences(id, query);

// Batch Operations
export const batchCreatePreferences = (data: PreferencesBatchCreateFormData, query?: PreferencesQueryFormData) => preferencesService.batchCreatePreferences(data, query);
export const batchUpdatePreferences = (data: PreferencesBatchUpdateFormData, query?: PreferencesQueryFormData) => preferencesService.batchUpdatePreferences(data, query);
export const batchDeletePreferences = (data: PreferencesBatchDeleteFormData, query?: PreferencesQueryFormData) => preferencesService.batchDeletePreferences(data, query);
