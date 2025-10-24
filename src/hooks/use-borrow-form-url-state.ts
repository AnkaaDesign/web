import { useCallback, useMemo } from "react";
import { z } from "zod";
import { useUrlFilters } from "./use-url-filters";

/**
 * Borrow Form URL State Hook
 *
 * Important behaviors:
 * - Manages selected items and their quantities in URL state
 * - Global userId is applied to all borrows
 * - Use preserveQuantitiesOnDeselect option to keep values when deselecting items
 */

interface UseBorrowFormUrlStateOptions {
  defaultQuantity?: number;
  preserveQuantitiesOnDeselect?: boolean;
  defaultPageSize?: number;
}

// Filter schemas for borrow form
const borrowFormFilterConfig = {
  // Selection state
  selectedItems: {
    schema: z.array(z.string()).default([]),
    defaultValue: [] as string[],
    debounceMs: 0, // Immediate update for selected items
  },
  quantities: {
    schema: z.record(z.string(), z.number().int().min(1)).default({}),
    defaultValue: {} as Record<string, number>,
    debounceMs: 0, // Immediate update for quantities
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

export function useBorrowFormUrlState(options: UseBorrowFormUrlStateOptions = {}) {
  const { defaultQuantity = 1, preserveQuantitiesOnDeselect = false, defaultPageSize = 40 } = options;

  // No refs needed anymore as useUrlFilters handles debouncing internally

  // Update borrowFormFilterConfig with custom default page size if provided
  const configWithDefaults = useMemo(() => {
    if (defaultPageSize === 40) return borrowFormFilterConfig;

    return {
      ...borrowFormFilterConfig,
      pageSize: {
        ...borrowFormFilterConfig.pageSize,
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
  const showSelectedOnly = filters.showSelectedOnly !== undefined ? filters.showSelectedOnly : false;
  const searchTerm = filters.searchTerm || "";
  const showInactive = filters.showInactive !== undefined ? filters.showInactive : false;
  const categoryIds = filters.categoryIds || [];
  const brandIds = filters.brandIds || [];
  const supplierIds = filters.supplierIds || [];
  const page = filters.page || 1;
  const pageSize = filters.pageSize || defaultPageSize;
  const totalRecords = filters.totalRecords || 0;

  // Update functions using the standardized hook
  const updateSelectedItems = useCallback(
    (newSelected: Set<string>) => {
      const selectedArray = Array.from(newSelected);
      setFilter("selectedItems", selectedArray.length > 0 ? selectedArray : undefined);
    },
    [setFilter],
  );

  const updateQuantities = useCallback(
    (newQuantities: Record<string, number>) => {
      const filtered = Object.fromEntries(
        Object.entries(newQuantities)
          .filter(([_, v]) => v >= 1 && Number.isInteger(v))
      );

      setFilter("quantities", Object.keys(filtered).length > 0 ? filtered : undefined);
    },
    [setFilter],
  );

  const updateGlobalUserId = useCallback(
    (userId: string | undefined) => {
      setFilter("globalUserId", userId);
    },
    [setFilter],
  );

  const setShowSelectedOnly = useCallback(
    (show: boolean) => {
      setFilters({
        showSelectedOnly: show,
        page: undefined, // Reset to page 1 when toggling filter
      });
    },
    [setFilters],
  );

  const setSearchTerm = useCallback(
    (term: string) => {
      // Use setFilter for searchTerm to get debouncing, and immediate update for page reset
      setFilter("searchTerm", term === "" ? undefined : term);
      if (filters.page !== 1) {
        setFilter("page", undefined); // Reset to page 1 when searching
      }
    },
    [setFilter, filters.page],
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

  // Pagination functions
  const setPage = useCallback(
    (newPage: number) => {
      const validPage = Math.max(1, newPage);
      setFilter("page", validPage === 1 ? undefined : validPage);
    },
    [setFilter],
  );

  const setPageSize = useCallback(
    (newPageSize: number) => {
      const validPageSize = Math.max(1, Math.min(100, newPageSize));
      setFilters({
        pageSize: validPageSize === defaultPageSize ? undefined : validPageSize,
        page: undefined, // Reset to page 1 when changing page size
      });
    },
    [setFilters, defaultPageSize],
  );

  const setTotalRecords = useCallback(
    (total: number) => {
      const validTotal = Math.max(0, total);
      setFilter("totalRecords", validTotal === 0 ? undefined : validTotal);
    },
    [setFilter],
  );

  // Helper to toggle item selection
  const toggleItemSelection = useCallback(
    (itemId: string, quantity?: number) => {
      const newSelected = new Set(selectedItems);
      const newQuantities = { ...quantities };

      if (newSelected.has(itemId)) {
        // Deselect
        newSelected.delete(itemId);
        if (!preserveQuantitiesOnDeselect) {
          delete newQuantities[itemId];
        }
      } else {
        // Select
        newSelected.add(itemId);
        newQuantities[itemId] = quantity || quantities[itemId] || defaultQuantity;
      }

      // Batch update all related state
      setFilters({
        selectedItems: Array.from(newSelected),
        quantities: newQuantities,
      });
    },
    [selectedItems, quantities, defaultQuantity, preserveQuantitiesOnDeselect, setFilters],
  );

  // Helper to clear all selections
  const clearAllSelections = useCallback(() => {
    const resetData: any = {
      selectedItems: undefined,
    };

    if (!preserveQuantitiesOnDeselect) {
      resetData.quantities = undefined;
    }

    setFilters(resetData);
  }, [preserveQuantitiesOnDeselect, setFilters]);

  // Helper to set quantity for an item
  const setItemQuantity = useCallback(
    (itemId: string, quantity: number) => {
      // Validate quantity is at least 1 and is an integer
      if (quantity < 1 || !Number.isInteger(quantity)) {
        return;
      }

      // Ensure the item is selected and update quantity atomically
      const newSelected = new Set(selectedItems);
      newSelected.add(itemId); // Ensure item is selected

      const newQuantities = { ...quantities, [itemId]: quantity };

      // Batch update to avoid race conditions
      setFilters({
        selectedItems: Array.from(newSelected),
        quantities: Object.keys(newQuantities).length > 0 ? newQuantities : undefined,
      });
    },
    [quantities, selectedItems, setFilters],
  );

  // Get selected items with data
  const getSelectedItemsWithData = useCallback(() => {
    return Array.from(selectedItems).map((id) => ({
      id,
      quantity: quantities[id] || defaultQuantity,
      userId: globalUserId,
    }));
  }, [selectedItems, quantities, defaultQuantity, globalUserId]);

  return {
    // State
    selectedItems,
    quantities,
    globalUserId,
    showSelectedOnly,
    searchTerm,
    showInactive,
    categoryIds,
    brandIds,
    supplierIds,
    page,
    pageSize,
    totalRecords,

    // Update functions
    updateSelectedItems,
    updateQuantities,
    updateGlobalUserId,
    setShowSelectedOnly,
    setSearchTerm,
    setShowInactive,
    setCategoryIds,
    setBrandIds,
    setSupplierIds,
    setPage,
    setPageSize,
    setTotalRecords,

    // Helper functions
    toggleItemSelection,
    clearAllSelections,
    setItemQuantity,
    getSelectedItemsWithData,

    // Computed values
    selectionCount: selectedItems.size,
    hasActiveFilters:
      isFilterActive("showInactive") || isFilterActive("categoryIds") || isFilterActive("brandIds") || isFilterActive("supplierIds") || isFilterActive("searchTerm"),
    totalPages: totalRecords > 0 ? Math.ceil(totalRecords / pageSize) : 1,
    hasNextPage: page < Math.ceil(totalRecords / pageSize),
    hasPrevPage: page > 1,

    // URL state management functions from useUrlFilters
    resetFilter,
    resetFilters,
    isFilterActive,
    activeFilterCount,
  };
}
