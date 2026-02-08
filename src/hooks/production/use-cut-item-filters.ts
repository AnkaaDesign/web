import { useCallback, useMemo } from "react";
import { z } from "zod";
import { useUrlFilters } from "../common/use-url-filters";
import type { CutGetManyFormData, CutOrderBy, CutInclude } from "../../schemas";
import { CUT_STATUS, CUT_TYPE, CUT_ORIGIN, CUT_REQUEST_REASON } from "../../constants";

// Filter state interface matching cutGetManySchema
export interface CutFilters {
  // Search
  searchingFor?: string;

  // Array filters
  status?: CUT_STATUS[];
  type?: CUT_TYPE[];
  origin?: CUT_ORIGIN[];
  reason?: CUT_REQUEST_REASON[];
  fileIds?: string[];
  taskIds?: string[];
  parentCutIds?: string[];

  // Date filters
  createdAt?: {
    gte?: Date;
    lte?: Date;
  };
  updatedAt?: {
    gte?: Date;
    lte?: Date;
  };
  startedAt?: {
    gte?: Date;
    lte?: Date;
  };
  completedAt?: {
    gte?: Date;
    lte?: Date;
  };

  // Pagination
  page?: number;
  limit?: number;

  // Sorting
  orderBy?: CutOrderBy;

  // Include relations
  include?: CutInclude;
}

// Define filter schemas
const filterSchemas = {
  // Search
  searchingFor: {
    schema: z.string().min(1),
    debounceMs: 500, // Custom debounce for search
  },

  // Array filters
  status: {
    schema: z.array(z.nativeEnum(CUT_STATUS)),
    defaultValue: [],
  },
  type: {
    schema: z.array(z.nativeEnum(CUT_TYPE)),
    defaultValue: [],
  },
  origin: {
    schema: z.array(z.nativeEnum(CUT_ORIGIN)),
    defaultValue: [],
  },
  reason: {
    schema: z.array(z.nativeEnum(CUT_REQUEST_REASON)),
    defaultValue: [],
  },
  fileIds: {
    schema: z.array(z.string()),
    defaultValue: [],
  },
  taskIds: {
    schema: z.array(z.string()),
    defaultValue: [],
  },
  parentCutIds: {
    schema: z.array(z.string()),
    defaultValue: [],
  },

  // Date filters
  createdAt: {
    schema: z.object({
      gte: z.coerce.date().optional(),
      lte: z.coerce.date().optional(),
    }),
  },
  updatedAt: {
    schema: z.object({
      gte: z.coerce.date().optional(),
      lte: z.coerce.date().optional(),
    }),
  },
  startedAt: {
    schema: z.object({
      gte: z.coerce.date().optional(),
      lte: z.coerce.date().optional(),
    }),
  },
  completedAt: {
    schema: z.object({
      gte: z.coerce.date().optional(),
      lte: z.coerce.date().optional(),
    }),
  },

  // Pagination
  page: {
    schema: z.coerce.number().int().positive(),
    defaultValue: 1,
  },
  limit: {
    schema: z.coerce.number().int().positive().max(100),
    defaultValue: 20,
  },

  // Sorting
  orderBy: {
    schema: z.union([
      z.object({
        id: z.enum(["asc", "desc"]).optional(),
        fileId: z.enum(["asc", "desc"]).optional(),
        type: z.enum(["asc", "desc"]).optional(),
        status: z.enum(["asc", "desc"]).optional(),
        statusOrder: z.enum(["asc", "desc"]).optional(),
        startedAt: z.enum(["asc", "desc"]).optional(),
        completedAt: z.enum(["asc", "desc"]).optional(),
        createdAt: z.enum(["asc", "desc"]).optional(),
        updatedAt: z.enum(["asc", "desc"]).optional(),
      }),
      z.array(
        z.object({
          id: z.enum(["asc", "desc"]).optional(),
          fileId: z.enum(["asc", "desc"]).optional(),
          type: z.enum(["asc", "desc"]).optional(),
          status: z.enum(["asc", "desc"]).optional(),
          statusOrder: z.enum(["asc", "desc"]).optional(),
          startedAt: z.enum(["asc", "desc"]).optional(),
          completedAt: z.enum(["asc", "desc"]).optional(),
          createdAt: z.enum(["asc", "desc"]).optional(),
          updatedAt: z.enum(["asc", "desc"]).optional(),
        }),
      ),
    ]),
    defaultValue: { createdAt: "desc" },
  },

  // Include relations
  include: {
    schema: z.object({
      file: z.boolean().optional(),
      task: z
        .union([
          z.boolean(),
          z.object({
            include: z
              .object({
                customer: z.boolean().optional(),
                sector: z.boolean().optional(),
                services: z.boolean().optional(),
              })
              .optional(),
          }),
        ])
        .optional(),
      parentCut: z
        .union([
          z.boolean(),
          z.object({
            include: z
              .object({
                file: z.boolean().optional(),
              })
              .optional(),
          }),
        ])
        .optional(),
      childCuts: z
        .union([
          z.boolean(),
          z.object({
            include: z
              .object({
                file: z.boolean().optional(),
              })
              .optional(),
          }),
        ])
        .optional(),
    }),
    defaultValue: {
      file: true,
      task: {
        include: {
          customer: true,
        },
      },
      parentCut: {
        include: {
          file: true,
        },
      },
    },
  },
};

export interface UseCutFiltersOptions {
  debounceMs?: number;
  defaultFilters?: Partial<CutFilters>;
}

export interface UseCutFiltersReturn {
  // Current filter state
  filters: CutFilters;

  // Filter update functions
  setFilter: <K extends keyof CutFilters>(key: K, value: CutFilters[K] | undefined) => void;
  setFilters: (filters: Partial<CutFilters>) => void;
  updateFilter: <K extends keyof CutFilters>(key: K, updater: (prev: CutFilters[K]) => CutFilters[K] | undefined) => void;

  // Filter reset functions
  resetFilter: <K extends keyof CutFilters>(key: K) => void;
  resetFilters: () => void;
  resetToDefaults: () => void;
  clearFilters: () => void;

  // Filter state helpers
  isFilterActive: <K extends keyof CutFilters>(key: K) => boolean;
  activeFilterCount: number;
  activeFilters: Partial<CutFilters>;

  // Convenience setters for common filters
  setSearch: (search: string | undefined) => void;
  addToArrayFilter: (key: keyof Pick<CutFilters, "status" | "type" | "origin" | "reason" | "fileIds" | "taskIds" | "parentCutIds">, value: string) => void;
  removeFromArrayFilter: (key: keyof Pick<CutFilters, "status" | "type" | "origin" | "reason" | "fileIds" | "taskIds" | "parentCutIds">, value: string) => void;
  setDateRange: (key: keyof Pick<CutFilters, "createdAt" | "updatedAt" | "startedAt" | "completedAt">, start?: Date, end?: Date) => void;

  // Transform to API format
  toApiParams: () => CutGetManyFormData;
}

export function useCutItemFilters(options: UseCutFiltersOptions = {}): UseCutFiltersReturn {
  const { defaultFilters = {} } = options;

  // Merge default filters with schema defaults
  const mergedFilterSchemas = useMemo(() => {
    const schemas = { ...filterSchemas };

    // Apply default filters from options
    Object.entries(defaultFilters).forEach(([key, value]) => {
      if (key in schemas) {
        (schemas as any)[key] = {
          ...(schemas as any)[key],
          defaultValue: value,
        };
      }
    });

    return schemas;
  }, [defaultFilters]);

  // Use URL filters hook
  const { filters, setFilter, setFilters, resetFilter, resetFilters, isFilterActive, activeFilterCount, getFilter } = useUrlFilters(mergedFilterSchemas);

  // Update filter with callback - using getFilter for stable reference
  const updateFilter = useCallback(
    <K extends keyof CutFilters>(key: K, updater: (prev: CutFilters[K]) => CutFilters[K] | undefined) => {
      const currentValue = getFilter(key) as CutFilters[K];
      const newValue = updater(currentValue);
      setFilter(key, newValue as any);
    },
    [setFilter, getFilter],
  );

  // Reset to default values
  const resetToDefaults = useCallback(() => {
    const defaults: Partial<CutFilters> = {};

    Object.entries(mergedFilterSchemas).forEach(([key, config]) => {
      if ("defaultValue" in config && config.defaultValue !== undefined) {
        (defaults as any)[key] = config.defaultValue;
      }
    });

    setFilters(defaults as any);
  }, [mergedFilterSchemas, setFilters]);

  // Clear all filters
  const clearFilters = useCallback(() => {
    resetFilters();
  }, [resetFilters]);

  // Get active filters (excluding defaults)
  const activeFilters = useMemo(() => {
    const active: Partial<CutFilters> = {};

    Object.entries(filters).forEach(([key, value]) => {
      if (isFilterActive(key as keyof CutFilters)) {
        (active as any)[key] = value;
      }
    });

    return active;
  }, [filters, isFilterActive]);

  // Convenience setters
  const setSearch = useCallback(
    (search: string | undefined) => {
      setFilter("searchingFor", search);
    },
    [setFilter],
  );

  const addToArrayFilter = useCallback(
    (key: keyof Pick<CutFilters, "status" | "type" | "origin" | "reason" | "fileIds" | "taskIds" | "parentCutIds">, value: string) => {
      const current = getFilter(key) || [];
      if (!current.includes(value)) {
        setFilter(key, [...current, value]);
      }
    },
    [getFilter, setFilter],
  );

  const removeFromArrayFilter = useCallback(
    (key: keyof Pick<CutFilters, "status" | "type" | "origin" | "reason" | "fileIds" | "taskIds" | "parentCutIds">, value: string) => {
      const current = getFilter(key) || [];
      const updated = current.filter((v) => v !== value);
      setFilter(key, updated.length > 0 ? updated : undefined);
    },
    [getFilter, setFilter],
  );

  const setDateRange = useCallback(
    (key: keyof Pick<CutFilters, "createdAt" | "updatedAt" | "startedAt" | "completedAt">, start?: Date, end?: Date) => {
      if (!start && !end) {
        setFilter(key, undefined);
      } else {
        setFilter(key, { gte: start, lte: end });
      }
    },
    [setFilter],
  );

  // Transform filters to API format
  const toApiParams = useCallback((): CutGetManyFormData => {
    const params: CutGetManyFormData = {};

    // Copy all filters that match the schema
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        (params as any)[key] = value;
      }
    });

    // Ensure defaults are included
    if (!params.page) params.page = 1;
    if (!params.limit) params.limit = 20;
    if (!params.orderBy) params.orderBy = { createdAt: "desc" };
    if (!params.include) {
      params.include = {
        file: true,
        task: {
          include: {
            customer: true,
          },
        },
        parentCut: {
          include: {
            file: true,
          },
        },
      };
    }

    return params;
  }, [filters]);

  return {
    // Current filter state
    filters: filters as CutFilters,

    // Filter update functions
    setFilter: setFilter as <K extends keyof CutFilters>(key: K, value: CutFilters[K] | undefined) => void,
    setFilters: setFilters as (filters: Partial<CutFilters>) => void,
    updateFilter,

    // Filter reset functions
    resetFilter: resetFilter as <K extends keyof CutFilters>(key: K) => void,
    resetFilters,
    resetToDefaults,
    clearFilters,

    // Filter state helpers
    isFilterActive,
    activeFilterCount,
    activeFilters,

    // Convenience setters
    setSearch,
    addToArrayFilter,
    removeFromArrayFilter,
    setDateRange,

    // Transform to API format
    toApiParams,
  };
}
