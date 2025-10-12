import { apiClient } from './axiosClient';
import type { AxiosRequestConfig } from 'axios';

// =====================
// Types
// =====================

export interface StatisticsFilters {
  dateRange: {
    from: Date;
    to: Date;
  };
  period?: 'day' | 'week' | 'month' | 'quarter' | 'year' | 'custom';
  categoryId?: string;
  brandId?: string;
  supplierId?: string;
  userId?: string;
  sectorId?: string;
  itemId?: string;
}

export interface InventoryOverview {
  totalItems: number;
  totalValue: number;
  lowStockItems: number;
  criticalItems: number;
  outOfStockItems: number;
  overstockItems: number;
  averageStockLevel: number;
  stockAccuracy: number;
  lastUpdated: string;
}

export interface StockLevelsData {
  available: number;
  reserved: number;
  damaged: number;
  inTransit: number;
  total: number;
  distribution: Array<{
    category: string;
    categoryId: string;
    count: number;
    value: number;
    percentage: number;
  }>;
}

export interface ConsumptionTrend {
  date: string;
  totalConsumption: number;
  totalValue: number;
  activityCount: number;
  incomingQuantity: number;
  outgoingQuantity: number;
  netChange: number;
}

export interface CategoryPerformance {
  categoryId: string;
  categoryName: string;
  itemCount: number;
  totalValue: number;
  totalQuantity: number;
  averageValue: number;
  turnoverRate: number;
  stockHealth: 'healthy' | 'low' | 'critical' | 'overstock';
  lastActivity: string;
}

export interface ItemMovementData {
  itemId: string;
  itemName: string;
  categoryName: string;
  brandName: string;
  totalMovements: number;
  incomingQuantity: number;
  outgoingQuantity: number;
  currentStock: number;
  stockValue: number;
  lastMovement: string;
  movementFrequency: number;
}

export interface StockValuation {
  totalValue: number;
  byCategory: Array<{
    categoryId: string;
    categoryName: string;
    value: number;
    percentage: number;
    itemCount: number;
  }>;
  byBrand: Array<{
    brandId: string;
    brandName: string;
    value: number;
    percentage: number;
    itemCount: number;
  }>;
  topValuedItems: Array<{
    itemId: string;
    itemName: string;
    quantity: number;
    unitValue: number;
    totalValue: number;
  }>;
  trends: {
    currentPeriod: number;
    previousPeriod: number;
    change: number;
    changePercentage: number;
  };
}

export interface StockHealthReport {
  healthScore: number;
  totalItems: number;
  healthyItems: number;
  lowStockItems: number;
  criticalItems: number;
  overstockItems: number;
  outOfStockItems: number;
  recommendations: Array<{
    priority: 'high' | 'medium' | 'low';
    type: 'reorder' | 'reduce' | 'review' | 'action';
    message: string;
    itemId?: string;
    itemName?: string;
  }>;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  timestamp: string;
}

// =====================
// Helper Functions
// =====================

/**
 * Build query parameters from filters
 */
const buildQueryParams = (filters: StatisticsFilters): Record<string, any> => {
  const params: Record<string, any> = {};

  if (filters.dateRange) {
    params.dateFrom = filters.dateRange.from.toISOString();
    params.dateTo = filters.dateRange.to.toISOString();
  }

  if (filters.period && filters.period !== 'custom') {
    params.period = filters.period;
  }

  if (filters.categoryId) params.categoryId = filters.categoryId;
  if (filters.brandId) params.brandId = filters.brandId;
  if (filters.supplierId) params.supplierId = filters.supplierId;
  if (filters.userId) params.userId = filters.userId;
  if (filters.sectorId) params.sectorId = filters.sectorId;
  if (filters.itemId) params.itemId = filters.itemId;

  return params;
};

// =====================
// Statistics Inventory Service
// =====================

/**
 * Statistics Inventory Service
 * Handles all inventory-related statistics API calls
 */
export const statisticsInventoryService = {
  /**
   * Get inventory overview statistics
   * @param filters - Date range and entity filters
   * @param config - Optional axios request config
   */
  getOverview: async (
    filters: StatisticsFilters,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<InventoryOverview>> => {
    const params = buildQueryParams(filters);
    const response = await apiClient.get<ApiResponse<InventoryOverview>>(
      '/statistics/inventory/overview',
      { params, ...config }
    );
    return response.data;
  },

  /**
   * Get stock levels and distribution
   * @param filters - Date range and entity filters
   * @param config - Optional axios request config
   */
  getStockLevels: async (
    filters: StatisticsFilters,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<StockLevelsData>> => {
    const params = buildQueryParams(filters);
    const response = await apiClient.get<ApiResponse<StockLevelsData>>(
      '/statistics/inventory/stock-levels',
      { params, ...config }
    );
    return response.data;
  },

  /**
   * Get consumption trends over time
   * @param filters - Date range and entity filters
   * @param config - Optional axios request config
   */
  getConsumptionTrends: async (
    filters: StatisticsFilters,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<ConsumptionTrend[]>> => {
    const params = buildQueryParams(filters);
    const response = await apiClient.get<ApiResponse<ConsumptionTrend[]>>(
      '/statistics/inventory/consumption-trends',
      { params, ...config }
    );
    return response.data;
  },

  /**
   * Get category performance metrics
   * @param filters - Date range and entity filters
   * @param config - Optional axios request config
   */
  getCategoryPerformance: async (
    filters: StatisticsFilters,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<CategoryPerformance[]>> => {
    const params = buildQueryParams(filters);
    const response = await apiClient.get<ApiResponse<CategoryPerformance[]>>(
      '/statistics/inventory/category-performance',
      { params, ...config }
    );
    return response.data;
  },

  /**
   * Get item movement data
   * @param filters - Date range and entity filters
   * @param limit - Maximum number of items to return
   * @param config - Optional axios request config
   */
  getItemMovements: async (
    filters: StatisticsFilters,
    limit: number = 50,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<ItemMovementData[]>> => {
    const params = { ...buildQueryParams(filters), limit };
    const response = await apiClient.get<ApiResponse<ItemMovementData[]>>(
      '/statistics/inventory/item-movements',
      { params, ...config }
    );
    return response.data;
  },

  /**
   * Get stock valuation details
   * @param filters - Date range and entity filters
   * @param config - Optional axios request config
   */
  getStockValuation: async (
    filters: StatisticsFilters,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<StockValuation>> => {
    const params = buildQueryParams(filters);
    const response = await apiClient.get<ApiResponse<StockValuation>>(
      '/statistics/inventory/stock-valuation',
      { params, ...config }
    );
    return response.data;
  },

  /**
   * Get stock health report with recommendations
   * @param filters - Date range and entity filters
   * @param config - Optional axios request config
   */
  getStockHealth: async (
    filters: StatisticsFilters,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<StockHealthReport>> => {
    const params = buildQueryParams(filters);
    const response = await apiClient.get<ApiResponse<StockHealthReport>>(
      '/statistics/inventory/stock-health',
      { params, ...config }
    );
    return response.data;
  },

  /**
   * Export inventory statistics
   * @param filters - Date range and entity filters
   * @param format - Export format (csv, xlsx, pdf)
   */
  exportStatistics: async (
    filters: StatisticsFilters,
    format: 'csv' | 'xlsx' | 'pdf' = 'xlsx'
  ): Promise<Blob> => {
    const params = { ...buildQueryParams(filters), format };
    const response = await apiClient.get('/statistics/inventory/export', {
      params,
      responseType: 'blob',
    });
    return response.data;
  },
};

// Export types
export type {
  StatisticsFilters,
  InventoryOverview,
  StockLevelsData,
  ConsumptionTrend,
  CategoryPerformance,
  ItemMovementData,
  StockValuation,
  StockHealthReport,
  ApiResponse,
};
