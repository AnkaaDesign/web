import { useCallback, useMemo } from "react";
import { z } from "zod";
import { useUrlFilters } from "./use-url-filters";

/**
 * Order Form URL State Hook
 *
 * Important behaviors:
 * - Manages selected items, their quantities, prices, and tax in URL state
 * - Manages form data (description, supplierId, forecast, notes) in URL state
 * - Handles form validation state
 * - Persists all state in URL for page refresh recovery
 * - Use preserveQuantitiesOnDeselect option to keep values when deselecting items
 */

export interface OrderFormValidationState {
  isValid: boolean;
  errors: {
    description?: string;
    supplierId?: string;
    selectedItems?: string;
    quantities?: Record<string, string>;
    prices?: Record<string, string>;
  };
}

interface UseOrderFormUrlStateOptions {
  defaultQuantity?: number;
  defaultPrice?: number;
  defaultTax?: number;
  preserveQuantitiesOnDeselect?: boolean;
  defaultPageSize?: number;
  initialData?: {
    description?: string;
    supplierId?: string;
    forecast?: Date | null;
    notes?: string;
    selectedItems?: Set<string>;
    quantities?: Record<string, number>;
    prices?: Record<string, number>;
    taxes?: Record<string, number>;
    criticalItems?: Set<string>;
  };
}

// Filter schemas for order form
const orderFormFilterConfig = {
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
  prices: {
    schema: z.record(z.string(), z.number().min(0)).default({}),
    defaultValue: {} as Record<string, number>,
    debounceMs: 0, // Immediate update for prices
  },
  taxes: {
    schema: z.record(z.string(), z.number().min(0).max(100)).default({}),
    defaultValue: {} as Record<string, number>,
    debounceMs: 0, // Immediate update for taxes
  },
  criticalItems: {
    schema: z.array(z.string()).default([]),
    defaultValue: [] as string[],
    debounceMs: 0, // Immediate update for critical items
  },

  // Form data state (persisted in URL)
  description: {
    schema: z.string().default(""),
    defaultValue: "",
    debounceMs: 0, // immediate update
  },
  supplierId: {
    schema: z.string().uuid().optional(),
    defaultValue: undefined as string | undefined,
    debounceMs: 0,
  },
  forecast: {
    schema: z.coerce.date().nullable().optional(),
    defaultValue: undefined as Date | null | undefined,
    debounceMs: 0,
  },
  notes: {
    schema: z.string().default(""),
    defaultValue: "",
    debounceMs: 300,
  },

  // Filter state
  showSelectedOnly: {
    schema: z.coerce.boolean().default(false),
    defaultValue: false,
    debounceMs: 0,
  },

  // Item filters
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
    debounceMs: 0, // Immediate update
  },
  brandIds: {
    schema: z.array(z.string()).default([]),
    defaultValue: [] as string[],
    debounceMs: 0, // Immediate update
  },
  supplierIds: {
    schema: z.array(z.string()).default([]),
    defaultValue: [] as string[],
    debounceMs: 0, // Immediate update
  },

  // Pagination state
  page: {
    schema: z.coerce.number().int().positive().default(1),
    defaultValue: 1,
    debounceMs: 0, // Immediate update
  },
  pageSize: {
    schema: z.coerce.number().int().positive().min(1).max(100).default(40),
    defaultValue: 40,
  },
  totalRecords: {
    schema: z.coerce.number().int().min(0).default(0),
    defaultValue: 0,
  },

  // Sorting state
  sortConfigs: {
    schema: z
      .array(
        z.object({
          column: z.string(),
          direction: z.enum(["asc", "desc"]),
        }),
      )
      .default([]),
    defaultValue: [] as Array<{ column: string; direction: "asc" | "desc" }>,
  },
} as const;

export function useOrderFormUrlState(options: UseOrderFormUrlStateOptions = {}) {
  const { defaultQuantity = 1, defaultPrice = 0, defaultTax = 0, preserveQuantitiesOnDeselect = false, defaultPageSize = 40, initialData } = options;

  // Update orderFormFilterConfig with custom defaults and initial data
  const configWithDefaults = useMemo(() => {
    const config = { ...orderFormFilterConfig };

    // Update page size if custom
    if (defaultPageSize !== 40) {
      config.pageSize = {
        ...config.pageSize,
        defaultValue: defaultPageSize as any,
        schema: z.coerce.number().int().positive().min(1).max(100).default(defaultPageSize) as any,
      };
    }

    // Apply initial data if provided
    if (initialData) {
      if (initialData.description !== undefined) {
        config.description = {
          ...config.description,
          defaultValue: initialData.description as any,
        };
      }
      if (initialData.supplierId !== undefined) {
        config.supplierId = {
          ...config.supplierId,
          defaultValue: initialData.supplierId as any,
        };
      }
      if (initialData.forecast !== undefined) {
        config.forecast = {
          ...config.forecast,
          defaultValue: initialData.forecast as any,
        };
      }
      if (initialData.notes !== undefined) {
        config.notes = {
          ...config.notes,
          defaultValue: initialData.notes as any,
        };
      }
      if (initialData.selectedItems) {
        config.selectedItems = {
          ...config.selectedItems,
          defaultValue: Array.from(initialData.selectedItems),
        };
      }
      if (initialData.quantities) {
        config.quantities = {
          ...config.quantities,
          defaultValue: initialData.quantities,
        };
      }
      if (initialData.prices) {
        config.prices = {
          ...config.prices,
          defaultValue: initialData.prices,
        };
      }
      if (initialData.taxes) {
        config.taxes = {
          ...config.taxes,
          defaultValue: initialData.taxes,
        };
      }
      if (initialData.criticalItems) {
        config.criticalItems = {
          ...config.criticalItems,
          defaultValue: Array.from(initialData.criticalItems),
        };
      }
    }

    return config;
  }, [defaultPageSize, initialData]);

  const { filters, setFilter, setFilters, resetFilter, resetFilters, isFilterActive, activeFilterCount } = useUrlFilters(configWithDefaults);

  // Convert selectedItems array to Set for easier manipulation
  const selectedItems = useMemo(() => {
    return new Set<string>(filters.selectedItems || []);
  }, [filters.selectedItems]);

  // Convert criticalItems array to Set
  const criticalItems = useMemo(() => {
    return new Set<string>(filters.criticalItems || []);
  }, [filters.criticalItems]);

  // Memoized state values
  const quantities = filters.quantities || {};
  const prices = filters.prices || {};
  const taxes = filters.taxes || {};
  const description = filters.description || "";
  const supplierId = filters.supplierId;
  const forecast = filters.forecast;
  const notes = filters.notes || "";
  const showSelectedOnly = filters.showSelectedOnly !== undefined ? filters.showSelectedOnly : false;
  const searchTerm = filters.searchTerm || "";
  const showInactive = filters.showInactive !== undefined ? filters.showInactive : false;
  const categoryIds = filters.categoryIds || [];
  const brandIds = filters.brandIds || [];
  const supplierIds = filters.supplierIds || [];
  const page = filters.page || 1;
  const pageSize = filters.pageSize || defaultPageSize;
  const totalRecords = filters.totalRecords || 0;
  const sortConfigs = filters.sortConfigs || [];

  // Update functions using the standardized hook
  const updateSelectedItems = useCallback(
    (newSelected: Set<string>) => {
      const selectedArray = Array.from(newSelected);
      setFilter("selectedItems", selectedArray.length > 0 ? selectedArray : undefined);
    },
    [setFilter],
  );


  const updateDescription = useCallback(
    (desc: string) => {
      // Always set the value, even if empty
      // Use empty string to preserve the field in URL
      setFilter("description", desc);
    },
    [setFilter],
  );

  const updateSupplierId = useCallback(
    (id: string | undefined) => {
      setFilter("supplierId", id);
    },
    [setFilter],
  );

  const updateForecast = useCallback(
    (date: Date | null | undefined) => {
      setFilter("forecast", date);
    },
    [setFilter],
  );

  const updateNotes = useCallback(
    (text: string) => {
      setFilter("notes", text === "" ? undefined : text);
    },
    [setFilter],
  );

  // Form validation logic
  const validation = useMemo((): OrderFormValidationState => {
    const errors: OrderFormValidationState["errors"] = {};
    let isValid = true;

    // Validate description
    if (!description.trim() || description.length < 1) {
      errors.description = "Descrição é obrigatória";
      isValid = false;
    } else if (description.length > 500) {
      errors.description = "Descrição deve ter no máximo 500 caracteres";
      isValid = false;
    }

    // Validate selected items
    if (selectedItems.size === 0) {
      errors.selectedItems = "Selecione pelo menos um item";
      isValid = false;
    }

    // Validate quantities
    const quantityErrors: Record<string, string> = {};
    Array.from(selectedItems).forEach((itemId) => {
      const quantity = quantities[itemId];
      if (!quantity || quantity < 0.01) {
        quantityErrors[itemId] = "Quantidade deve ser maior que 0";
        isValid = false;
      }
    });
    if (Object.keys(quantityErrors).length > 0) {
      errors.quantities = quantityErrors;
    }

    // Validate prices
    const priceErrors: Record<string, string> = {};
    Array.from(selectedItems).forEach((itemId) => {
      const price = prices[itemId];
      if (price === undefined || price < 0) {
        priceErrors[itemId] = "Preço deve ser maior ou igual a 0";
        isValid = false;
      }
    });
    if (Object.keys(priceErrors).length > 0) {
      errors.prices = priceErrors;
    }

    return {
      isValid,
      errors,
    };
  }, [description, selectedItems, quantities, prices]);

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

  // Batch update filters to avoid race conditions
  const setBatchFilters = useCallback(
    (updates: { showInactive?: boolean; categoryIds?: string[]; brandIds?: string[]; supplierIds?: string[]; resetPage?: boolean }) => {
      const { resetPage, ...filterUpdates } = updates;

      setFilters({
        ...(filterUpdates.showInactive !== undefined && { showInactive: filterUpdates.showInactive }),
        ...(filterUpdates.categoryIds !== undefined && { categoryIds: filterUpdates.categoryIds }),
        ...(filterUpdates.brandIds !== undefined && { brandIds: filterUpdates.brandIds }),
        ...(filterUpdates.supplierIds !== undefined && { supplierIds: filterUpdates.supplierIds }),
        ...(resetPage && { page: undefined }), // Reset to page 1 in same batch
      });
    },
    [setFilters],
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

  // Sorting functions
  const setSortConfigs = useCallback(
    (configs: Array<{ column: string; direction: "asc" | "desc" }>) => {
      setFilter("sortConfigs", configs.length > 0 ? configs : undefined);
    },
    [setFilter],
  );

  const toggleSort = useCallback(
    (column: string) => {
      const newConfigs = [...sortConfigs];
      const existingIndex = newConfigs.findIndex((config) => config.column === column);

      if (existingIndex >= 0) {
        const currentDirection = newConfigs[existingIndex].direction;
        if (currentDirection === "asc") {
          newConfigs[existingIndex].direction = "desc";
        } else {
          // Remove from sort
          newConfigs.splice(existingIndex, 1);
        }
      } else {
        // Add new sort
        newConfigs.push({ column, direction: "asc" });
      }

      setSortConfigs(newConfigs);
    },
    [sortConfigs, setSortConfigs],
  );

  const getSortDirection = useCallback(
    (column: string): "asc" | "desc" | null => {
      const config = sortConfigs.find((c) => c.column === column);
      return config ? config.direction : null;
    },
    [sortConfigs],
  );

  const getSortOrder = useCallback(
    (column: string): number | null => {
      const index = sortConfigs.findIndex((c) => c.column === column);
      return index >= 0 ? index : null;
    },
    [sortConfigs],
  );

  // Helper to toggle item selection
  const toggleItemSelection = useCallback(
    (itemId: string, quantity?: number, price?: number, tax?: number) => {
      const newSelected = new Set(selectedItems);
      const newQuantities = { ...quantities };
      const newPrices = { ...prices };
      const newTaxes = { ...taxes };

      if (newSelected.has(itemId)) {
        // Item is already selected - check if we should deselect or just update values
        // If no explicit values are provided, this is a toggle to deselect
        if (quantity === undefined && price === undefined && tax === undefined) {
          // Deselect
          newSelected.delete(itemId);
          if (!preserveQuantitiesOnDeselect) {
            delete newQuantities[itemId];
            delete newPrices[itemId];
            delete newTaxes[itemId];
          }
        } else {
          // Update existing item values without deselecting
          // Preserve existing values if new ones aren't provided
          if (quantity !== undefined) {
            newQuantities[itemId] = quantity;
          }
          if (price !== undefined) {
            newPrices[itemId] = price;
          }
          if (tax !== undefined) {
            newTaxes[itemId] = tax;
          }
        }
      } else {
        // Select new item
        newSelected.add(itemId);
        newQuantities[itemId] = quantity || quantities[itemId] || defaultQuantity;
        newPrices[itemId] = price !== undefined ? price : prices[itemId] !== undefined ? prices[itemId] : defaultPrice;
        newTaxes[itemId] = tax !== undefined ? tax : taxes[itemId] !== undefined ? taxes[itemId] : defaultTax;
      }

      // Batch update all related state
      const hasChanges =
        newSelected.size !== selectedItems.size ||
        JSON.stringify(newQuantities) !== JSON.stringify(quantities) ||
        JSON.stringify(newPrices) !== JSON.stringify(prices) ||
        JSON.stringify(newTaxes) !== JSON.stringify(taxes);

      if (hasChanges) {
        setFilters({
          selectedItems: newSelected.size > 0 ? Array.from(newSelected) : undefined,
          quantities: Object.keys(newQuantities).length > 0 ? newQuantities : undefined,
          prices: Object.keys(newPrices).length > 0 ? newPrices : undefined,
          taxes: Object.keys(newTaxes).length > 0 ? newTaxes : undefined,
        });
      }
    },
    [selectedItems, quantities, prices, taxes, defaultQuantity, defaultPrice, defaultTax, preserveQuantitiesOnDeselect, setFilters],
  );

  // Helper to toggle critical status
  const toggleCriticalItem = useCallback(
    (itemId: string) => {
      // Ensure the item is selected when toggling critical status
      const newSelected = new Set(selectedItems);
      newSelected.add(itemId); // Ensure item is selected

      const newCritical = new Set(criticalItems);
      if (newCritical.has(itemId)) {
        newCritical.delete(itemId);
      } else {
        newCritical.add(itemId);
      }

      // Batch update to avoid race conditions
      setFilters({
        selectedItems: Array.from(newSelected),
        criticalItems: newCritical.size > 0 ? Array.from(newCritical) : undefined,
      });
    },
    [criticalItems, selectedItems, setFilters],
  );

  // Helper to clear all selections
  const clearAllSelections = useCallback(() => {
    const resetData: any = {
      selectedItems: undefined,
      criticalItems: undefined,
    };

    if (!preserveQuantitiesOnDeselect) {
      resetData.quantities = undefined;
      resetData.prices = undefined;
      resetData.taxes = undefined;
    }

    setFilters(resetData);
  }, [preserveQuantitiesOnDeselect, setFilters]);

  // Helper to set quantity for an item
  const setItemQuantity = useCallback(
    (itemId: string, quantity: number) => {
      if (quantity < 0.01) {
        return;
      }

      // Ensure the item is selected and update quantity atomically
      const newSelected = new Set(selectedItems);
      newSelected.add(itemId); // Ensure item is selected

      const newQuantities = { ...quantities, [itemId]: quantity };

      // Include current prices and taxes to avoid losing them in race conditions
      const currentPrices = { ...prices };
      const currentTaxes = { ...taxes };

      // Batch update to avoid race conditions - include all related state
      setFilters({
        selectedItems: Array.from(newSelected),
        quantities: Object.keys(newQuantities).length > 0 ? newQuantities : undefined,
        prices: Object.keys(currentPrices).length > 0 ? currentPrices : undefined,
        taxes: Object.keys(currentTaxes).length > 0 ? currentTaxes : undefined,
      });
    },
    [quantities, selectedItems, prices, taxes, setFilters],
  );

  // Helper to set price for an item
  const setItemPrice = useCallback(
    (itemId: string, price: number) => {
      if (price < 0) {
        return;
      }

      // Ensure the item is selected and update price atomically
      const newSelected = new Set(selectedItems);
      newSelected.add(itemId); // Ensure item is selected

      const newPrices = { ...prices, [itemId]: price };

      // Include current quantities and taxes to avoid losing them in race conditions
      const currentQuantities = { ...quantities };
      const currentTaxes = { ...taxes };

      // Batch update to avoid race conditions - include all related state
      setFilters({
        selectedItems: Array.from(newSelected),
        quantities: Object.keys(currentQuantities).length > 0 ? currentQuantities : undefined,
        prices: Object.keys(newPrices).length > 0 ? newPrices : undefined,
        taxes: Object.keys(currentTaxes).length > 0 ? currentTaxes : undefined,
      });
    },
    [prices, selectedItems, quantities, taxes, setFilters],
  );

  // Helper to set tax for an item
  const setItemTax = useCallback(
    (itemId: string, tax: number) => {
      if (tax < 0 || tax > 100) {
        return;
      }

      // Ensure the item is selected and update tax atomically
      const newSelected = new Set(selectedItems);
      newSelected.add(itemId); // Ensure item is selected

      const newTaxes = { ...taxes, [itemId]: tax };

      // Include current quantities and prices to avoid losing them in race conditions
      const currentQuantities = { ...quantities };
      const currentPrices = { ...prices };

      // Batch update to avoid race conditions - include all related state
      setFilters({
        selectedItems: Array.from(newSelected),
        quantities: Object.keys(currentQuantities).length > 0 ? currentQuantities : undefined,
        prices: Object.keys(currentPrices).length > 0 ? currentPrices : undefined,
        taxes: Object.keys(newTaxes).length > 0 ? newTaxes : undefined,
      });
    },
    [taxes, selectedItems, quantities, prices, setFilters],
  );

  // Get selected items with data
  const getSelectedItemsWithData = useCallback(() => {
    return Array.from(selectedItems).map((id) => ({
      id,
      quantity: quantities[id] || defaultQuantity,
      price: prices[id] || defaultPrice,
      tax: taxes[id] || defaultTax,
      isCritical: criticalItems.has(id),
    }));
  }, [selectedItems, quantities, prices, taxes, criticalItems, defaultQuantity, defaultPrice, defaultTax]);

  // Form data helpers
  const getFormData = useCallback(() => {
    return {
      description: description.trim(),
      supplierId: supplierId || undefined,
      forecast: forecast || undefined,
      notes: notes.trim() || undefined,
      items: getSelectedItemsWithData().map((item) => ({
        itemId: item.id,
        orderedQuantity: item.quantity,
        price: item.price,
        tax: item.tax,
        isCritical: item.isCritical,
      })),
    };
  }, [description, supplierId, forecast, notes, getSelectedItemsWithData]);

  const resetForm = useCallback(() => {
    setFilters({
      selectedItems: undefined,
      quantities: undefined,
      prices: undefined,
      taxes: undefined,
      criticalItems: undefined,
      description: undefined,
      supplierId: undefined,
      forecast: undefined,
      notes: undefined,
    });
  }, [setFilters]);

  const resetFormData = useCallback(() => {
    setFilters({
      description: undefined,
      supplierId: undefined,
      forecast: undefined,
      notes: undefined,
    });
  }, [setFilters]);

  // Check if form has any data
  const hasFormData = useMemo(() => {
    return description.trim() !== "" || supplierId !== undefined || forecast !== undefined || notes.trim() !== "" || selectedItems.size > 0;
  }, [description, supplierId, forecast, notes, selectedItems.size]);

  return {
    // Core Form State
    selectedItems,
    quantities,
    prices,
    taxes,
    criticalItems,
    description,
    supplierId,
    forecast,
    notes,
    validation,

    // Filter and Pagination State
    showSelectedOnly,
    searchTerm,
    showInactive,
    categoryIds,
    brandIds,
    supplierIds,
    page,
    pageSize,
    totalRecords,
    sortConfigs,

    // Form Data Update Functions
    updateSelectedItems,
    updateDescription,
    updateSupplierId,
    updateForecast,
    updateNotes,

    // Filter Update Functions
    setShowSelectedOnly,
    setSearchTerm,
    setShowInactive,
    setCategoryIds,
    setBrandIds,
    setSupplierIds,
    setBatchFilters,
    setPage,
    setPageSize,
    setTotalRecords,

    // Sorting Functions
    setSortConfigs,
    toggleSort,
    getSortDirection,
    getSortOrder,

    // Item Management Helper Functions
    toggleItemSelection,
    toggleCriticalItem,
    clearAllSelections,
    setItemQuantity,
    setItemPrice,
    setItemTax,
    getSelectedItemsWithData,

    // Form Management Helper Functions
    getFormData,
    resetForm,
    resetFormData,
    hasFormData,

    // Computed Values
    selectionCount: selectedItems.size,
    hasActiveFilters:
      isFilterActive("showInactive") || isFilterActive("categoryIds") || isFilterActive("brandIds") || isFilterActive("supplierIds") || isFilterActive("searchTerm"),
    totalPages: totalRecords > 0 ? Math.ceil(totalRecords / pageSize) : 1,
    hasNextPage: page < Math.ceil(totalRecords / pageSize),
    hasPrevPage: page > 1,

    // URL State Management Functions
    resetFilter,
    resetFilters,
    isFilterActive,
    activeFilterCount,

    // Raw Filters Access (for advanced usage)
    filters,
    setFilter,
    setFilters,
  };
}
