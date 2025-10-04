import { useQuery, useQueryClient, type UseQueryOptions } from "@tanstack/react-query";
import { useMemo, useState, useCallback } from "react";
import { startOfDay, endOfDay, subWeeks, subMonths, subQuarters, subYears } from "date-fns";
import {
  statisticsService,
  type StatisticsFilters,
  type InventoryStatistics,
  type StockTrends,
  type ActivityAnalytics,
  type StockMetrics,
  type ForecastingMetrics,
  type PerformanceMetrics,
  type ConsumptionStatistics,
} from "../api-client";

// =====================
// Query Keys for Caching
// =====================

export const inventoryStatisticsKeys = {
  all: ['inventory-statistics'] as const,
  overview: (filters: StatisticsFilters) => [...inventoryStatisticsKeys.all, 'overview', filters] as const,
  trends: (filters: StatisticsFilters) => [...inventoryStatisticsKeys.all, 'trends', filters] as const,
  activities: (filters: StatisticsFilters) => [...inventoryStatisticsKeys.all, 'activities', filters] as const,
  stockMetrics: (filters: StatisticsFilters) => [...inventoryStatisticsKeys.all, 'stock-metrics', filters] as const,
  forecasting: (filters: StatisticsFilters) => [...inventoryStatisticsKeys.all, 'forecasting', filters] as const,
  performance: (filters: StatisticsFilters) => [...inventoryStatisticsKeys.all, 'performance', filters] as const,
  consumption: (filters: StatisticsFilters) => [...inventoryStatisticsKeys.all, 'consumption', filters] as const,
};

// =====================
// Statistics Filter Management Hook
// =====================

export interface StatisticsFilterState extends StatisticsFilters {
  isLoading: boolean;
  hasChanges: boolean;
}

export const useStatisticsFilters = (initialFilters?: Partial<StatisticsFilters>) => {
  const getDefaultDateRange = useCallback((period: StatisticsFilters['period']) => {
    const now = new Date();
    const endDate = endOfDay(now);
    let startDate: Date;

    switch (period) {
      case 'day':
        startDate = startOfDay(now);
        break;
      case 'week':
        startDate = startOfDay(subWeeks(now, 1));
        break;
      case 'month':
        startDate = startOfDay(subMonths(now, 1));
        break;
      case 'quarter':
        startDate = startOfDay(subQuarters(now, 1));
        break;
      case 'year':
        startDate = startOfDay(subYears(now, 1));
        break;
      default:
        startDate = startOfDay(subMonths(now, 1));
    }

    return { from: startDate, to: endDate };
  }, []);

  const [filters, setFilters] = useState<StatisticsFilters>(() => {
    const period = initialFilters?.period || 'month';
    return {
      dateRange: initialFilters?.dateRange || getDefaultDateRange(period),
      period,
      categoryId: initialFilters?.categoryId,
      brandId: initialFilters?.brandId,
      supplierId: initialFilters?.supplierId,
      userId: initialFilters?.userId,
      sectorId: initialFilters?.sectorId,
    };
  });

  const [originalFilters] = useState(filters);
  const [isLoading, setIsLoading] = useState(false);

  const hasChanges = useMemo(() => {
    return JSON.stringify(filters) !== JSON.stringify(originalFilters);
  }, [filters, originalFilters]);

  const updateFilter = useCallback(<K extends keyof StatisticsFilters>(
    key: K,
    value: StatisticsFilters[K]
  ) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
      // Auto-update date range when period changes
      ...(key === 'period' && value !== 'custom' ? {
        dateRange: getDefaultDateRange(value as StatisticsFilters['period'])
      } : {}),
    }));
  }, [getDefaultDateRange]);

  const updateFilters = useCallback((newFilters: Partial<StatisticsFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  }, []);

  const resetFilters = useCallback(() => {
    const period = 'month';
    setFilters({
      dateRange: getDefaultDateRange(period),
      period,
      categoryId: undefined,
      brandId: undefined,
      supplierId: undefined,
      userId: undefined,
      sectorId: undefined,
    });
  }, [getDefaultDateRange]);

  const setPeriod = useCallback((period: StatisticsFilters['period']) => {
    updateFilter('period', period);
  }, [updateFilter]);

  const setDateRange = useCallback((dateRange: StatisticsFilters['dateRange']) => {
    setFilters(prev => ({
      ...prev,
      dateRange,
      period: 'custom',
    }));
  }, []);

  return {
    filters,
    hasChanges,
    isLoading,
    setIsLoading,
    updateFilter,
    updateFilters,
    resetFilters,
    setPeriod,
    setDateRange,
  };
};

// =====================
// Statistics Hooks
// =====================

/**
 * Hook for getting inventory overview statistics
 */
export const useInventoryStatistics = (
  filters: StatisticsFilters,
  options?: Omit<UseQueryOptions<InventoryStatistics>, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey: inventoryStatisticsKeys.overview(filters),
    queryFn: async () => {
      const response = await statisticsService.getInventoryStatistics(filters);
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    ...options,
  });
};

/**
 * Hook for getting stock trends data
 */
export const useStockTrends = (
  filters: StatisticsFilters,
  options?: Omit<UseQueryOptions<StockTrends>, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey: inventoryStatisticsKeys.trends(filters),
    queryFn: async () => {
      const response = await statisticsService.getStockTrends(filters);
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    ...options,
  });
};

/**
 * Hook for getting activity analytics
 */
export const useActivityAnalytics = (
  filters: StatisticsFilters,
  options?: Omit<UseQueryOptions<ActivityAnalytics>, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey: inventoryStatisticsKeys.activities(filters),
    queryFn: async () => {
      const response = await statisticsService.getActivityAnalytics(filters);
      return response.data;
    },
    staleTime: 3 * 60 * 1000, // 3 minutes (more frequent updates for activities)
    gcTime: 10 * 60 * 1000, // 10 minutes
    ...options,
  });
};

/**
 * Hook for getting detailed stock metrics
 */
export const useStockMetrics = (
  filters: StatisticsFilters,
  options?: Omit<UseQueryOptions<StockMetrics>, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey: inventoryStatisticsKeys.stockMetrics(filters),
    queryFn: async () => {
      const response = await statisticsService.getStockMetrics(filters);
      return response.data;
    },
    staleTime: 15 * 60 * 1000, // 15 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    ...options,
  });
};

/**
 * Hook for getting forecasting metrics
 */
export const useForecastingMetrics = (
  filters: StatisticsFilters,
  options?: Omit<UseQueryOptions<ForecastingMetrics>, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey: inventoryStatisticsKeys.forecasting(filters),
    queryFn: async () => {
      const response = await statisticsService.getForecastingMetrics(filters);
      return response.data;
    },
    staleTime: 30 * 60 * 1000, // 30 minutes (forecasting changes less frequently)
    gcTime: 60 * 60 * 1000, // 1 hour
    ...options,
  });
};

/**
 * Hook for getting performance metrics
 */
export const usePerformanceMetrics = (
  filters: StatisticsFilters,
  options?: Omit<UseQueryOptions<PerformanceMetrics>, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey: inventoryStatisticsKeys.performance(filters),
    queryFn: async () => {
      const response = await statisticsService.getPerformanceMetrics(filters);
      return response.data;
    },
    staleTime: 30 * 60 * 1000, // 30 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
    ...options,
  });
};

/**
 * Hook for getting comprehensive consumption statistics
 */
export const useConsumptionStatistics = (
  filters: StatisticsFilters,
  options?: Omit<UseQueryOptions<ConsumptionStatistics>, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey: inventoryStatisticsKeys.consumption(filters),
    queryFn: async () => {
      const response = await statisticsService.getConsumptionStatistics(filters);
      return response.data;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    ...options,
  });
};

/**
 * Computed statistics hook that aggregates multiple data sources
 */
export const useComputedInventoryMetrics = (filters: StatisticsFilters) => {
  const { data: overview, isLoading: overviewLoading, error: overviewError } = useInventoryStatistics(filters);
  const { data: trends, isLoading: trendsLoading, error: trendsError } = useStockTrends(filters);
  const { data: stockMetrics, isLoading: stockMetricsLoading } = useStockMetrics(filters);
  const { data: performance, isLoading: performanceLoading } = usePerformanceMetrics(filters);

  const computedMetrics = useMemo(() => {
    if (!overview || !trends) return null;

    // Calculate efficiency metrics
    const stockEfficiency = overview.totalItems > 0 ?
      (overview.totalItems - overview.lowStockItems - overview.criticalItems) / overview.totalItems * 100 : 0;

    // Calculate value concentration
    const topCategoriesValue = overview.topCategories.reduce((sum, cat) => sum + cat.totalValue, 0);
    const valueConcentration = overview.totalValue > 0 ?
      (topCategoriesValue / overview.totalValue) * 100 : 0;

    // Calculate activity intensity
    const avgDailyActivities = trends.dailyValues.reduce((sum, day) => sum + day.activities, 0) / trends.dailyValues.length;

    // Risk assessment
    const riskScore = (overview.criticalItems * 3 + overview.lowStockItems) / overview.totalItems * 100;

    // Advanced metrics from stock metrics if available
    const advancedMetrics = stockMetrics ? {
      turnoverRate: stockMetrics.turnoverMetrics.averageTurnover,
      stockAccuracy: stockMetrics.stockHealth.stockAccuracy,
      fillRate: stockMetrics.stockHealth.fillRate,
    } : {};

    // Performance insights
    const performanceInsights = performance ? {
      inventoryTurnover: performance.efficiency.inventoryTurnover,
      daysSalesInventory: performance.efficiency.daysSalesInventory,
      overallAccuracy: performance.accuracy.overallAccuracy,
    } : {};

    return {
      stockEfficiency: Number(stockEfficiency.toFixed(1)),
      valueConcentration: Number(valueConcentration.toFixed(1)),
      avgDailyActivities: Number(avgDailyActivities.toFixed(1)),
      riskScore: Number(riskScore.toFixed(1)),
      ...advancedMetrics,
      ...performanceInsights,
      recommendedActions: generateRecommendations(overview, trends, stockMetrics, performance),
    };
  }, [overview, trends, stockMetrics, performance]);

  return {
    metrics: computedMetrics,
    isLoading: overviewLoading || trendsLoading || stockMetricsLoading || performanceLoading,
    hasError: !!(overviewError || trendsError),
    overview,
    trends,
    stockMetrics,
    performance,
  };
};

/**
 * Hook for real-time statistics with auto-refresh
 */
export const useRealTimeStatistics = (
  filters: StatisticsFilters,
  refreshInterval: number = 30000 // 30 seconds
) => {
  const overviewQuery = useInventoryStatistics(filters, {
    refetchInterval: refreshInterval,
    refetchIntervalInBackground: true,
  });

  const trendsQuery = useStockTrends(filters, {
    refetchInterval: refreshInterval * 2, // Refresh trends less frequently
    refetchIntervalInBackground: true,
  });

  const activitiesQuery = useActivityAnalytics(filters, {
    refetchInterval: refreshInterval / 2, // Refresh activities more frequently
    refetchIntervalInBackground: true,
  });

  return {
    overview: overviewQuery,
    trends: trendsQuery,
    activities: activitiesQuery,
    isAnyLoading: overviewQuery.isLoading || trendsQuery.isLoading || activitiesQuery.isLoading,
    hasAnyError: overviewQuery.error || trendsQuery.error || activitiesQuery.error,
  };
};

/**
 * Hook for cache management and invalidation
 */
export const useStatisticsCache = () => {
  const queryClient = useQueryClient();

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: inventoryStatisticsKeys.all });
  }, [queryClient]);

  const invalidateOverview = useCallback((filters?: StatisticsFilters) => {
    if (filters) {
      queryClient.invalidateQueries({ queryKey: inventoryStatisticsKeys.overview(filters) });
    } else {
      queryClient.invalidateQueries({ queryKey: [...inventoryStatisticsKeys.all, 'overview'] });
    }
  }, [queryClient]);

  const invalidateTrends = useCallback((filters?: StatisticsFilters) => {
    if (filters) {
      queryClient.invalidateQueries({ queryKey: inventoryStatisticsKeys.trends(filters) });
    } else {
      queryClient.invalidateQueries({ queryKey: [...inventoryStatisticsKeys.all, 'trends'] });
    }
  }, [queryClient]);

  const invalidateActivities = useCallback((filters?: StatisticsFilters) => {
    if (filters) {
      queryClient.invalidateQueries({ queryKey: inventoryStatisticsKeys.activities(filters) });
    } else {
      queryClient.invalidateQueries({ queryKey: [...inventoryStatisticsKeys.all, 'activities'] });
    }
  }, [queryClient]);

  const refreshCache = useCallback(async (filters: StatisticsFilters) => {
    try {
      const response = await statisticsService.refreshCache(filters);
      if (response.success) {
        // Invalidate relevant queries after cache refresh
        invalidateAll();
      }
      return response;
    } catch (error) {
      console.error('Failed to refresh statistics cache:', error);
      throw error;
    }
  }, [invalidateAll]);

  const prefetchStatistics = useCallback(async (filters: StatisticsFilters) => {
    await Promise.all([
      queryClient.prefetchQuery({
        queryKey: inventoryStatisticsKeys.overview(filters),
        queryFn: async () => {
          const response = await statisticsService.getInventoryStatistics(filters);
          return response.data;
        },
      }),
      queryClient.prefetchQuery({
        queryKey: inventoryStatisticsKeys.trends(filters),
        queryFn: async () => {
          const response = await statisticsService.getStockTrends(filters);
          return response.data;
        },
      }),
    ]);
  }, [queryClient]);

  return {
    invalidateAll,
    invalidateOverview,
    invalidateTrends,
    invalidateActivities,
    refreshCache,
    prefetchStatistics,
  };
};

// =====================
// Helper Functions
// =====================

/**
 * Generate recommendations based on data
 */
const generateRecommendations = (
  overview: InventoryStatistics,
  trends: StockTrends,
  stockMetrics?: StockMetrics,
  performance?: PerformanceMetrics
): string[] => {
  const recommendations: string[] = [];

  // Critical stock recommendations
  if (overview.criticalItems > overview.totalItems * 0.05) {
    recommendations.push('Reabastecer itens em estoque crítico urgentemente');
  }

  // Low stock recommendations
  if (overview.lowStockItems > overview.totalItems * 0.15) {
    recommendations.push('Revisar pontos de reposição para reduzir itens em estoque baixo');
  }

  // Trend-based recommendations
  if (trends.weeklyComparison.percentageChange < -10) {
    recommendations.push('Investigar queda significativa no valor do estoque');
  }

  if (trends.weeklyComparison.percentageChange > 20) {
    recommendations.push('Monitorar crescimento acelerado do estoque');
  }

  // Activity-based recommendations
  const avgActivities = trends.dailyValues.reduce((sum, day) => sum + day.activities, 0) / trends.dailyValues.length;
  if (avgActivities < 10) {
    recommendations.push('Baixa atividade detectada - verificar processos operacionais');
  }

  // Advanced recommendations based on stock metrics
  if (stockMetrics) {
    if (stockMetrics.turnoverMetrics.deadStock > 0) {
      recommendations.push(`${stockMetrics.turnoverMetrics.deadStock} itens sem movimento - considerar liquidação`);
    }

    if (stockMetrics.stockHealth.stockAccuracy < 95) {
      recommendations.push('Acurácia do estoque baixa - realizar contagem cíclica');
    }

    if (stockMetrics.stockHealth.overstock > overview.totalItems * 0.1) {
      recommendations.push('Alto nível de sobre-estoque detectado - revisar políticas de reposição');
    }
  }

  // Performance-based recommendations
  if (performance) {
    if (performance.efficiency.inventoryTurnover < 4) {
      recommendations.push('Giro de estoque baixo - otimizar compras e vendas');
    }

    if (performance.accuracy.overallAccuracy < 98) {
      recommendations.push('Acurácia geral baixa - implementar melhorias nos processos');
    }
  }

  // Default positive message
  if (recommendations.length === 0) {
    recommendations.push('Estoque operando dentro dos parâmetros normais');
  }

  return recommendations;
};

// =====================
// Export Everything
// =====================

export type {
  StatisticsFilters,
  InventoryStatistics,
  StockTrends,
  ActivityAnalytics,
  StockMetrics,
  ForecastingMetrics,
  PerformanceMetrics,
  ConsumptionStatistics,
};