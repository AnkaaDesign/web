import { useState, useCallback, useEffect, useMemo } from "react";

export interface ColumnWidthConfig {
  [columnId: string]: number;
}

interface UseColumnWidthsOptions {
  storageKey: string;
  defaultWidths: ColumnWidthConfig;
}

interface UseColumnWidthsReturn {
  /** Current column widths */
  columnWidths: ColumnWidthConfig;
  /** Update a single column width */
  setColumnWidth: (columnId: string, width: number) => void;
  /** Get width for a specific column (returns default if not set) */
  getColumnWidth: (columnId: string) => number;
  /** Reset all widths to defaults */
  resetToDefaults: () => void;
  /** Reset a single column to its default width */
  resetColumnWidth: (columnId: string) => void;
}

/**
 * Hook for managing resizable table column widths with localStorage persistence.
 *
 * Features:
 * - Persists column widths to localStorage
 * - Falls back to default widths when not set
 * - Provides individual and bulk reset functionality
 *
 * @example
 * ```tsx
 * const { columnWidths, setColumnWidth, getColumnWidth } = useColumnWidths({
 *   storageKey: "my-table-column-widths",
 *   defaultWidths: {
 *     name: 200,
 *     customer: 150,
 *     date: 120,
 *   },
 * });
 *
 * // In your table header
 * <ColumnHeader
 *   resizable
 *   width={getColumnWidth("name")}
 *   onResize={(width) => setColumnWidth("name", width)}
 * >
 *   Name
 * </ColumnHeader>
 * ```
 */
export function useColumnWidths({
  storageKey,
  defaultWidths,
}: UseColumnWidthsOptions): UseColumnWidthsReturn {
  // Initialize from localStorage or use empty object (defaults will be used via getColumnWidth)
  const [columnWidths, setColumnWidths] = useState<ColumnWidthConfig>(() => {
    if (typeof window === "undefined") return {};

    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Validate that it's an object with number values
        if (typeof parsed === "object" && parsed !== null) {
          const validated: ColumnWidthConfig = {};
          for (const [key, value] of Object.entries(parsed)) {
            if (typeof value === "number" && value > 0) {
              validated[key] = value;
            }
          }
          return validated;
        }
      }
    } catch (error) {
      console.error(`[useColumnWidths] Failed to load from localStorage (${storageKey}):`, error);
    }

    return {};
  });

  // Persist to localStorage when widths change
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      // Only save non-empty objects
      if (Object.keys(columnWidths).length > 0) {
        localStorage.setItem(storageKey, JSON.stringify(columnWidths));
      } else {
        // Remove from storage if empty (using defaults)
        localStorage.removeItem(storageKey);
      }
    } catch (error) {
      console.error(`[useColumnWidths] Failed to save to localStorage (${storageKey}):`, error);
    }
  }, [columnWidths, storageKey]);

  // Update a single column width
  const setColumnWidth = useCallback((columnId: string, width: number) => {
    const roundedWidth = Math.max(50, Math.round(width));
    setColumnWidths((prev) => ({
      ...prev,
      [columnId]: roundedWidth,
    }));
  }, []);

  // Get width for a specific column (falls back to default)
  const getColumnWidth = useCallback(
    (columnId: string): number => {
      return columnWidths[columnId] ?? defaultWidths[columnId] ?? 150; // Ultimate fallback: 150px
    },
    [columnWidths, defaultWidths]
  );

  // Reset all widths to defaults
  const resetToDefaults = useCallback(() => {
    setColumnWidths({});
  }, []);

  // Reset a single column to its default width
  const resetColumnWidth = useCallback((columnId: string) => {
    setColumnWidths((prev) => {
      const { [columnId]: _, ...rest } = prev;
      return rest;
    });
  }, []);

  return {
    columnWidths,
    setColumnWidth,
    getColumnWidth,
    resetToDefaults,
    resetColumnWidth,
  };
}

/**
 * Default column widths based on common column types.
 * These provide sensible defaults that work well for most use cases.
 */
export const DEFAULT_COLUMN_WIDTHS: Record<string, number> = {
  // Checkbox column
  checkbox: 48,

  // Name/text columns
  name: 200,
  "customer.fantasyName": 180,
  "negotiatingWith.name": 150,
  "invoiceTo.fantasyName": 150,
  details: 200,
  observation: 200,

  // Identifier columns
  identificador: 140,
  chassisNumber: 140,

  // Date columns
  forecastDate: 120,
  entryDate: 120,
  startedAt: 120,
  finishedAt: 140,
  term: 120,
  duration: 120,

  // Numeric/measure columns
  measures: 120,
  price: 120,

  // Status/badge columns
  "sector.name": 140,
  truckCategory: 160,
  commission: 140,
  generalPainting: 140,

  // Service order columns
  serviceOrders: 200,
  "serviceOrders.commercial": 100,
  "serviceOrders.logistic": 100,
  "serviceOrders.artwork": 100,
  "serviceOrders.production": 100,
  "serviceOrders.financial": 100,
};

/**
 * Min/Max constraints for column widths
 */
export const COLUMN_WIDTH_CONSTRAINTS = {
  minWidth: 60,
  maxWidth: 600,
} as const;
