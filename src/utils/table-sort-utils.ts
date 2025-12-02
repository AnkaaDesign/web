import { type ReactNode } from "react";

/**
 * Sort direction type
 */
export type SortDirection = "asc" | "desc";

/**
 * Sort configuration for a single column
 */
export interface SortConfig {
  column: string;
  direction: SortDirection;
  order?: number;
}

/**
 * Custom sort function type
 */
export type CustomSortFunction<T = any> = (a: T, b: T, direction: SortDirection) => number;

/**
 * Sort column configuration with enhanced features
 */
export interface SortableColumnConfig {
  key: string;
  header: string;
  sortable?: boolean;
  customSortFunction?: CustomSortFunction;
  nullHandling?: "first" | "last" | "default";
  dataType?: "string" | "number" | "date" | "boolean" | "custom";
  accessor?: string | ((item: any) => any);
  className?: string;
  align?: "left" | "center" | "right";
  icon?: ReactNode;
  tooltip?: string;
}

/**
 * Sort state management interface
 */
export interface SortState {
  sortConfigs: SortConfig[];
  setSortConfigs: (configs: SortConfig[]) => void;
  toggleSort: (column: string, options?: ToggleSortOptions) => void;
  clearSort: (column?: string) => void;
  getSortDirection: (column: string) => SortDirection | null;
  getSortOrder: (column: string) => number | null;
  getSortConfig: (column: string) => SortConfig | null;
  hasSort: (column?: string) => boolean;
  getActiveSortColumns: () => string[];
}

/**
 * Options for toggling sort
 */
export interface ToggleSortOptions {
  multiSort?: boolean;
  replaceExisting?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
}

/**
 * Enhanced sort utilities for handling complex sorting scenarios
 */
export class TableSortUtils {
  /**
   * Get the value from an item using an accessor
   */
  static getValue(item: any, accessor: string | ((item: any) => any)): any {
    if (typeof accessor === "function") {
      return accessor(item);
    }

    if (typeof accessor === "string") {
      // Support nested properties like "user.name" or "items[0].title"
      return accessor.split(".").reduce((obj, key) => {
        if (obj == null) return null;

        // Handle array indices like "items[0]"
        const arrayMatch = key.match(/^(.+)\[(\d+)\]$/);
        if (arrayMatch) {
          const [, prop, index] = arrayMatch;
          return obj[prop]?.[parseInt(index, 10)];
        }

        return obj[key];
      }, item);
    }

    return item[accessor];
  }

  /**
   * Compare two values with proper null/undefined handling
   */
  static compareValues(a: any, b: any, direction: SortDirection, nullHandling: "first" | "last" | "default" = "default"): number {
    // Handle null/undefined values
    const aIsNullish = a === null || a === undefined || a === "";
    const bIsNullish = b === null || b === undefined || b === "";

    if (aIsNullish && bIsNullish) return 0;

    if (aIsNullish) {
      switch (nullHandling) {
        case "first":
          return direction === "asc" ? -1 : 1;
        case "last":
          return direction === "asc" ? 1 : -1;
        case "default":
          return -1;
      }
    }

    if (bIsNullish) {
      switch (nullHandling) {
        case "first":
          return direction === "asc" ? 1 : -1;
        case "last":
          return direction === "asc" ? -1 : 1;
        case "default":
          return 1;
      }
    }

    // Convert values for comparison
    const normalizedA = this.normalizeValue(a);
    const normalizedB = this.normalizeValue(b);

    // Compare normalized values
    if (normalizedA < normalizedB) {
      return direction === "asc" ? -1 : 1;
    }
    if (normalizedA > normalizedB) {
      return direction === "asc" ? 1 : -1;
    }
    return 0;
  }

  /**
   * Normalize values for comparison
   */
  static normalizeValue(value: any): any {
    if (value === null || value === undefined) return "";

    // Handle dates
    if (value instanceof Date) {
      return value.getTime();
    }

    // Handle date strings
    if (typeof value === "string" && value.match(/^\d{4}-\d{2}-\d{2}/)) {
      return new Date(value).getTime();
    }

    // Handle numbers as strings
    if (typeof value === "string" && !isNaN(Number(value))) {
      return Number(value);
    }

    // Handle booleans
    if (typeof value === "boolean") {
      return value ? 1 : 0;
    }

    // Handle strings (case-insensitive)
    if (typeof value === "string") {
      return value.toLowerCase();
    }

    return value;
  }

  /**
   * Sort an array of items using multiple sort configurations
   */
  static sortItems<T>(items: T[], sortConfigs: SortConfig[], columnConfigs: Map<string, SortableColumnConfig>): T[] {
    if (!items || items.length === 0 || sortConfigs.length === 0) {
      return items;
    }

    return [...items].sort((a, b) => {
      for (const sortConfig of sortConfigs) {
        const columnConfig = columnConfigs.get(sortConfig.column);

        if (!columnConfig) continue;

        let result = 0;

        // Use custom sort function if provided
        if (columnConfig.customSortFunction) {
          result = columnConfig.customSortFunction(a, b, sortConfig.direction);
        } else {
          // Get values using accessor
          const accessor = columnConfig.accessor || columnConfig.key;
          const aValue = this.getValue(a, accessor);
          const bValue = this.getValue(b, accessor);

          // Use built-in comparison with null handling
          result = this.compareValues(aValue, bValue, sortConfig.direction, columnConfig.nullHandling);
        }

        // If not equal, return the result
        if (result !== 0) {
          return result;
        }
      }

      // If all sort configs result in equality, maintain original order
      return 0;
    });
  }

  /**
   * Toggle sort for a column with advanced options
   */
  static toggleColumnSort(currentSortConfigs: SortConfig[], column: string, options: ToggleSortOptions = {}): SortConfig[] {
    const { multiSort = false, replaceExisting = false, ctrlKey = false } = options;

    // Multi-sort enabled by Ctrl/Cmd key or explicit option
    const enableMultiSort = multiSort || ctrlKey;

    let newSortConfigs = [...currentSortConfigs];
    const existingIndex = newSortConfigs.findIndex((config) => config.column === column);

    if (replaceExisting || (!enableMultiSort && existingIndex === -1)) {
      // Replace all sorts with this column
      if (existingIndex !== -1) {
        const existing = newSortConfigs[existingIndex];
        if (existing.direction === "asc") {
          newSortConfigs = [{ column, direction: "desc", order: 0 }];
        } else {
          newSortConfigs = [];
        }
      } else {
        newSortConfigs = [{ column, direction: "asc", order: 0 }];
      }
    } else if (existingIndex !== -1) {
      // Column already in sort - toggle direction or remove
      const existing = newSortConfigs[existingIndex];
      if (existing.direction === "asc") {
        newSortConfigs[existingIndex] = { ...existing, direction: "desc" };
      } else {
        // Remove this sort config
        newSortConfigs.splice(existingIndex, 1);
      }
    } else {
      // Add new sort config for multi-sort
      const newOrder = newSortConfigs.length;
      newSortConfigs.push({ column, direction: "asc", order: newOrder });
    }

    // Update order values to be sequential
    return newSortConfigs.map((config, index) => ({
      ...config,
      order: index,
    }));
  }

  /**
   * Clear sort for a specific column or all columns
   */
  static clearSort(currentSortConfigs: SortConfig[], column?: string): SortConfig[] {
    if (!column) {
      return [];
    }

    return currentSortConfigs.filter((config) => config.column !== column).map((config, index) => ({ ...config, order: index }));
  }

  /**
   * Get sort direction for a column
   */
  static getSortDirection(sortConfigs: SortConfig[], column: string): SortDirection | null {
    const config = sortConfigs.find((config) => config.column === column);
    return config?.direction || null;
  }

  /**
   * Get sort order for a column (0-based index)
   */
  static getSortOrder(sortConfigs: SortConfig[], column: string): number | null {
    const config = sortConfigs.find((config) => config.column === column);
    return config?.order ?? null;
  }

  /**
   * Get sort configuration for a column
   */
  static getSortConfig(sortConfigs: SortConfig[], column: string): SortConfig | null {
    return sortConfigs.find((config) => config.column === column) || null;
  }

  /**
   * Check if any sorts are active
   */
  static hasActiveSort(sortConfigs: SortConfig[], column?: string): boolean {
    if (column) {
      return sortConfigs.some((config) => config.column === column);
    }
    return sortConfigs.length > 0;
  }

  /**
   * Get list of actively sorted columns
   */
  static getActiveSortColumns(sortConfigs: SortConfig[]): string[] {
    return sortConfigs.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map((config) => config.column);
  }

  /**
   * Validate sort configuration
   */
  static validateSortConfig(sortConfig: SortConfig): boolean {
    return !!(sortConfig.column && (sortConfig.direction === "asc" || sortConfig.direction === "desc") && (sortConfig.order === undefined || sortConfig.order >= 0));
  }

  /**
   * Create sort configuration from URL parameters
   */
  static parseSortFromUrl(sortParam: string | null): SortConfig[] {
    if (!sortParam) return [];

    try {
      const parsed = JSON.parse(sortParam);
      if (Array.isArray(parsed)) {
        return parsed.filter(this.validateSortConfig).map((config, index) => ({ ...config, order: index }));
      }
    } catch {
      // Fallback for simple "column:direction" format
      const [column, direction] = sortParam.split(":");
      if (column && (direction === "asc" || direction === "desc")) {
        return [{ column, direction, order: 0 }];
      }
    }

    return [];
  }

  /**
   * Serialize sort configuration to URL parameter
   */
  static serializeSortForUrl(sortConfigs: SortConfig[]): string | null {
    if (sortConfigs.length === 0) return null;

    // For single sort, use simple format
    if (sortConfigs.length === 1) {
      const config = sortConfigs[0];
      return `${config.column}:${config.direction}`;
    }

    // For multiple sorts, use JSON format
    return JSON.stringify(sortConfigs);
  }
}

/**
 * Predefined custom sort functions for common data types
 */
export const customSortFunctions = {
  /**
   * Sort Brazilian names (considering particles like "da", "de", "dos")
   */
  brazilianName: (a: any, b: any, direction: SortDirection): number => {
    const getValue = (item: any) => {
      const name = typeof item === "string" ? item : item?.name || "";
      // Extract last name for sorting, considering Brazilian particles
      const parts = name.toLowerCase().split(" ");
      const particles = ["da", "de", "do", "das", "dos", "e"];

      // Find the main last name (skip particles)
      let lastName = "";
      for (let i = parts.length - 1; i >= 0; i--) {
        if (!particles.includes(parts[i])) {
          lastName = parts[i];
          break;
        }
      }

      return lastName || name.toLowerCase();
    };

    const aValue = getValue(a);
    const bValue = getValue(b);

    return TableSortUtils.compareValues(aValue, bValue, direction);
  },

  /**
   * Sort CPF numbers
   */
  cpf: (a: any, b: any, direction: SortDirection): number => {
    const getValue = (item: any) => {
      const cpf = typeof item === "string" ? item : item?.cpf || "";
      return cpf.replace(/\D/g, ""); // Remove non-digits for comparison
    };

    const aValue = getValue(a);
    const bValue = getValue(b);

    return TableSortUtils.compareValues(aValue, bValue, direction);
  },

  /**
   * Sort CNPJ numbers
   */
  cnpj: (a: any, b: any, direction: SortDirection): number => {
    const getValue = (item: any) => {
      const cnpj = typeof item === "string" ? item : item?.cnpj || "";
      return cnpj.replace(/\D/g, ""); // Remove non-digits for comparison
    };

    const aValue = getValue(a);
    const bValue = getValue(b);

    return TableSortUtils.compareValues(aValue, bValue, direction);
  },

  /**
   * Sort currency values (Brazilian Real)
   */
  currency: (a: any, b: any, direction: SortDirection): number => {
    const getValue = (item: any) => {
      const value = typeof item === "number" ? item : typeof item === "string" ? parseFloat(item.replace(/[^\d,-]/g, "").replace(",", ".")) : item?.value || item?.price || 0;
      return isNaN(value) ? 0 : value;
    };

    const aValue = getValue(a);
    const bValue = getValue(b);

    return TableSortUtils.compareValues(aValue, bValue, direction);
  },

  /**
   * Sort by status with predefined order
   */
  status:
    (statusOrder: Record<string, number>) =>
    (a: any, b: any, direction: SortDirection): number => {
      const getValue = (item: any) => {
        const status = typeof item === "string" ? item : item?.status || "";
        return statusOrder[status] ?? 999; // Unknown statuses go to end
      };

      const aValue = getValue(a);
      const bValue = getValue(b);

      return TableSortUtils.compareValues(aValue, bValue, direction);
    },

  /**
   * Sort by priority (HIGH, MEDIUM, LOW)
   */
  priority: (a: any, b: any, direction: SortDirection): number => {
    const priorityOrder = {
      HIGH: 1,
      MEDIUM: 2,
      LOW: 3,
      URGENT: 0,
      CRITICAL: 0,
    };

    const getValue = (item: any) => {
      const priority = typeof item === "string" ? item : item?.priority || "";
      return priorityOrder[priority.toUpperCase() as keyof typeof priorityOrder] ?? 999;
    };

    const aValue = getValue(a);
    const bValue = getValue(b);

    return TableSortUtils.compareValues(aValue, bValue, direction);
  },

  /**
   * Sort by date with null handling
   */
  date: (a: any, b: any, direction: SortDirection): number => {
    const getValue = (item: any) => {
      const date = typeof item === "string" || item instanceof Date ? item : item?.date || item?.createdAt || item?.updatedAt || null;

      if (!date) return null;

      return date instanceof Date ? date.getTime() : new Date(date).getTime();
    };

    const aValue = getValue(a);
    const bValue = getValue(b);

    return TableSortUtils.compareValues(aValue, bValue, direction, "last");
  },

  /**
   * Sort by quantity with proper number handling
   */
  quantity: (a: any, b: any, direction: SortDirection): number => {
    const getValue = (item: any) => {
      const qty = typeof item === "number" ? item : typeof item === "string" ? parseFloat(item) : item?.quantity || item?.amount || 0;
      return isNaN(qty) ? 0 : qty;
    };

    const aValue = getValue(a);
    const bValue = getValue(b);

    return TableSortUtils.compareValues(aValue, bValue, direction);
  },
};

/**
 * Hook for creating a column configuration map
 */
export function createColumnConfigMap(columns: SortableColumnConfig[]): Map<string, SortableColumnConfig> {
  return new Map(columns.map((col) => [col.key, col]));
}

/**
 * Utility to create a sort state object
 */
export function createSortState(initialSortConfigs: SortConfig[] = [], onSortChange?: (sortConfigs: SortConfig[]) => void): SortState {
  const sortConfigs = initialSortConfigs;

  const setSortConfigs = (configs: SortConfig[]) => {
    sortConfigs.splice(0, sortConfigs.length, ...configs);
    onSortChange?.(configs);
  };

  const toggleSort = (column: string, options?: ToggleSortOptions) => {
    const newConfigs = TableSortUtils.toggleColumnSort(sortConfigs, column, options);
    setSortConfigs(newConfigs);
  };

  const clearSort = (column?: string) => {
    const newConfigs = TableSortUtils.clearSort(sortConfigs, column);
    setSortConfigs(newConfigs);
  };

  return {
    sortConfigs,
    setSortConfigs,
    toggleSort,
    clearSort,
    getSortDirection: (column: string) => TableSortUtils.getSortDirection(sortConfigs, column),
    getSortOrder: (column: string) => TableSortUtils.getSortOrder(sortConfigs, column),
    getSortConfig: (column: string) => TableSortUtils.getSortConfig(sortConfigs, column),
    hasSort: (column?: string) => TableSortUtils.hasActiveSort(sortConfigs, column),
    getActiveSortColumns: () => TableSortUtils.getActiveSortColumns(sortConfigs),
  };
}
