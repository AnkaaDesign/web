// packages/api-client/src/item-brand.ts

import { apiClient } from "./axiosClient";
import type {
  // Schema types (for parameters)
  ItemBrandGetManyFormData,
  ItemBrandGetByIdFormData,
  ItemBrandCreateFormData,
  ItemBrandUpdateFormData,
  ItemBrandBatchCreateFormData,
  ItemBrandBatchUpdateFormData,
  ItemBrandBatchDeleteFormData,
  ItemBrandQueryFormData,
} from "../schemas";
import type {
  // Interface types (for responses)
  ItemBrand,
  ItemBrandGetUniqueResponse,
  ItemBrandGetManyResponse,
  ItemBrandCreateResponse,
  ItemBrandUpdateResponse,
  ItemBrandDeleteResponse,
  ItemBrandBatchCreateResponse,
  ItemBrandBatchUpdateResponse,
  ItemBrandBatchDeleteResponse,
} from "../types";

// =====================
// ItemBrand Service Class
// =====================

export class ItemBrandService {
  private readonly basePath = "/items/brands";

  // =====================
  // Query Operations
  // =====================

  async getItemBrands(params?: ItemBrandGetManyFormData): Promise<ItemBrandGetManyResponse> {
    const response = await apiClient.get<ItemBrandGetManyResponse>(this.basePath, {
      params,
    });
    return response.data;
  }

  async getItemBrandById(id: string, params?: ItemBrandGetByIdFormData): Promise<ItemBrandGetUniqueResponse> {
    const response = await apiClient.get<ItemBrandGetUniqueResponse>(`${this.basePath}/${id}`, {
      params,
    });
    return response.data;
  }

  // =====================
  // Mutation Operations
  // =====================

  async createItemBrand(data: ItemBrandCreateFormData, query?: ItemBrandQueryFormData): Promise<ItemBrandCreateResponse> {
    const response = await apiClient.post<ItemBrandCreateResponse>(this.basePath, data, {
      params: query,
    });
    return response.data;
  }

  async updateItemBrand(id: string, data: ItemBrandUpdateFormData, query?: ItemBrandQueryFormData): Promise<ItemBrandUpdateResponse> {
    const response = await apiClient.put<ItemBrandUpdateResponse>(`${this.basePath}/${id}`, data, {
      params: query,
    });
    return response.data;
  }

  async deleteItemBrand(id: string): Promise<ItemBrandDeleteResponse> {
    const response = await apiClient.delete<ItemBrandDeleteResponse>(`${this.basePath}/${id}`);
    return response.data;
  }

  // =====================
  // Batch Operations
  // =====================

  async batchCreateItemBrands(data: ItemBrandBatchCreateFormData, query?: ItemBrandQueryFormData): Promise<ItemBrandBatchCreateResponse<ItemBrand>> {
    const response = await apiClient.post<ItemBrandBatchCreateResponse<ItemBrand>>(`${this.basePath}/batch`, data, {
      params: query,
    });
    return response.data;
  }

  async batchUpdateItemBrands(data: ItemBrandBatchUpdateFormData, query?: ItemBrandQueryFormData): Promise<ItemBrandBatchUpdateResponse<ItemBrand>> {
    const response = await apiClient.put<ItemBrandBatchUpdateResponse<ItemBrand>>(`${this.basePath}/batch`, data, {
      params: query,
    });
    return response.data;
  }

  async batchDeleteItemBrands(data: ItemBrandBatchDeleteFormData, query?: ItemBrandQueryFormData): Promise<ItemBrandBatchDeleteResponse> {
    const response = await apiClient.delete<ItemBrandBatchDeleteResponse>(`${this.basePath}/batch`, {
      data,
      params: query,
    });
    return response.data;
  }
}

// =====================
// Export service instance
// =====================

export const itemBrandService = new ItemBrandService();

// =====================
// Export individual functions
// =====================

// Query Operations
export const getItemBrands = (params?: ItemBrandGetManyFormData) => itemBrandService.getItemBrands(params);
export const getItemBrandById = (id: string, params?: ItemBrandGetByIdFormData) => itemBrandService.getItemBrandById(id, params);

// Mutation Operations
export const createItemBrand = (data: ItemBrandCreateFormData, query?: ItemBrandQueryFormData) => itemBrandService.createItemBrand(data, query);
export const updateItemBrand = (id: string, data: ItemBrandUpdateFormData, query?: ItemBrandQueryFormData) => itemBrandService.updateItemBrand(id, data, query);
export const deleteItemBrand = (id: string) => itemBrandService.deleteItemBrand(id);

// Batch Operations
export const batchCreateItemBrands = (data: ItemBrandBatchCreateFormData, query?: ItemBrandQueryFormData) => itemBrandService.batchCreateItemBrands(data, query);
export const batchUpdateItemBrands = (data: ItemBrandBatchUpdateFormData, query?: ItemBrandQueryFormData) => itemBrandService.batchUpdateItemBrands(data, query);
export const batchDeleteItemBrands = (data: ItemBrandBatchDeleteFormData, query?: ItemBrandQueryFormData) => itemBrandService.batchDeleteItemBrands(data, query);
