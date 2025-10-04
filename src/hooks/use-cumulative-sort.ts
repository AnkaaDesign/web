import { useState, useCallback } from "react";

export type SortConfig = {
  columnKey: string;
  direction: "asc" | "desc";
};

export interface UseCumulativeSortOptions {
  maxSortColumns?: number;
  onSortChange?: (sortConfigs: SortConfig[]) => void;
}

export function useCumulativeSort(initialSortConfigs: SortConfig[] = [], options: UseCumulativeSortOptions = {}) {
  const { maxSortColumns = 5, onSortChange } = options;
  const [sortConfigs, setSortConfigs] = useState<SortConfig[]>(initialSortConfigs);

  const handleSort = useCallback(
    (columnKey: string) => {
      setSortConfigs((prev) => {
        const existingIndex = prev.findIndex((config) => config.columnKey === columnKey);
        let newConfigs: SortConfig[];

        if (existingIndex !== -1) {
          // Column is already sorted
          const existingConfig = prev[existingIndex];

          if (existingConfig.direction === "asc") {
            // Change to descending and move to front (primary sort)
            const updatedConfig = { ...existingConfig, direction: "desc" as const };
            newConfigs = [updatedConfig, ...prev.filter((config) => config.columnKey !== columnKey)];
          } else {
            // Remove from sorts
            newConfigs = prev.filter((config) => config.columnKey !== columnKey);
          }
        } else {
          // Add new sort as primary (at the beginning)
          const newSort = { columnKey, direction: "asc" as const };

          if (prev.length >= maxSortColumns) {
            // Remove the oldest sort (last one) if we've reached the limit
            newConfigs = [newSort, ...prev.slice(0, maxSortColumns - 1)];
          } else {
            newConfigs = [newSort, ...prev];
          }
        }

        // Call the callback if provided
        onSortChange?.(newConfigs);
        return newConfigs;
      });
    },
    [maxSortColumns, onSortChange],
  );

  const clearSort = useCallback(() => {
    setSortConfigs([]);
    onSortChange?.([]);
  }, [onSortChange]);

  const getSortOrder = useCallback(
    (columnKey: string): number | null => {
      const index = sortConfigs.findIndex((config) => config.columnKey === columnKey);
      return index === -1 ? null : index + 1;
    },
    [sortConfigs],
  );

  const getSortDirection = useCallback(
    (columnKey: string): "asc" | "desc" | null => {
      const config = sortConfigs.find((c) => c.columnKey === columnKey);
      return config?.direction || null;
    },
    [sortConfigs],
  );

  const convertToOrderBy = useCallback(<T extends Record<string, unknown>>(): T => {
    if (sortConfigs.length === 0) return {} as T;

    // Helper function to convert dot notation to nested object
    const createNestedObject = (key: string, value: unknown): Record<string, unknown> => {
      const keys = key.split(".");
      if (keys.length === 1) {
        return { [key]: value };
      }

      const result: Record<string, unknown> = {};
      let current: Record<string, unknown> = result;

      for (let i = 0; i < keys.length - 1; i++) {
        current[keys[i]] = {};
        current = current[keys[i]] as Record<string, unknown>;
      }

      current[keys[keys.length - 1]] = value;
      return result;
    };

    // For paint-related entities, always return as object
    // This avoids serialization issues with the API
    if (sortConfigs.length === 1) {
      const { columnKey, direction } = sortConfigs[0];
      return createNestedObject(columnKey, direction) as T;
    }

    // For multiple sorts, merge them into a single object
    // This ensures compatibility with the API's query parameter handling
    const mergedOrderBy: Record<string, unknown> = {};

    sortConfigs.forEach(({ columnKey, direction }) => {
      const nestedObj = createNestedObject(columnKey, direction);
      // Deep merge the nested objects
      Object.keys(nestedObj).forEach((key) => {
        const nestedValue = nestedObj[key];
        if (typeof nestedValue === "object" && nestedValue !== null && !Array.isArray(nestedValue)) {
          const currentValue = mergedOrderBy[key];
          const currentObj = typeof currentValue === "object" && currentValue !== null && !Array.isArray(currentValue) ? (currentValue as Record<string, unknown>) : {};
          mergedOrderBy[key] = { ...currentObj, ...(nestedValue as Record<string, unknown>) };
        } else {
          mergedOrderBy[key] = nestedValue;
        }
      });
    });

    return mergedOrderBy as T;
  }, [sortConfigs]);

  return {
    sortConfigs,
    handleSort,
    clearSort,
    getSortOrder,
    getSortDirection,
    convertToOrderBy,
    setSortConfigs,
  };
}
