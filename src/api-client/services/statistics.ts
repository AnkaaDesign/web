import { apiClient } from '../axiosClient';

// =====================
// Statistics Interface Types
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
}

export interface InventoryStatistics {
  totalItems: number;
  totalValue: number;
  lowStockItems: number;
  criticalItems: number;
  averageStockLevel: number;
  topCategories: Array<{
    id: string;
    name: string;
    itemCount: number;
    totalValue: number;
  }>;
  stockDistribution: Array<{
    category: string;
    count: number;
    percentage: number;
  }>;
  recentActivities: Array<{
    id: string;
    type: string;
    itemName: string;
    quantity: number;
    user: string;
    date: string;
  }>;
}

export interface StockTrends {
  dailyValues: Array<{
    date: string;
    totalValue: number;
    itemCount: number;
    activities: number;
  }>;
  weeklyComparison: {
    currentWeek: number;
    previousWeek: number;
    percentageChange: number;
  };
  monthlyGrowth: {
    currentMonth: number;
    previousMonth: number;
    percentageChange: number;
  };
}

export interface ActivityAnalytics {
  totalActivities: number;
  activityTypes: Array<{
    type: string;
    count: number;
    percentage: number;
  }>;
  hourlyDistribution: Array<{
    hour: number;
    count: number;
  }>;
  userRanking: Array<{
    userId: string;
    userName: string;
    activityCount: number;
    efficiency: number;
    sectorName: string;
  }>;
  sectorComparison: Array<{
    sectorId: string;
    sectorName: string;
    activityCount: number;
    avgEfficiency: number;
    userCount: number;
  }>;
}

export interface StockMetrics {
  stockLevels: {
    total: number;
    available: number;
    reserved: number;
    damaged: number;
    inTransit: number;
  };
  turnoverMetrics: {
    averageTurnover: number;
    fastMovingItems: number;
    slowMovingItems: number;
    deadStock: number;
  };
  valueMetrics: {
    totalValue: number;
    averageItemValue: number;
    highestValue: number;
    lowestValue: number;
    valueDistribution: Array<{
      range: string;
      count: number;
      percentage: number;
    }>;
  };
  stockHealth: {
    stockAccuracy: number;
    fillRate: number;
    serviceLevel: number;
    overstock: number;
    understock: number;
  };
}

export interface ForecastingMetrics {
  demandForecast: Array<{
    itemId: string;
    itemName: string;
    currentStock: number;
    forecastedDemand: number;
    suggestedOrder: number;
    confidence: number;
  }>;
  reorderAnalysis: Array<{
    itemId: string;
    itemName: string;
    currentStock: number;
    reorderPoint: number;
    maxStock: number;
    daysUntilReorder: number;
    recommendedAction: string;
  }>;
  seasonalPatterns: Array<{
    month: string;
    demandMultiplier: number;
    historicalAverage: number;
    trendDirection: 'up' | 'down' | 'stable';
  }>;
}

export interface PerformanceMetrics {
  efficiency: {
    inventoryTurnover: number;
    daysSalesInventory: number;
    stockoutRate: number;
    carryingCost: number;
  };
  accuracy: {
    cycleCounting: number;
    receivingAccuracy: number;
    pickingAccuracy: number;
    overallAccuracy: number;
  };
  cost: {
    totalCarryingCost: number;
    storageCostPerUnit: number;
    obsolescenceCost: number;
    orderingCost: number;
  };
}

export interface ConsumptionStatistics {
  overview: InventoryStatistics;
  trends: StockTrends;
  activities: ActivityAnalytics;
  stockMetrics: StockMetrics;
  forecasting: ForecastingMetrics;
  performance: PerformanceMetrics;
}

// =====================
// Query Parameter Types
// =====================

interface StatisticsQueryParams {
  dateRange?: string; // JSON stringified { from: string, to: string }
  period?: 'day' | 'week' | 'month' | 'quarter' | 'year';
  categoryId?: string;
  brandId?: string;
  supplierId?: string;
  userId?: string;
  sectorId?: string;
}

// =====================
// API Response Types
// =====================

interface StatisticsResponse<T> {
  success: boolean;
  message: string;
  data: T;
  cached?: boolean;
  cacheExpiry?: string;
}

// =====================
// Helper Functions
// =====================

const prepareQueryParams = (filters: StatisticsFilters): StatisticsQueryParams => {
  const { period, ...restFilters } = filters;
  return {
    ...restFilters,
    ...(period !== 'custom' && { period }),
    dateRange: JSON.stringify({
      from: filters.dateRange.from.toISOString(),
      to: filters.dateRange.to.toISOString(),
    }),
  };
};

// =====================
// Statistics Service
// =====================

export const statisticsService = {
  /**
   * Get inventory statistics overview
   */
  getInventoryStatistics: async (filters: StatisticsFilters): Promise<StatisticsResponse<InventoryStatistics>> => {
    const { period, ...restFilters } = filters;
    const params: StatisticsQueryParams = {
      ...restFilters,
      ...(period !== 'custom' && { period }),
      dateRange: JSON.stringify({
        from: filters.dateRange.from.toISOString(),
        to: filters.dateRange.to.toISOString(),
      }),
    };

    const response = await apiClient.get<StatisticsResponse<InventoryStatistics>>(
      '/inventory-statistics',
      { params }
    );
    return response.data;
  },

  /**
   * Get stock trends analysis
   */
  getStockTrends: async (filters: StatisticsFilters): Promise<StatisticsResponse<StockTrends>> => {
    const { period, ...restFilters } = filters;
    const params: StatisticsQueryParams = {
      ...restFilters,
      ...(period !== 'custom' && { period }),
      dateRange: JSON.stringify({
        from: filters.dateRange.from.toISOString(),
        to: filters.dateRange.to.toISOString(),
      }),
    };

    const response = await apiClient.get<StatisticsResponse<StockTrends>>(
      '/inventory-statistics/trends',
      { params }
    );
    return response.data;
  },

  /**
   * Get activity analytics
   */
  getActivityAnalytics: async (filters: StatisticsFilters): Promise<StatisticsResponse<ActivityAnalytics>> => {
    const params = prepareQueryParams(filters);

    const response = await apiClient.get<StatisticsResponse<ActivityAnalytics>>(
      '/inventory-statistics/activities',
      { params }
    );
    return response.data;
  },

  /**
   * Get detailed stock metrics
   */
  getStockMetrics: async (filters: StatisticsFilters): Promise<StatisticsResponse<StockMetrics>> => {
    const params = prepareQueryParams(filters);

    const response = await apiClient.get<StatisticsResponse<StockMetrics>>(
      '/inventory-statistics/stock-metrics',
      { params }
    );
    return response.data;
  },

  /**
   * Get forecasting and predictive analytics
   */
  getForecastingMetrics: async (filters: StatisticsFilters): Promise<StatisticsResponse<ForecastingMetrics>> => {
    const params = prepareQueryParams(filters);

    const response = await apiClient.get<StatisticsResponse<ForecastingMetrics>>(
      '/inventory-statistics/forecasting',
      { params }
    );
    return response.data;
  },

  /**
   * Get performance KPIs
   */
  getPerformanceMetrics: async (filters: StatisticsFilters): Promise<StatisticsResponse<PerformanceMetrics>> => {
    const params = prepareQueryParams(filters);

    const response = await apiClient.get<StatisticsResponse<PerformanceMetrics>>(
      '/inventory-statistics/performance',
      { params }
    );
    return response.data;
  },

  /**
   * Get comprehensive consumption statistics (aggregated endpoint)
   */
  getConsumptionStatistics: async (filters: StatisticsFilters): Promise<StatisticsResponse<ConsumptionStatistics>> => {
    const params = prepareQueryParams(filters);

    const response = await apiClient.get<StatisticsResponse<ConsumptionStatistics>>(
      '/inventory-statistics/consumption',
      { params }
    );
    return response.data;
  },

  /**
   * Export statistics data
   */
  exportStatistics: async (
    filters: StatisticsFilters,
    format: 'csv' | 'xlsx' | 'pdf' = 'xlsx'
  ): Promise<Blob> => {
    const params = {
      ...prepareQueryParams(filters),
      format,
    };

    const response = await apiClient.get(
      '/inventory-statistics/export',
      {
        params,
        responseType: 'blob',
      }
    );
    return response.data;
  },

  /**
   * Refresh cached statistics
   */
  refreshCache: async (filters: StatisticsFilters): Promise<{ success: boolean; message: string }> => {
    const params = prepareQueryParams(filters);

    const response = await apiClient.post<{ success: boolean; message: string }>(
      '/inventory-statistics/refresh-cache',
      {},
      { params }
    );
    return response.data;
  },
};

// =====================
// Export Types for Hooks
// =====================

export type { StatisticsResponse };