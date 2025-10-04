import { useCallback, useMemo } from "react";
import { z } from "zod";
import { useUrlFilters } from "./use-url-filters";

/**
 * Generic Item Form URL State Hook
 *
 * Important behaviors:
 * - Manages selected items and their quantities in URL state
 * - Global userId is applied to all items (optional)
 * - Use preserveQuantitiesOnDeselect option to keep values when deselecting items
 * - Supports any item type filtering (tools, materials, ppe, etc.)
 */

interface UseItemFormUrlStateOptions {
  defaultQuantity?: number;
  preserveQuantitiesOnDeselect?: boolean;
  defaultPageSize?: number;
  itemTypeFilter?: string; // e.g., "TOOL", "MATERIAL", "PPE"
}

// Filter schemas for generic item form
const itemFormFilterConfig = {
  // Selection state
  selectedItems: {
    schema: z.array(z.string()).default([]),
    defaultValue: [] as string[],
  },
  quantities: {
    schema: z.record(z.string(), z.number().min(0.01)).default({}),
    defaultValue: {} as Record<string, number>,
  },

  // Global settings
  globalUserId: {
    schema: z.string().optional(),
  },
  showSelectedOnly: {
    schema: z.coerce.boolean().default(false),
    defaultValue: false,
    debounceMs: 0, // Immediate update for boolean switches
  },

  // Filters
  searchTerm: {
    schema: z.string().default(""),
    defaultValue: "",
    debounceMs: 300,
  },
  showInactive: {
    schema: z.coerce.boolean().default(false),
    defaultValue: false,
    debounceMs: 0, // Immediate update for boolean switches
  },
  categoryIds: {
    schema: z.array(z.string()).default([]),
    defaultValue: [] as string[],
  },
  brandIds: {
    schema: z.array(z.string()).default([]),
    defaultValue: [] as string[],
  },
  supplierIds: {
    schema: z.array(z.string()).default([]),
    defaultValue: [] as string[],
  },

  // Pagination state
  page: {
    schema: z.coerce.number().int().positive().default(1),
    defaultValue: 1,
  },
  pageSize: {
    schema: z.coerce.number().int().positive().min(1).max(100).default(40),
    defaultValue: 40,
  },
  totalRecords: {
    schema: z.coerce.number().int().min(0).default(0),
    defaultValue: 0,
  },
} as const;

export function useItemFormUrlState(options: UseItemFormUrlStateOptions = {}) {
  const { defaultQuantity = 1, preserveQuantitiesOnDeselect = false, defaultPageSize = 40, itemTypeFilter } = options;

  // Update itemFormFilterConfig with custom default page size if provided
  const configWithDefaults = useMemo(() => {
    if (defaultPageSize === 40) return itemFormFilterConfig;

    return {
      ...itemFormFilterConfig,
      pageSize: {
        ...itemFormFilterConfig.pageSize,
        defaultValue: defaultPageSize,
        schema: z.coerce.number().int().positive().min(1).max(100).default(defaultPageSize),
      },
    };
  }, [defaultPageSize]);

  const { filters, setFilter, setFilters, resetFilter, resetFilters, isFilterActive, activeFilterCount } = useUrlFilters(configWithDefaults);

  // Convert selectedItems array to Set for easier manipulation
  const selectedItems = useMemo(() => {
    return new Set<string>(filters.selectedItems || []);
  }, [filters.selectedItems]);

  // Memoized quantities and other filters
  const quantities = filters.quantities || {};
  const globalUserId = filters.globalUserId;
  const showSelectedOnly = filters.showSelectedOnly;
  const searchTerm = filters.searchTerm;
  const showInactive = filters.showInactive;
  const categoryIds = filters.categoryIds || [];
  const brandIds = filters.brandIds || [];
  const supplierIds = filters.supplierIds || [];

  // Pagination
  const page = filters.page;
  const pageSize = filters.pageSize;
  const totalRecords = filters.totalRecords;

  // Selection count
  const selectionCount = selectedItems.size;

  // Toggle item selection
  const toggleItemSelection = useCallback(
    (itemId: string) => {
      const currentSelected = filters.selectedItems || [];
      const currentQuantities = filters.quantities || {};

      if (currentSelected.includes(itemId)) {
        // Remove from selection
        const newSelected = currentSelected.filter((id) => id !== itemId);

        let newQuantities = { ...currentQuantities };
        if (!preserveQuantitiesOnDeselect && newQuantities[itemId] !== undefined) {
          delete newQuantities[itemId];
        }

        setFilters({
          selectedItems: newSelected,
          quantities: newQuantities,
        });
      } else {
        // Add to selection with default quantity
        const newSelected = [...currentSelected, itemId];
        const newQuantities = {
          ...currentQuantities,
          [itemId]: currentQuantities[itemId] || defaultQuantity,
        };

        setFilters({
          selectedItems: newSelected,
          quantities: newQuantities,
        });
      }
    },
    [filters.selectedItems, filters.quantities, preserveQuantitiesOnDeselect, defaultQuantity, setFilters],
  );

  // Set item quantity
  const setItemQuantity = useCallback(
    (itemId: string, quantity: number) => {
      const newQuantities = {
        ...quantities,
        [itemId]: quantity,
      };
      setFilter("quantities", newQuantities);
    },
    [quantities, setFilter],
  );

  // Update global user ID
  const updateGlobalUserId = useCallback(
    (userId: string | undefined) => {
      setFilter("globalUserId", userId);
    },
    [setFilter],
  );

  // Clear all selections
  const clearAllSelections = useCallback(() => {
    setFilters({
      selectedItems: [],
      quantities: {},
    });
  }, [setFilters]);

  // Pagination handlers
  const setPage = useCallback(
    (newPage: number) => {
      setFilter("page", newPage);
    },
    [setFilter],
  );

  const setPageSize = useCallback(
    (newPageSize: number) => {
      setFilters({
        pageSize: newPageSize,
        page: 1, // Reset to first page when changing page size
      });
    },
    [setFilters],
  );

  const setTotalRecords = useCallback(
    (total: number) => {
      setFilter("totalRecords", total);
    },
    [setFilter],
  );

  // Filter handlers
  const setShowSelectedOnly = useCallback(
    (show: boolean) => {
      setFilter("showSelectedOnly", show);
    },
    [setFilter],
  );

  const setSearchTerm = useCallback(
    (term: string) => {
      setFilter("searchTerm", term);
    },
    [setFilter],
  );

  const setShowInactive = useCallback(
    (show: boolean) => {
      setFilter("showInactive", show);
    },
    [setFilter],
  );

  const setCategoryIds = useCallback(
    (ids: string[]) => {
      setFilter("categoryIds", ids);
    },
    [setFilter],
  );

  const setBrandIds = useCallback(
    (ids: string[]) => {
      setFilter("brandIds", ids);
    },
    [setFilter],
  );

  const setSupplierIds = useCallback(
    (ids: string[]) => {
      setFilter("supplierIds", ids);
    },
    [setFilter],
  );

  // Get selected items with quantities for submission
  const getSelectedItemsForSubmission = useCallback(() => {
    return Array.from(selectedItems).map((itemId) => ({
      itemId,
      quantity: quantities[itemId] || defaultQuantity,
      userId: globalUserId,
    }));
  }, [selectedItems, quantities, defaultQuantity, globalUserId]);

  // Check if an item is selected
  const isSelected = useCallback(
    (itemId: string) => {
      return selectedItems.has(itemId);
    },
    [selectedItems],
  );

  return {
    // Selection state
    selectedItems,
    quantities,
    globalUserId,
    showSelectedOnly,

    // Filter state
    searchTerm,
    showInactive,
    categoryIds,
    brandIds,
    supplierIds,

    // Pagination state
    page,
    pageSize,
    totalRecords,

    // Computed values
    selectionCount,

    // Actions
    toggleItemSelection,
    setItemQuantity,
    updateGlobalUserId,
    clearAllSelections,

    // Pagination actions
    setPage,
    setPageSize,
    setTotalRecords,

    // Filter actions
    setShowSelectedOnly,
    setSearchTerm,
    setShowInactive,
    setCategoryIds,
    setBrandIds,
    setSupplierIds,

    // Utilities
    getSelectedItemsForSubmission,
    isSelected,

    // Configuration
    itemTypeFilter,

    // Raw filter state for advanced usage
    filters,
    setFilter,
    setFilters,
    resetFilter,
    resetFilters,
    isFilterActive,
    activeFilterCount,
  };
}
