// packages/api-client/src/item-price.ts

import { apiClient } from "./axiosClient";
import type {
  // Schema types (for parameters)
  PriceGetManyFormData,
  PriceGetByIdFormData,
  PriceCreateFormData,
  PriceUpdateFormData,
  PriceBatchCreateFormData,
  PriceBatchUpdateFormData,
  PriceBatchDeleteFormData,
  PriceQueryFormData,
} from "../schemas";
import type {
  // Interface types (for responses)
  Price,
  PriceGetUniqueResponse,
  PriceGetManyResponse,
  PriceCreateResponse,
  PriceUpdateResponse,
  PriceDeleteResponse,
  PriceBatchCreateResponse,
  PriceBatchUpdateResponse,
  PriceBatchDeleteResponse,
} from "../types";

// =====================
// ItemPrice Service Class
// =====================

export class ItemPriceService {
  private readonly basePath = "/item-prices";

  // =====================
  // Query Operations
  // =====================

  async getItemPrices(params?: PriceGetManyFormData): Promise<PriceGetManyResponse> {
    const response = await apiClient.get<PriceGetManyResponse>(this.basePath, {
      params,
    });
    return response.data;
  }

  async getItemPriceById(id: string, params?: PriceGetByIdFormData): Promise<PriceGetUniqueResponse> {
    const response = await apiClient.get<PriceGetUniqueResponse>(`${this.basePath}/${id}`, {
      params,
    });
    return response.data;
  }

  async getLatestPriceByItemId(itemId: string): Promise<PriceGetUniqueResponse> {
    const response = await apiClient.get<PriceGetUniqueResponse>(`${this.basePath}/item/${itemId}/latest`);
    return response.data;
  }

  async getPriceHistory(itemId: string, limit?: number): Promise<PriceGetManyResponse> {
    const response = await apiClient.get<PriceGetManyResponse>(`${this.basePath}/item/${itemId}/history`, {
      params: limit ? { limit } : undefined,
    });
    return response.data;
  }

  // =====================
  // Mutation Operations
  // =====================

  async createItemPrice(data: PriceCreateFormData, query?: PriceQueryFormData): Promise<PriceCreateResponse> {
    const response = await apiClient.post<PriceCreateResponse>(this.basePath, data, {
      params: query,
    });
    return response.data;
  }

  async updateItemPrice(id: string, data: PriceUpdateFormData, query?: PriceQueryFormData): Promise<PriceUpdateResponse> {
    const response = await apiClient.put<PriceUpdateResponse>(`${this.basePath}/${id}`, data, {
      params: query,
    });
    return response.data;
  }

  async deleteItemPrice(id: string): Promise<PriceDeleteResponse> {
    const response = await apiClient.delete<PriceDeleteResponse>(`${this.basePath}/${id}`);
    return response.data;
  }

  // =====================
  // Batch Operations
  // =====================

  async batchCreateItemPrices(data: PriceBatchCreateFormData, query?: PriceQueryFormData): Promise<PriceBatchCreateResponse<Price>> {
    const response = await apiClient.post<PriceBatchCreateResponse<Price>>(`${this.basePath}/batch`, data, {
      params: query,
    });
    return response.data;
  }

  async batchUpdateItemPrices(data: PriceBatchUpdateFormData, query?: PriceQueryFormData): Promise<PriceBatchUpdateResponse<Price>> {
    const response = await apiClient.put<PriceBatchUpdateResponse<Price>>(`${this.basePath}/batch`, data, {
      params: query,
    });
    return response.data;
  }

  async batchDeleteItemPrices(data: PriceBatchDeleteFormData, query?: PriceQueryFormData): Promise<PriceBatchDeleteResponse> {
    const response = await apiClient.delete<PriceBatchDeleteResponse>(`${this.basePath}/batch`, {
      data,
      params: query,
    });
    return response.data;
  }
}

// =====================
// Export service instance
// =====================

export const itemPriceService = new ItemPriceService();

// =====================
// Export individual functions
// =====================

// Query Operations
export const getItemPrices = (params?: PriceGetManyFormData) => itemPriceService.getItemPrices(params);
export const getItemPriceById = (id: string, params?: PriceGetByIdFormData) => itemPriceService.getItemPriceById(id, params);
export const getLatestPriceByItemId = (itemId: string) => itemPriceService.getLatestPriceByItemId(itemId);
export const getPriceHistory = (itemId: string, limit?: number) => itemPriceService.getPriceHistory(itemId, limit);

// Mutation Operations
export const createItemPrice = (data: PriceCreateFormData, query?: PriceQueryFormData) => itemPriceService.createItemPrice(data, query);
export const updateItemPrice = (id: string, data: PriceUpdateFormData, query?: PriceQueryFormData) => itemPriceService.updateItemPrice(id, data, query);
export const deleteItemPrice = (id: string) => itemPriceService.deleteItemPrice(id);

// Batch Operations
export const batchCreateItemPrices = (data: PriceBatchCreateFormData, query?: PriceQueryFormData) => itemPriceService.batchCreateItemPrices(data, query);
export const batchUpdateItemPrices = (data: PriceBatchUpdateFormData, query?: PriceQueryFormData) => itemPriceService.batchUpdateItemPrices(data, query);
export const batchDeleteItemPrices = (data: PriceBatchDeleteFormData, query?: PriceQueryFormData) => itemPriceService.batchDeleteItemPrices(data, query);
