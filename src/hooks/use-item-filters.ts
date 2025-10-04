import { useCallback, useMemo } from "react";
import { z } from "zod";
import { useUrlFilters } from "./use-url-filters";
import type { ItemGetManyFormData, ItemOrderBy, ItemInclude } from "../schemas";
import { MEASURE_UNIT, STOCK_LEVEL } from "../constants";

// Filter state interface matching itemGetManySchema
export interface ItemFilters {
  // Search
  searchingFor?: string;

  // Boolean filters
  isActive?: boolean;
  isPpe?: boolean;
  shouldAssignToUser?: boolean;
  hasBarcode?: boolean;
  hasSupplier?: boolean;
  hasActivities?: boolean;
  hasBorrows?: boolean;
  lowStock?: boolean;
  outOfStock?: boolean;
  overStock?: boolean;

  // Array filters
  itemIds?: string[];
  brandIds?: string[];
  categoryIds?: string[];
  supplierIds?: string[];
  barcodes?: string[];
  names?: string[];
  stockLevels?: STOCK_LEVEL[];

  // Range filters
  quantityRange?: {
    min?: number;
    max?: number;
  };
  taxRange?: {
    min?: number;
    max?: number;
  };
  monthlyConsumptionRange?: {
    min?: number;
    max?: number;
  };

  // Date filters
  createdAt?: {
    gte?: Date;
    lte?: Date;
  };
  updatedAt?: {
    gte?: Date;
    lte?: Date;
  };

  // Measure unit filter
  measureUnit?: MEASURE_UNIT | null;

  // Pagination
  page?: number;
  limit?: number;

  // Sorting
  orderBy?: ItemOrderBy;

  // Include relations
  include?: ItemInclude;
}

// Define filter schemas
const filterSchemas = {
  // Search
  searchingFor: {
    schema: z.string().min(1),
    debounceMs: 500, // Custom debounce for search
  },

  // Boolean filters
  isActive: {
    schema: z.coerce.boolean(),
    defaultValue: undefined,
  },
  isPpe: {
    schema: z.coerce.boolean(),
  },
  shouldAssignToUser: {
    schema: z.coerce.boolean(),
  },
  hasBarcode: {
    schema: z.coerce.boolean(),
  },
  hasSupplier: {
    schema: z.coerce.boolean(),
  },
  hasActivities: {
    schema: z.coerce.boolean(),
  },
  hasBorrows: {
    schema: z.coerce.boolean(),
  },
  lowStock: {
    schema: z.coerce.boolean(),
  },
  outOfStock: {
    schema: z.coerce.boolean(),
  },
  overStock: {
    schema: z.coerce.boolean(),
  },

  // Array filters
  itemIds: {
    schema: z.array(z.string()),
    defaultValue: [],
  },
  brandIds: {
    schema: z.array(z.string()),
    defaultValue: [],
  },
  categoryIds: {
    schema: z.array(z.string()),
    defaultValue: [],
  },
  supplierIds: {
    schema: z.array(z.string()),
    defaultValue: [],
  },
  barcodes: {
    schema: z.array(z.string()),
    defaultValue: [],
  },
  names: {
    schema: z.array(z.string()),
    defaultValue: [],
  },
  stockLevels: {
    schema: z.array(z.nativeEnum(STOCK_LEVEL)),
    defaultValue: [],
  },

  // Range filters
  quantityRange: {
    schema: z.object({
      min: z.coerce.number().optional(),
      max: z.coerce.number().optional(),
    }),
  },
  taxRange: {
    schema: z.object({
      min: z.coerce.number().optional(),
      max: z.coerce.number().optional(),
    }),
  },
  monthlyConsumptionRange: {
    schema: z.object({
      min: z.coerce.number().optional(),
      max: z.coerce.number().optional(),
    }),
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

  // Measure unit
  measureUnit: {
    schema: z.nativeEnum(MEASURE_UNIT).nullable().optional(),
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
        name: z.enum(["asc", "desc"]).optional(),
        quantity: z.enum(["asc", "desc"]).optional(),
        tax: z.enum(["asc", "desc"]).optional(),
        monthlyConsumption: z.enum(["asc", "desc"]).optional(),
        createdAt: z.enum(["asc", "desc"]).optional(),
        updatedAt: z.enum(["asc", "desc"]).optional(),
      }),
      z.array(
        z.object({
          id: z.enum(["asc", "desc"]).optional(),
          name: z.enum(["asc", "desc"]).optional(),
          quantity: z.enum(["asc", "desc"]).optional(),
          tax: z.enum(["asc", "desc"]).optional(),
          monthlyConsumption: z.enum(["asc", "desc"]).optional(),
          createdAt: z.enum(["asc", "desc"]).optional(),
          updatedAt: z.enum(["asc", "desc"]).optional(),
        }),
      ),
    ]),
    defaultValue: { name: "asc" },
  },

  // Include relations
  include: {
    schema: z.object({
      brand: z.boolean().optional(),
      category: z.boolean().optional(),
      supplier: z.boolean().optional(),
      prices: z.boolean().optional(),
      activities: z.boolean().optional(),
      borrows: z.boolean().optional(),
      orderItems: z.boolean().optional(),
      ppeConfigs: z.boolean().optional(),
      ppeDeliveries: z.boolean().optional(),
      orderRules: z.boolean().optional(),
      externalWithdrawalItems: z.boolean().optional(),
      relatedItems: z.boolean().optional(),
      relatedTo: z.boolean().optional(),
      maintenance: z.boolean().optional(),
      maintenanceItemsNeeded: z.boolean().optional(),
      formulaComponents: z.boolean().optional(),
      count: z.boolean().optional(),
    }),
    defaultValue: {
      brand: true,
      category: true,
      supplier: true,
      prices: true,
    },
  },
};

export interface UseItemFiltersOptions {
  debounceMs?: number;
  defaultFilters?: Partial<ItemFilters>;
}

export interface UseItemFiltersReturn {
  // Current filter state
  filters: ItemFilters;

  // Filter update functions
  setFilter: <K extends keyof ItemFilters>(key: K, value: ItemFilters[K] | undefined) => void;
  setFilters: (filters: Partial<ItemFilters>) => void;
  updateFilter: <K extends keyof ItemFilters>(key: K, updater: (prev: ItemFilters[K]) => ItemFilters[K] | undefined) => void;

  // Filter reset functions
  resetFilter: <K extends keyof ItemFilters>(key: K) => void;
  resetFilters: () => void;
  resetToDefaults: () => void;

  // Filter state helpers
  isFilterActive: <K extends keyof ItemFilters>(key: K) => boolean;
  activeFilterCount: number;
  activeFilters: Partial<ItemFilters>;

  // Convenience setters for common filters
  setSearch: (search: string | undefined) => void;
  toggleBoolean: (
    key: keyof Pick<
      ItemFilters,
      "isActive" | "isPpe" | "shouldAssignToUser" | "hasBarcode" | "hasSupplier" | "hasActivities" | "hasBorrows" | "lowStock" | "outOfStock" | "overStock"
    >,
  ) => void;
  addToArrayFilter: (key: keyof Pick<ItemFilters, "itemIds" | "brandIds" | "categoryIds" | "supplierIds" | "barcodes" | "names" | "stockLevels">, value: string) => void;
  removeFromArrayFilter: (key: keyof Pick<ItemFilters, "itemIds" | "brandIds" | "categoryIds" | "supplierIds" | "barcodes" | "names" | "stockLevels">, value: string) => void;
  setRangeFilter: (key: keyof Pick<ItemFilters, "quantityRange" | "taxRange" | "monthlyConsumptionRange">, min?: number, max?: number) => void;
  setDateRange: (key: keyof Pick<ItemFilters, "createdAt" | "updatedAt">, start?: Date, end?: Date) => void;

  // Transform to API format
  toApiParams: () => ItemGetManyFormData;
}

export function useItemFilters(options: UseItemFiltersOptions = {}): UseItemFiltersReturn {
  const { defaultFilters = {} } = options;

  // Merge default filters with schema defaults
  const mergedFilterSchemas = useMemo(() => {
    const schemas = { ...filterSchemas };

    // Apply default filters from options
    Object.entries(defaultFilters).forEach(([key, value]) => {
      if (key in schemas) {
        const schemaKey = key as keyof typeof schemas;
        (schemas as any)[schemaKey] = {
          ...(schemas as any)[schemaKey],
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
    <K extends keyof ItemFilters>(key: K, updater: (prev: ItemFilters[K]) => ItemFilters[K] | undefined) => {
      const currentValue = getFilter(key) as ItemFilters[K];
      const newValue = updater(currentValue);
      setFilter(key, newValue as any);
    },
    [setFilter, getFilter],
  );

  // Reset to default values
  const resetToDefaults = useCallback(() => {
    const defaults: Partial<ItemFilters> = {};

    Object.entries(mergedFilterSchemas).forEach(([key, config]) => {
      if ("defaultValue" in config && config.defaultValue !== undefined) {
        (defaults as any)[key] = config.defaultValue;
      }
    });

    setFilters(defaults as any);
  }, [mergedFilterSchemas, setFilters]);

  // Get active filters (excluding defaults)
  const activeFilters = useMemo(() => {
    const active: Partial<ItemFilters> = {};

    Object.entries(filters).forEach(([key, value]) => {
      if (isFilterActive(key as keyof ItemFilters)) {
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

  const toggleBoolean = useCallback(
    (
      key: keyof Pick<
        ItemFilters,
        "isActive" | "isPpe" | "shouldAssignToUser" | "hasBarcode" | "hasSupplier" | "hasActivities" | "hasBorrows" | "lowStock" | "outOfStock" | "overStock"
      >,
    ) => {
      // Use updateFilter to avoid dependency on filters object
      updateFilter(key, (prev) => !prev);
    },
    [updateFilter],
  );

  const addToArrayFilter = useCallback(
    (key: keyof Pick<ItemFilters, "itemIds" | "brandIds" | "categoryIds" | "supplierIds" | "barcodes" | "names" | "stockLevels">, value: string) => {
      const current = (getFilter(key) as string[]) || [];
      if (!current.includes(value)) {
        setFilter(key, [...current, value]);
      }
    },
    [getFilter, setFilter],
  );

  const removeFromArrayFilter = useCallback(
    (key: keyof Pick<ItemFilters, "itemIds" | "brandIds" | "categoryIds" | "supplierIds" | "barcodes" | "names" | "stockLevels">, value: string) => {
      const current = (getFilter(key) as string[]) || [];
      const updated = current.filter((v) => v !== value);
      setFilter(key, updated.length > 0 ? updated : undefined);
    },
    [getFilter, setFilter],
  );

  const setRangeFilter = useCallback(
    (key: keyof Pick<ItemFilters, "quantityRange" | "taxRange" | "monthlyConsumptionRange">, min?: number, max?: number) => {
      if (min === undefined && max === undefined) {
        setFilter(key, undefined);
      } else {
        setFilter(key, { min, max });
      }
    },
    [setFilter],
  );

  const setDateRange = useCallback(
    (key: keyof Pick<ItemFilters, "createdAt" | "updatedAt">, start?: Date, end?: Date) => {
      if (!start && !end) {
        setFilter(key, undefined);
      } else {
        setFilter(key, { gte: start, lte: end });
      }
    },
    [setFilter],
  );

  // Transform filters to API format
  const toApiParams = useCallback((): ItemGetManyFormData => {
    const params: ItemGetManyFormData = {};

    // Copy all filters that match the schema
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        (params as any)[key] = value;
      }
    });

    // Ensure defaults are included
    if (!params.page) params.page = 1;
    if (!params.limit) params.limit = 20;
    if (!params.orderBy) params.orderBy = { name: "asc" };
    if (!params.include) {
      params.include = {
        brand: true,
        category: true,
        supplier: true,
        prices: true,
      };
    }

    return params;
  }, [filters]);

  return {
    // Current filter state
    filters: filters as ItemFilters,

    // Filter update functions
    setFilter: setFilter as <K extends keyof ItemFilters>(key: K, value: ItemFilters[K] | undefined) => void,
    setFilters: setFilters as (filters: Partial<ItemFilters>) => void,
    updateFilter,

    // Filter reset functions
    resetFilter: resetFilter as <K extends keyof ItemFilters>(key: K) => void,
    resetFilters,
    resetToDefaults,

    // Filter state helpers
    isFilterActive,
    activeFilterCount,
    activeFilters,

    // Convenience setters
    setSearch,
    toggleBoolean,
    addToArrayFilter,
    removeFromArrayFilter,
    setRangeFilter,
    setDateRange,

    // Transform to API format
    toApiParams,
  };
}

// Example usage:
/*
const ItemListPage = () => {
  const {
    filters,
    setSearch,
    toggleBoolean,
    addToArrayFilter,
    removeFromArrayFilter,
    setRangeFilter,
    activeFilterCount,
    resetFilters,
    toApiParams,
  } = useItemFilters({
    defaultFilters: {
      isActive: true,
      limit: 50,
    },
  });
  
  // Use with API hook
  const { data, isLoading } = useItems(toApiParams());
  
  return (
    <div>
      <input
        value={filters.searchingFor || ""}
        onChange={(e) => setSearch(e.target.value || undefined)}
        placeholder="Buscar items..."
      />
      
      <button onClick={() => toggleBoolean("isActive")}>
        {filters.isActive ? "Mostrar inativos" : "Mostrar ativos"}
      </button>
      
      <button onClick={() => toggleBoolean("lowStock")}>
        {filters.lowStock ? "Todos os items" : "Estoque baixo"}
      </button>
      
      <select
        multiple
        value={filters.categoryIds || []}
        onChange={(e) => {
          const selected = Array.from(e.target.selectedOptions, option => option.value);
          setFilter("categoryIds", selected.length > 0 ? selected : undefined);
        }}
      >
        {categories.map(cat => (
          <option key={cat.id} value={cat.id}>{cat.name}</option>
        ))}
      </select>
      
      <div>
        <input
          type="number"
          placeholder="Quantidade mínima"
          value={filters.quantityRange?.min || ""}
          onChange={(e) => {
            const min = e.target.value ? Number(e.target.value) : undefined;
            setRangeFilter("quantityRange", min, filters.quantityRange?.max);
          }}
        />
        <input
          type="number"
          placeholder="Quantidade máxima"
          value={filters.quantityRange?.max || ""}
          onChange={(e) => {
            const max = e.target.value ? Number(e.target.value) : undefined;
            setRangeFilter("quantityRange", filters.quantityRange?.min, max);
          }}
        />
      </div>
      
      <button onClick={resetFilters} disabled={activeFilterCount === 0}>
        Limpar filtros ({activeFilterCount})
      </button>
      
      {isLoading ? (
        <div>Carregando...</div>
      ) : (
        <ItemList items={data?.data || []} />
      )}
    </div>
  );
};
*/
