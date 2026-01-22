// packages/api/src/supplier.ts

import { apiClient } from "./axiosClient";
import type {
  // Schema types (for parameters)
  SupplierGetManyFormData,
  SupplierGetByIdFormData,
  SupplierCreateFormData,
  SupplierUpdateFormData,
  SupplierBatchCreateFormData,
  SupplierBatchUpdateFormData,
  SupplierBatchDeleteFormData,
  SupplierQueryFormData,
} from "../schemas";
import type {
  // Interface types (for responses)
  Supplier,
  SupplierGetUniqueResponse,
  SupplierGetManyResponse,
  SupplierCreateResponse,
  SupplierUpdateResponse,
  SupplierDeleteResponse,
  SupplierBatchCreateResponse,
  SupplierBatchUpdateResponse,
  SupplierBatchDeleteResponse,
} from "../types";

// =====================
// Supplier Service Class
// =====================

export class SupplierService {
  private readonly basePath = "/suppliers";

  // =====================
  // Query Operations
  // =====================

  async getSuppliers(params?: SupplierGetManyFormData): Promise<SupplierGetManyResponse> {
    const response = await apiClient.get<SupplierGetManyResponse>(this.basePath, {
      params,
    });
    return response.data;
  }

  async getAllSuppliers(params?: Omit<SupplierGetManyFormData, "page" | "limit">): Promise<SupplierGetManyResponse> {
    const response = await apiClient.get<SupplierGetManyResponse>(this.basePath, {
      params: {
        ...params,
        limit: 10000, // Large limit to get all suppliers
      },
    });
    return response.data;
  }

  async getSupplierById(id: string, params?: Omit<SupplierGetByIdFormData, "id">): Promise<SupplierGetUniqueResponse> {
    const response = await apiClient.get<SupplierGetUniqueResponse>(`${this.basePath}/${id}`, {
      params,
    });
    return response.data;
  }

  // =====================
  // Mutation Operations
  // =====================

  async createSupplier(data: SupplierCreateFormData | FormData, query?: SupplierQueryFormData): Promise<SupplierCreateResponse> {
    // Don't set Content-Type for FormData - let axios handle it automatically
    const response = await apiClient.post<SupplierCreateResponse>(this.basePath, data, {
      params: query,
    });
    return response.data;
  }

  async updateSupplier(id: string, data: SupplierUpdateFormData | FormData, query?: SupplierQueryFormData): Promise<SupplierUpdateResponse> {
    // Don't set Content-Type for FormData - let axios handle it automatically
    const response = await apiClient.put<SupplierUpdateResponse>(`${this.basePath}/${id}`, data, {
      params: query,
    });
    return response.data;
  }

  async deleteSupplier(id: string): Promise<SupplierDeleteResponse> {
    const response = await apiClient.delete<SupplierDeleteResponse>(`${this.basePath}/${id}`);
    return response.data;
  }

  // =====================
  // Batch Operations
  // =====================

  async batchCreateSuppliers(data: SupplierBatchCreateFormData, query?: SupplierQueryFormData): Promise<SupplierBatchCreateResponse<Supplier>> {
    const response = await apiClient.post<SupplierBatchCreateResponse<Supplier>>(`${this.basePath}/batch`, data, {
      params: query,
    });
    return response.data;
  }

  async batchUpdateSuppliers(data: SupplierBatchUpdateFormData, query?: SupplierQueryFormData): Promise<SupplierBatchUpdateResponse<Supplier>> {
    const response = await apiClient.put<SupplierBatchUpdateResponse<Supplier>>(`${this.basePath}/batch`, data, {
      params: query,
    });
    return response.data;
  }

  async batchDeleteSuppliers(data: SupplierBatchDeleteFormData, query?: SupplierQueryFormData): Promise<SupplierBatchDeleteResponse> {
    const response = await apiClient.delete<SupplierBatchDeleteResponse>(`${this.basePath}/batch`, {
      data,
      params: query,
    });
    return response.data;
  }
}

// =====================
// Export service instance
// =====================

export const supplierService = new SupplierService();

// =====================
// Export individual functions
// =====================

// Query Operations
export const getSuppliers = (params?: SupplierGetManyFormData) => supplierService.getSuppliers(params);
export const getAllSuppliers = (params?: Omit<SupplierGetManyFormData, "page" | "limit">) => supplierService.getAllSuppliers(params);
export const getSupplierById = (id: string, params?: Omit<SupplierGetByIdFormData, "id">) => supplierService.getSupplierById(id, params);

// Mutation Operations
export const createSupplier = (data: SupplierCreateFormData | FormData, query?: SupplierQueryFormData) => supplierService.createSupplier(data, query);
export const updateSupplier = (id: string, data: SupplierUpdateFormData | FormData, query?: SupplierQueryFormData) => supplierService.updateSupplier(id, data, query);
export const deleteSupplier = (id: string) => supplierService.deleteSupplier(id);

// Batch Operations
export const batchCreateSuppliers = (data: SupplierBatchCreateFormData, query?: SupplierQueryFormData) => supplierService.batchCreateSuppliers(data, query);
export const batchUpdateSuppliers = (data: SupplierBatchUpdateFormData, query?: SupplierQueryFormData) => supplierService.batchUpdateSuppliers(data, query);
export const batchDeleteSuppliers = (data: SupplierBatchDeleteFormData, query?: SupplierQueryFormData) => supplierService.batchDeleteSuppliers(data, query);
