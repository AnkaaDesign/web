import { apiClient } from './axiosClient';
import type { AxiosRequestConfig } from 'axios';
import type { StatisticsFilters, ApiResponse } from './statistics-inventory.service';

// =====================
// Types
// =====================

export interface UnifiedDashboardData {
  overview: {
    totalRevenue: number;
    totalCost: number;
    totalProfit: number;
    profitMargin: number;
    inventoryValue: number;
    activeOrders: number;
    activeEmployees: number;
    productivity: number;
  };
  inventory: {
    totalItems: number;
    totalValue: number;
    lowStockItems: number;
    criticalItems: number;
    stockHealth: number;
    recentActivities: number;
  };
  production: {
    ordersInProgress: number;
    completedToday: number;
    delayedOrders: number;
    efficiency: number;
    onTimeDeliveryRate: number;
    qualityScore: number;
  };
  financial: {
    revenue: number;
    expenses: number;
    profit: number;
    cashFlow: number;
    profitMargin: number;
    revenueGrowth: number;
  };
  hr: {
    activeEmployees: number;
    attendanceRate: number;
    productivity: number;
    pendingLeaves: number;
    turnoverRate: number;
  };
  alerts: Array<{
    id: string;
    type: 'critical' | 'warning' | 'info';
    category: 'inventory' | 'production' | 'financial' | 'hr';
    title: string;
    message: string;
    timestamp: string;
    actionRequired: boolean;
  }>;
  trends: {
    revenue: Array<{ date: string; value: number }>;
    production: Array<{ date: string; value: number }>;
    inventory: Array<{ date: string; value: number }>;
    expenses: Array<{ date: string; value: number }>;
  };
}

export interface KPIMetrics {
  financial: {
    revenue: { value: number; change: number; trend: 'up' | 'down' | 'stable' };
    profit: { value: number; change: number; trend: 'up' | 'down' | 'stable' };
    profitMargin: { value: number; change: number; trend: 'up' | 'down' | 'stable' };
    cashFlow: { value: number; change: number; trend: 'up' | 'down' | 'stable' };
  };
  operational: {
    inventoryTurnover: { value: number; change: number; trend: 'up' | 'down' | 'stable' };
    orderFulfillment: { value: number; change: number; trend: 'up' | 'down' | 'stable' };
    onTimeDelivery: { value: number; change: number; trend: 'up' | 'down' | 'stable' };
    qualityRate: { value: number; change: number; trend: 'up' | 'down' | 'stable' };
  };
  hr: {
    productivity: { value: number; change: number; trend: 'up' | 'down' | 'stable' };
    attendance: { value: number; change: number; trend: 'up' | 'down' | 'stable' };
    satisfaction: { value: number; change: number; trend: 'up' | 'down' | 'stable' };
    turnover: { value: number; change: number; trend: 'up' | 'down' | 'stable' };
  };
  customer: {
    satisfaction: { value: number; change: number; trend: 'up' | 'down' | 'stable' };
    retention: { value: number; change: number; trend: 'up' | 'down' | 'stable' };
    orderValue: { value: number; change: number; trend: 'up' | 'down' | 'stable' };
    repeatRate: { value: number; change: number; trend: 'up' | 'down' | 'stable' };
  };
}

export interface PerformanceSnapshot {
  timestamp: string;
  score: number;
  status: 'excellent' | 'good' | 'fair' | 'poor';
  categories: {
    inventory: { score: number; status: string; issues: string[] };
    production: { score: number; status: string; issues: string[] };
    financial: { score: number; status: string; issues: string[] };
    hr: { score: number; status: string; issues: string[] };
  };
  recommendations: Array<{
    priority: 'high' | 'medium' | 'low';
    category: string;
    title: string;
    description: string;
    estimatedImpact: string;
  }>;
  achievements: Array<{
    category: string;
    title: string;
    description: string;
    value: number;
  }>;
}

export interface ExecutiveSummary {
  period: string;
  highlights: {
    revenue: { value: number; change: number; vs: string };
    profit: { value: number; change: number; vs: string };
    orders: { value: number; change: number; vs: string };
    efficiency: { value: number; change: number; vs: string };
  };
  keyMetrics: Array<{
    name: string;
    value: number;
    unit: string;
    change: number;
    status: 'good' | 'warning' | 'critical';
  }>;
  topPerformers: {
    products: Array<{ id: string; name: string; value: number }>;
    customers: Array<{ id: string; name: string; value: number }>;
    employees: Array<{ id: string; name: string; value: number }>;
  };
  criticalIssues: Array<{
    severity: 'high' | 'medium' | 'low';
    category: string;
    description: string;
    impact: string;
    action: string;
  }>;
  opportunities: Array<{
    type: string;
    description: string;
    potential: string;
    effort: 'low' | 'medium' | 'high';
  }>;
  forecast: {
    revenue: Array<{ date: string; value: number; confidence: number }>;
    orders: Array<{ date: string; value: number; confidence: number }>;
    trends: string[];
  };
}

export interface ComparisonReport {
  currentPeriod: {
    start: string;
    end: string;
    metrics: Record<string, number>;
  };
  previousPeriod: {
    start: string;
    end: string;
    metrics: Record<string, number>;
  };
  changes: Record<string, {
    absolute: number;
    percentage: number;
    trend: 'improving' | 'declining' | 'stable';
  }>;
  insights: string[];
}

export interface RealTimeMetrics {
  timestamp: string;
  activeUsers: number;
  activeOrders: number;
  recentActivities: Array<{
    type: string;
    description: string;
    user: string;
    timestamp: string;
  }>;
  systemHealth: {
    overall: number;
    database: number;
    api: number;
    storage: number;
  };
  performance: {
    avgResponseTime: number;
    requestsPerMinute: number;
    errorRate: number;
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
  if (filters.sectorId) params.sectorId = filters.sectorId;
  if (filters.itemId) params.itemId = filters.itemId;

  return params;
};

// =====================
// Statistics Dashboard Service
// =====================

/**
 * Statistics Dashboard Service
 * Handles all dashboard-related statistics API calls
 */
export const statisticsDashboardService = {
  /**
   * Get unified dashboard data with all key metrics
   */
  getUnifiedDashboard: async (
    filters: StatisticsFilters,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<UnifiedDashboardData>> => {
    const params = buildQueryParams(filters);
    const response = await apiClient.get<ApiResponse<UnifiedDashboardData>>(
      '/statistics/dashboard/unified',
      { params, ...config }
    );
    return response.data;
  },

  /**
   * Get KPI metrics across all departments
   */
  getKPIMetrics: async (
    filters: StatisticsFilters,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<KPIMetrics>> => {
    const params = buildQueryParams(filters);
    const response = await apiClient.get<ApiResponse<KPIMetrics>>(
      '/statistics/dashboard/kpi',
      { params, ...config }
    );
    return response.data;
  },

  /**
   * Get current performance snapshot
   */
  getPerformanceSnapshot: async (
    filters: StatisticsFilters,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<PerformanceSnapshot>> => {
    const params = buildQueryParams(filters);
    const response = await apiClient.get<ApiResponse<PerformanceSnapshot>>(
      '/statistics/dashboard/performance-snapshot',
      { params, ...config }
    );
    return response.data;
  },

  /**
   * Get executive summary report
   */
  getExecutiveSummary: async (
    filters: StatisticsFilters,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<ExecutiveSummary>> => {
    const params = buildQueryParams(filters);
    const response = await apiClient.get<ApiResponse<ExecutiveSummary>>(
      '/statistics/dashboard/executive-summary',
      { params, ...config }
    );
    return response.data;
  },

  /**
   * Get period comparison report
   */
  getComparisonReport: async (
    filters: StatisticsFilters,
    comparePeriod: 'previous' | 'year_ago' = 'previous',
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<ComparisonReport>> => {
    const params = { ...buildQueryParams(filters), comparePeriod };
    const response = await apiClient.get<ApiResponse<ComparisonReport>>(
      '/statistics/dashboard/comparison',
      { params, ...config }
    );
    return response.data;
  },

  /**
   * Get real-time metrics
   */
  getRealTimeMetrics: async (
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<RealTimeMetrics>> => {
    const response = await apiClient.get<ApiResponse<RealTimeMetrics>>(
      '/statistics/dashboard/real-time',
      config
    );
    return response.data;
  },

  /**
   * Refresh dashboard cache
   */
  refreshCache: async (
    filters: StatisticsFilters
  ): Promise<ApiResponse<{ success: boolean; message: string }>> => {
    const params = buildQueryParams(filters);
    const response = await apiClient.post<ApiResponse<{ success: boolean; message: string }>>(
      '/statistics/dashboard/refresh-cache',
      {},
      { params }
    );
    return response.data;
  },

  /**
   * Export dashboard report
   */
  exportDashboard: async (
    filters: StatisticsFilters,
    format: 'csv' | 'xlsx' | 'pdf' = 'pdf'
  ): Promise<Blob> => {
    const params = { ...buildQueryParams(filters), format };
    const response = await apiClient.get('/statistics/dashboard/export', {
      params,
      responseType: 'blob',
    });
    return response.data;
  },
};

// Export types
export type {
  UnifiedDashboardData,
  KPIMetrics,
  PerformanceSnapshot,
  ExecutiveSummary,
  ComparisonReport,
  RealTimeMetrics,
};
