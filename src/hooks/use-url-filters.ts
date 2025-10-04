import { useCallback, useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { z } from "zod";

// Type for filter configuration
interface FilterConfig<T> {
  schema: z.ZodSchema<T>;
  defaultValue?: T;
  debounceMs?: number;
}

// Helper function to parse filter value from URL
function parseFilterValue(value: string | null, schema: z.ZodSchema): any {
  if (value === null) return undefined;

  // Handle empty string - it's a valid value
  if (value === "") return "";

  // Try to parse as JSON first (for complex types like arrays, objects)
  try {
    const parsed = JSON.parse(value);
    const result = schema.safeParse(parsed);
    return result.success ? result.data : undefined;
  } catch {
    // If JSON parse fails, try direct parse (for simple types)
    const result = schema.safeParse(value);
    return result.success ? result.data : undefined;
  }
}

// Helper function to serialize filter value for URL
function serializeFilterValue(value: any): string | null {
  if (value === undefined || value === null) return null;

  // Empty string is a valid value, don't remove it
  if (value === "") return ""; // Keep empty string as is

  // For simple types, convert to string
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  // For complex types, use JSON
  return JSON.stringify(value);
}

export function useUrlFilters<T extends Record<string, any>>(filterConfigs: { [K in keyof T]: FilterConfig<T[K]> }): {
  filters: T;
  setFilter: <K extends keyof T>(key: K, value: T[K] | undefined) => void;
  setFilters: (filters: Partial<T>) => void;
  resetFilter: <K extends keyof T>(key: K) => void;
  resetFilters: () => void;
  isFilterActive: <K extends keyof T>(key: K) => boolean;
  activeFilterCount: number;
  getFilter: <K extends keyof T>(key: K) => T[K] | undefined;
} {
  const [searchParams, setSearchParams] = useSearchParams();
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Use ref to track current filter values for stable references
  const filtersRef = useRef<T>({} as T);

  // Parse filters from URL
  const filters = useMemo(() => {
    const result = {} as T;

    for (const [key, config] of Object.entries(filterConfigs) as Array<[keyof T, FilterConfig<any>]>) {
      const urlValue = searchParams.get(String(key));
      const parsedValue = parseFilterValue(urlValue, config.schema);

      // Use parsed value if valid, otherwise use default
      if (parsedValue !== undefined) {
        result[key] = parsedValue;
      } else if (config.defaultValue !== undefined) {
        result[key] = config.defaultValue;
      }
    }

    return result;
  }, [searchParams, filterConfigs]);

  // Update ref after filters are computed
  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  // Update URL immediately or with debouncing
  const updateUrl = useCallback(
    (updater: (params: URLSearchParams) => void, debounceMs?: number) => {
      const doUpdate = () => {
        setSearchParams(
          (prev) => {
            const newParams = new URLSearchParams(prev);
            const oldParamsString = prev.toString();

            updater(newParams);

            // Only update if params actually changed
            const newParamsString = newParams.toString();
            if (oldParamsString !== newParamsString) {
              return newParams;
            }
            return prev;
          },
          { replace: true },
        );
        // Clear the timeout ref after the update executes
        debounceTimeoutRef.current = null;
      };

      if (debounceMs !== undefined && debounceMs > 0) {
        // Clear existing timeout to prevent stale updates
        if (debounceTimeoutRef.current) {
          clearTimeout(debounceTimeoutRef.current);
        }
        // Set new timeout
        debounceTimeoutRef.current = setTimeout(doUpdate, debounceMs);
      } else {
        // Clear any pending timeout when doing immediate update
        if (debounceTimeoutRef.current) {
          clearTimeout(debounceTimeoutRef.current);
          debounceTimeoutRef.current = null;
        }
        // Update immediately
        doUpdate();
      }
    },
    [setSearchParams],
  );

  // Set a single filter
  const setFilter = useCallback(
    <K extends keyof T>(key: K, value: T[K] | undefined) => {
      const config = filterConfigs[key];

      // Validate the value first
      if (value !== undefined) {
        const result = config.schema.safeParse(value);
        if (!result.success) {
          console.warn(`Invalid filter value for "${String(key)}":`, result.error);
          return;
        }
      }

      // Determine debounce time - use filter-specific or none (immediate)
      const debounceMs = config.debounceMs;

      updateUrl((params) => {
        const serialized = serializeFilterValue(value);

        if (serialized === null) {
          params.delete(String(key));
        } else {
          params.set(String(key), serialized);
        }
      }, debounceMs);
    },
    [filterConfigs, updateUrl],
  );

  // Set multiple filters at once
  const setFilters = useCallback(
    (newFilters: Partial<T>) => {
      // For batch updates, use immediate update (no debouncing)
      updateUrl((params) => {
        for (const [key, value] of Object.entries(newFilters) as Array<[keyof T, any]>) {
          const config = filterConfigs[key];
          if (!config) continue;

          // Validate the value
          if (value !== undefined) {
            const result = config.schema.safeParse(value);
            if (!result.success) {
              console.warn(`Invalid filter value for "${String(key)}":`, result.error);
              continue;
            }
          }

          const serialized = serializeFilterValue(value);
          if (serialized === null) {
            params.delete(String(key));
          } else {
            params.set(String(key), serialized);
          }
        }
      }, 0); // Immediate update for batch operations
    },
    [filterConfigs, updateUrl],
  );

  // Reset a single filter
  const resetFilter = useCallback(
    <K extends keyof T>(key: K) => {
      updateUrl((params) => {
        params.delete(String(key));
      }, 0); // Immediate update for reset
    },
    [updateUrl],
  );

  // Reset all filters
  const resetFilters = useCallback(() => {
    updateUrl((params) => {
      for (const key of Object.keys(filterConfigs)) {
        params.delete(key);
      }
    }, 0); // Immediate update for reset
  }, [filterConfigs, updateUrl]);

  // Check if a filter is active (different from default)
  const isFilterActive = useCallback(
    <K extends keyof T>(key: K): boolean => {
      const currentValue = filters[key];
      const defaultValue = filterConfigs[key]?.defaultValue;

      if (currentValue === undefined && defaultValue === undefined) return false;
      if (currentValue === undefined || defaultValue === undefined) return true;

      // Deep comparison for objects/arrays
      return JSON.stringify(currentValue) !== JSON.stringify(defaultValue);
    },
    [filters, filterConfigs],
  );

  // Count active filters
  const activeFilterCount = useMemo(() => {
    return Object.keys(filterConfigs).filter((key) => isFilterActive(key as keyof T)).length;
  }, [filterConfigs, isFilterActive]);

  // Get current filter value from ref (stable reference)
  const getFilter = useCallback(<K extends keyof T>(key: K): T[K] | undefined => {
    return filtersRef.current[key];
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  return {
    filters,
    setFilter,
    setFilters,
    resetFilter,
    resetFilters,
    isFilterActive,
    activeFilterCount,
    getFilter,
  };
}

// Common filter schemas for reuse
export const commonFilterSchemas = {
  // String filters
  search: z.string().min(1),
  status: z.string(),

  // Number filters
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  minPrice: z.coerce.number().min(0),
  maxPrice: z.coerce.number().min(0),

  // Date filters
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),

  // Boolean filters
  isActive: z.coerce.boolean(),
  showDeleted: z.coerce.boolean(),

  // Array filters
  categories: z.array(z.string()),
  tags: z.array(z.string()),

  // Enum filters
  sortBy: z.enum(["name", "date", "price"]),
  sortOrder: z.enum(["asc", "desc"]),
};

// Example usage:
/*
const MyComponent = () => {
  const { filters, setFilter, setFilters, resetFilters, activeFilterCount } = useUrlFilters({
    search: {
      schema: commonFilterSchemas.search,
      debounceMs: 500, // Custom debounce for search
    },
    status: {
      schema: z.enum(["ACTIVE", "INACTIVE", "PENDING"]),
      defaultValue: "ACTIVE",
    },
    page: {
      schema: commonFilterSchemas.page,
      defaultValue: 1,
    },
    categories: {
      schema: commonFilterSchemas.categories,
      defaultValue: [],
    },
  })

  // Use filters
  const { data } = useQuery({
    queryKey: ["items", filters],
    queryFn: () => fetchItems(filters),
  })

  return (
    <div>
      <input
        value={filters.search ?? ""}
        onChange={(e) => setFilter("search", e.target.value || undefined)}
        placeholder="Search..."
      />
      
      <select
        value={filters.status}
        onChange={(e) => setFilter("status", e.target.value)}
      >
        <option value="ACTIVE">Active</option>
        <option value="INACTIVE">Inactive</option>
        <option value="PENDING">Pending</option>
      </select>

      <button onClick={resetFilters}>
        Clear Filters ({activeFilterCount})
      </button>
    </div>
  )
}
*/
