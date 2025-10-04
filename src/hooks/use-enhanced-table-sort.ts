import { useCallback, useMemo } from "react";
import { TableSortUtils, SortConfig, SortableColumnConfig, CustomSortFunction, customSortFunctions } from "@/utils/table-sort-utils";

/**
 * Enhanced sort configuration interface
 */
export interface EnhancedSortConfig extends SortConfig {
  customSortFunction?: CustomSortFunction;
  nullHandling?: "first" | "last" | "default";
}

/**
 * Options for the enhanced table sort hook
 */
export interface UseEnhancedTableSortOptions {
  // Column configurations
  columns: SortableColumnConfig[];

  // Current sort state
  sortConfigs: SortConfig[];

  // Sort update functions
  onSortChange: (sortConfigs: SortConfig[]) => void;

  // Features
  enableMultiSort?: boolean;
  enableCustomSorts?: boolean;
  maxSortColumns?: number;

  // Backend integration
  enableServerSort?: boolean;
  onServerSort?: (sortConfigs: SortConfig[]) => void;

  // UI feedback
  enableOptimisticSort?: boolean;
  onOptimisticSort?: (data: any[]) => void;
}

/**
 * Enhanced table sort hook that provides comprehensive sorting functionality
 */
export function useEnhancedTableSort(options: UseEnhancedTableSortOptions) {
  const {
    columns,
    sortConfigs,
    onSortChange,
    enableMultiSort = true,
    enableCustomSorts = true,
    maxSortColumns = 5,
    enableServerSort = false,
    onServerSort,
    enableOptimisticSort = true,
    onOptimisticSort,
  } = options;

  // Create column configuration map for efficient lookups
  const columnConfigMap = useMemo(() => {
    return new Map(columns.map((col) => [col.key, col]));
  }, [columns]);

  // Get all sortable columns
  const sortableColumns = useMemo(() => {
    return columns.filter((col) => col.sortable !== false);
  }, [columns]);

  // Enhanced toggle sort function that supports advanced features
  const toggleSort = useCallback(
    (column: string, event?: React.MouseEvent) => {
      const columnConfig = columnConfigMap.get(column);
      if (!columnConfig) return;

      // Determine if multi-sort should be enabled
      const ctrlKey = event?.ctrlKey || event?.metaKey || false;
      const shiftKey = event?.shiftKey || false;
      const enableMulti = enableMultiSort && (ctrlKey || sortConfigs.length > 1);

      // Calculate new sort configurations
      const newSortConfigs = TableSortUtils.toggleColumnSort(sortConfigs, column, {
        multiSort: enableMulti,
        ctrlKey,
        shiftKey,
      });

      // Respect max sort columns limit
      const limitedSortConfigs = newSortConfigs.slice(0, maxSortColumns);

      // Update sort state
      onSortChange(limitedSortConfigs);

      // Trigger server sort if enabled
      if (enableServerSort && onServerSort) {
        onServerSort(limitedSortConfigs);
      }
    },
    [columnConfigMap, enableMultiSort, sortConfigs, maxSortColumns, onSortChange, enableServerSort, onServerSort],
  );

  // Clear sort for a specific column or all columns
  const clearSort = useCallback(
    (column?: string) => {
      const newSortConfigs = TableSortUtils.clearSort(sortConfigs, column);
      onSortChange(newSortConfigs);

      if (enableServerSort && onServerSort) {
        onServerSort(newSortConfigs);
      }
    },
    [sortConfigs, onSortChange, enableServerSort, onServerSort],
  );

  // Set multiple sort configurations at once
  const setSortConfigs = useCallback(
    (newSortConfigs: SortConfig[]) => {
      const validConfigs = newSortConfigs.filter(TableSortUtils.validateSortConfig).slice(0, maxSortColumns);

      onSortChange(validConfigs);

      if (enableServerSort && onServerSort) {
        onServerSort(validConfigs);
      }
    },
    [maxSortColumns, onSortChange, enableServerSort, onServerSort],
  );

  // Sort data using current sort configurations
  const sortData = useCallback(
    <T>(data: T[]): T[] => {
      if (!data || data.length === 0 || sortConfigs.length === 0) {
        return data;
      }

      // Use optimistic sorting for immediate UI feedback
      if (enableOptimisticSort) {
        const sortedData = TableSortUtils.sortItems(data, sortConfigs, columnConfigMap);
        onOptimisticSort?.(sortedData);
        return sortedData;
      }

      return TableSortUtils.sortItems(data, sortConfigs, columnConfigMap);
    },
    [sortConfigs, columnConfigMap, enableOptimisticSort, onOptimisticSort],
  );

  // Get sort direction for a column
  const getSortDirection = useCallback(
    (column: string) => {
      return TableSortUtils.getSortDirection(sortConfigs, column);
    },
    [sortConfigs],
  );

  // Get sort order for a column
  const getSortOrder = useCallback(
    (column: string) => {
      return TableSortUtils.getSortOrder(sortConfigs, column);
    },
    [sortConfigs],
  );

  // Get sort configuration for a column
  const getSortConfig = useCallback(
    (column: string) => {
      return TableSortUtils.getSortConfig(sortConfigs, column);
    },
    [sortConfigs],
  );

  // Check if any sorts are active
  const hasActiveSort = useCallback(
    (column?: string) => {
      return TableSortUtils.hasActiveSort(sortConfigs, column);
    },
    [sortConfigs],
  );

  // Get actively sorted columns
  const getActiveSortColumns = useCallback(() => {
    return TableSortUtils.getActiveSortColumns(sortConfigs);
  }, [sortConfigs]);

  // Get column labels for display
  const getColumnLabels = useCallback(() => {
    const labels: Record<string, string> = {};
    columns.forEach((col) => {
      labels[col.key] = col.header;
    });
    return labels;
  }, [columns]);

  // Create sort preset
  const createSortPreset = useCallback(
    (name: string) => {
      return {
        name,
        sortConfigs: [...sortConfigs],
        createdAt: new Date(),
      };
    },
    [sortConfigs],
  );

  // Apply sort preset
  const applySortPreset = useCallback(
    (preset: { sortConfigs: SortConfig[] }) => {
      setSortConfigs(preset.sortConfigs);
    },
    [setSortConfigs],
  );

  // Advanced sort functions with Brazilian context
  const getBrazilianSortFunction = useCallback((type: keyof typeof customSortFunctions) => {
    return customSortFunctions[type];
  }, []);

  // Auto-detect sort function based on column data type
  const getAutoSortFunction = useCallback(
    (column: string, sampleData?: any[]) => {
      const columnConfig = columnConfigMap.get(column);

      if (columnConfig?.customSortFunction) {
        return columnConfig.customSortFunction;
      }

      if (columnConfig?.dataType) {
        switch (columnConfig.dataType) {
          case "date":
            return customSortFunctions.date;
          case "number":
            return customSortFunctions.quantity;
          case "boolean":
            return customSortFunctions.priority;
          default:
            return undefined;
        }
      }

      // Auto-detect from sample data
      if (sampleData && sampleData.length > 0) {
        const accessor = columnConfig?.accessor || column;
        const sampleValue = TableSortUtils.getValue(sampleData[0], accessor);

        if (sampleValue instanceof Date || (typeof sampleValue === "string" && sampleValue.match(/^\d{4}-\d{2}-\d{2}/))) {
          return customSortFunctions.date;
        }

        if (typeof sampleValue === "number") {
          return customSortFunctions.quantity;
        }

        if (typeof sampleValue === "string" && sampleValue.match(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/)) {
          return customSortFunctions.cpf;
        }

        if (typeof sampleValue === "string" && sampleValue.match(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/)) {
          return customSortFunctions.cnpj;
        }
      }

      return undefined;
    },
    [columnConfigMap],
  );

  // Convert sort to URL format
  const serializeSortForUrl = useCallback(() => {
    return TableSortUtils.serializeSortForUrl(sortConfigs);
  }, [sortConfigs]);

  // Parse sort from URL format
  const parseSortFromUrl = useCallback((urlParam: string | null) => {
    return TableSortUtils.parseSortFromUrl(urlParam);
  }, []);

  // Get sort summary for display
  const getSortSummary = useCallback(() => {
    if (sortConfigs.length === 0) return null;

    const columnLabels = getColumnLabels();
    return {
      columns: sortConfigs.map((config) => ({
        ...config,
        label: columnLabels[config.column] || config.column,
      })),
      count: sortConfigs.length,
      hasMultiple: sortConfigs.length > 1,
    };
  }, [sortConfigs, getColumnLabels]);

  // Check if sort configuration is valid
  const validateSortConfig = useCallback(
    (config: SortConfig) => {
      return TableSortUtils.validateSortConfig(config) && columnConfigMap.has(config.column);
    },
    [columnConfigMap],
  );

  // Memoized derived state
  const derivedState = useMemo(
    () => ({
      activeSortColumns: getActiveSortColumns(),
      hasMultipleSort: sortConfigs.length > 1,
      canAddMoreSort: sortConfigs.length < maxSortColumns,
      sortSummary: getSortSummary(),
    }),
    [getActiveSortColumns, sortConfigs.length, maxSortColumns, getSortSummary],
  );

  return {
    // State
    sortConfigs,
    activeSortColumns: derivedState.activeSortColumns,
    hasMultipleSort: derivedState.hasMultipleSort,
    canAddMoreSort: derivedState.canAddMoreSort,
    sortSummary: derivedState.sortSummary,

    // Configuration
    sortableColumns,
    columnConfigMap,
    maxSortColumns,

    // Actions
    toggleSort,
    clearSort,
    setSortConfigs,
    sortData,

    // Getters
    getSortDirection,
    getSortOrder,
    getSortConfig,
    hasActiveSort,
    getActiveSortColumns,
    getColumnLabels,

    // Advanced features
    createSortPreset,
    applySortPreset,
    getBrazilianSortFunction,
    getAutoSortFunction,

    // URL integration
    serializeSortForUrl,
    parseSortFromUrl,

    // Utilities
    validateSortConfig,
  };
}
