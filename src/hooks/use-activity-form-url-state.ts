import { useCallback, useMemo } from "react";
import { z } from "zod";
import { ACTIVITY_OPERATION } from "../constants";
import { useUrlFilters } from "./use-url-filters";

/**
 * Activity Form URL State Hook
 *
 * Important behaviors:
 * - Manages selected items and their quantities in URL state
 * - Global operation and userId are applied to all activities
 * - Use preserveQuantitiesOnDeselect option to keep values when deselecting items
 */

interface UseActivityFormUrlStateOptions {
  defaultQuantity?: number;
  defaultOperation?: ACTIVITY_OPERATION;
  preserveQuantitiesOnDeselect?: boolean;
  defaultPageSize?: number;
}

// Filter schemas for activity form
const activityFormFilterConfig = {
  // Selection state
  selectedItems: {
    schema: z.array(z.string()).default([]),
    defaultValue: [] as string[],
    debounceMs: 0, // Immediate update for selected items
  },
  quantities: {
    schema: z.record(z.string(), z.number().min(0.01)).default({}),
    defaultValue: {} as Record<string, number>,
    debounceMs: 0, // Immediate update for quantities
  },

  // Individual item settings
  operations: {
    schema: z.record(z.string(), z.enum(Object.values(ACTIVITY_OPERATION) as [string, ...string[]])).default({}),
    defaultValue: {} as Record<string, ACTIVITY_OPERATION>,
    debounceMs: 0, // Immediate update for operations
  },
  userIds: {
    schema: z.record(z.string(), z.string()).default({}),
    defaultValue: {} as Record<string, string>,
    debounceMs: 0, // Immediate update for userIds
  },

  // Global settings
  globalUserId: {
    schema: z.string().optional(),
  },
  globalOperation: {
    schema: z.enum(Object.values(ACTIVITY_OPERATION) as [string, ...string[]]).default(ACTIVITY_OPERATION.OUTBOUND),
    defaultValue: ACTIVITY_OPERATION.OUTBOUND,
  },
  useGlobalUser: {
    schema: z.coerce.boolean().default(false),
    defaultValue: false,
    debounceMs: 0,
  },
  useGlobalOperation: {
    schema: z.coerce.boolean().default(true),
    defaultValue: true,
    debounceMs: 0,
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

export function useActivityFormUrlState(options: UseActivityFormUrlStateOptions = {}) {
  const { defaultQuantity = 1, defaultOperation = ACTIVITY_OPERATION.OUTBOUND, preserveQuantitiesOnDeselect = false, defaultPageSize = 40 } = options;

  // No refs needed anymore as useUrlFilters handles debouncing internally

  // Update activityFormFilterConfig with custom default page size if provided
  const configWithDefaults = useMemo(() => {
    if (defaultPageSize === 40) return activityFormFilterConfig;

    return {
      ...activityFormFilterConfig,
      pageSize: {
        ...activityFormFilterConfig.pageSize,
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
  const operations = filters.operations || {};
  const userIds = filters.userIds || {};
  const globalUserId = filters.globalUserId;
  const globalOperation = filters.globalOperation || defaultOperation;
  const useGlobalUser = filters.useGlobalUser !== undefined ? filters.useGlobalUser : false;
  const useGlobalOperation = filters.useGlobalOperation !== undefined ? filters.useGlobalOperation : true;
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
      const filtered = Object.fromEntries(Object.entries(newQuantities).filter(([_, v]) => v >= 0.01));

      setFilter("quantities", Object.keys(filtered).length > 0 ? filtered : undefined);
    },
    [setFilter],
  );

  const updateOperations = useCallback(
    (newOperations: Record<string, ACTIVITY_OPERATION>) => {
      const filtered = Object.fromEntries(Object.entries(newOperations).filter(([_, v]) => v !== undefined)) as Record<string, ACTIVITY_OPERATION>;

      const valueToSet = Object.keys(filtered).length > 0 ? filtered : undefined;
      setFilter("operations", valueToSet);
    },
    [setFilter],
  );

  const updateUserIds = useCallback(
    (newUserIds: Record<string, string | undefined>) => {
      const filtered = Object.fromEntries(Object.entries(newUserIds).filter(([_, v]) => v !== undefined && v !== "")) as Record<string, string>;

      const valueToSet = Object.keys(filtered).length > 0 ? filtered : undefined;
      setFilter("userIds", valueToSet);
    },
    [setFilter],
  );

  const updateGlobalUserId = useCallback(
    (userId: string | undefined) => {
      setFilter("globalUserId", userId);
    },
    [setFilter],
  );

  const updateGlobalOperation = useCallback(
    (operation: ACTIVITY_OPERATION) => {
      // Always set the operation, don't set to undefined
      setFilter("globalOperation", operation);
    },
    [setFilter],
  );

  const updateUseGlobalUser = useCallback(
    (useGlobal: boolean) => {
      // Always explicitly set the boolean value, never undefined
      setFilter("useGlobalUser", useGlobal);
      // Note: Individual userIds are preserved in the URL state when toggling off
      // This ensures users don't lose their individual selections
    },
    [setFilter],
  );

  const updateUseGlobalOperation = useCallback(
    (useGlobal: boolean) => {
      // Always explicitly set the boolean value, never undefined
      setFilter("useGlobalOperation", useGlobal);
      // Note: Individual operations are preserved in the URL state when toggling off
      // This ensures users don't lose their individual selections
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
      // Validate quantity is at least 0.01
      if (quantity < 0.01) {
        return;
      }

      // Ensure the item is selected and update quantity atomically
      const newSelected = new Set(selectedItems);
      newSelected.add(itemId); // Ensure item is selected

      const newQuantities = { ...quantities, [itemId]: quantity };

      // Batch update - only update selectedItems and quantities
      // Don't include operations/userIds to avoid race conditions
      setFilters({
        selectedItems: Array.from(newSelected),
        quantities: Object.keys(newQuantities).length > 0 ? newQuantities : undefined,
      });
    },
    [quantities, selectedItems, setFilters],
  );

  // Helper to set operation for an item
  const setItemOperation = useCallback(
    (itemId: string, operation: ACTIVITY_OPERATION) => {
      const newOperations = { ...operations, [itemId]: operation } as Record<string, ACTIVITY_OPERATION>;
      updateOperations(newOperations);
    },
    [operations, updateOperations],
  );

  // Helper to set user for an item
  const setItemUser = useCallback(
    (itemId: string, userId: string | undefined) => {
      const newUserIds = { ...userIds };
      if (userId) {
        newUserIds[itemId] = userId;
      } else {
        delete newUserIds[itemId];
      }
      updateUserIds(newUserIds);
    },
    [userIds, updateUserIds],
  );

  // Get selected items with data
  const getSelectedItemsWithData = useCallback(() => {
    return Array.from(selectedItems).map((id) => ({
      id,
      quantity: quantities[id] || defaultQuantity,
      operation: useGlobalOperation ? globalOperation : operations[id] || defaultOperation,
      userId: useGlobalUser ? globalUserId : userIds[id],
    }));
  }, [selectedItems, quantities, operations, userIds, defaultQuantity, defaultOperation, globalOperation, globalUserId, useGlobalOperation, useGlobalUser]);

  // Batch update selected items and quantities atomically
  const batchUpdateSelection = useCallback(
    (newSelected: Set<string>, newQuantities: Record<string, number>) => {
      const selectedArray = Array.from(newSelected);
      const filteredQuantities = Object.fromEntries(Object.entries(newQuantities).filter(([_, v]) => v >= 0.01));

      setFilters({
        selectedItems: selectedArray.length > 0 ? selectedArray : undefined,
        quantities: Object.keys(filteredQuantities).length > 0 ? filteredQuantities : undefined,
      });
    },
    [setFilters],
  );

  return {
    // State
    selectedItems,
    quantities,
    operations,
    userIds,
    globalUserId,
    globalOperation,
    useGlobalUser,
    useGlobalOperation,
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
    updateOperations,
    updateUserIds,
    updateGlobalUserId,
    updateGlobalOperation,
    updateUseGlobalUser,
    updateUseGlobalOperation,
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
    setItemOperation,
    setItemUser,
    getSelectedItemsWithData,
    batchUpdateSelection,

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
