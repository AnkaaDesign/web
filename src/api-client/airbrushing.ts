// packages/api-client/src/airbrushing.ts

import { apiClient } from "./axiosClient";
import type {
  // Schema types (for parameters)
  AirbrushingGetManyFormData,
  AirbrushingGetByIdFormData,
  AirbrushingCreateFormData,
  AirbrushingUpdateFormData,
  AirbrushingBatchCreateFormData,
  AirbrushingBatchUpdateFormData,
  AirbrushingBatchDeleteFormData,
  AirbrushingQueryFormData,
} from "../schemas";
import type {
  // Interface types (for responses)
  Airbrushing,
  AirbrushingGetUniqueResponse,
  AirbrushingGetManyResponse,
  AirbrushingCreateResponse,
  AirbrushingUpdateResponse,
  AirbrushingDeleteResponse,
  AirbrushingBatchCreateResponse,
  AirbrushingBatchUpdateResponse,
  AirbrushingBatchDeleteResponse,
} from "../types";

// =====================
// Airbrushing Service Class
// =====================

export class AirbrushingService {
  private readonly basePath = "/airbrushings";

  // =====================
  // Query Operations
  // =====================

  async getAirbrushings(params?: AirbrushingGetManyFormData): Promise<AirbrushingGetManyResponse> {
    const response = await apiClient.get<AirbrushingGetManyResponse>(this.basePath, {
      params,
    });
    return response.data;
  }

  async getAirbrushingById(id: string, params?: Omit<AirbrushingGetByIdFormData, "id">): Promise<AirbrushingGetUniqueResponse> {
    const response = await apiClient.get<AirbrushingGetUniqueResponse>(`${this.basePath}/${id}`, {
      params,
    });
    return response.data;
  }

  // =====================
  // Mutation Operations
  // =====================

  async createAirbrushing(data: AirbrushingCreateFormData, query?: AirbrushingQueryFormData): Promise<AirbrushingCreateResponse> {
    const response = await apiClient.post<AirbrushingCreateResponse>(this.basePath, data, {
      params: query,
    });
    return response.data;
  }

  async updateAirbrushing(id: string, data: AirbrushingUpdateFormData, query?: AirbrushingQueryFormData): Promise<AirbrushingUpdateResponse> {
    const response = await apiClient.put<AirbrushingUpdateResponse>(`${this.basePath}/${id}`, data, {
      params: query,
    });
    return response.data;
  }

  async deleteAirbrushing(id: string): Promise<AirbrushingDeleteResponse> {
    const response = await apiClient.delete<AirbrushingDeleteResponse>(`${this.basePath}/${id}`);
    return response.data;
  }

  // =====================
  // Batch Operations
  // =====================

  async batchCreateAirbrushings(data: AirbrushingBatchCreateFormData, query?: AirbrushingQueryFormData): Promise<AirbrushingBatchCreateResponse<Airbrushing>> {
    const response = await apiClient.post<AirbrushingBatchCreateResponse<Airbrushing>>(`${this.basePath}/batch`, data, {
      params: query,
    });
    return response.data;
  }

  async batchUpdateAirbrushings(data: AirbrushingBatchUpdateFormData, query?: AirbrushingQueryFormData): Promise<AirbrushingBatchUpdateResponse<Airbrushing>> {
    const response = await apiClient.put<AirbrushingBatchUpdateResponse<Airbrushing>>(`${this.basePath}/batch`, data, {
      params: query,
    });
    return response.data;
  }

  async batchDeleteAirbrushings(data: AirbrushingBatchDeleteFormData, query?: AirbrushingQueryFormData): Promise<AirbrushingBatchDeleteResponse> {
    const response = await apiClient.delete<AirbrushingBatchDeleteResponse>(`${this.basePath}/batch`, {
      data,
      params: query,
    });
    return response.data;
  }
}

// =====================
// Export service instance
// =====================

export const airbrushingService = new AirbrushingService();

// =====================
// Export individual functions
// =====================

// Query Operations
export const getAirbrushings = (params?: AirbrushingGetManyFormData) => airbrushingService.getAirbrushings(params);
export const getAirbrushingById = (id: string, params?: Omit<AirbrushingGetByIdFormData, "id">) => airbrushingService.getAirbrushingById(id, params);

// Mutation Operations
export const createAirbrushing = (data: AirbrushingCreateFormData, query?: AirbrushingQueryFormData) => airbrushingService.createAirbrushing(data, query);
export const updateAirbrushing = (id: string, data: AirbrushingUpdateFormData, query?: AirbrushingQueryFormData) => airbrushingService.updateAirbrushing(id, data, query);
export const deleteAirbrushing = (id: string) => airbrushingService.deleteAirbrushing(id);

// Batch Operations
export const batchCreateAirbrushings = (data: AirbrushingBatchCreateFormData, query?: AirbrushingQueryFormData) => airbrushingService.batchCreateAirbrushings(data, query);
export const batchUpdateAirbrushings = (data: AirbrushingBatchUpdateFormData, query?: AirbrushingQueryFormData) => airbrushingService.batchUpdateAirbrushings(data, query);
export const batchDeleteAirbrushings = (data: AirbrushingBatchDeleteFormData, query?: AirbrushingQueryFormData) => airbrushingService.batchDeleteAirbrushings(data, query);
