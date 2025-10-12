import { apiClient } from './axiosClient';
import type { AxiosRequestConfig } from 'axios';
import type { StatisticsFilters, ApiResponse } from './statistics-inventory.service';

// =====================
// Types
// =====================

export interface ProductionOverview {
  totalProduction: number;
  totalProductionValue: number;
  completedOrders: number;
  pendingOrders: number;
  cancelledOrders: number;
  averageProductionTime: number;
  onTimeDeliveryRate: number;
  qualityRate: number;
  efficiency: number;
}

export interface ProductionTrend {
  date: string;
  productionVolume: number;
  completedOrders: number;
  pendingOrders: number;
  cancelledOrders: number;
  totalValue: number;
  averageOrderValue: number;
  efficiency: number;
}

export interface OrderMetrics {
  totalOrders: number;
  averageOrderValue: number;
  averageCompletionTime: number;
  onTimeDeliveryRate: number;
  delayedOrders: number;
  rushOrders: number;
  byStatus: Array<{
    status: string;
    count: number;
    percentage: number;
    totalValue: number;
  }>;
  byPriority: Array<{
    priority: string;
    count: number;
    percentage: number;
    averageCompletionTime: number;
  }>;
}

export interface ProductionByItem {
  itemId: string;
  itemName: string;
  categoryName: string;
  brandName: string;
  totalProduced: number;
  totalValue: number;
  ordersCount: number;
  averageLeadTime: number;
  successRate: number;
  lastProduction: string;
}

export interface ProductionByCustomer {
  customerId: string;
  customerName: string;
  totalOrders: number;
  completedOrders: number;
  pendingOrders: number;
  totalValue: number;
  averageOrderValue: number;
  onTimeRate: number;
  satisfactionScore: number;
}

export interface ResourceUtilization {
  overall: number;
  byUser: Array<{
    userId: string;
    userName: string;
    sectorName: string;
    ordersHandled: number;
    hoursWorked: number;
    efficiency: number;
    utilizationRate: number;
  }>;
  bySector: Array<{
    sectorId: string;
    sectorName: string;
    ordersHandled: number;
    activeUsers: number;
    averageEfficiency: number;
    utilizationRate: number;
  }>;
  byEquipment: Array<{
    equipmentId: string;
    equipmentName: string;
    hoursUsed: number;
    utilizationRate: number;
    maintenanceHours: number;
    downtime: number;
  }>;
}

export interface QualityMetrics {
  overallQualityRate: number;
  defectRate: number;
  reworkRate: number;
  totalInspections: number;
  passedInspections: number;
  failedInspections: number;
  byDefectType: Array<{
    type: string;
    count: number;
    percentage: number;
    severity: 'low' | 'medium' | 'high';
  }>;
  trends: {
    currentPeriod: number;
    previousPeriod: number;
    change: number;
    improving: boolean;
  };
}

export interface BottleneckAnalysis {
  identifiedBottlenecks: Array<{
    stage: string;
    averageWaitTime: number;
    impactScore: number;
    affectedOrders: number;
    recommendations: string[];
  }>;
  criticalPath: {
    stages: string[];
    totalTime: number;
    optimizationPotential: number;
  };
  workloadDistribution: Array<{
    stage: string;
    averageTime: number;
    standardDeviation: number;
    utilizationRate: number;
  }>;
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
  if (filters.userId) params.userId = filters.userId;
  if (filters.sectorId) params.sectorId = filters.sectorId;
  if (filters.itemId) params.itemId = filters.itemId;

  return params;
};

// =====================
// Statistics Production Service
// =====================

/**
 * Statistics Production Service
 * Handles all production-related statistics API calls
 */
export const statisticsProductionService = {
  /**
   * Get production overview statistics
   */
  getOverview: async (
    filters: StatisticsFilters,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<ProductionOverview>> => {
    const params = buildQueryParams(filters);
    const response = await apiClient.get<ApiResponse<ProductionOverview>>(
      '/statistics/production/overview',
      { params, ...config }
    );
    return response.data;
  },

  /**
   * Get production trends over time
   */
  getProductionTrends: async (
    filters: StatisticsFilters,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<ProductionTrend[]>> => {
    const params = buildQueryParams(filters);
    const response = await apiClient.get<ApiResponse<ProductionTrend[]>>(
      '/statistics/production/trends',
      { params, ...config }
    );
    return response.data;
  },

  /**
   * Get order metrics and analysis
   */
  getOrderMetrics: async (
    filters: StatisticsFilters,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<OrderMetrics>> => {
    const params = buildQueryParams(filters);
    const response = await apiClient.get<ApiResponse<OrderMetrics>>(
      '/statistics/production/order-metrics',
      { params, ...config }
    );
    return response.data;
  },

  /**
   * Get production data by item
   */
  getProductionByItem: async (
    filters: StatisticsFilters,
    limit: number = 50,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<ProductionByItem[]>> => {
    const params = { ...buildQueryParams(filters), limit };
    const response = await apiClient.get<ApiResponse<ProductionByItem[]>>(
      '/statistics/production/by-item',
      { params, ...config }
    );
    return response.data;
  },

  /**
   * Get production data by customer
   */
  getProductionByCustomer: async (
    filters: StatisticsFilters,
    limit: number = 50,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<ProductionByCustomer[]>> => {
    const params = { ...buildQueryParams(filters), limit };
    const response = await apiClient.get<ApiResponse<ProductionByCustomer[]>>(
      '/statistics/production/by-customer',
      { params, ...config }
    );
    return response.data;
  },

  /**
   * Get resource utilization metrics
   */
  getResourceUtilization: async (
    filters: StatisticsFilters,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<ResourceUtilization>> => {
    const params = buildQueryParams(filters);
    const response = await apiClient.get<ApiResponse<ResourceUtilization>>(
      '/statistics/production/resource-utilization',
      { params, ...config }
    );
    return response.data;
  },

  /**
   * Get quality metrics and defect analysis
   */
  getQualityMetrics: async (
    filters: StatisticsFilters,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<QualityMetrics>> => {
    const params = buildQueryParams(filters);
    const response = await apiClient.get<ApiResponse<QualityMetrics>>(
      '/statistics/production/quality-metrics',
      { params, ...config }
    );
    return response.data;
  },

  /**
   * Get bottleneck analysis
   */
  getBottleneckAnalysis: async (
    filters: StatisticsFilters,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<BottleneckAnalysis>> => {
    const params = buildQueryParams(filters);
    const response = await apiClient.get<ApiResponse<BottleneckAnalysis>>(
      '/statistics/production/bottleneck-analysis',
      { params, ...config }
    );
    return response.data;
  },

  /**
   * Export production statistics
   */
  exportStatistics: async (
    filters: StatisticsFilters,
    format: 'csv' | 'xlsx' | 'pdf' = 'xlsx'
  ): Promise<Blob> => {
    const params = { ...buildQueryParams(filters), format };
    const response = await apiClient.get('/statistics/production/export', {
      params,
      responseType: 'blob',
    });
    return response.data;
  },
};

// Export types
export type {
  ProductionOverview,
  ProductionTrend,
  OrderMetrics,
  ProductionByItem,
  ProductionByCustomer,
  ResourceUtilization,
  QualityMetrics,
  BottleneckAnalysis,
};
