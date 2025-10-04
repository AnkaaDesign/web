import { useState, useCallback, useEffect, useMemo } from "react";
import { DateRange } from "react-day-picker";
import { startOfDay, endOfDay, subDays, subWeeks, subMonths, subQuarters, subYears, startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfQuarter, endOfQuarter, startOfYear, endOfYear } from "date-fns";

import { StatisticsFilters } from "./statistics-filter-bar";

const STORAGE_KEY = "inventory-statistics-filters";
const STORAGE_VERSION = "1.0";

interface StoredFilters extends StatisticsFilters {
  _version?: string;
  _timestamp?: number;
}

interface FilterPreset {
  id: string;
  name: string;
  description: string;
  filters: Partial<StatisticsFilters>;
  isDefault?: boolean;
}

const DEFAULT_FILTERS: StatisticsFilters = {
  dateRange: undefined,
  period: 'month',
  groupBy: 'category',
  metrics: ['totalValue'],
  compareWith: 'none',
  showTrends: false,
  chartType: 'bar',
  aggregationType: 'sum',
  showLabels: true,
  showValues: true,
  showPercentages: false,
};

// Pre-defined filter presets
const FILTER_PRESETS: FilterPreset[] = [
  {
    id: 'default',
    name: 'Padrão',
    description: 'Configuração padrão do sistema',
    filters: DEFAULT_FILTERS,
    isDefault: true,
  },
  {
    id: 'last-30-days',
    name: 'Últimos 30 dias',
    description: 'Análise dos últimos 30 dias por categoria',
    filters: {
      period: 'custom',
      groupBy: 'category',
      metrics: ['totalValue', 'totalItems'],
      chartType: 'bar',
      showTrends: true,
    },
  },
  {
    id: 'monthly-comparison',
    name: 'Comparação Mensal',
    description: 'Comparação com o mês anterior',
    filters: {
      period: 'month',
      groupBy: 'category',
      metrics: ['totalValue'],
      compareWith: 'previous-period',
      chartType: 'line',
      showTrends: true,
    },
  },
  {
    id: 'yearly-overview',
    name: 'Visão Anual',
    description: 'Comparação com o ano anterior por trimestre',
    filters: {
      period: 'year',
      groupBy: 'month',
      metrics: ['totalValue', 'turnoverRate'],
      compareWith: 'previous-year',
      chartType: 'area',
      showTrends: true,
    },
  },
  {
    id: 'supplier-analysis',
    name: 'Análise por Fornecedor',
    description: 'Análise detalhada por fornecedor',
    filters: {
      period: 'quarter',
      groupBy: 'supplier',
      metrics: ['totalValue', 'totalItems', 'averageValue'],
      chartType: 'pie',
      showPercentages: true,
      showValues: true,
    },
  },
  {
    id: 'stock-performance',
    name: 'Performance de Estoque',
    description: 'Métricas de performance e rotatividade',
    filters: {
      period: 'month',
      groupBy: 'category',
      metrics: ['stockLevel', 'turnoverRate', 'activities'],
      chartType: 'bar',
      showTrends: true,
      aggregationType: 'average',
    },
  },
];

export function useStatisticsFilterState(initialFilters?: Partial<StatisticsFilters>) {
  // Generate default date range based on period
  const getDefaultDateRange = useCallback((period: StatisticsFilters['period']): DateRange => {
    const now = new Date();

    switch (period) {
      case 'day':
        return {
          from: startOfDay(now),
          to: endOfDay(now),
        };
      case 'week':
        return {
          from: startOfWeek(now, { weekStartsOn: 1 }),
          to: endOfWeek(now, { weekStartsOn: 1 }),
        };
      case 'month':
        return {
          from: startOfMonth(now),
          to: endOfMonth(now),
        };
      case 'quarter':
        return {
          from: startOfQuarter(now),
          to: endOfQuarter(now),
        };
      case 'year':
        return {
          from: startOfYear(now),
          to: endOfYear(now),
        };
      case 'custom':
      default:
        return {
          from: startOfMonth(now),
          to: endOfMonth(now),
        };
    }
  }, []);

  // Load filters from localStorage or use defaults
  const loadFiltersFromStorage = useCallback((): StatisticsFilters => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        const defaultFilters = { ...DEFAULT_FILTERS };
        defaultFilters.dateRange = getDefaultDateRange(defaultFilters.period);
        return defaultFilters;
      }

      const parsed: StoredFilters = JSON.parse(stored);

      // Check version compatibility
      if (parsed._version !== STORAGE_VERSION) {
        console.warn('Statistics filters version mismatch, using defaults');
        const defaultFilters = { ...DEFAULT_FILTERS };
        defaultFilters.dateRange = getDefaultDateRange(defaultFilters.period);
        return defaultFilters;
      }

      // Check if stored data is too old (older than 7 days)
      const isExpired = parsed._timestamp && (Date.now() - parsed._timestamp) > 7 * 24 * 60 * 60 * 1000;
      if (isExpired) {
        console.info('Statistics filters expired, using defaults');
        const defaultFilters = { ...DEFAULT_FILTERS };
        defaultFilters.dateRange = getDefaultDateRange(defaultFilters.period);
        return defaultFilters;
      }

      // Parse date range if it exists
      if (parsed.dateRange) {
        parsed.dateRange = {
          from: parsed.dateRange.from ? new Date(parsed.dateRange.from) : undefined,
          to: parsed.dateRange.to ? new Date(parsed.dateRange.to) : undefined,
        };
      }

      // Remove storage metadata and return filters
      const { _version, _timestamp, ...filters } = parsed;

      // Ensure date range is set if missing
      if (!filters.dateRange) {
        filters.dateRange = getDefaultDateRange(filters.period);
      }

      return filters as StatisticsFilters;
    } catch (error) {
      console.error('Failed to load statistics filters from storage:', error);
      const defaultFilters = { ...DEFAULT_FILTERS };
      defaultFilters.dateRange = getDefaultDateRange(defaultFilters.period);
      return defaultFilters;
    }
  }, [getDefaultDateRange]);

  // Initialize state
  const [filters, setFilters] = useState<StatisticsFilters>(() => {
    const stored = loadFiltersFromStorage();
    const merged = { ...stored, ...initialFilters };

    // Ensure date range is properly set
    if (!merged.dateRange || (!merged.dateRange.from && !merged.dateRange.to)) {
      merged.dateRange = getDefaultDateRange(merged.period);
    }

    return merged;
  });

  const [originalFilters] = useState(filters);

  // Save filters to localStorage
  const saveFiltersToStorage = useCallback((filtersToSave: StatisticsFilters) => {
    try {
      const toStore: StoredFilters = {
        ...filtersToSave,
        _version: STORAGE_VERSION,
        _timestamp: Date.now(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
    } catch (error) {
      console.error('Failed to save statistics filters to storage:', error);
    }
  }, []);

  // Auto-save filters when they change
  useEffect(() => {
    saveFiltersToStorage(filters);
  }, [filters, saveFiltersToStorage]);

  // Update individual filter
  const updateFilter = useCallback(<K extends keyof StatisticsFilters>(
    key: K,
    value: StatisticsFilters[K]
  ) => {
    setFilters(prev => {
      const updated = { ...prev, [key]: value };

      // Auto-update date range when period changes
      if (key === 'period' && value !== 'custom') {
        updated.dateRange = getDefaultDateRange(value as StatisticsFilters['period']);
      }

      return updated;
    });
  }, [getDefaultDateRange]);

  // Update multiple filters at once
  const updateFilters = useCallback((updates: Partial<StatisticsFilters>) => {
    setFilters(prev => {
      let updated = { ...prev, ...updates };

      // Auto-update date range if period changed and it's not custom
      if (updates.period && updates.period !== 'custom' && !updates.dateRange) {
        updated.dateRange = getDefaultDateRange(updates.period);
      }

      return updated;
    });
  }, [getDefaultDateRange]);

  // Reset to default filters
  const resetFilters = useCallback(() => {
    const defaultFilters = { ...DEFAULT_FILTERS };
    defaultFilters.dateRange = getDefaultDateRange(defaultFilters.period);
    setFilters(defaultFilters);
  }, [getDefaultDateRange]);

  // Apply a preset
  const applyPreset = useCallback((presetId: string) => {
    const preset = FILTER_PRESETS.find(p => p.id === presetId);
    if (!preset) {
      console.warn(`Preset with id "${presetId}" not found`);
      return;
    }

    const presetFilters = { ...DEFAULT_FILTERS, ...preset.filters };

    // Generate appropriate date range for the preset
    if (!presetFilters.dateRange) {
      if (presetId === 'last-30-days') {
        presetFilters.dateRange = {
          from: startOfDay(subDays(new Date(), 29)),
          to: endOfDay(new Date()),
        };
      } else {
        presetFilters.dateRange = getDefaultDateRange(presetFilters.period);
      }
    }

    setFilters(presetFilters);
  }, [getDefaultDateRange]);

  // Check if current filters match a preset
  const currentPreset = useMemo(() => {
    return FILTER_PRESETS.find(preset => {
      const presetFilters = { ...DEFAULT_FILTERS, ...preset.filters };

      // Compare relevant fields (excluding dateRange for most presets)
      const fieldsToCompare: (keyof StatisticsFilters)[] = [
        'period', 'groupBy', 'metrics', 'compareWith', 'showTrends',
        'chartType', 'aggregationType', 'showLabels', 'showValues', 'showPercentages'
      ];

      return fieldsToCompare.every(field => {
        if (field === 'metrics') {
          // Special handling for arrays
          const currentMetrics = filters[field] || [];
          const presetMetrics = presetFilters[field] || [];
          return JSON.stringify(currentMetrics.sort()) === JSON.stringify(presetMetrics.sort());
        }
        return filters[field] === presetFilters[field];
      });
    });
  }, [filters]);

  // Count active filters (non-default values)
  const activeFilterCount = useMemo(() => {
    let count = 0;

    if (filters.period !== DEFAULT_FILTERS.period) count++;
    if (filters.dateRange?.from || filters.dateRange?.to) count++;
    if (filters.groupBy !== DEFAULT_FILTERS.groupBy) count++;
    if (JSON.stringify(filters.metrics) !== JSON.stringify(DEFAULT_FILTERS.metrics)) count++;
    if (filters.compareWith !== DEFAULT_FILTERS.compareWith) count++;
    if (filters.showTrends !== DEFAULT_FILTERS.showTrends) count++;
    if (filters.chartType !== DEFAULT_FILTERS.chartType) count++;
    if (filters.aggregationType !== DEFAULT_FILTERS.aggregationType) count++;
    if (filters.showLabels !== DEFAULT_FILTERS.showLabels) count++;
    if (filters.showValues !== DEFAULT_FILTERS.showValues) count++;
    if (filters.showPercentages !== DEFAULT_FILTERS.showPercentages) count++;

    // Entity filters
    if (filters.categoryIds?.length) count++;
    if (filters.brandIds?.length) count++;
    if (filters.supplierIds?.length) count++;
    if (filters.userIds?.length) count++;
    if (filters.sectorIds?.length) count++;

    return count;
  }, [filters]);

  // Check if there are unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    return JSON.stringify(filters) !== JSON.stringify(originalFilters);
  }, [filters, originalFilters]);

  // Clear storage
  const clearStorage = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear statistics filters storage:', error);
    }
  }, []);

  return {
    // Current state
    filters,
    activeFilterCount,
    hasUnsavedChanges,
    currentPreset,

    // Actions
    updateFilter,
    updateFilters,
    resetFilters,
    applyPreset,
    clearStorage,

    // Presets
    presets: FILTER_PRESETS,

    // Utilities
    getDefaultDateRange,
  };
}