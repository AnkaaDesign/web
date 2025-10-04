// packages/api-client/src/truck.ts

import { apiClient } from "./axiosClient";
import type {
  // Schema types (for parameters)
  TruckGetManyFormData,
  TruckGetByIdFormData,
  TruckCreateFormData,
  TruckUpdateFormData,
  TruckBatchCreateFormData,
  TruckBatchUpdateFormData,
  TruckBatchDeleteFormData,
  TruckQueryFormData,
} from "../schemas";
import type {
  // Interface types (for responses)
  Truck,
  TruckGetUniqueResponse,
  TruckGetManyResponse,
  TruckCreateResponse,
  TruckUpdateResponse,
  TruckDeleteResponse,
  TruckBatchCreateResponse,
  TruckBatchUpdateResponse,
  TruckBatchDeleteResponse,
} from "../types";

// =====================
// Truck Service Class
// =====================

export class TruckService {
  private readonly basePath = "/trucks";

  // =====================
  // Query Operations
  // =====================

  async getTrucks(params?: TruckGetManyFormData): Promise<TruckGetManyResponse> {
    const response = await apiClient.get<TruckGetManyResponse>(this.basePath, {
      params,
    });
    return response.data;
  }

  async getTruckById(id: string, params?: Omit<TruckGetByIdFormData, "id">): Promise<TruckGetUniqueResponse> {
    const response = await apiClient.get<TruckGetUniqueResponse>(`${this.basePath}/${id}`, {
      params,
    });
    return response.data;
  }

  // =====================
  // Mutation Operations
  // =====================

  async createTruck(data: TruckCreateFormData, query?: TruckQueryFormData): Promise<TruckCreateResponse> {
    const response = await apiClient.post<TruckCreateResponse>(this.basePath, data, {
      params: query,
    });
    return response.data;
  }

  async updateTruck(id: string, data: TruckUpdateFormData, query?: TruckQueryFormData): Promise<TruckUpdateResponse> {
    const response = await apiClient.put<TruckUpdateResponse>(`${this.basePath}/${id}`, data, {
      params: query,
    });
    return response.data;
  }

  async deleteTruck(id: string): Promise<TruckDeleteResponse> {
    const response = await apiClient.delete<TruckDeleteResponse>(`${this.basePath}/${id}`);
    return response.data;
  }

  // =====================
  // Batch Operations
  // =====================

  async batchCreateTrucks(data: TruckBatchCreateFormData, query?: TruckQueryFormData): Promise<TruckBatchCreateResponse<Truck>> {
    const response = await apiClient.post<TruckBatchCreateResponse<Truck>>(`${this.basePath}/batch`, data, {
      params: query,
    });
    return response.data;
  }

  async batchUpdateTrucks(data: TruckBatchUpdateFormData, query?: TruckQueryFormData): Promise<TruckBatchUpdateResponse<Truck>> {
    const response = await apiClient.put<TruckBatchUpdateResponse<Truck>>(`${this.basePath}/batch`, data, {
      params: query,
    });
    return response.data;
  }

  async batchDeleteTrucks(data: TruckBatchDeleteFormData, query?: TruckQueryFormData): Promise<TruckBatchDeleteResponse> {
    const response = await apiClient.delete<TruckBatchDeleteResponse>(`${this.basePath}/batch`, {
      data,
      params: query,
    });
    return response.data;
  }
}

// =====================
// Export service instance
// =====================

export const truckService = new TruckService();

// =====================
// Export individual functions
// =====================

// Query Operations
export const getTrucks = (params?: TruckGetManyFormData) => truckService.getTrucks(params);
export const getTruckById = (id: string, params?: Omit<TruckGetByIdFormData, "id">) => truckService.getTruckById(id, params);

// Mutation Operations
export const createTruck = (data: TruckCreateFormData, query?: TruckQueryFormData) => truckService.createTruck(data, query);
export const updateTruck = (id: string, data: TruckUpdateFormData, query?: TruckQueryFormData) => truckService.updateTruck(id, data, query);
export const deleteTruck = (id: string) => truckService.deleteTruck(id);

// Batch Operations
export const batchCreateTrucks = (data: TruckBatchCreateFormData, query?: TruckQueryFormData) => truckService.batchCreateTrucks(data, query);
export const batchUpdateTrucks = (data: TruckBatchUpdateFormData, query?: TruckQueryFormData) => truckService.batchUpdateTrucks(data, query);
export const batchDeleteTrucks = (data: TruckBatchDeleteFormData, query?: TruckQueryFormData) => truckService.batchDeleteTrucks(data, query);
