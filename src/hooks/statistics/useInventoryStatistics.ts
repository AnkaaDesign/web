import { useQuery, useMutation, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import { statisticsInventoryService } from '../../api-client/statistics-inventory.service';
import type {
  StatisticsFilters,
  InventoryOverview,
  StockLevelsData,
  ConsumptionTrend,
  CategoryPerformance,
  ItemMovementData,
  StockValuation,
  StockHealthReport,
  ApiResponse,
} from '../../api-client/statistics-inventory.service';

// =====================
// Query Keys
// =====================

export const inventoryStatisticsKeys = {
  all: ['statistics', 'inventory'] as const,
  overview: (filters: StatisticsFilters) => [...inventoryStatisticsKeys.all, 'overview', filters] as const,
  stockLevels: (filters: StatisticsFilters) => [...inventoryStatisticsKeys.all, 'stock-levels', filters] as const,
  consumptionTrends: (filters: StatisticsFilters) => [...inventoryStatisticsKeys.all, 'consumption-trends', filters] as const,
  categoryPerformance: (filters: StatisticsFilters) => [...inventoryStatisticsKeys.all, 'category-performance', filters] as const,
  itemMovements: (filters: StatisticsFilters, limit: number) => [...inventoryStatisticsKeys.all, 'item-movements', filters, limit] as const,
  stockValuation: (filters: StatisticsFilters) => [...inventoryStatisticsKeys.all, 'stock-valuation', filters] as const,
  stockHealth: (filters: StatisticsFilters) => [...inventoryStatisticsKeys.all, 'stock-health', filters] as const,
};

// =====================
// Hooks
// =====================

/**
 * Hook to fetch inventory overview statistics
 * @param filters - Date range and entity filters
 * @param options - TanStack Query options
 */
export const useInventoryOverview = (
  filters: StatisticsFilters,
  options?: Omit<UseQueryOptions<ApiResponse<InventoryOverview>, Error>, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey: inventoryStatisticsKeys.overview(filters),
    queryFn: () => statisticsInventoryService.getOverview(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 2,
    ...options,
  });
};

/**
 * Hook to fetch stock levels and distribution
 * @param filters - Date range and entity filters
 * @param options - TanStack Query options
 */
export const useStockLevels = (
  filters: StatisticsFilters,
  options?: Omit<UseQueryOptions<ApiResponse<StockLevelsData>, Error>, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey: inventoryStatisticsKeys.stockLevels(filters),
    queryFn: () => statisticsInventoryService.getStockLevels(filters),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 2,
    ...options,
  });
};

/**
 * Hook to fetch consumption trends over time
 * @param filters - Date range and entity filters
 * @param options - TanStack Query options
 */
export const useConsumptionTrends = (
  filters: StatisticsFilters,
  options?: Omit<UseQueryOptions<ApiResponse<ConsumptionTrend[]>, Error>, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey: inventoryStatisticsKeys.consumptionTrends(filters),
    queryFn: () => statisticsInventoryService.getConsumptionTrends(filters),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 2,
    ...options,
  });
};

/**
 * Hook to fetch category performance metrics
 * @param filters - Date range and entity filters
 * @param options - TanStack Query options
 */
export const useCategoryPerformance = (
  filters: StatisticsFilters,
  options?: Omit<UseQueryOptions<ApiResponse<CategoryPerformance[]>, Error>, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey: inventoryStatisticsKeys.categoryPerformance(filters),
    queryFn: () => statisticsInventoryService.getCategoryPerformance(filters),
    staleTime: 10 * 60 * 1000, // 10 minutes (less volatile)
    gcTime: 20 * 60 * 1000,
    retry: 2,
    ...options,
  });
};

/**
 * Hook to fetch item movement data
 * @param filters - Date range and entity filters
 * @param limit - Maximum number of items to return
 * @param options - TanStack Query options
 */
export const useItemMovements = (
  filters: StatisticsFilters,
  limit: number = 50,
  options?: Omit<UseQueryOptions<ApiResponse<ItemMovementData[]>, Error>, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey: inventoryStatisticsKeys.itemMovements(filters, limit),
    queryFn: () => statisticsInventoryService.getItemMovements(filters, limit),
    staleTime: 3 * 60 * 1000, // 3 minutes (more volatile)
    gcTime: 10 * 60 * 1000,
    retry: 2,
    ...options,
  });
};

/**
 * Hook to fetch stock valuation details
 * @param filters - Date range and entity filters
 * @param options - TanStack Query options
 */
export const useStockValuation = (
  filters: StatisticsFilters,
  options?: Omit<UseQueryOptions<ApiResponse<StockValuation>, Error>, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey: inventoryStatisticsKeys.stockValuation(filters),
    queryFn: () => statisticsInventoryService.getStockValuation(filters),
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 20 * 60 * 1000,
    retry: 2,
    ...options,
  });
};

/**
 * Hook to fetch stock health report with recommendations
 * @param filters - Date range and entity filters
 * @param options - TanStack Query options
 */
export const useStockHealth = (
  filters: StatisticsFilters,
  options?: Omit<UseQueryOptions<ApiResponse<StockHealthReport>, Error>, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey: inventoryStatisticsKeys.stockHealth(filters),
    queryFn: () => statisticsInventoryService.getStockHealth(filters),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 2,
    ...options,
  });
};

/**
 * Hook to export inventory statistics
 * Uses mutation since it's a non-idempotent action that downloads a file
 */
export const useExportInventoryStatistics = () => {
  return useMutation({
    mutationFn: ({
      filters,
      format = 'xlsx',
    }: {
      filters: StatisticsFilters;
      format?: 'csv' | 'xlsx' | 'pdf';
    }) => statisticsInventoryService.exportStatistics(filters, format),
    onSuccess: (blob, variables) => {
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `inventory-statistics-${new Date().toISOString().split('T')[0]}.${variables.format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    },
  });
};

/**
 * Hook to invalidate all inventory statistics queries
 * Useful when data changes and cache needs to be refreshed
 */
export const useInvalidateInventoryStatistics = () => {
  const queryClient = useQueryClient();

  return {
    invalidateAll: () => {
      queryClient.invalidateQueries({ queryKey: inventoryStatisticsKeys.all });
    },
    invalidateOverview: (filters?: StatisticsFilters) => {
      if (filters) {
        queryClient.invalidateQueries({ queryKey: inventoryStatisticsKeys.overview(filters) });
      } else {
        queryClient.invalidateQueries({ queryKey: [...inventoryStatisticsKeys.all, 'overview'] });
      }
    },
    invalidateStockLevels: (filters?: StatisticsFilters) => {
      if (filters) {
        queryClient.invalidateQueries({ queryKey: inventoryStatisticsKeys.stockLevels(filters) });
      } else {
        queryClient.invalidateQueries({ queryKey: [...inventoryStatisticsKeys.all, 'stock-levels'] });
      }
    },
  };
};

/**
 * Combined hook to fetch multiple inventory statistics at once
 * More efficient than calling multiple hooks separately
 */
export const useInventoryStatistics = (filters: StatisticsFilters) => {
  const overview = useInventoryOverview(filters);
  const stockLevels = useStockLevels(filters);
  const consumptionTrends = useConsumptionTrends(filters);
  const stockHealth = useStockHealth(filters);

  return {
    overview,
    stockLevels,
    consumptionTrends,
    stockHealth,
    isLoading: overview.isLoading || stockLevels.isLoading || consumptionTrends.isLoading || stockHealth.isLoading,
    isError: overview.isError || stockLevels.isError || consumptionTrends.isError || stockHealth.isError,
    error: overview.error || stockLevels.error || consumptionTrends.error || stockHealth.error,
  };
};

// Export types
export type { StatisticsFilters, InventoryOverview, StockLevelsData, ConsumptionTrend, CategoryPerformance, ItemMovementData, StockValuation, StockHealthReport };
