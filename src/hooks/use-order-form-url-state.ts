import { useCallback, useMemo } from "react";
import { z } from "zod";
import { useUrlFilters } from "./use-url-filters";

/**
 * Order Form URL State Hook
 *
 * Important behaviors:
 * - Manages selected items, their quantities, prices, ICMS, and IPI in URL state
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
  defaultIcms?: number;
  defaultIpi?: number;
  preserveQuantitiesOnDeselect?: boolean;
  defaultPageSize?: number;
  initialData?: {
    description?: string;
    supplierId?: string;
    forecast?: Date | null;
    notes?: string;
    orderItemMode?: "inventory" | "temporary";
    selectedItems?: Set<string>;
    quantities?: Record<string, number>;
    prices?: Record<string, number>;
    icmses?: Record<string, number>;
    ipis?: Record<string, number>;
    temporaryItems?: Array<{
      temporaryItemDescription: string;
      orderedQuantity: number;
      price: number;
      icms: number;
      ipi: number;
    }>;
  };
}

// Filter schemas for order form
const orderFormFilterConfig = {
  // Form step (for multi-step forms)
  step: {
    schema: z.coerce.number().int().min(1).max(3).default(1),
    defaultValue: 1,
    debounceMs: 0, // Immediate update for step changes
  },

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
  icmses: {
    schema: z.record(z.string(), z.number().min(0).max(100)).default({}),
    defaultValue: {} as Record<string, number>,
    debounceMs: 0, // Immediate update for ICMS
  },
  ipis: {
    schema: z.record(z.string(), z.number().min(0).max(100)).default({}),
    defaultValue: {} as Record<string, number>,
    debounceMs: 0, // Immediate update for IPI
  },

  // Order item mode (inventory vs temporary items)
  orderItemMode: {
    schema: z.enum(["inventory", "temporary"]).default("inventory"),
    defaultValue: "inventory" as "inventory" | "temporary",
    debounceMs: 0, // Immediate update
  },

  // Temporary items state
  temporaryItems: {
    schema: z.array(
      z.object({
        temporaryItemDescription: z.string(),
        orderedQuantity: z.number().positive(),
        price: z.number().min(0),
        icms: z.number().min(0).max(100).default(0),
        ipi: z.number().min(0).max(100).default(0),
      })
    ).default([]),
    defaultValue: [] as Array<{
      temporaryItemDescription: string;
      orderedQuantity: number;
      price: number;
      icms: number;
      ipi: number;
    }>,
    debounceMs: 0, // Immediate update
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
  const { defaultQuantity = 1, defaultPrice = 0, defaultIcms = 0, defaultIpi = 0, preserveQuantitiesOnDeselect = false, defaultPageSize = 40, initialData } = options;

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
      if (initialData.icmses) {
        config.icmses = {
          ...config.icmses,
          defaultValue: initialData.icmses,
        };
      }
      if (initialData.ipis) {
        config.ipis = {
          ...config.ipis,
          defaultValue: initialData.ipis,
        };
      }
      if (initialData.orderItemMode !== undefined) {
        config.orderItemMode = {
          ...config.orderItemMode,
          defaultValue: initialData.orderItemMode,
        };
      }
      if (initialData.temporaryItems !== undefined) {
        config.temporaryItems = {
          ...config.temporaryItems,
          defaultValue: initialData.temporaryItems,
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

  // Memoized state values
  const quantities = filters.quantities || {};
  const prices = filters.prices || {};
  const icmses = filters.icmses || {};
  const ipis = filters.ipis || {};
  const description = filters.description || "";
  const supplierId = filters.supplierId;
  const forecast = filters.forecast;
  const notes = filters.notes || "";
  const orderItemMode = filters.orderItemMode || "inventory";
  const temporaryItems = filters.temporaryItems || [];
  const showSelectedOnly = filters.showSelectedOnly !== undefined ? filters.showSelectedOnly : false;
  const searchTerm = filters.searchTerm || "";
  const showInactive = filters.showInactive !== undefined ? filters.showInactive : false;
  const categoryIds = filters.categoryIds || [];
  const brandIds = filters.brandIds || [];
  const supplierIds = filters.supplierIds || [];
  const step = filters.step || 1;
  const page = filters.page || 1;
  const pageSize = filters.pageSize || defaultPageSize;
  const totalRecords = filters.totalRecords || 0;
  const sortConfigs = filters.sortConfigs || [];

  // Update functions using the standardized hook
  const setStep = useCallback(
    (newStep: number) => {
      const validStep = Math.max(1, Math.min(3, newStep));
      setFilter("step", validStep === 1 ? undefined : validStep);
    },
    [setFilter],
  );
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
    (itemId: string, quantity?: number, price?: number, icms?: number, ipi?: number) => {
      console.log('[useOrderFormUrlState] toggleItemSelection CALLED', {
        itemId,
        quantity,
        price,
        icms,
        ipi,
        currentSelectedSize: selectedItems.size,
        isAlreadySelected: selectedItems.has(itemId),
        timestamp: Date.now()
      });

      const newSelected = new Set(selectedItems);
      const newQuantities = { ...quantities };
      const newPrices = { ...prices };
      const newIcmses = { ...icmses };
      const newIpis = { ...ipis };

      if (newSelected.has(itemId)) {
        // Item is already selected - check if we should deselect or just update values
        // If no explicit values are provided, this is a toggle to deselect
        if (quantity === undefined && price === undefined && icms === undefined && ipi === undefined) {
          // Deselect
          newSelected.delete(itemId);
          if (!preserveQuantitiesOnDeselect) {
            delete newQuantities[itemId];
            delete newPrices[itemId];
            delete newIcmses[itemId];
            delete newIpis[itemId];
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
          if (icms !== undefined) {
            newIcmses[itemId] = icms;
          }
          if (ipi !== undefined) {
            newIpis[itemId] = ipi;
          }
        }
      } else {
        // Select new item
        newSelected.add(itemId);
        newQuantities[itemId] = quantity || quantities[itemId] || defaultQuantity;
        newPrices[itemId] = price !== undefined ? price : prices[itemId] !== undefined ? prices[itemId] : defaultPrice;
        newIcmses[itemId] = icms !== undefined ? icms : icmses[itemId] !== undefined ? icmses[itemId] : defaultIcms;
        newIpis[itemId] = ipi !== undefined ? ipi : ipis[itemId] !== undefined ? ipis[itemId] : defaultIpi;
      }

      // Batch update all related state
      const hasChanges =
        newSelected.size !== selectedItems.size ||
        JSON.stringify(newQuantities) !== JSON.stringify(quantities) ||
        JSON.stringify(newPrices) !== JSON.stringify(prices) ||
        JSON.stringify(newIcmses) !== JSON.stringify(icmses) ||
        JSON.stringify(newIpis) !== JSON.stringify(ipis);

      console.log('[useOrderFormUrlState] toggleItemSelection - hasChanges check', {
        hasChanges,
        oldSelectedSize: selectedItems.size,
        newSelectedSize: newSelected.size,
        selectedItemsChanged: newSelected.size !== selectedItems.size,
        quantitiesChanged: JSON.stringify(newQuantities) !== JSON.stringify(quantities),
        pricesChanged: JSON.stringify(newPrices) !== JSON.stringify(prices),
        timestamp: Date.now()
      });

      if (hasChanges) {
        console.log('[useOrderFormUrlState] toggleItemSelection - CALLING setFilters', {
          selectedItemsToSet: newSelected.size > 0 ? Array.from(newSelected) : undefined,
          quantitiesToSet: Object.keys(newQuantities).length > 0 ? newQuantities : undefined,
          pricesToSet: Object.keys(newPrices).length > 0 ? newPrices : undefined,
          timestamp: Date.now()
        });

        setFilters({
          selectedItems: newSelected.size > 0 ? Array.from(newSelected) : undefined,
          quantities: Object.keys(newQuantities).length > 0 ? newQuantities : undefined,
          prices: Object.keys(newPrices).length > 0 ? newPrices : undefined,
          icmses: Object.keys(newIcmses).length > 0 ? newIcmses : undefined,
          ipis: Object.keys(newIpis).length > 0 ? newIpis : undefined,
        });

        console.log('[useOrderFormUrlState] toggleItemSelection - AFTER setFilters', { timestamp: Date.now() });
      }
    },
    [selectedItems, quantities, prices, icmses, ipis, defaultQuantity, defaultPrice, defaultIcms, defaultIpi, preserveQuantitiesOnDeselect, setFilters],
  );

  // Helper to clear all selections
  const clearAllSelections = useCallback(() => {
    const resetData: any = {
      selectedItems: undefined,
    };

    if (!preserveQuantitiesOnDeselect) {
      resetData.quantities = undefined;
      resetData.prices = undefined;
      resetData.icmses = undefined;
      resetData.ipis = undefined;
    }

    setFilters(resetData);
  }, [preserveQuantitiesOnDeselect, setFilters]);

  // Helper to batch update selection (for select all / deselect all)
  const batchUpdateSelection = useCallback(
    (newSelected: Set<string>, newQuantities: Record<string, number>, newPrices: Record<string, number>, newIcmses: Record<string, number>, newIpis: Record<string, number>) => {
      setFilters({
        selectedItems: newSelected.size > 0 ? Array.from(newSelected) : undefined,
        quantities: Object.keys(newQuantities).length > 0 ? newQuantities : undefined,
        prices: Object.keys(newPrices).length > 0 ? newPrices : undefined,
        icmses: Object.keys(newIcmses).length > 0 ? newIcmses : undefined,
        ipis: Object.keys(newIpis).length > 0 ? newIpis : undefined,
      });
    },
    [setFilters]
  );

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

      // Batch update - only update selectedItems and quantities
      // Don't include prices/taxes to avoid race conditions
      setFilters({
        selectedItems: Array.from(newSelected),
        quantities: Object.keys(newQuantities).length > 0 ? newQuantities : undefined,
      });
    },
    [quantities, selectedItems, setFilters],
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

      // Batch update - only update selectedItems and prices
      // Don't include quantities/taxes to avoid race conditions
      setFilters({
        selectedItems: Array.from(newSelected),
        prices: Object.keys(newPrices).length > 0 ? newPrices : undefined,
      });
    },
    [prices, selectedItems, setFilters],
  );

  // Helper to set ICMS for an item
  const setItemIcms = useCallback(
    (itemId: string, icms: number) => {
      if (icms < 0 || icms > 100) {
        return;
      }

      // Ensure the item is selected and update ICMS atomically
      const newSelected = new Set(selectedItems);
      newSelected.add(itemId); // Ensure item is selected

      const newIcmses = { ...icmses, [itemId]: icms };

      // Batch update - only update selectedItems and icmses
      // Don't include quantities/prices/IPI to avoid race conditions
      setFilters({
        selectedItems: Array.from(newSelected),
        icmses: Object.keys(newIcmses).length > 0 ? newIcmses : undefined,
      });
    },
    [icmses, selectedItems, setFilters],
  );

  // Helper to set IPI for an item
  const setItemIpi = useCallback(
    (itemId: string, ipi: number) => {
      if (ipi < 0 || ipi > 100) {
        return;
      }

      // Ensure the item is selected and update IPI atomically
      const newSelected = new Set(selectedItems);
      newSelected.add(itemId); // Ensure item is selected

      const newIpis = { ...ipis, [itemId]: ipi };

      // Batch update - only update selectedItems and ipis
      // Don't include quantities/prices/ICMS to avoid race conditions
      setFilters({
        selectedItems: Array.from(newSelected),
        ipis: Object.keys(newIpis).length > 0 ? newIpis : undefined,
      });
    },
    [ipis, selectedItems, setFilters],
  );

  // Get selected items with data
  const getSelectedItemsWithData = useCallback(() => {
    return Array.from(selectedItems).map((id) => ({
      id,
      quantity: quantities[id] || defaultQuantity,
      price: prices[id] || defaultPrice,
      icms: icmses[id] || defaultIcms,
      ipi: ipis[id] || defaultIpi,
    }));
  }, [selectedItems, quantities, prices, icmses, ipis, defaultQuantity, defaultPrice, defaultIcms, defaultIpi]);

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
        icms: item.icms,
        ipi: item.ipi,
      })),
    };
  }, [description, supplierId, forecast, notes, getSelectedItemsWithData]);

  const resetForm = useCallback(() => {
    setFilters({
      selectedItems: undefined,
      quantities: undefined,
      prices: undefined,
      icmses: undefined,
      ipis: undefined,
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

  // Helper to set order item mode
  const setOrderItemMode = useCallback(
    (mode: "inventory" | "temporary") => {
      setFilters({ orderItemMode: mode });
    },
    [setFilters]
  );

  // Helper to add temporary item
  const addTemporaryItem = useCallback(
    (item: {
      temporaryItemDescription: string;
      orderedQuantity: number;
      price: number;
      icms?: number;
      ipi?: number;
    }) => {
      const newTemporaryItems = [
        ...temporaryItems,
        {
          temporaryItemDescription: item.temporaryItemDescription,
          orderedQuantity: item.orderedQuantity,
          price: item.price,
          icms: item.icms ?? 0,
          ipi: item.ipi ?? 0,
        },
      ];
      setFilters({ temporaryItems: newTemporaryItems });
    },
    [temporaryItems, setFilters]
  );

  // Helper to update temporary item
  const updateTemporaryItem = useCallback(
    (
      index: number,
      updates: Partial<{
        temporaryItemDescription: string;
        orderedQuantity: number;
        price: number;
        icms: number;
        ipi: number;
      }>
    ) => {
      const newTemporaryItems = [...temporaryItems];
      if (index >= 0 && index < newTemporaryItems.length) {
        newTemporaryItems[index] = {
          ...newTemporaryItems[index],
          ...updates,
        };
        setFilters({ temporaryItems: newTemporaryItems });
      }
    },
    [temporaryItems, setFilters]
  );

  // Helper to remove temporary item
  const removeTemporaryItem = useCallback(
    (index: number) => {
      const newTemporaryItems = temporaryItems.filter((_, i) => i !== index);
      setFilters({ temporaryItems: newTemporaryItems });
    },
    [temporaryItems, setFilters]
  );

  // Helper to clear all temporary items
  const clearTemporaryItems = useCallback(() => {
    setFilters({ temporaryItems: [] });
  }, [setFilters]);

  // Helper to set temporary items array
  const setTemporaryItems = useCallback(
    (items: Array<{
      temporaryItemDescription: string;
      orderedQuantity: number;
      price: number;
      icms: number;
      ipi: number;
    }>) => {
      setFilters({ temporaryItems: items });
    },
    [setFilters]
  );

  return {
    // Core Form State
    selectedItems,
    quantities,
    prices,
    icmses,
    ipis,
    orderItemMode,
    temporaryItems,
    description,
    supplierId,
    forecast,
    notes,
    validation,

    // Filter and Pagination State
    step,
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
    setStep,
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
    clearAllSelections,
    batchUpdateSelection,
    setItemQuantity,
    setItemPrice,
    setItemIcms,
    setItemIpi,
    getSelectedItemsWithData,

    // Order Item Mode Management
    setOrderItemMode,

    // Temporary Items Management
    addTemporaryItem,
    updateTemporaryItem,
    removeTemporaryItem,
    clearTemporaryItems,
    setTemporaryItems,

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
