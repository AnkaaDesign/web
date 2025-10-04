// packages/api-client/src/observation.ts

import { apiClient } from "./axiosClient";
import type {
  // Schema types (for parameters)
  ObservationGetManyFormData,
  ObservationGetByIdFormData,
  ObservationCreateFormData,
  ObservationUpdateFormData,
  ObservationBatchCreateFormData,
  ObservationBatchUpdateFormData,
  ObservationBatchDeleteFormData,
  ObservationQueryFormData,
} from "../schemas";
import type {
  // Interface types (for responses)
  Observation,
  ObservationGetUniqueResponse,
  ObservationGetManyResponse,
  ObservationCreateResponse,
  ObservationUpdateResponse,
  ObservationDeleteResponse,
  ObservationBatchCreateResponse,
  ObservationBatchUpdateResponse,
  ObservationBatchDeleteResponse,
} from "../types";

// =====================
// Observation Service Class
// =====================

export class ObservationService {
  private readonly basePath = "/observations";

  // =====================
  // Query Operations
  // =====================

  async getObservations(params?: ObservationGetManyFormData): Promise<ObservationGetManyResponse> {
    const response = await apiClient.get<ObservationGetManyResponse>(this.basePath, {
      params,
    });
    return response.data;
  }

  async getObservationById(id: string, params?: Omit<ObservationGetByIdFormData, "id">): Promise<ObservationGetUniqueResponse> {
    const response = await apiClient.get<ObservationGetUniqueResponse>(`${this.basePath}/${id}`, {
      params,
    });
    return response.data;
  }

  // =====================
  // Mutation Operations
  // =====================

  async createObservation(data: ObservationCreateFormData, query?: ObservationQueryFormData): Promise<ObservationCreateResponse> {
    const response = await apiClient.post<ObservationCreateResponse>(this.basePath, data, {
      params: query,
    });
    return response.data;
  }

  async updateObservation(id: string, data: ObservationUpdateFormData, query?: ObservationQueryFormData): Promise<ObservationUpdateResponse> {
    const response = await apiClient.put<ObservationUpdateResponse>(`${this.basePath}/${id}`, data, {
      params: query,
    });
    return response.data;
  }

  async deleteObservation(id: string): Promise<ObservationDeleteResponse> {
    const response = await apiClient.delete<ObservationDeleteResponse>(`${this.basePath}/${id}`);
    return response.data;
  }

  // =====================
  // Batch Operations
  // =====================

  async batchCreateObservations(data: ObservationBatchCreateFormData, query?: ObservationQueryFormData): Promise<ObservationBatchCreateResponse<Observation>> {
    const response = await apiClient.post<ObservationBatchCreateResponse<Observation>>(`${this.basePath}/batch`, data, {
      params: query,
    });
    return response.data;
  }

  async batchUpdateObservations(data: ObservationBatchUpdateFormData, query?: ObservationQueryFormData): Promise<ObservationBatchUpdateResponse<Observation>> {
    const response = await apiClient.put<ObservationBatchUpdateResponse<Observation>>(`${this.basePath}/batch`, data, {
      params: query,
    });
    return response.data;
  }

  async batchDeleteObservations(data: ObservationBatchDeleteFormData, query?: ObservationQueryFormData): Promise<ObservationBatchDeleteResponse> {
    const response = await apiClient.delete<ObservationBatchDeleteResponse>(`${this.basePath}/batch`, {
      data,
      params: query,
    });
    return response.data;
  }
}

// =====================
// Export service instance
// =====================

export const observationService = new ObservationService();

// =====================
// Export individual functions
// =====================

// Query Operations
export const getObservations = (params?: ObservationGetManyFormData) => observationService.getObservations(params);
export const getObservationById = (id: string, params?: Omit<ObservationGetByIdFormData, "id">) => observationService.getObservationById(id, params);

// Mutation Operations
export const createObservation = (data: ObservationCreateFormData, query?: ObservationQueryFormData) => observationService.createObservation(data, query);
export const updateObservation = (id: string, data: ObservationUpdateFormData, query?: ObservationQueryFormData) => observationService.updateObservation(id, data, query);
export const deleteObservation = (id: string) => observationService.deleteObservation(id);

// Batch Operations
export const batchCreateObservations = (data: ObservationBatchCreateFormData, query?: ObservationQueryFormData) => observationService.batchCreateObservations(data, query);
export const batchUpdateObservations = (data: ObservationBatchUpdateFormData, query?: ObservationQueryFormData) => observationService.batchUpdateObservations(data, query);
export const batchDeleteObservations = (data: ObservationBatchDeleteFormData, query?: ObservationQueryFormData) => observationService.batchDeleteObservations(data, query);
