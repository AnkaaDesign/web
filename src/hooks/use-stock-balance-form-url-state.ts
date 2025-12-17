import { useCallback, useMemo } from "react";
import { z } from "zod";
import { useUrlFilters } from "./use-url-filters";

/**
 * Stock Balance Form URL State Hook
 *
 * Manages state for the stock balance form including:
 * - Selected items for counting
 * - Original quantities (current stock)
 * - Counted quantities (user input)
 * - Filters and pagination
 */

interface UseStockBalanceFormUrlStateOptions {
  defaultCountedQuantity?: number;
  preserveQuantitiesOnDeselect?: boolean;
  defaultPageSize?: number;
}

// Filter schemas for stock balance form
const stockBalanceFormFilterConfig = {
  // Selection state
  selectedItems: {
    schema: z.array(z.string()).default([]),
    defaultValue: [] as string[],
    debounceMs: 0,
  },
  // Counted quantities (user input)
  countedQuantities: {
    schema: z.record(z.string(), z.number().min(0)).default({}),
    defaultValue: {} as Record<string, number>,
    debounceMs: 0,
  },
  // Original quantities (current stock at time of selection)
  originalQuantities: {
    schema: z.record(z.string(), z.number().min(0)).default({}),
    defaultValue: {} as Record<string, number>,
    debounceMs: 0,
  },

  // View options
  showSelectedOnly: {
    schema: z.coerce.boolean().default(false),
    defaultValue: false,
    debounceMs: 0,
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
    debounceMs: 0,
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

export function useStockBalanceFormUrlState(options: UseStockBalanceFormUrlStateOptions = {}) {
  const { defaultCountedQuantity = 0, preserveQuantitiesOnDeselect = true, defaultPageSize = 40 } = options;

  // Update config with custom default page size if provided
  const configWithDefaults = useMemo(() => {
    if (defaultPageSize === 40) return stockBalanceFormFilterConfig;

    return {
      ...stockBalanceFormFilterConfig,
      pageSize: {
        ...stockBalanceFormFilterConfig.pageSize,
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

  // Memoized quantities and filters
  const countedQuantities = filters.countedQuantities || {};
  const originalQuantities = filters.originalQuantities || {};
  const showSelectedOnly = filters.showSelectedOnly !== undefined ? filters.showSelectedOnly : false;
  const searchTerm = filters.searchTerm || "";
  const showInactive = filters.showInactive !== undefined ? filters.showInactive : false;
  const categoryIds = filters.categoryIds || [];
  const brandIds = filters.brandIds || [];
  const supplierIds = filters.supplierIds || [];
  const page = filters.page || 1;
  const pageSize = filters.pageSize || defaultPageSize;
  const totalRecords = filters.totalRecords || 0;

  // Update functions
  const setShowSelectedOnly = useCallback(
    (show: boolean) => {
      setFilters({
        showSelectedOnly: show,
        page: undefined,
      });
    },
    [setFilters],
  );

  const setSearchTerm = useCallback(
    (term: string) => {
      setFilter("searchTerm", term === "" ? undefined : term);
      if (filters.page !== 1) {
        setFilter("page", undefined);
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
        page: undefined,
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
    (itemId: string) => {
      const newSelected = new Set(selectedItems);
      const newCountedQuantities = { ...countedQuantities };
      const newOriginalQuantities = { ...originalQuantities };

      if (newSelected.has(itemId)) {
        // Deselect
        newSelected.delete(itemId);
        if (!preserveQuantitiesOnDeselect) {
          delete newCountedQuantities[itemId];
          delete newOriginalQuantities[itemId];
        }
      } else {
        // Select - quantities will be set by handleSelectItem in the page
        newSelected.add(itemId);
      }

      setFilters({
        selectedItems: Array.from(newSelected),
        countedQuantities: Object.keys(newCountedQuantities).length > 0 ? newCountedQuantities : undefined,
        originalQuantities: Object.keys(newOriginalQuantities).length > 0 ? newOriginalQuantities : undefined,
      });
    },
    [selectedItems, countedQuantities, originalQuantities, preserveQuantitiesOnDeselect, setFilters],
  );

  // Helper to clear all selections
  const clearAllSelections = useCallback(() => {
    setFilters({
      selectedItems: undefined,
      countedQuantities: undefined,
      originalQuantities: undefined,
    });
  }, [setFilters]);

  // Helper to set counted quantity for an item
  const setItemCountedQuantity = useCallback(
    (itemId: string, quantity: number) => {
      if (quantity < 0) return;

      const newSelected = new Set(selectedItems);
      newSelected.add(itemId);

      const newCountedQuantities = { ...countedQuantities, [itemId]: quantity };

      setFilters({
        selectedItems: Array.from(newSelected),
        countedQuantities: Object.keys(newCountedQuantities).length > 0 ? newCountedQuantities : undefined,
      });
    },
    [countedQuantities, selectedItems, setFilters],
  );

  // Helper to set original quantity for an item (called when selecting)
  const setItemOriginalQuantity = useCallback(
    (itemId: string, quantity: number) => {
      if (quantity < 0) return;

      const newOriginalQuantities = { ...originalQuantities, [itemId]: quantity };

      setFilter("originalQuantities", Object.keys(newOriginalQuantities).length > 0 ? newOriginalQuantities : undefined);
    },
    [originalQuantities, setFilter],
  );

  // Atomic helper to select an item with its original stock quantity
  // This prevents race conditions by updating all state in one call
  const selectItemWithOriginalQuantity = useCallback(
    (itemId: string, originalStock: number) => {
      if (originalStock < 0) return;

      const newSelected = new Set(selectedItems);
      const isCurrentlySelected = newSelected.has(itemId);

      if (isCurrentlySelected) {
        // Deselecting - just toggle
        newSelected.delete(itemId);
        const newCountedQuantities = { ...countedQuantities };
        const newOriginalQuantities = { ...originalQuantities };
        if (!preserveQuantitiesOnDeselect) {
          delete newCountedQuantities[itemId];
          delete newOriginalQuantities[itemId];
        }
        setFilters({
          selectedItems: Array.from(newSelected),
          countedQuantities: Object.keys(newCountedQuantities).length > 0 ? newCountedQuantities : undefined,
          originalQuantities: Object.keys(newOriginalQuantities).length > 0 ? newOriginalQuantities : undefined,
        });
      } else {
        // Selecting - add item and set both original and counted quantities atomically
        newSelected.add(itemId);
        const newOriginalQuantities = { ...originalQuantities, [itemId]: originalStock };
        const newCountedQuantities = { ...countedQuantities, [itemId]: originalStock }; // Default counted to original

        setFilters({
          selectedItems: Array.from(newSelected),
          originalQuantities: Object.keys(newOriginalQuantities).length > 0 ? newOriginalQuantities : undefined,
          countedQuantities: Object.keys(newCountedQuantities).length > 0 ? newCountedQuantities : undefined,
        });
      }
    },
    [selectedItems, countedQuantities, originalQuantities, preserveQuantitiesOnDeselect, setFilters],
  );

  // Get items with differences (for submission)
  const getItemsWithDifferences = useCallback(() => {
    return Array.from(selectedItems)
      .map((itemId) => {
        const original = originalQuantities[itemId] ?? 0;
        const counted = countedQuantities[itemId] ?? original;
        const difference = counted - original;

        return {
          itemId,
          originalQuantity: original,
          countedQuantity: counted,
          difference,
        };
      })
      .filter((item) => item.difference !== 0);
  }, [selectedItems, originalQuantities, countedQuantities]);

  // Get all selected items with data
  const getSelectedItemsWithData = useCallback(() => {
    return Array.from(selectedItems).map((itemId) => {
      const original = originalQuantities[itemId] ?? 0;
      const counted = countedQuantities[itemId] ?? original;

      return {
        itemId,
        originalQuantity: original,
        countedQuantity: counted,
        difference: counted - original,
      };
    });
  }, [selectedItems, originalQuantities, countedQuantities]);

  return {
    // State
    selectedItems,
    countedQuantities,
    originalQuantities,
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
    setItemCountedQuantity,
    setItemOriginalQuantity,
    selectItemWithOriginalQuantity,
    getItemsWithDifferences,
    getSelectedItemsWithData,

    // Computed values
    selectionCount: selectedItems.size,
    hasActiveFilters:
      isFilterActive("showInactive") || isFilterActive("categoryIds") || isFilterActive("brandIds") || isFilterActive("supplierIds") || isFilterActive("searchTerm"),
    totalPages: totalRecords > 0 ? Math.ceil(totalRecords / pageSize) : 1,
    hasNextPage: page < Math.ceil(totalRecords / pageSize),
    hasPrevPage: page > 1,

    // URL state management functions
    resetFilter,
    resetFilters,
    isFilterActive,
    activeFilterCount,
  };
}
