import { apiClient } from './axiosClient';
import type { AxiosRequestConfig } from 'axios';
import type { StatisticsFilters, ApiResponse } from './statistics-inventory.service';

// =====================
// Types
// =====================

export interface OrdersOverview {
  totalOrders: number;
  totalOrderValue: number;
  averageOrderValue: number;
  completedOrders: number;
  pendingOrders: number;
  cancelledOrders: number;
  completionRate: number;
  cancellationRate: number;
  averageProcessingTime: number;
}

export interface OrderTrend {
  date: string;
  ordersPlaced: number;
  ordersCompleted: number;
  ordersCancelled: number;
  totalValue: number;
  averageValue: number;
  averageProcessingTime: number;
}

export interface OrdersByStatus {
  status: string;
  count: number;
  percentage: number;
  totalValue: number;
  averageValue: number;
  oldestOrder: string;
  newestOrder: string;
}

export interface OrdersBySupplier {
  supplierId: string;
  supplierName: string;
  totalOrders: number;
  completedOrders: number;
  pendingOrders: number;
  totalValue: number;
  averageOrderValue: number;
  averageLeadTime: number;
  onTimeDeliveryRate: number;
  qualityScore: number;
}

export interface OrdersByItem {
  itemId: string;
  itemName: string;
  categoryName: string;
  brandName: string;
  ordersCount: number;
  totalQuantityOrdered: number;
  totalValue: number;
  averageQuantity: number;
  averageUnitPrice: number;
  lastOrdered: string;
}

export interface OrderDeliveryMetrics {
  onTimeDeliveries: number;
  lateDeliveries: number;
  onTimeRate: number;
  averageDelay: number;
  bySupplier: Array<{
    supplierId: string;
    supplierName: string;
    onTimeDeliveries: number;
    lateDeliveries: number;
    onTimeRate: number;
    averageDelay: number;
  }>;
  trends: {
    currentPeriod: number;
    previousPeriod: number;
    change: number;
    improving: boolean;
  };
}

export interface OrderCostAnalysis {
  totalCost: number;
  averageOrderCost: number;
  shippingCost: number;
  taxCost: number;
  otherCosts: number;
  costTrends: Array<{
    date: string;
    totalCost: number;
    shippingCost: number;
    taxCost: number;
    otherCosts: number;
  }>;
  byCategory: Array<{
    categoryId: string;
    categoryName: string;
    totalCost: number;
    percentage: number;
    averageUnitCost: number;
  }>;
  savingsOpportunities: Array<{
    area: string;
    currentCost: number;
    potentialSavings: number;
    recommendation: string;
  }>;
}

export interface OrderFrequencyAnalysis {
  totalUniqueItems: number;
  frequentlyOrdered: Array<{
    itemId: string;
    itemName: string;
    orderFrequency: number;
    averageQuantity: number;
    lastOrdered: string;
    nextSuggestedOrder: string;
  }>;
  seasonalPatterns: Array<{
    month: string;
    averageOrders: number;
    pattern: 'high' | 'medium' | 'low';
    seasonalityFactor: number;
  }>;
  reorderCycle: {
    averageCycleDays: number;
    fastestCycle: number;
    slowestCycle: number;
    cycleTrend: 'decreasing' | 'stable' | 'increasing';
  };
}

// =====================
// Helper Functions
// =====================

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
  if (filters.itemId) params.itemId = filters.itemId;

  return params;
};

// =====================
// Statistics Orders Service
// =====================

/**
 * Statistics Orders Service
 * Handles all order-related statistics API calls
 */
export const statisticsOrdersService = {
  /**
   * Get orders overview statistics
   */
  getOverview: async (
    filters: StatisticsFilters,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<OrdersOverview>> => {
    const params = buildQueryParams(filters);
    const response = await apiClient.get<ApiResponse<OrdersOverview>>(
      '/statistics/orders/overview',
      { params, ...config }
    );
    return response.data;
  },

  /**
   * Get order trends over time
   */
  getOrderTrends: async (
    filters: StatisticsFilters,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<OrderTrend[]>> => {
    const params = buildQueryParams(filters);
    const response = await apiClient.get<ApiResponse<OrderTrend[]>>(
      '/statistics/orders/trends',
      { params, ...config }
    );
    return response.data;
  },

  /**
   * Get orders grouped by status
   */
  getOrdersByStatus: async (
    filters: StatisticsFilters,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<OrdersByStatus[]>> => {
    const params = buildQueryParams(filters);
    const response = await apiClient.get<ApiResponse<OrdersByStatus[]>>(
      '/statistics/orders/by-status',
      { params, ...config }
    );
    return response.data;
  },

  /**
   * Get orders grouped by supplier
   */
  getOrdersBySupplier: async (
    filters: StatisticsFilters,
    limit: number = 50,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<OrdersBySupplier[]>> => {
    const params = { ...buildQueryParams(filters), limit };
    const response = await apiClient.get<ApiResponse<OrdersBySupplier[]>>(
      '/statistics/orders/by-supplier',
      { params, ...config }
    );
    return response.data;
  },

  /**
   * Get orders grouped by item
   */
  getOrdersByItem: async (
    filters: StatisticsFilters,
    limit: number = 50,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<OrdersByItem[]>> => {
    const params = { ...buildQueryParams(filters), limit };
    const response = await apiClient.get<ApiResponse<OrdersByItem[]>>(
      '/statistics/orders/by-item',
      { params, ...config }
    );
    return response.data;
  },

  /**
   * Get order delivery metrics
   */
  getDeliveryMetrics: async (
    filters: StatisticsFilters,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<OrderDeliveryMetrics>> => {
    const params = buildQueryParams(filters);
    const response = await apiClient.get<ApiResponse<OrderDeliveryMetrics>>(
      '/statistics/orders/delivery-metrics',
      { params, ...config }
    );
    return response.data;
  },

  /**
   * Get order cost analysis
   */
  getCostAnalysis: async (
    filters: StatisticsFilters,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<OrderCostAnalysis>> => {
    const params = buildQueryParams(filters);
    const response = await apiClient.get<ApiResponse<OrderCostAnalysis>>(
      '/statistics/orders/cost-analysis',
      { params, ...config }
    );
    return response.data;
  },

  /**
   * Get order frequency analysis
   */
  getFrequencyAnalysis: async (
    filters: StatisticsFilters,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<OrderFrequencyAnalysis>> => {
    const params = buildQueryParams(filters);
    const response = await apiClient.get<ApiResponse<OrderFrequencyAnalysis>>(
      '/statistics/orders/frequency-analysis',
      { params, ...config }
    );
    return response.data;
  },

  /**
   * Export order statistics
   */
  exportStatistics: async (
    filters: StatisticsFilters,
    format: 'csv' | 'xlsx' | 'pdf' = 'xlsx'
  ): Promise<Blob> => {
    const params = { ...buildQueryParams(filters), format };
    const response = await apiClient.get('/statistics/orders/export', {
      params,
      responseType: 'blob',
    });
    return response.data;
  },
};

// Export types
export type {
  OrdersOverview,
  OrderTrend,
  OrdersByStatus,
  OrdersBySupplier,
  OrdersByItem,
  OrderDeliveryMetrics,
  OrderCostAnalysis,
  OrderFrequencyAnalysis,
};
