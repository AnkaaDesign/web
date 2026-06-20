// packages/api/src/warehouse-location.ts

import { apiClient } from "./axiosClient";
import type {
  WarehouseLocationGetManyFormData,
  WarehouseLocationGetByIdFormData,
  WarehouseLocationCreateFormData,
  WarehouseLocationUpdateFormData,
  WarehouseLocationBatchCreateFormData,
  WarehouseLocationBatchUpdateFormData,
  WarehouseLocationBatchDeleteFormData,
  WarehouseLocationQueryFormData,
} from "../schemas";
import type {
  WarehouseLocation,
  WarehouseLocationGetUniqueResponse,
  WarehouseLocationGetManyResponse,
  WarehouseLocationCreateResponse,
  WarehouseLocationUpdateResponse,
  WarehouseLocationDeleteResponse,
  WarehouseLocationBatchCreateResponse,
  WarehouseLocationBatchUpdateResponse,
  WarehouseLocationBatchDeleteResponse,
} from "../types";

// =====================
// WarehouseLocation Service Class
// =====================

export class WarehouseLocationService {
  private readonly basePath = "/warehouse-locations";

  // =====================
  // Query Operations
  // =====================

  async getWarehouseLocations(params?: WarehouseLocationGetManyFormData): Promise<WarehouseLocationGetManyResponse> {
    const response = await apiClient.get<WarehouseLocationGetManyResponse>(this.basePath, {
      params,
    });
    return response.data;
  }

  async getAllWarehouseLocations(params?: Omit<WarehouseLocationGetManyFormData, "page" | "limit">): Promise<WarehouseLocationGetManyResponse> {
    const response = await apiClient.get<WarehouseLocationGetManyResponse>(this.basePath, {
      params: {
        ...params,
        limit: 10000,
      },
    });
    return response.data;
  }

  async getWarehouseLocationById(id: string, params?: Omit<WarehouseLocationGetByIdFormData, "id">): Promise<WarehouseLocationGetUniqueResponse> {
    const response = await apiClient.get<WarehouseLocationGetUniqueResponse>(`${this.basePath}/${id}`, {
      params,
    });
    return response.data;
  }

  // =====================
  // Mutation Operations
  // =====================

  async createWarehouseLocation(data: WarehouseLocationCreateFormData, query?: WarehouseLocationQueryFormData): Promise<WarehouseLocationCreateResponse> {
    const response = await apiClient.post<WarehouseLocationCreateResponse>(this.basePath, data, {
      params: query,
    });
    return response.data;
  }

  async updateWarehouseLocation(
    id: string,
    data: WarehouseLocationUpdateFormData,
    query?: WarehouseLocationQueryFormData,
    options?: { suppressToast?: boolean },
  ): Promise<WarehouseLocationUpdateResponse> {
    const response = await apiClient.put<WarehouseLocationUpdateResponse>(`${this.basePath}/${id}`, data, {
      params: query,
      ...(options?.suppressToast ? ({ metadata: { suppressToast: true } } as any) : {}),
    });
    return response.data;
  }

  async deleteWarehouseLocation(id: string): Promise<WarehouseLocationDeleteResponse> {
    const response = await apiClient.delete<WarehouseLocationDeleteResponse>(`${this.basePath}/${id}`);
    return response.data;
  }

  // =====================
  // Batch Operations
  // =====================

  async batchCreateWarehouseLocations(data: WarehouseLocationBatchCreateFormData, query?: WarehouseLocationQueryFormData): Promise<WarehouseLocationBatchCreateResponse<WarehouseLocation>> {
    const response = await apiClient.post<WarehouseLocationBatchCreateResponse<WarehouseLocation>>(`${this.basePath}/batch`, data, {
      params: query,
    });
    return response.data;
  }

  async batchUpdateWarehouseLocations(data: WarehouseLocationBatchUpdateFormData, query?: WarehouseLocationQueryFormData): Promise<WarehouseLocationBatchUpdateResponse<WarehouseLocation>> {
    const response = await apiClient.put<WarehouseLocationBatchUpdateResponse<WarehouseLocation>>(`${this.basePath}/batch`, data, {
      params: query,
    });
    return response.data;
  }

  async batchDeleteWarehouseLocations(data: WarehouseLocationBatchDeleteFormData, query?: WarehouseLocationQueryFormData): Promise<WarehouseLocationBatchDeleteResponse> {
    const response = await apiClient.delete<WarehouseLocationBatchDeleteResponse>(`${this.basePath}/batch`, {
      data,
      params: query,
    });
    return response.data;
  }
}

// =====================
// Export service instance
// =====================

export const warehouseLocationService = new WarehouseLocationService();

// =====================
// Export individual functions
// =====================

// Query Operations
export const getWarehouseLocations = (params?: WarehouseLocationGetManyFormData) => warehouseLocationService.getWarehouseLocations(params);
export const getAllWarehouseLocations = (params?: Omit<WarehouseLocationGetManyFormData, "page" | "limit">) => warehouseLocationService.getAllWarehouseLocations(params);
export const getWarehouseLocationById = (id: string, params?: Omit<WarehouseLocationGetByIdFormData, "id">) => warehouseLocationService.getWarehouseLocationById(id, params);

// Mutation Operations
export const createWarehouseLocation = (data: WarehouseLocationCreateFormData, query?: WarehouseLocationQueryFormData) => warehouseLocationService.createWarehouseLocation(data, query);
export const updateWarehouseLocation = (id: string, data: WarehouseLocationUpdateFormData, query?: WarehouseLocationQueryFormData, options?: { suppressToast?: boolean }) =>
  warehouseLocationService.updateWarehouseLocation(id, data, query, options);
export const deleteWarehouseLocation = (id: string) => warehouseLocationService.deleteWarehouseLocation(id);

// Batch Operations
export const batchCreateWarehouseLocations = (data: WarehouseLocationBatchCreateFormData, query?: WarehouseLocationQueryFormData) => warehouseLocationService.batchCreateWarehouseLocations(data, query);
export const batchUpdateWarehouseLocations = (data: WarehouseLocationBatchUpdateFormData, query?: WarehouseLocationQueryFormData) => warehouseLocationService.batchUpdateWarehouseLocations(data, query);
export const batchDeleteWarehouseLocations = (data: WarehouseLocationBatchDeleteFormData, query?: WarehouseLocationQueryFormData) => warehouseLocationService.batchDeleteWarehouseLocations(data, query);
