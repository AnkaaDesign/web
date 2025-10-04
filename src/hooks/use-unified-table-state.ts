import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useUrlStateCoordinator, UrlUpdateAction } from "./use-url-state-coordinator";
import {
  extractActiveFilters,
  FilterIndicator,
  hasActiveFilters as utilsHasActiveFilters,
  countActiveFilters,
  convertFiltersToApiFormat,
  ExtractFilterOptions,
} from "../utils/table-filter-utils";

// ============================
// Core Type Definitions
// ============================

export interface PaginationState {
  page: number;
  pageSize: number;
  totalRecords?: number;
  hasNextPage?: boolean;
  hasPreviousPage?: boolean;
}

export interface SelectionState {
  selectedIds: string[];
  isAllSelected: boolean;
  isPartiallySelected: boolean;
  selectionCount: number;
}

export interface SortConfig {
  column: string;
  direction: "asc" | "desc";
  priority?: number;
}

export interface SortState {
  sortConfigs: SortConfig[];
  primarySort?: SortConfig;
}

export interface SearchState {
  searchText: string;
  debouncedSearchText: string;
  isSearching: boolean;
}

export interface FilterState<TFilters> {
  filters: Partial<TFilters>;
  activeFilterCount: number;
  hasActiveFilters: boolean;
  filterIndicators: FilterIndicator[];
}

export interface TableStatePreset<TFilters> {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  filters?: Partial<TFilters>;
  sort?: SortConfig[];
  pageSize?: number;
  isDefault?: boolean;
}

export interface UnifiedTableState<TFilters> extends PaginationState, SelectionState, SortState, SearchState, FilterState<TFilters> {
  // Combined state flags
  hasAnyFilters: boolean;
  hasAnyState: boolean;
  isLoading: boolean;
  error?: string;
}

// ============================
// Configuration Options
// ============================

export interface UseUnifiedTableStateOptions<TFilters, TApiFilters = TFilters> {
  // Basic configuration
  namespace?: string;
  defaultPageSize?: number;
  maxPageSize?: number;

  // Default values
  defaultFilters?: Partial<TFilters>;
  defaultSort?: SortConfig[];

  // Debouncing
  debounceMs?: {
    search?: number;
    filter?: number;
    pagination?: number;
    sorting?: number;
    selection?: number;
  };

  // Search configuration
  searchParamName?: string;
  searchPlaceholder?: string;

  // Selection behavior
  resetSelectionOnPageChange?: boolean;
  resetSelectionOnFilterChange?: boolean;
  persistSelection?: boolean;

  // URL state management
  enableUrlSync?: boolean;
  excludeFromUrl?: string[];

  // Filter configuration
  filterOptions?: Partial<ExtractFilterOptions<TFilters>>;

  // Transform functions
  transformToApi?: (filters: Partial<TFilters>) => Partial<TApiFilters>;
  transformFromUrl?: (params: URLSearchParams) => Partial<TFilters>;
  transformToUrl?: (filters: Partial<TFilters>) => Record<string, string>;

  // Validation
  validateFilters?: (filters: Partial<TFilters>) => string | null;
  validateSort?: (sortConfigs: SortConfig[]) => string | null;

  // State presets
  presets?: TableStatePreset<TFilters>[];
  enablePresets?: boolean;

  // Performance optimization
  enableOptimisticUpdates?: boolean;
  batchUpdates?: boolean;
  preventUnnecessaryRenders?: boolean;

  // Callbacks
  onStateChange?: (state: UnifiedTableState<TFilters>) => void;
  onFiltersChange?: (filters: Partial<TFilters>) => void;
  onSortChange?: (sortConfigs: SortConfig[]) => void;
  onSelectionChange?: (selectedIds: string[]) => void;
  onPageChange?: (page: number) => void;
  onError?: (error: string) => void;
}

// ============================
// Return Type
// ============================

export interface UseUnifiedTableStateReturn<TFilters, TApiFilters = TFilters> {
  // Current state
  state: UnifiedTableState<TFilters>;

  // Pagination
  pagination: {
    page: number;
    pageSize: number;
    totalRecords?: number;
    hasNextPage?: boolean;
    hasPreviousPage?: boolean;
    setPage: (page: number) => void;
    setPageSize: (pageSize: number) => void;
    nextPage: () => void;
    previousPage: () => void;
    goToFirstPage: () => void;
    goToLastPage: () => void;
    resetPagination: () => void;
  };

  // Selection
  selection: {
    selectedIds: string[];
    selectionCount: number;
    isAllSelected: boolean;
    isPartiallySelected: boolean;
    hasSelection: boolean;
    setSelectedIds: (ids: string[]) => void;
    toggleSelection: (id: string) => void;
    toggleSelectAll: (allIds: string[]) => void;
    selectAll: (allIds: string[]) => void;
    deselectAll: () => void;
    isSelected: (id: string) => boolean;
    removeFromSelection: (ids: string[]) => void;
    invertSelection: (allIds: string[]) => void;
    resetSelection: () => void;
  };

  // Sorting
  sorting: {
    sortConfigs: SortConfig[];
    primarySort?: SortConfig;
    hasSorting: boolean;
    setSortConfigs: (configs: SortConfig[]) => void;
    addSort: (column: string, direction?: "asc" | "desc") => void;
    removeSort: (column: string) => void;
    toggleSort: (column: string) => void;
    clearSort: () => void;
    getSortDirection: (column: string) => "asc" | "desc" | null;
    getSortOrder: (column: string) => number | null;
    getSortPriority: (column: string) => number | null;
    resetSort: () => void;
  };

  // Search
  search: {
    searchText: string;
    debouncedSearchText: string;
    isSearching: boolean;
    setSearch: (text: string) => void;
    clearSearch: () => void;
  };

  // Filters
  filters: {
    filters: Partial<TFilters>;
    activeFilterCount: number;
    hasActiveFilters: boolean;
    filterIndicators: FilterIndicator[];
    setFilters: (filters: Partial<TFilters> | ((prev: Partial<TFilters>) => Partial<TFilters>)) => void;
    setFilter: <K extends keyof TFilters>(key: K, value: TFilters[K] | undefined) => void;
    clearFilter: (key: keyof TFilters) => void;
    clearAllFilters: () => void;
    resetFilters: () => void;
    getApiFilters: () => Partial<TApiFilters>;
  };

  // State management
  stateManagement: {
    resetAll: () => void;
    resetToDefaults: () => void;
    getQueryParams: () => Partial<TApiFilters & { searchingFor?: string; page?: number; pageSize?: number; orderBy?: any }>;
    saveAsPreset: (name: string, description?: string) => void;
    loadPreset: (presetId: string) => void;
    deletePreset: (presetId: string) => void;
    exportState: () => string;
    importState: (stateJson: string) => boolean;
  };

  // Presets (if enabled)
  presets?: {
    availablePresets: TableStatePreset<TFilters>[];
    currentPreset?: string;
    saveCurrentAsPreset: (name: string, description?: string) => void;
    loadPreset: (presetId: string) => void;
    deletePreset: (presetId: string) => void;
    isDefaultPreset: (presetId: string) => boolean;
  };

  // Utilities
  utils: {
    hasAnyState: boolean;
    isDefaultState: boolean;
    getStateSignature: () => string;
    validateCurrentState: () => string | null;
    optimisticUpdate: <T>(operation: () => Promise<T>, rollback?: () => void) => Promise<T>;
  };
}

// ============================
// Default Values
// ============================

const DEFAULT_OPTIONS = {
  defaultPageSize: 40,
  maxPageSize: 100,
  searchParamName: "searchingFor",
  searchPlaceholder: "Buscar...",
  resetSelectionOnPageChange: false,
  resetSelectionOnFilterChange: true,
  persistSelection: false,
  enableUrlSync: true,
  excludeFromUrl: [],
  enablePresets: false,
  enableOptimisticUpdates: true,
  batchUpdates: true,
  preventUnnecessaryRenders: true,
  debounceMs: {
    search: 300,
    filter: 150,
    pagination: 0,
    sorting: 0,
    selection: 50,
  },
};

// ============================
// Helper Functions
// ============================

function convertSortConfigsToOrderBy(sortConfigs: SortConfig[]) {
  if (sortConfigs.length === 0) {
    return undefined;
  }

  const orderByArray = sortConfigs.map((config) => {
    const fieldPath = config.column.split(".");

    if (fieldPath.length === 1) {
      return { [fieldPath[0]]: config.direction };
    } else if (fieldPath.length === 2) {
      return { [fieldPath[0]]: { [fieldPath[1]]: config.direction } };
    } else if (fieldPath.length === 3) {
      return { [fieldPath[0]]: { [fieldPath[1]]: { [fieldPath[2]]: config.direction } } };
    } else {
      return { [config.column]: config.direction };
    }
  });

  return orderByArray;
}

function serializeValue(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "number" && value === 1) return null;
  if (typeof value === "number" && value === 40) return null;
  return JSON.stringify(value);
}

function generateStateSignature<TFilters>(state: UnifiedTableState<TFilters>): string {
  const signature = {
    p: state.page,
    ps: state.pageSize,
    s: state.sortConfigs,
    f: state.filters,
    search: state.debouncedSearchText,
    sel: state.selectedIds.length,
  };
  return btoa(JSON.stringify(signature));
}

// ============================
// Main Hook Implementation
// ============================

export function useUnifiedTableState<TFilters extends Record<string, any>, TApiFilters = TFilters>(
  options: UseUnifiedTableStateOptions<TFilters, TApiFilters> = {},
): UseUnifiedTableStateReturn<TFilters, TApiFilters> {
  const {
    namespace,
    defaultPageSize = DEFAULT_OPTIONS.defaultPageSize,
    maxPageSize = DEFAULT_OPTIONS.maxPageSize,
    defaultFilters = {} as Partial<TFilters>,
    defaultSort = [],
    debounceMs = DEFAULT_OPTIONS.debounceMs,
    searchParamName = DEFAULT_OPTIONS.searchParamName,
    resetSelectionOnPageChange = DEFAULT_OPTIONS.resetSelectionOnPageChange,
    resetSelectionOnFilterChange = DEFAULT_OPTIONS.resetSelectionOnFilterChange,
    persistSelection = DEFAULT_OPTIONS.persistSelection,
    enableUrlSync = DEFAULT_OPTIONS.enableUrlSync,
    excludeFromUrl = DEFAULT_OPTIONS.excludeFromUrl,
    filterOptions,
    transformToApi,
    transformFromUrl,
    transformToUrl,
    validateFilters,
    validateSort,
    presets: initialPresets = [],
    enablePresets = DEFAULT_OPTIONS.enablePresets,
    enableOptimisticUpdates = DEFAULT_OPTIONS.enableOptimisticUpdates,
    onStateChange,
    onFiltersChange,
    onSortChange,
    onSelectionChange,
    onPageChange,
    onError,
  } = options;

  // URL State Coordinator
  const { searchParams, queueUpdate, batchUpdates, cancelPendingUpdates, getParamName } = useUrlStateCoordinator({
    debounceMs,
    namespace,
  });

  // Internal state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [optimisticState, setOptimisticState] = useState<Partial<UnifiedTableState<TFilters>>>({});

  // Search state with debouncing
  const [searchText, setSearchText] = useState(() => (enableUrlSync ? searchParams.get(getParamName(searchParamName)) || "" : ""));
  const [debouncedSearchText, setDebouncedSearchText] = useState(searchText);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Presets state
  const [availablePresets, setAvailablePresets] = useState<TableStatePreset<TFilters>[]>(initialPresets);
  const [currentPreset, setCurrentPreset] = useState<string | undefined>();

  // Refs for stable comparisons
  const previousStateRef = useRef<string>("");
  const stateCallbackRef = useRef(onStateChange);
  stateCallbackRef.current = onStateChange;

  // Parse state from URL
  const urlState = useMemo(() => {
    if (!enableUrlSync) {
      return {
        page: 1,
        pageSize: defaultPageSize,
        selectedIds: [],
        sortConfigs: defaultSort,
        filters: defaultFilters,
      };
    }

    // Parse pagination
    const pageValue = searchParams.get(getParamName("page"));
    const pageSizeValue = searchParams.get(getParamName("pageSize"));
    const page = pageValue ? Math.max(1, parseInt(pageValue, 10) || 1) : 1;
    const pageSize = pageSizeValue ? Math.max(1, Math.min(maxPageSize, parseInt(pageSizeValue, 10)) || defaultPageSize) : defaultPageSize;

    // Parse selection
    const selectedValue = searchParams.get(getParamName("selected"));
    let selectedIds: string[] = [];
    if (selectedValue) {
      try {
        const parsed = JSON.parse(selectedValue);
        if (Array.isArray(parsed)) {
          selectedIds = parsed.filter((id) => typeof id === "string");
        }
      } catch {
        // Ignore parsing errors
      }
    }

    // Parse sort
    const sortValue = searchParams.get(getParamName("sort"));
    let sortConfigs: SortConfig[] = [];
    if (sortValue !== null) {
      try {
        const parsed = JSON.parse(sortValue);
        if (Array.isArray(parsed)) {
          sortConfigs = parsed
            .filter((config) => config && typeof config.column === "string" && (config.direction === "asc" || config.direction === "desc"))
            .map((config, index) => ({
              ...config,
              priority: config.priority ?? index,
            }));
        }
      } catch {
        // Ignore parsing errors
      }
    } else if (!searchParams.has(getParamName("sort")) && defaultSort.length > 0) {
      sortConfigs = defaultSort.map((config, index) => ({
        ...config,
        priority: config.priority ?? index,
      }));
    }

    // Parse filters
    let filters: Partial<TFilters> = { ...defaultFilters };
    if (transformFromUrl) {
      const urlFilters = transformFromUrl(searchParams);
      filters = { ...filters, ...urlFilters };
    } else {
      // Default parsing logic
      searchParams.forEach((value, key) => {
        if (excludeFromUrl.includes(key)) return;
        if (
          key === getParamName("page") ||
          key === getParamName("pageSize") ||
          key === getParamName("selected") ||
          key === getParamName("sort") ||
          key === getParamName(searchParamName)
        )
          return;

        try {
          if (value.startsWith("[") || value.startsWith("{")) {
            filters[key as keyof TFilters] = JSON.parse(value);
          } else if (value === "true" || value === "false") {
            filters[key as keyof TFilters] = (value === "true") as any;
          } else if (!isNaN(Number(value)) && value !== "") {
            filters[key as keyof TFilters] = Number(value) as any;
          } else if (value.match(/^\d{4}-\d{2}-\d{2}T/)) {
            filters[key as keyof TFilters] = new Date(value) as any;
          } else {
            filters[key as keyof TFilters] = value as any;
          }
        } catch {
          filters[key as keyof TFilters] = value as any;
        }
      });
    }

    return {
      page,
      pageSize,
      selectedIds,
      sortConfigs,
      filters,
    };
  }, [searchParams, enableUrlSync, defaultPageSize, maxPageSize, defaultSort, defaultFilters, getParamName, searchParamName, transformFromUrl, excludeFromUrl]);

  // Handle search debouncing
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearchText(searchText);
    }, debounceMs.search || 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchText, debounceMs.search]);

  // Update URL when debounced search changes
  useEffect(() => {
    if (!enableUrlSync) return;

    queueUpdate((params) => {
      if (debouncedSearchText) {
        params.set(getParamName(searchParamName), debouncedSearchText);
      } else {
        params.delete(getParamName(searchParamName));
      }
    }, "search");
  }, [debouncedSearchText, enableUrlSync, queueUpdate, getParamName, searchParamName]);

  // Computed state values
  const computedState = useMemo(() => {
    const baseState = {
      ...urlState,
      searchText,
      debouncedSearchText,
      isSearching: searchText !== debouncedSearchText,
      totalRecords: optimisticState.totalRecords,
      hasNextPage: optimisticState.hasNextPage,
      hasPreviousPage: urlState.page > 1,
    };

    // Apply optimistic updates
    const state = { ...baseState, ...optimisticState };

    // Compute derived values
    const selectionCount = state.selectedIds.length;
    const isAllSelected = false; // Will be computed by caller with actual data
    const isPartiallySelected = selectionCount > 0;
    const activeFilterCount = countActiveFilters(state.filters, ["page", "pageSize", "selected", "sort", searchParamName, "orderBy", "include", "where"]);
    const hasActiveFilters =
      utilsHasActiveFilters(state.filters, ["page", "pageSize", "selected", "sort", searchParamName, "orderBy", "include", "where"]) || !!state.debouncedSearchText;

    // Generate filter indicators
    const filterIndicators = extractActiveFilters({
      filters: state.filters,
      onRemoveFilter: (key: string) => {
        updateFilters((prev) => {
          const { [key]: _, ...rest } = prev;
          return rest as Partial<TFilters>;
        });
      },
      ...filterOptions,
    });

    const primarySort = state.sortConfigs.length > 0 ? state.sortConfigs[0] : undefined;
    const hasAnyFilters = hasActiveFilters || state.debouncedSearchText.length > 0;
    const hasAnyState = hasAnyFilters || selectionCount > 0 || state.sortConfigs.length > 0 || state.page > 1 || state.pageSize !== defaultPageSize;

    const unifiedState: UnifiedTableState<TFilters> = {
      // Pagination
      page: state.page,
      pageSize: state.pageSize,
      totalRecords: state.totalRecords,
      hasNextPage: state.hasNextPage,
      hasPreviousPage: state.hasPreviousPage,

      // Selection
      selectedIds: state.selectedIds,
      isAllSelected,
      isPartiallySelected,
      selectionCount,

      // Sorting
      sortConfigs: state.sortConfigs,
      primarySort,

      // Search
      searchText: state.searchText,
      debouncedSearchText: state.debouncedSearchText,
      isSearching: state.isSearching,

      // Filters
      filters: state.filters,
      activeFilterCount,
      hasActiveFilters,
      filterIndicators,

      // Combined flags
      hasAnyFilters,
      hasAnyState,
      isLoading,
      error,
    };

    return unifiedState;
  }, [urlState, searchText, debouncedSearchText, optimisticState, isLoading, error, defaultPageSize, searchParamName, filterOptions]);

  // State change callback
  useEffect(() => {
    const signature = generateStateSignature(computedState);
    if (signature !== previousStateRef.current) {
      previousStateRef.current = signature;
      stateCallbackRef.current?.(computedState);
    }
  }, [computedState]);

  // Update functions
  const updatePagination = useCallback(
    (page?: number, pageSize?: number) => {
      if (!enableUrlSync) return;

      queueUpdate((params) => {
        if (page !== undefined) {
          if (page === 1) {
            params.delete(getParamName("page"));
          } else {
            params.set(getParamName("page"), page.toString());
          }
        }

        if (pageSize !== undefined) {
          if (pageSize === defaultPageSize) {
            params.delete(getParamName("pageSize"));
          } else {
            params.set(getParamName("pageSize"), pageSize.toString());
          }
        }

        // Reset selection if configured
        if (resetSelectionOnPageChange && (page !== undefined || pageSize !== undefined)) {
          params.delete(getParamName("selected"));
        }
      }, "pagination");

      onPageChange?.(page ?? computedState.page);
    },
    [enableUrlSync, queueUpdate, getParamName, defaultPageSize, resetSelectionOnPageChange, onPageChange, computedState.page],
  );

  const updateSelection = useCallback(
    (selectedIds: string[]) => {
      if (!enableUrlSync) return;

      queueUpdate((params) => {
        const serialized = serializeValue(selectedIds);
        if (serialized === null || selectedIds.length === 0) {
          params.delete(getParamName("selected"));
        } else {
          params.set(getParamName("selected"), serialized);
        }
      }, "selection");

      onSelectionChange?.(selectedIds);
    },
    [enableUrlSync, queueUpdate, getParamName, onSelectionChange],
  );

  const updateSort = useCallback(
    (sortConfigs: SortConfig[]) => {
      if (!enableUrlSync) return;

      // Validate sort if validator provided
      if (validateSort) {
        const error = validateSort(sortConfigs);
        if (error) {
          setError(error);
          onError?.(error);
          return;
        }
      }

      queueUpdate((params) => {
        const serialized = serializeValue(sortConfigs);
        if (serialized === null || sortConfigs.length === 0) {
          params.delete(getParamName("sort"));
        } else {
          params.set(getParamName("sort"), serialized);
        }
      }, "sorting");

      onSortChange?.(sortConfigs);
    },
    [enableUrlSync, queueUpdate, getParamName, validateSort, onSortChange, onError],
  );

  const updateFilters = useCallback(
    (filters: Partial<TFilters> | ((prev: Partial<TFilters>) => Partial<TFilters>)) => {
      if (!enableUrlSync) return;

      const newFilters = typeof filters === "function" ? filters(computedState.filters) : filters;

      // Validate filters if validator provided
      if (validateFilters) {
        const error = validateFilters(newFilters);
        if (error) {
          setError(error);
          onError?.(error);
          return;
        }
      }

      queueUpdate((params) => {
        // Clear existing filter params
        Array.from(params.keys()).forEach((key) => {
          if (
            !excludeFromUrl.includes(key) &&
            key !== getParamName("page") &&
            key !== getParamName("pageSize") &&
            key !== getParamName("selected") &&
            key !== getParamName("sort") &&
            key !== getParamName(searchParamName)
          ) {
            params.delete(key);
          }
        });

        // Add new filter params
        if (transformToUrl) {
          const urlParams = transformToUrl(newFilters);
          Object.entries(urlParams).forEach(([key, value]) => {
            if (value) {
              params.set(getParamName(key), value);
            }
          });
        } else {
          // Default transformation
          Object.entries(newFilters).forEach(([key, value]) => {
            if (excludeFromUrl.includes(key)) return;
            if (value === undefined || value === null) return;

            if (Array.isArray(value)) {
              if (value.length > 0) {
                params.set(getParamName(key), JSON.stringify(value));
              }
            } else if (value instanceof Date) {
              params.set(getParamName(key), value.toISOString());
            } else if (typeof value === "object") {
              const serialized = JSON.stringify(value);
              if (serialized !== "{}" && serialized !== "null") {
                params.set(getParamName(key), serialized);
              }
            } else if (typeof value === "boolean") {
              params.set(getParamName(key), value.toString());
            } else {
              params.set(getParamName(key), String(value));
            }
          });
        }

        // Reset to page 1 when filters change
        params.delete(getParamName("page"));

        // Reset selection if configured
        if (resetSelectionOnFilterChange) {
          params.delete(getParamName("selected"));
        }
      }, "filter");

      onFiltersChange?.(newFilters);
    },
    [
      enableUrlSync,
      queueUpdate,
      getParamName,
      computedState.filters,
      validateFilters,
      transformToUrl,
      excludeFromUrl,
      searchParamName,
      resetSelectionOnFilterChange,
      onFiltersChange,
      onError,
    ],
  );

  // Optimistic update function
  const optimisticUpdate = useCallback(
    async <T>(operation: () => Promise<T>, rollback?: () => void): Promise<T> => {
      if (!enableOptimisticUpdates) {
        return operation();
      }

      try {
        setIsLoading(true);
        const result = await operation();
        setOptimisticState({});
        setError(undefined);
        return result;
      } catch (err) {
        rollback?.();
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        setError(errorMessage);
        onError?.(errorMessage);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [enableOptimisticUpdates, onError],
  );

  // API state computation
  const getApiFilters = useCallback((): Partial<TApiFilters> => {
    let apiFilters = computedState.filters;

    if (transformToApi) {
      apiFilters = transformToApi(apiFilters) as Partial<TFilters>;
    }

    return apiFilters as Partial<TApiFilters>;
  }, [computedState.filters, transformToApi]);

  const getQueryParams = useCallback(() => {
    const apiFilters = getApiFilters();
    const result: any = { ...apiFilters };

    // Add search if present
    if (computedState.debouncedSearchText) {
      result.searchingFor = computedState.debouncedSearchText;
    }

    // Add pagination
    if (computedState.page > 1) {
      result.page = computedState.page;
    }
    if (computedState.pageSize !== defaultPageSize) {
      result.pageSize = computedState.pageSize;
    }

    // Add sorting
    if (computedState.sortConfigs.length > 0) {
      result.orderBy = convertSortConfigsToOrderBy(computedState.sortConfigs);
    }

    return result;
  }, [computedState, getApiFilters, defaultPageSize]);

  // Preset management
  const saveAsPreset = useCallback(
    (name: string, description?: string) => {
      if (!enablePresets) return;

      const preset: TableStatePreset<TFilters> = {
        id: `preset_${Date.now()}`,
        name,
        description,
        filters: computedState.filters,
        sort: computedState.sortConfigs,
        pageSize: computedState.pageSize !== defaultPageSize ? computedState.pageSize : undefined,
      };

      setAvailablePresets((prev) => [...prev, preset]);
    },
    [enablePresets, computedState, defaultPageSize],
  );

  const loadPreset = useCallback(
    (presetId: string) => {
      if (!enablePresets) return;

      const preset = availablePresets.find((p) => p.id === presetId);
      if (!preset) return;

      if (enableUrlSync) {
        batchUpdates([
          {
            updater: (params) => {
              // Clear current state
              params.clear();

              // Apply preset
              if (preset.filters) {
                if (transformToUrl) {
                  const urlParams = transformToUrl(preset.filters);
                  Object.entries(urlParams).forEach(([key, value]) => {
                    if (value) params.set(getParamName(key), value);
                  });
                } else {
                  Object.entries(preset.filters).forEach(([key, value]) => {
                    if (value !== undefined && value !== null) {
                      params.set(getParamName(key), JSON.stringify(value));
                    }
                  });
                }
              }

              if (preset.sort && preset.sort.length > 0) {
                params.set(getParamName("sort"), JSON.stringify(preset.sort));
              }

              if (preset.pageSize && preset.pageSize !== defaultPageSize) {
                params.set(getParamName("pageSize"), preset.pageSize.toString());
              }
            },
            action: "batch",
          },
        ]);
      }

      setCurrentPreset(presetId);
    },
    [enablePresets, availablePresets, enableUrlSync, batchUpdates, transformToUrl, getParamName, defaultPageSize],
  );

  const deletePreset = useCallback(
    (presetId: string) => {
      if (!enablePresets) return;

      setAvailablePresets((prev) => prev.filter((p) => p.id !== presetId));
      if (currentPreset === presetId) {
        setCurrentPreset(undefined);
      }
    },
    [enablePresets, currentPreset],
  );

  // Reset functions
  const resetAll = useCallback(() => {
    if (!enableUrlSync) return;

    cancelPendingUpdates();
    queueUpdate((params) => {
      params.clear();
    }, "batch");

    setSearchText("");
    setDebouncedSearchText("");
    setCurrentPreset(undefined);
    setOptimisticState({});
    setError(undefined);
  }, [enableUrlSync, cancelPendingUpdates, queueUpdate]);

  const resetToDefaults = useCallback(() => {
    if (!enableUrlSync) return;

    cancelPendingUpdates();
    batchUpdates([
      {
        updater: (params) => {
          params.clear();

          // Apply defaults
          if (Object.keys(defaultFilters).length > 0) {
            if (transformToUrl) {
              const urlParams = transformToUrl(defaultFilters);
              Object.entries(urlParams).forEach(([key, value]) => {
                if (value) params.set(getParamName(key), value);
              });
            } else {
              Object.entries(defaultFilters).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                  params.set(getParamName(key), JSON.stringify(value));
                }
              });
            }
          }

          if (defaultSort.length > 0) {
            params.set(getParamName("sort"), JSON.stringify(defaultSort));
          }
        },
        action: "batch",
      },
    ]);

    setSearchText("");
    setDebouncedSearchText("");
    setCurrentPreset(undefined);
    setOptimisticState({});
    setError(undefined);
  }, [enableUrlSync, cancelPendingUpdates, batchUpdates, defaultFilters, defaultSort, transformToUrl, getParamName]);

  // State export/import
  const exportState = useCallback(() => {
    const exportData = {
      page: computedState.page,
      pageSize: computedState.pageSize,
      filters: computedState.filters,
      sort: computedState.sortConfigs,
      search: computedState.debouncedSearchText,
      selection: computedState.selectedIds,
      timestamp: Date.now(),
      version: "1.0",
    };
    return JSON.stringify(exportData);
  }, [computedState]);

  const importState = useCallback(
    (stateJson: string): boolean => {
      try {
        const importData = JSON.parse(stateJson);

        if (!importData.version || importData.version !== "1.0") {
          return false;
        }

        if (enableUrlSync) {
          batchUpdates([
            {
              updater: (params) => {
                params.clear();

                // Import state
                if (importData.filters && Object.keys(importData.filters).length > 0) {
                  if (transformToUrl) {
                    const urlParams = transformToUrl(importData.filters);
                    Object.entries(urlParams).forEach(([key, value]) => {
                      if (value) params.set(getParamName(key), value);
                    });
                  } else {
                    Object.entries(importData.filters).forEach(([key, value]) => {
                      if (value !== undefined && value !== null) {
                        params.set(getParamName(key), JSON.stringify(value));
                      }
                    });
                  }
                }

                if (importData.sort && importData.sort.length > 0) {
                  params.set(getParamName("sort"), JSON.stringify(importData.sort));
                }

                if (importData.page && importData.page > 1) {
                  params.set(getParamName("page"), importData.page.toString());
                }

                if (importData.pageSize && importData.pageSize !== defaultPageSize) {
                  params.set(getParamName("pageSize"), importData.pageSize.toString());
                }

                if (importData.search) {
                  params.set(getParamName(searchParamName), importData.search);
                }

                if (importData.selection && importData.selection.length > 0) {
                  params.set(getParamName("selected"), JSON.stringify(importData.selection));
                }
              },
              action: "batch",
            },
          ]);
        }

        if (importData.search) {
          setSearchText(importData.search);
          setDebouncedSearchText(importData.search);
        }

        return true;
      } catch {
        return false;
      }
    },
    [enableUrlSync, batchUpdates, transformToUrl, getParamName, defaultPageSize, searchParamName],
  );

  // Individual action handlers
  const setPage = useCallback(
    (page: number) => {
      updatePagination(Math.max(1, page + 1)); // Convert from 0-based to 1-based
    },
    [updatePagination],
  );

  const setPageSize = useCallback(
    (pageSize: number) => {
      updatePagination(1, Math.max(1, Math.min(maxPageSize, pageSize)));
    },
    [updatePagination, maxPageSize],
  );

  const nextPage = useCallback(() => {
    if (!computedState.hasNextPage) return;
    updatePagination(computedState.page + 1);
  }, [computedState.hasNextPage, computedState.page, updatePagination]);

  const previousPage = useCallback(() => {
    if (!computedState.hasPreviousPage) return;
    updatePagination(Math.max(1, computedState.page - 1));
  }, [computedState.hasPreviousPage, computedState.page, updatePagination]);

  const goToFirstPage = useCallback(() => {
    updatePagination(1);
  }, [updatePagination]);

  const goToLastPage = useCallback(() => {
    if (computedState.totalRecords && computedState.pageSize) {
      const lastPage = Math.ceil(computedState.totalRecords / computedState.pageSize);
      updatePagination(lastPage);
    }
  }, [computedState.totalRecords, computedState.pageSize, updatePagination]);

  const setSelectedIds = useCallback(
    (selectedIds: string[]) => {
      updateSelection(selectedIds);
    },
    [updateSelection],
  );

  const toggleSelection = useCallback(
    (id: string) => {
      const currentSelected = new Set(computedState.selectedIds);
      if (currentSelected.has(id)) {
        currentSelected.delete(id);
      } else {
        currentSelected.add(id);
      }
      updateSelection(Array.from(currentSelected));
    },
    [computedState.selectedIds, updateSelection],
  );

  const toggleSelectAll = useCallback(
    (allIds: string[]) => {
      const isAllSelected = allIds.length > 0 && allIds.every((id) => computedState.selectedIds.includes(id));

      if (isAllSelected) {
        updateSelection([]);
      } else {
        updateSelection(allIds);
      }
    },
    [computedState.selectedIds, updateSelection],
  );

  const selectAll = useCallback(
    (allIds: string[]) => {
      updateSelection(allIds);
    },
    [updateSelection],
  );

  const deselectAll = useCallback(() => {
    updateSelection([]);
  }, [updateSelection]);

  const isSelected = useCallback(
    (id: string) => {
      return computedState.selectedIds.includes(id);
    },
    [computedState.selectedIds],
  );

  const removeFromSelection = useCallback(
    (ids: string[]) => {
      const currentSelected = new Set(computedState.selectedIds);
      ids.forEach((id) => currentSelected.delete(id));
      updateSelection(Array.from(currentSelected));
    },
    [computedState.selectedIds, updateSelection],
  );

  const invertSelection = useCallback(
    (allIds: string[]) => {
      const currentSelected = new Set(computedState.selectedIds);
      const inverted = allIds.filter((id) => !currentSelected.has(id));
      updateSelection(inverted);
    },
    [computedState.selectedIds, updateSelection],
  );

  const setSortConfigs = useCallback(
    (sortConfigs: SortConfig[]) => {
      updateSort(
        sortConfigs.map((config, index) => ({
          ...config,
          priority: config.priority ?? index,
        })),
      );
    },
    [updateSort],
  );

  const addSort = useCallback(
    (column: string, direction: "asc" | "desc" = "asc") => {
      const newConfigs = [...computedState.sortConfigs, { column, direction, priority: computedState.sortConfigs.length }];
      updateSort(newConfigs);
    },
    [computedState.sortConfigs, updateSort],
  );

  const removeSort = useCallback(
    (column: string) => {
      const newConfigs = computedState.sortConfigs.filter((config) => config.column !== column).map((config, index) => ({ ...config, priority: index }));
      updateSort(newConfigs);
    },
    [computedState.sortConfigs, updateSort],
  );

  const toggleSort = useCallback(
    (column: string) => {
      const existingConfigIndex = computedState.sortConfigs.findIndex((config) => config.column === column);

      if (existingConfigIndex === -1) {
        addSort(column, "asc");
      } else {
        const existingConfig = computedState.sortConfigs[existingConfigIndex];
        if (existingConfig.direction === "asc") {
          const newConfigs = [...computedState.sortConfigs];
          newConfigs[existingConfigIndex] = { ...existingConfig, direction: "desc" };
          updateSort(newConfigs);
        } else {
          removeSort(column);
        }
      }
    },
    [computedState.sortConfigs, addSort, removeSort, updateSort],
  );

  const clearSort = useCallback(() => {
    updateSort([]);
  }, [updateSort]);

  const getSortDirection = useCallback(
    (column: string): "asc" | "desc" | null => {
      const config = computedState.sortConfigs.find((config) => config.column === column);
      return config?.direction || null;
    },
    [computedState.sortConfigs],
  );

  const getSortOrder = useCallback(
    (column: string): number | null => {
      const index = computedState.sortConfigs.findIndex((config) => config.column === column);
      return index === -1 ? null : index;
    },
    [computedState.sortConfigs],
  );

  const getSortPriority = useCallback(
    (column: string): number | null => {
      const config = computedState.sortConfigs.find((config) => config.column === column);
      return config?.priority ?? null;
    },
    [computedState.sortConfigs],
  );

  const setSearch = useCallback((text: string) => {
    setSearchText(text);
  }, []);

  const clearSearch = useCallback(() => {
    setSearchText("");
    setDebouncedSearchText("");
  }, []);

  const setFilter = useCallback(
    <K extends keyof TFilters>(key: K, value: TFilters[K] | undefined) => {
      updateFilters((prev) => ({
        ...prev,
        [key]: value,
      }));
    },
    [updateFilters],
  );

  const clearFilter = useCallback(
    (key: keyof TFilters) => {
      updateFilters((prev) => {
        const { [key]: _, ...rest } = prev;
        return rest as Partial<TFilters>;
      });
    },
    [updateFilters],
  );

  const clearAllFilters = useCallback(() => {
    updateFilters({});
  }, [updateFilters]);

  const resetFilters = useCallback(() => {
    updateFilters(defaultFilters);
  }, [updateFilters, defaultFilters]);

  // Compute additional state flags
  const isDefaultState = useMemo(() => {
    return (
      computedState.page === 1 &&
      computedState.pageSize === defaultPageSize &&
      computedState.selectedIds.length === 0 &&
      computedState.sortConfigs.length === 0 &&
      !computedState.debouncedSearchText &&
      JSON.stringify(computedState.filters) === JSON.stringify(defaultFilters)
    );
  }, [computedState, defaultPageSize, defaultFilters]);

  const validateCurrentState = useCallback(() => {
    if (validateFilters) {
      const filterError = validateFilters(computedState.filters);
      if (filterError) return filterError;
    }

    if (validateSort) {
      const sortError = validateSort(computedState.sortConfigs);
      if (sortError) return sortError;
    }

    return null;
  }, [computedState.filters, computedState.sortConfigs, validateFilters, validateSort]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // Return the complete API
  return {
    state: computedState,

    pagination: {
      page: computedState.page - 1, // Convert to 0-based for components
      pageSize: computedState.pageSize,
      totalRecords: computedState.totalRecords,
      hasNextPage: computedState.hasNextPage,
      hasPreviousPage: computedState.hasPreviousPage,
      setPage,
      setPageSize,
      nextPage,
      previousPage,
      goToFirstPage,
      goToLastPage,
      resetPagination: () => updatePagination(1, defaultPageSize),
    },

    selection: {
      selectedIds: computedState.selectedIds,
      selectionCount: computedState.selectionCount,
      isAllSelected: computedState.isAllSelected,
      isPartiallySelected: computedState.isPartiallySelected,
      hasSelection: computedState.selectionCount > 0,
      setSelectedIds,
      toggleSelection,
      toggleSelectAll,
      selectAll,
      deselectAll,
      isSelected,
      removeFromSelection,
      invertSelection,
      resetSelection: () => updateSelection([]),
    },

    sorting: {
      sortConfigs: computedState.sortConfigs,
      primarySort: computedState.primarySort,
      hasSorting: computedState.sortConfigs.length > 0,
      setSortConfigs,
      addSort,
      removeSort,
      toggleSort,
      clearSort,
      getSortDirection,
      getSortOrder,
      getSortPriority,
      resetSort: () => updateSort([]),
    },

    search: {
      searchText: computedState.searchText,
      debouncedSearchText: computedState.debouncedSearchText,
      isSearching: computedState.isSearching,
      setSearch,
      clearSearch,
    },

    filters: {
      filters: computedState.filters,
      activeFilterCount: computedState.activeFilterCount,
      hasActiveFilters: computedState.hasActiveFilters,
      filterIndicators: computedState.filterIndicators,
      setFilters: updateFilters,
      setFilter,
      clearFilter,
      clearAllFilters,
      resetFilters,
      getApiFilters,
    },

    stateManagement: {
      resetAll,
      resetToDefaults,
      getQueryParams,
      saveAsPreset,
      loadPreset,
      deletePreset,
      exportState,
      importState,
    },

    ...(enablePresets && {
      presets: {
        availablePresets,
        currentPreset,
        saveCurrentAsPreset: saveAsPreset,
        loadPreset,
        deletePreset,
        isDefaultPreset: (presetId: string) => {
          const preset = availablePresets.find((p) => p.id === presetId);
          return preset?.isDefault ?? false;
        },
      },
    }),

    utils: {
      hasAnyState: computedState.hasAnyState,
      isDefaultState,
      getStateSignature: () => generateStateSignature(computedState),
      validateCurrentState,
      optimisticUpdate,
    },
  };
}
