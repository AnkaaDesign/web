import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

interface UseTableFiltersOptions<TFilters> {
  /** Default filters to apply when no URL params exist */
  defaultFilters?: Partial<TFilters>;
  /** Debounce delay for search in milliseconds */
  searchDebounceMs?: number;
  /** The parameter name for search (default: "searchingFor") */
  searchParamName?: string;
  /** Custom serializer for filters to URL params */
  serializeToUrl?: (filters: Partial<TFilters>) => Record<string, string>;
  /** Custom deserializer from URL params to filters */
  deserializeFromUrl?: (params: URLSearchParams) => Partial<TFilters>;
  /** Filter keys to exclude from URL */
  excludeFromUrl?: string[];
}

interface UseTableFiltersReturn<TFilters> {
  /** Current filters including search */
  filters: Partial<TFilters>;
  /** Update filters (excluding search) */
  setFilters: (filters: Partial<TFilters> | ((prev: Partial<TFilters>) => Partial<TFilters>)) => void;
  /** Current search value (debounced) */
  searchingFor: string;
  /** Display search value (immediate) */
  displaySearchText: string;
  /** Update search value */
  setSearch: (value: string) => void;
  /** Clear all filters including search */
  clearAllFilters: () => void;
  /** Clear specific filter */
  clearFilter: (key: keyof TFilters) => void;
  /** Check if any filters are active */
  hasActiveFilters: boolean;
  /** Get the merged filters for API calls */
  queryFilters: Partial<TFilters & { searchingFor?: string }>;
}

/**
 * Unified hook for managing table filters, search, and URL state
 * Handles debouncing, URL synchronization, and state management
 */
export function useTableFilters<TFilters extends Record<string, any>>({
  defaultFilters = {} as Partial<TFilters>,
  searchDebounceMs = 300,
  searchParamName = "searchingFor",
  serializeToUrl,
  deserializeFromUrl,
  excludeFromUrl = [],
}: UseTableFiltersOptions<TFilters> = {}): UseTableFiltersReturn<TFilters> {
  const [searchParams, setSearchParams] = useSearchParams();
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const urlUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialMount = useRef(true);
  const lastUrlString = useRef<string>("");
  const preservedParamsRef = useRef<Record<string, string>>({});

  // Track preserved params whenever searchParams changes
  useEffect(() => {
    const preserveKeys = ["page", "pageSize", "selected", "sort", "showSelectedOnly"];
    const preserved: Record<string, string> = {};
    preserveKeys.forEach(key => {
      const value = searchParams.get(key);
      if (value) {
        preserved[key] = value;
      }
    });
    preservedParamsRef.current = preserved;
  }, [searchParams]);

  // Default serializer - converts filters to URL params
  const defaultSerializeToUrl = useCallback(
    (filters: Partial<TFilters>): Record<string, string> => {
      const params: Record<string, string> = {};

      Object.entries(filters).forEach(([key, value]) => {
        if (excludeFromUrl.includes(key)) return;
        if (value === undefined || value === null || value === "") return;

        if (Array.isArray(value)) {
          if (value.length > 0) {
            params[key] = JSON.stringify(value);
          }
        } else if (typeof value === "object" && value instanceof Date) {
          params[key] = value.toISOString();
        } else if (typeof value === "object") {
          // Handle nested objects (like date ranges)
          const serialized = JSON.stringify(value);
          if (serialized !== "{}" && serialized !== "null") {
            params[key] = serialized;
          }
        } else if (typeof value === "boolean") {
          params[key] = value.toString();
        } else {
          params[key] = String(value);
        }
      });

      return params;
    },
    [excludeFromUrl],
  );

  // Default deserializer - converts URL params to filters
  const defaultDeserializeFromUrl = useCallback(
    (params: URLSearchParams): Partial<TFilters> => {
      const filters: any = {};

      params.forEach((value, key) => {
        if (excludeFromUrl.includes(key)) return;

        // Try to parse JSON for arrays and objects
        if (value.startsWith("[") || value.startsWith("{")) {
          try {
            filters[key] = JSON.parse(value);
          } catch {
            filters[key] = value;
          }
        }
        // Parse booleans
        else if (value === "true" || value === "false") {
          filters[key] = value === "true";
        }
        // Parse numbers
        else if (!isNaN(Number(value)) && value !== "") {
          filters[key] = Number(value);
        }
        // Parse dates
        else if (value.match(/^\d{4}-\d{2}-\d{2}T/)) {
          filters[key] = new Date(value);
        }
        // Keep as string
        else {
          filters[key] = value;
        }
      });

      return filters as Partial<TFilters>;
    },
    [excludeFromUrl],
  );

  const serialize = useMemo(() => serializeToUrl || defaultSerializeToUrl, [serializeToUrl, defaultSerializeToUrl]);
  const deserialize = useMemo(() => deserializeFromUrl || defaultDeserializeFromUrl, [deserializeFromUrl, defaultDeserializeFromUrl]);

  // State management with lazy initialization
  const [filters, setFiltersState] = useState<Partial<TFilters>>(() => {
    const urlFilters = deserialize(searchParams);
    return { ...defaultFilters, ...urlFilters };
  });
  const [searchingFor, setSearchingFor] = useState(() => searchParams.get(searchParamName) || "");
  const [displaySearchText, setDisplaySearchText] = useState(() => searchParams.get(searchParamName) || "");

  // Sync URL when filters change with debouncing
  useEffect(() => {
    // Skip the very first mount to avoid double-setting URL params
    if (isInitialMount.current) {
      isInitialMount.current = false;
      lastUrlString.current = searchParams.toString();
      return;
    }

    // Clear existing timeout
    if (urlUpdateTimeoutRef.current) {
      clearTimeout(urlUpdateTimeoutRef.current);
    }

    // Debounce URL updates to prevent rapid changes
    urlUpdateTimeoutRef.current = setTimeout(() => {
      const newParams = new URLSearchParams();

      // Add current filter params
      const serialized = serialize(filters);
      Object.entries(serialized).forEach(([key, value]) => {
        newParams.set(key, value);
      });

      // Add search param
      if (searchingFor) {
        newParams.set(searchParamName, searchingFor);
      }

      // Preserve pagination/selection params from ref (not from searchParams to avoid circular dependency)
      Object.entries(preservedParamsRef.current).forEach(([key, value]) => {
        newParams.set(key, value);
      });

      // Only update if params actually changed
      const newString = newParams.toString();
      if (newString !== lastUrlString.current) {
        lastUrlString.current = newString;
        setSearchParams(newParams, { replace: true });
      }
    }, 100); // Small delay to batch rapid changes
  }, [filters, searchingFor, serialize, searchParamName, setSearchParams]);

  // Handle browser navigation (back/forward)
  useEffect(() => {
    const handlePopState = () => {
      // Re-read URL params on navigation
      const currentParams = new URLSearchParams(window.location.search);
      const urlFilters = deserialize(currentParams);
      const urlSearch = currentParams.get(searchParamName) || "";

      setFiltersState({ ...defaultFilters, ...urlFilters });
      setSearchingFor(urlSearch);
      setDisplaySearchText(urlSearch);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [deserialize, searchParamName, defaultFilters]);

  // Debounced search update
  const setSearch = useCallback(
    (value: string) => {
      // Update display text immediately
      setDisplaySearchText(value);

      // Clear existing timeout
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
        debounceTimeoutRef.current = null;
      }

      // Set new timeout for debounced update
      debounceTimeoutRef.current = setTimeout(() => {
        setSearchingFor(value);
        debounceTimeoutRef.current = null;
      }, searchDebounceMs);
    },
    [searchDebounceMs],
  );

  // Update filters with deep comparison to avoid unnecessary updates
  const setFilters = useCallback((newFilters: Partial<TFilters> | ((prev: Partial<TFilters>) => Partial<TFilters>)) => {
    setFiltersState((prev) => {
      const updated = typeof newFilters === "function" ? newFilters(prev) : newFilters;
      // Remove undefined values
      const cleaned = Object.fromEntries(Object.entries(updated).filter(([_, v]) => v !== undefined)) as Partial<TFilters>;
      // Only update if actually different
      return JSON.stringify(cleaned) === JSON.stringify(prev) ? prev : cleaned;
    });
  }, []);

  // Clear all filters
  const clearAllFilters = useCallback(() => {
    setFiltersState(defaultFilters);
    setSearchingFor("");
    setDisplaySearchText("");

    // Clear timeout to prevent pending URL updates
    if (urlUpdateTimeoutRef.current) {
      clearTimeout(urlUpdateTimeoutRef.current);
    }

    // Clear filter-related URL params but preserve pagination and selection
    setSearchParams(
      (prev) => {
        const newParams = new URLSearchParams();

        // Only preserve non-filter params
        const preserveKeys = ["page", "pageSize", "selected", "sort", "showSelectedOnly"];
        preserveKeys.forEach(key => {
          const value = prev.get(key);
          if (value) {
            newParams.set(key, value);
          }
        });

        return newParams;
      },
      { replace: true },
    );
  }, [defaultFilters, setSearchParams]);

  // Clear specific filter
  const clearFilter = useCallback(
    (key: keyof TFilters) => {
      setFilters((prev) => {
        const { [key]: _, ...rest } = prev;
        return rest as Partial<TFilters>;
      });
    },
    [setFilters],
  );

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    if (searchingFor) return true;

    const activeKeys = Object.keys(filters).filter((key) => {
      const value = filters[key];
      if (value === undefined || value === null) return false;
      if (Array.isArray(value) && value.length === 0) return false;
      if (typeof value === "object" && Object.keys(value).length === 0) return false;

      // Check if it's different from default
      const defaultValue = defaultFilters[key as keyof TFilters];
      return JSON.stringify(value) !== JSON.stringify(defaultValue);
    });

    return activeKeys.length > 0;
  }, [filters, searchingFor, defaultFilters]);

  // Get merged filters for API calls
  const queryFilters = useMemo(() => {
    const merged: any = { ...filters };

    // Only add searchingFor if it has a value
    if (searchingFor) {
      merged.searchingFor = searchingFor;
    }

    return merged as Partial<TFilters & { searchingFor?: string }>;
  }, [filters, searchingFor]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      if (urlUpdateTimeoutRef.current) {
        clearTimeout(urlUpdateTimeoutRef.current);
      }
    };
  }, []);

  return {
    filters,
    setFilters,
    searchingFor,
    displaySearchText,
    setSearch,
    clearAllFilters,
    clearFilter,
    hasActiveFilters,
    queryFilters,
  };
}
