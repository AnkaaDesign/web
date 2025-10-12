import type { StatisticsFilters } from '../../api-client/statistics-inventory.service';

/**
 * Query Builder Utility
 * Builds type-safe query parameters for statistics API requests
 */

/**
 * Build query parameters from statistics filters
 * Converts StatisticsFilters object to API query parameters
 */
export const buildStatisticsQueryParams = (filters: StatisticsFilters): Record<string, any> => {
  const params: Record<string, any> = {};

  // Date range parameters
  if (filters.dateRange) {
    params.dateFrom = filters.dateRange.from.toISOString();
    params.dateTo = filters.dateRange.to.toISOString();
  }

  // Period parameter (exclude if custom)
  if (filters.period && filters.period !== 'custom') {
    params.period = filters.period;
  }

  // Entity filter parameters
  if (filters.categoryId) params.categoryId = filters.categoryId;
  if (filters.brandId) params.brandId = filters.brandId;
  if (filters.supplierId) params.supplierId = filters.supplierId;
  if (filters.userId) params.userId = filters.userId;
  if (filters.sectorId) params.sectorId = filters.sectorId;
  if (filters.itemId) params.itemId = filters.itemId;

  return params;
};

/**
 * Build pagination parameters
 */
export const buildPaginationParams = (page: number = 1, limit: number = 50): Record<string, number> => {
  return {
    page: Math.max(1, page),
    limit: Math.max(1, Math.min(1000, limit)), // Cap at 1000
  };
};

/**
 * Build sorting parameters
 */
export const buildSortParams = (sortBy: string, sortOrder: 'asc' | 'desc' = 'desc'): Record<string, string> => {
  return {
    sortBy,
    sortOrder,
  };
};

/**
 * Merge multiple parameter objects safely
 */
export const mergeQueryParams = (...params: Record<string, any>[]): Record<string, any> => {
  return params.reduce((acc, curr) => {
    return { ...acc, ...curr };
  }, {});
};

/**
 * Remove null and undefined values from query parameters
 */
export const cleanQueryParams = (params: Record<string, any>): Record<string, any> => {
  return Object.entries(params).reduce((acc, [key, value]) => {
    if (value !== null && value !== undefined) {
      acc[key] = value;
    }
    return acc;
  }, {} as Record<string, any>);
};

/**
 * Build cache key from filters for React Query
 */
export const buildStatisticsCacheKey = (
  namespace: string,
  endpoint: string,
  filters: StatisticsFilters
): string[] => {
  return [
    'statistics',
    namespace,
    endpoint,
    JSON.stringify(filters),
  ];
};

/**
 * Validate date range
 */
export const validateDateRange = (dateRange: { from: Date; to: Date }): boolean => {
  const { from, to } = dateRange;

  if (!(from instanceof Date) || !(to instanceof Date)) {
    return false;
  }

  if (isNaN(from.getTime()) || isNaN(to.getTime())) {
    return false;
  }

  if (from > to) {
    return false;
  }

  // Check if range is not too large (e.g., max 2 years)
  const maxRangeMs = 2 * 365 * 24 * 60 * 60 * 1000; // 2 years
  if (to.getTime() - from.getTime() > maxRangeMs) {
    return false;
  }

  return true;
};

/**
 * Build URL search params from filters (for URL state management)
 */
export const filtersToURLParams = (filters: StatisticsFilters): URLSearchParams => {
  const params = new URLSearchParams();

  if (filters.dateRange) {
    params.set('from', filters.dateRange.from.toISOString());
    params.set('to', filters.dateRange.to.toISOString());
  }

  if (filters.period) params.set('period', filters.period);
  if (filters.categoryId) params.set('categoryId', filters.categoryId);
  if (filters.brandId) params.set('brandId', filters.brandId);
  if (filters.supplierId) params.set('supplierId', filters.supplierId);
  if (filters.userId) params.set('userId', filters.userId);
  if (filters.sectorId) params.set('sectorId', filters.sectorId);
  if (filters.itemId) params.set('itemId', filters.itemId);

  return params;
};

/**
 * Parse filters from URL search params
 */
export const filtersFromURLParams = (params: URLSearchParams): Partial<StatisticsFilters> => {
  const filters: Partial<StatisticsFilters> = {};

  const from = params.get('from');
  const to = params.get('to');
  if (from && to) {
    try {
      filters.dateRange = {
        from: new Date(from),
        to: new Date(to),
      };
    } catch (e) {
      // Invalid date, skip
    }
  }

  const period = params.get('period');
  if (period && ['day', 'week', 'month', 'quarter', 'year', 'custom'].includes(period)) {
    filters.period = period as StatisticsFilters['period'];
  }

  const categoryId = params.get('categoryId');
  if (categoryId) filters.categoryId = categoryId;

  const brandId = params.get('brandId');
  if (brandId) filters.brandId = brandId;

  const supplierId = params.get('supplierId');
  if (supplierId) filters.supplierId = supplierId;

  const userId = params.get('userId');
  if (userId) filters.userId = userId;

  const sectorId = params.get('sectorId');
  if (sectorId) filters.sectorId = sectorId;

  const itemId = params.get('itemId');
  if (itemId) filters.itemId = itemId;

  return filters;
};

/**
 * Compare two filter objects for equality
 */
export const areFiltersEqual = (
  filters1: StatisticsFilters,
  filters2: StatisticsFilters
): boolean => {
  return JSON.stringify(filters1) === JSON.stringify(filters2);
};

/**
 * Get a human-readable description of filters
 */
export const getFiltersDescription = (filters: StatisticsFilters): string => {
  const parts: string[] = [];

  if (filters.dateRange) {
    const from = filters.dateRange.from.toLocaleDateString('pt-BR');
    const to = filters.dateRange.to.toLocaleDateString('pt-BR');
    parts.push(`${from} - ${to}`);
  }

  if (filters.period && filters.period !== 'custom') {
    const periodLabels: Record<string, string> = {
      day: 'Diário',
      week: 'Semanal',
      month: 'Mensal',
      quarter: 'Trimestral',
      year: 'Anual',
    };
    parts.push(periodLabels[filters.period] || filters.period);
  }

  return parts.join(' | ') || 'Todos os períodos';
};
