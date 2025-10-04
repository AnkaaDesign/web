// packages/api-client/src/parking-spot.ts

import { apiClient } from "./axiosClient";
import type {
  // Schema types (for parameters)
  ParkingSpotGetManyFormData,
  ParkingSpotGetByIdFormData,
  ParkingSpotCreateFormData,
  ParkingSpotUpdateFormData,
  ParkingSpotBatchCreateFormData,
  ParkingSpotBatchUpdateFormData,
  ParkingSpotBatchDeleteFormData,
  ParkingSpotQueryFormData,
} from "../schemas";
import type {
  // Interface types (for responses)
  ParkingSpot,
  ParkingSpotGetUniqueResponse,
  ParkingSpotGetManyResponse,
  ParkingSpotCreateResponse,
  ParkingSpotUpdateResponse,
  ParkingSpotDeleteResponse,
  ParkingSpotBatchCreateResponse,
  ParkingSpotBatchUpdateResponse,
  ParkingSpotBatchDeleteResponse,
} from "../types";

// =====================
// ParkingSpot Service Class
// =====================

export class ParkingSpotService {
  private readonly basePath = "/parking-spots";

  // =====================
  // Query Operations
  // =====================

  async getParkingSpots(params?: ParkingSpotGetManyFormData): Promise<ParkingSpotGetManyResponse> {
    const response = await apiClient.get<ParkingSpotGetManyResponse>(this.basePath, {
      params,
    });
    return response.data;
  }

  async getParkingSpotById(params: ParkingSpotGetByIdFormData): Promise<ParkingSpotGetUniqueResponse> {
    const { id, ...queryParams } = params;
    const response = await apiClient.get<ParkingSpotGetUniqueResponse>(`${this.basePath}/${id}`, {
      params: queryParams,
    });
    return response.data;
  }

  // =====================
  // Mutation Operations
  // =====================

  async createParkingSpot(data: ParkingSpotCreateFormData, query?: ParkingSpotQueryFormData): Promise<ParkingSpotCreateResponse> {
    const response = await apiClient.post<ParkingSpotCreateResponse>(this.basePath, data, {
      params: query,
    });
    return response.data;
  }

  async updateParkingSpot(id: string, data: ParkingSpotUpdateFormData, query?: ParkingSpotQueryFormData): Promise<ParkingSpotUpdateResponse> {
    const response = await apiClient.put<ParkingSpotUpdateResponse>(`${this.basePath}/${id}`, data, {
      params: query,
    });
    return response.data;
  }

  async deleteParkingSpot(id: string): Promise<ParkingSpotDeleteResponse> {
    const response = await apiClient.delete<ParkingSpotDeleteResponse>(`${this.basePath}/${id}`);
    return response.data;
  }

  // =====================
  // Batch Operations
  // =====================

  async batchCreateParkingSpots(data: ParkingSpotBatchCreateFormData, query?: ParkingSpotQueryFormData): Promise<ParkingSpotBatchCreateResponse<ParkingSpot>> {
    const response = await apiClient.post<ParkingSpotBatchCreateResponse<ParkingSpot>>(`${this.basePath}/batch`, data, {
      params: query,
    });
    return response.data;
  }

  async batchUpdateParkingSpots(data: ParkingSpotBatchUpdateFormData, query?: ParkingSpotQueryFormData): Promise<ParkingSpotBatchUpdateResponse<ParkingSpot>> {
    const response = await apiClient.put<ParkingSpotBatchUpdateResponse<ParkingSpot>>(`${this.basePath}/batch`, data, {
      params: query,
    });
    return response.data;
  }

  async batchDeleteParkingSpots(data: ParkingSpotBatchDeleteFormData, query?: ParkingSpotQueryFormData): Promise<ParkingSpotBatchDeleteResponse> {
    const response = await apiClient.delete<ParkingSpotBatchDeleteResponse>(`${this.basePath}/batch`, {
      data,
      params: query,
    });
    return response.data;
  }
}

// =====================
// Export service instance
// =====================

export const parkingSpotService = new ParkingSpotService();

// =====================
// Export individual functions
// =====================

// Query Operations
export const getParkingSpots = (params?: ParkingSpotGetManyFormData) => parkingSpotService.getParkingSpots(params);
export const getParkingSpotById = (params: ParkingSpotGetByIdFormData) => parkingSpotService.getParkingSpotById(params);

// Mutation Operations
export const createParkingSpot = (data: ParkingSpotCreateFormData, query?: ParkingSpotQueryFormData) => parkingSpotService.createParkingSpot(data, query);
export const updateParkingSpot = (id: string, data: ParkingSpotUpdateFormData, query?: ParkingSpotQueryFormData) => parkingSpotService.updateParkingSpot(id, data, query);
export const deleteParkingSpot = (id: string) => parkingSpotService.deleteParkingSpot(id);

// Batch Operations
export const batchCreateParkingSpots = (data: ParkingSpotBatchCreateFormData, query?: ParkingSpotQueryFormData) => parkingSpotService.batchCreateParkingSpots(data, query);
export const batchUpdateParkingSpots = (data: ParkingSpotBatchUpdateFormData, query?: ParkingSpotQueryFormData) => parkingSpotService.batchUpdateParkingSpots(data, query);
export const batchDeleteParkingSpots = (data: ParkingSpotBatchDeleteFormData, query?: ParkingSpotQueryFormData) => parkingSpotService.batchDeleteParkingSpots(data, query);
