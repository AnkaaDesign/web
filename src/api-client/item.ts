// packages/api-client/src/item.ts

import { apiClient } from "./axiosClient";
import type {
  // Schema types (for parameters)
  ItemGetManyFormData,
  ItemGetByIdFormData,
  ItemCreateFormData,
  ItemUpdateFormData,
  ItemBatchCreateFormData,
  ItemBatchUpdateFormData,
  ItemBatchDeleteFormData,
  ItemQueryFormData,
  ItemBrandGetManyFormData,
  ItemBrandGetByIdFormData,
  ItemBrandCreateFormData,
  ItemBrandUpdateFormData,
  ItemBrandBatchCreateFormData,
  ItemBrandBatchUpdateFormData,
  ItemBrandBatchDeleteFormData,
  ItemBrandQueryFormData,
  ItemCategoryGetManyFormData,
  ItemCategoryGetByIdFormData,
  ItemCategoryCreateFormData,
  ItemCategoryUpdateFormData,
  ItemCategoryBatchCreateFormData,
  ItemCategoryBatchUpdateFormData,
  ItemCategoryBatchDeleteFormData,
  ItemCategoryQueryFormData,
  PriceGetManyFormData,
  PriceGetByIdFormData,
  PriceCreateFormData,
  PriceUpdateFormData,
  PriceBatchCreateFormData,
  PriceBatchUpdateFormData,
  PriceBatchDeleteFormData,
  PriceQueryFormData,
  // Merge types
  ItemMergeFormData,
} from "../schemas";
import type {
  // Interface types (for responses)
  ItemGetUniqueResponse,
  ItemGetManyResponse,
  ItemCreateResponse,
  ItemUpdateResponse,
  ItemDeleteResponse,
  ItemBatchCreateResponse,
  ItemBatchUpdateResponse,
  ItemBatchDeleteResponse,
  ItemBrandGetUniqueResponse,
  ItemBrandGetManyResponse,
  ItemBrandCreateResponse,
  ItemBrandUpdateResponse,
  ItemBrandDeleteResponse,
  ItemBrandBatchCreateResponse,
  ItemBrandBatchUpdateResponse,
  ItemBrandBatchDeleteResponse,
  ItemCategoryGetUniqueResponse,
  ItemCategoryGetManyResponse,
  ItemCategoryCreateResponse,
  ItemCategoryUpdateResponse,
  ItemCategoryDeleteResponse,
  ItemCategoryBatchCreateResponse,
  ItemCategoryBatchUpdateResponse,
  ItemCategoryBatchDeleteResponse,
  PriceGetUniqueResponse,
  PriceGetManyResponse,
  PriceCreateResponse,
  PriceUpdateResponse,
  PriceDeleteResponse,
  PriceBatchCreateResponse,
  PriceBatchUpdateResponse,
  PriceBatchDeleteResponse,
  // Stock management types
  RecalculateMonthlyConsumptionResponse,
  RecalculateItemMonthlyConsumptionResponse,
  UpdateReorderPointsResponse,
  AnalyzeReorderPointsResponse,
  // Merge response types
  ItemMergeResponse,
  // Entity types (for batch responses)
  Item,
  ItemBrand,
  ItemCategory,
  Price,
} from "../types";
import { PPE_TYPE, PPE_SIZE } from "../constants";

// =====================
// Item Service Class
// =====================

export class ItemService {
  private readonly itemBasePath = "/items";
  private readonly brandBasePath = "/items/brands";
  private readonly categoryBasePath = "/items/categories";
  private readonly priceBasePath = "/items/prices";

  // =====================
  // Item Query Operations
  // =====================

  async getItems(params: ItemGetManyFormData): Promise<ItemGetManyResponse> {
    const response = await apiClient.get<ItemGetManyResponse>(this.itemBasePath, { params });
    return response.data;
  }

  async getItemById(id: string, params?: Omit<ItemGetByIdFormData, "id">): Promise<ItemGetUniqueResponse> {
    const response = await apiClient.get<ItemGetUniqueResponse>(`${this.itemBasePath}/${id}`, {
      params,
    });
    return response.data;
  }

  // =====================
  // Item CRUD Operations
  // =====================

  async createItem(data: ItemCreateFormData, query?: ItemQueryFormData): Promise<ItemCreateResponse> {
    console.log("=== ITEM SERVICE CREATE DEBUG ===");
    console.log("Creating item with data:", JSON.stringify(data, null, 2));
    console.log("Query params:", JSON.stringify(query, null, 2));

    try {
      const response = await apiClient.post<ItemCreateResponse>(this.itemBasePath, data, { params: query });
      console.log("Item created successfully:", response.data);
      return response.data;
    } catch (error) {
      console.error("Error creating item in service:", error);
      throw error;
    }
  }

  async updateItem(id: string, data: ItemUpdateFormData, query?: ItemQueryFormData): Promise<ItemUpdateResponse> {
    const response = await apiClient.put<ItemUpdateResponse>(`${this.itemBasePath}/${id}`, data, { params: query });
    return response.data;
  }

  async deleteItem(id: string): Promise<ItemDeleteResponse> {
    const response = await apiClient.delete<ItemDeleteResponse>(`${this.itemBasePath}/${id}`);
    return response.data;
  }

  // =====================
  // Item Batch Operations
  // =====================

  async batchCreateItems(data: ItemBatchCreateFormData, query?: ItemQueryFormData): Promise<ItemBatchCreateResponse<Item>> {
    const response = await apiClient.post<ItemBatchCreateResponse<Item>>(`${this.itemBasePath}/batch`, data, { params: query });
    return response.data;
  }

  async batchUpdateItems(data: ItemBatchUpdateFormData, query?: ItemQueryFormData): Promise<ItemBatchUpdateResponse<Item>> {
    console.log("=== API CLIENT LAYER DEBUGGING ===");
    console.log("Step 15 - API Client received data:", JSON.stringify(data, null, 2));
    console.log("Step 16 - API Client received query:", JSON.stringify(query, null, 2));
    console.log("Step 17 - Making PUT request to:", `${this.itemBasePath}/batch`);
    console.log("Step 18 - Request payload:", JSON.stringify(data, null, 2));

    const response = await apiClient.put<ItemBatchUpdateResponse<Item>>(`${this.itemBasePath}/batch`, data, { params: query });

    console.log("Step 19 - API Client received response:", {
      status: response.status,
      statusText: response.statusText,
      data: JSON.stringify(response.data, null, 2),
    });

    return response.data;
  }

  async batchDeleteItems(data: ItemBatchDeleteFormData, query?: ItemQueryFormData): Promise<ItemBatchDeleteResponse> {
    const response = await apiClient.delete<ItemBatchDeleteResponse>(`${this.itemBasePath}/batch`, { data, params: query });
    return response.data;
  }

  // =====================
  // Item Merge Operations
  // =====================

  async mergeItems(data: ItemMergeFormData, query?: ItemQueryFormData): Promise<ItemMergeResponse> {
    const response = await apiClient.post<ItemMergeResponse>(`${this.itemBasePath}/merge`, data, { params: query });
    return response.data;
  }

  // =====================
  // ItemBrand Query Operations
  // =====================

  async getItemBrands(params: ItemBrandGetManyFormData): Promise<ItemBrandGetManyResponse> {
    const response = await apiClient.get<ItemBrandGetManyResponse>(this.brandBasePath, { params });
    return response.data;
  }

  async getItemBrandById(id: string, params?: ItemBrandGetByIdFormData): Promise<ItemBrandGetUniqueResponse> {
    const response = await apiClient.get<ItemBrandGetUniqueResponse>(`${this.brandBasePath}/${id}`, {
      params,
    });
    return response.data;
  }

  // =====================
  // ItemBrand CRUD Operations
  // =====================

  async createItemBrand(data: ItemBrandCreateFormData, query?: ItemBrandQueryFormData): Promise<ItemBrandCreateResponse> {
    const response = await apiClient.post<ItemBrandCreateResponse>(this.brandBasePath, data, { params: query });
    return response.data;
  }

  async updateItemBrand(id: string, data: ItemBrandUpdateFormData, query?: ItemBrandQueryFormData): Promise<ItemBrandUpdateResponse> {
    const response = await apiClient.put<ItemBrandUpdateResponse>(`${this.brandBasePath}/${id}`, data, { params: query });
    return response.data;
  }

  async deleteItemBrand(id: string): Promise<ItemBrandDeleteResponse> {
    const response = await apiClient.delete<ItemBrandDeleteResponse>(`${this.brandBasePath}/${id}`);
    return response.data;
  }

  // =====================
  // ItemBrand Batch Operations
  // =====================

  async batchCreateItemBrands(data: ItemBrandBatchCreateFormData, query?: ItemBrandQueryFormData): Promise<ItemBrandBatchCreateResponse<ItemBrand>> {
    const response = await apiClient.post<ItemBrandBatchCreateResponse<ItemBrand>>(`${this.brandBasePath}/batch`, data, { params: query });
    return response.data;
  }

  async batchUpdateItemBrands(data: ItemBrandBatchUpdateFormData, query?: ItemBrandQueryFormData): Promise<ItemBrandBatchUpdateResponse<ItemBrand>> {
    const response = await apiClient.put<ItemBrandBatchUpdateResponse<ItemBrand>>(`${this.brandBasePath}/batch`, data, { params: query });
    return response.data;
  }

  async batchDeleteItemBrands(data: ItemBrandBatchDeleteFormData, query?: ItemBrandQueryFormData): Promise<ItemBrandBatchDeleteResponse> {
    const response = await apiClient.delete<ItemBrandBatchDeleteResponse>(`${this.brandBasePath}/batch`, { data, params: query });
    return response.data;
  }

  // =====================
  // ItemCategory Query Operations
  // =====================

  async getItemCategories(params: ItemCategoryGetManyFormData): Promise<ItemCategoryGetManyResponse> {
    const response = await apiClient.get<ItemCategoryGetManyResponse>(this.categoryBasePath, { params });
    return response.data;
  }

  async getItemCategoryById(id: string, params?: ItemCategoryGetByIdFormData): Promise<ItemCategoryGetUniqueResponse> {
    const response = await apiClient.get<ItemCategoryGetUniqueResponse>(`${this.categoryBasePath}/${id}`, {
      params,
    });
    return response.data;
  }

  // =====================
  // ItemCategory CRUD Operations
  // =====================

  async createItemCategory(data: ItemCategoryCreateFormData, query?: ItemCategoryQueryFormData): Promise<ItemCategoryCreateResponse> {
    const response = await apiClient.post<ItemCategoryCreateResponse>(this.categoryBasePath, data, { params: query });
    return response.data;
  }

  async updateItemCategory(id: string, data: ItemCategoryUpdateFormData, query?: ItemCategoryQueryFormData): Promise<ItemCategoryUpdateResponse> {
    const response = await apiClient.put<ItemCategoryUpdateResponse>(`${this.categoryBasePath}/${id}`, data, { params: query });
    return response.data;
  }

  async deleteItemCategory(id: string): Promise<ItemCategoryDeleteResponse> {
    const response = await apiClient.delete<ItemCategoryDeleteResponse>(`${this.categoryBasePath}/${id}`);
    return response.data;
  }

  // =====================
  // ItemCategory Batch Operations
  // =====================

  async batchCreateItemCategories(data: ItemCategoryBatchCreateFormData, query?: ItemCategoryQueryFormData): Promise<ItemCategoryBatchCreateResponse<ItemCategory>> {
    const response = await apiClient.post<ItemCategoryBatchCreateResponse<ItemCategory>>(`${this.categoryBasePath}/batch`, data, { params: query });
    return response.data;
  }

  async batchUpdateItemCategories(data: ItemCategoryBatchUpdateFormData, query?: ItemCategoryQueryFormData): Promise<ItemCategoryBatchUpdateResponse<ItemCategory>> {
    const response = await apiClient.put<ItemCategoryBatchUpdateResponse<ItemCategory>>(`${this.categoryBasePath}/batch`, data, { params: query });
    return response.data;
  }

  async batchDeleteItemCategories(data: ItemCategoryBatchDeleteFormData, query?: ItemCategoryQueryFormData): Promise<ItemCategoryBatchDeleteResponse> {
    const response = await apiClient.delete<ItemCategoryBatchDeleteResponse>(`${this.categoryBasePath}/batch`, { data, params: query });
    return response.data;
  }

  // =====================
  // Price Query Operations
  // =====================

  async getPrices(params: PriceGetManyFormData): Promise<PriceGetManyResponse> {
    const response = await apiClient.get<PriceGetManyResponse>(this.priceBasePath, { params });
    return response.data;
  }

  async getPriceById(id: string, params?: PriceGetByIdFormData): Promise<PriceGetUniqueResponse> {
    const response = await apiClient.get<PriceGetUniqueResponse>(`${this.priceBasePath}/${id}`, {
      params,
    });
    return response.data;
  }

  // =====================
  // Price CRUD Operations
  // =====================

  async createPrice(data: PriceCreateFormData, query?: PriceQueryFormData): Promise<PriceCreateResponse> {
    const response = await apiClient.post<PriceCreateResponse>(this.priceBasePath, data, { params: query });
    return response.data;
  }

  async updatePrice(id: string, data: PriceUpdateFormData, query?: PriceQueryFormData): Promise<PriceUpdateResponse> {
    const response = await apiClient.put<PriceUpdateResponse>(`${this.priceBasePath}/${id}`, data, { params: query });
    return response.data;
  }

  async deletePrice(id: string): Promise<PriceDeleteResponse> {
    const response = await apiClient.delete<PriceDeleteResponse>(`${this.priceBasePath}/${id}`);
    return response.data;
  }

  // =====================
  // Price Batch Operations
  // =====================

  async batchCreatePrices(data: PriceBatchCreateFormData, query?: PriceQueryFormData): Promise<PriceBatchCreateResponse<Price>> {
    const response = await apiClient.post<PriceBatchCreateResponse<Price>>(`${this.priceBasePath}/batch`, data, { params: query });
    return response.data;
  }

  async batchUpdatePrices(data: PriceBatchUpdateFormData, query?: PriceQueryFormData): Promise<PriceBatchUpdateResponse<Price>> {
    const response = await apiClient.put<PriceBatchUpdateResponse<Price>>(`${this.priceBasePath}/batch`, data, { params: query });
    return response.data;
  }

  async batchDeletePrices(data: PriceBatchDeleteFormData, query?: PriceQueryFormData): Promise<PriceBatchDeleteResponse> {
    const response = await apiClient.delete<PriceBatchDeleteResponse>(`${this.priceBasePath}/batch`, { data, params: query });
    return response.data;
  }

  // =====================
  // Stock Management Operations
  // =====================

  async recalculateAllItemsMonthlyConsumption(): Promise<RecalculateMonthlyConsumptionResponse> {
    const response = await apiClient.post<RecalculateMonthlyConsumptionResponse>(`${this.itemBasePath}/recalculate-monthly-consumption`);
    return response.data;
  }

  async recalculateItemMonthlyConsumption(id: string): Promise<RecalculateItemMonthlyConsumptionResponse> {
    const response = await apiClient.post<RecalculateItemMonthlyConsumptionResponse>(`${this.itemBasePath}/${id}/recalculate-monthly-consumption`);
    return response.data;
  }

  async adjustItemPrices(
    itemIds: string[],
    percentage: number,
  ): Promise<{
    success: boolean;
    message: string;
    data: {
      totalSuccess: number;
      totalFailed: number;
      results: any[];
    };
  }> {
    const response = await apiClient.post<{
      success: boolean;
      message: string;
      data: {
        totalSuccess: number;
        totalFailed: number;
        results: any[];
      };
    }>(`${this.itemBasePath}/batch-adjust-prices`, { itemIds, percentage });
    return response.data;
  }

  async updateReorderPoints(lookbackDays?: number): Promise<UpdateReorderPointsResponse> {
    const params = lookbackDays ? { lookbackDays } : undefined;
    const response = await apiClient.post<UpdateReorderPointsResponse>(`${this.itemBasePath}/reorder-points/update`, {}, { params });
    return response.data;
  }

  async analyzeReorderPoints(itemIds: string[], lookbackDays?: number): Promise<AnalyzeReorderPointsResponse> {
    const params = lookbackDays ? { lookbackDays } : undefined;
    const response = await apiClient.post<AnalyzeReorderPointsResponse>(`${this.itemBasePath}/reorder-points/analyze`, { itemIds }, { params });
    return response.data;
  }

  // =====================
  // Item Measure Operations
  // =====================

  async getItemMeasures(itemId: string): Promise<{ data: any[] }> {
    const response = await apiClient.get<{ data: any[] }>(`${this.itemBasePath}/${itemId}/measures`);
    return response.data;
  }

  async addItemMeasure(itemId: string, data: { value: number; unit: string; measureType: string }): Promise<{ data: any }> {
    const response = await apiClient.post<{ data: any }>(`${this.itemBasePath}/${itemId}/measures`, data);
    return response.data;
  }

  async updateItemMeasure(itemId: string, measureId: string, data: { value?: number; unit?: string; measureType?: string }): Promise<{ data: any }> {
    const response = await apiClient.put<{ data: any }>(`${this.itemBasePath}/${itemId}/measures/${measureId}`, data);
    return response.data;
  }

  async deleteItemMeasure(itemId: string, measureId: string): Promise<{ success: boolean }> {
    const response = await apiClient.delete<{ success: boolean }>(`${this.itemBasePath}/${itemId}/measures/${measureId}`);
    return response.data;
  }

  // =====================
  // PPE-specific Item Operations
  // =====================

  async getItemsByPpeType(ppeType: PPE_TYPE, params?: Omit<ItemGetManyFormData, "where">): Promise<ItemGetManyResponse> {
    const response = await apiClient.get<ItemGetManyResponse>(this.itemBasePath, {
      params: {
        ...params,
        where: {
          ...params?.where,
          ppeType,
        },
      },
    });
    return response.data;
  }

  async getItemsByPpeSize(ppeSize: PPE_SIZE, params?: Omit<ItemGetManyFormData, "where">): Promise<ItemGetManyResponse> {
    const response = await apiClient.get<ItemGetManyResponse>(this.itemBasePath, {
      params: {
        ...params,
        where: {
          ...params?.where,
          ppeSize,
        },
      },
    });
    return response.data;
  }

  async getItemsByPpeTypeAndSize(ppeType: PPE_TYPE, ppeSize: PPE_SIZE, params?: Omit<ItemGetManyFormData, "where">): Promise<ItemGetManyResponse> {
    const response = await apiClient.get<ItemGetManyResponse>(this.itemBasePath, {
      params: {
        ...params,
        where: {
          ...params?.where,
          ppeType,
          ppeSize,
        },
      },
    });
    return response.data;
  }

  async getPpeItems(params?: Omit<ItemGetManyFormData, "where">): Promise<ItemGetManyResponse> {
    const response = await apiClient.get<ItemGetManyResponse>(this.itemBasePath, {
      params: {
        ...params,
        where: {
          ...params?.where,
          ppeType: { not: null },
        },
      },
    });
    return response.data;
  }
}

// =====================
// Export service instance
// =====================

export const itemService = new ItemService();

// =====================
// Export individual functions (for backward compatibility)
// =====================

// Item functions
export const getItems = (params: ItemGetManyFormData) => itemService.getItems(params);
export const getItemById = (id: string, params?: Omit<ItemGetByIdFormData, "id">) => itemService.getItemById(id, params);
export const createItem = (data: ItemCreateFormData, query?: ItemQueryFormData) => itemService.createItem(data, query);
export const updateItem = (id: string, data: ItemUpdateFormData, query?: ItemQueryFormData) => itemService.updateItem(id, data, query);
export const deleteItem = (id: string) => itemService.deleteItem(id);
export const batchCreateItems = (data: ItemBatchCreateFormData, query?: ItemQueryFormData) => itemService.batchCreateItems(data, query);
export const batchUpdateItems = (data: ItemBatchUpdateFormData, query?: ItemQueryFormData) => itemService.batchUpdateItems(data, query);
export const batchDeleteItems = (data: ItemBatchDeleteFormData, query?: ItemQueryFormData) => itemService.batchDeleteItems(data, query);
export const mergeItems = (data: ItemMergeFormData, query?: ItemQueryFormData) => itemService.mergeItems(data, query);

// ItemBrand functions
export const getItemBrands = (params: ItemBrandGetManyFormData) => itemService.getItemBrands(params);
export const getItemBrandById = (id: string, params?: ItemBrandGetByIdFormData) => itemService.getItemBrandById(id, params);
export const createItemBrand = (data: ItemBrandCreateFormData, query?: ItemBrandQueryFormData) => itemService.createItemBrand(data, query);
export const updateItemBrand = (id: string, data: ItemBrandUpdateFormData, query?: ItemBrandQueryFormData) => itemService.updateItemBrand(id, data, query);
export const deleteItemBrand = (id: string) => itemService.deleteItemBrand(id);
export const batchCreateItemBrands = (data: ItemBrandBatchCreateFormData, query?: ItemBrandQueryFormData) => itemService.batchCreateItemBrands(data, query);
export const batchUpdateItemBrands = (data: ItemBrandBatchUpdateFormData, query?: ItemBrandQueryFormData) => itemService.batchUpdateItemBrands(data, query);
export const batchDeleteItemBrands = (data: ItemBrandBatchDeleteFormData, query?: ItemBrandQueryFormData) => itemService.batchDeleteItemBrands(data, query);

// ItemCategory functions - exported from item-category.ts instead to avoid duplicates
// export const getItemCategories = (params: ItemCategoryGetManyFormData) => itemService.getItemCategories(params);
// export const getItemCategoryById = (id: string, params?: ItemCategoryGetByIdFormData) => itemService.getItemCategoryById(id, params);
// export const createItemCategory = (data: ItemCategoryCreateFormData, query?: ItemCategoryQueryFormData) => itemService.createItemCategory(data, query);
// export const updateItemCategory = (id: string, data: ItemCategoryUpdateFormData, query?: ItemCategoryQueryFormData) => itemService.updateItemCategory(id, data, query);
// export const deleteItemCategory = (id: string) => itemService.deleteItemCategory(id);
// export const batchCreateItemCategories = (data: ItemCategoryBatchCreateFormData, query?: ItemCategoryQueryFormData) => itemService.batchCreateItemCategories(data, query);
// export const batchUpdateItemCategories = (data: ItemCategoryBatchUpdateFormData, query?: ItemCategoryQueryFormData) => itemService.batchUpdateItemCategories(data, query);
// export const batchDeleteItemCategories = (data: ItemCategoryBatchDeleteFormData, query?: ItemCategoryQueryFormData) => itemService.batchDeleteItemCategories(data, query);

// Price functions
export const getPrices = (params: PriceGetManyFormData) => itemService.getPrices(params);
export const getPriceById = (id: string, params?: PriceGetByIdFormData) => itemService.getPriceById(id, params);
export const createPrice = (data: PriceCreateFormData, query?: PriceQueryFormData) => itemService.createPrice(data, query);
export const updatePrice = (id: string, data: PriceUpdateFormData, query?: PriceQueryFormData) => itemService.updatePrice(id, data, query);
export const deletePrice = (id: string) => itemService.deletePrice(id);
export const batchCreatePrices = (data: PriceBatchCreateFormData, query?: PriceQueryFormData) => itemService.batchCreatePrices(data, query);
export const batchUpdatePrices = (data: PriceBatchUpdateFormData, query?: PriceQueryFormData) => itemService.batchUpdatePrices(data, query);
export const batchDeletePrices = (data: PriceBatchDeleteFormData, query?: PriceQueryFormData) => itemService.batchDeletePrices(data, query);

// Stock Management functions
export const recalculateAllItemsMonthlyConsumption = () => itemService.recalculateAllItemsMonthlyConsumption();
export const recalculateItemMonthlyConsumption = (id: string) => itemService.recalculateItemMonthlyConsumption(id);
export const adjustItemPrices = (itemIds: string[], percentage: number) => itemService.adjustItemPrices(itemIds, percentage);
export const updateReorderPoints = (lookbackDays?: number) => itemService.updateReorderPoints(lookbackDays);
export const analyzeReorderPoints = (itemIds: string[], lookbackDays?: number) => itemService.analyzeReorderPoints(itemIds, lookbackDays);

// Item Measure functions
export const getItemMeasures = (itemId: string) => itemService.getItemMeasures(itemId);
export const addItemMeasure = (itemId: string, data: { value: number; unit: string; measureType: string }) => itemService.addItemMeasure(itemId, data);
export const updateItemMeasure = (itemId: string, measureId: string, data: { value?: number; unit?: string; measureType?: string }) =>
  itemService.updateItemMeasure(itemId, measureId, data);
export const deleteItemMeasure = (itemId: string, measureId: string) => itemService.deleteItemMeasure(itemId, measureId);

// PPE-specific Item functions
export const getItemsByPpeType = (ppeType: PPE_TYPE, params?: Omit<ItemGetManyFormData, "where">) => itemService.getItemsByPpeType(ppeType, params);
export const getItemsByPpeSize = (ppeSize: PPE_SIZE, params?: Omit<ItemGetManyFormData, "where">) => itemService.getItemsByPpeSize(ppeSize, params);
export const getItemsByPpeTypeAndSize = (ppeType: PPE_TYPE, ppeSize: PPE_SIZE, params?: Omit<ItemGetManyFormData, "where">) =>
  itemService.getItemsByPpeTypeAndSize(ppeType, ppeSize, params);
export const getPpeItems = (params?: Omit<ItemGetManyFormData, "where">) => itemService.getPpeItems(params);
