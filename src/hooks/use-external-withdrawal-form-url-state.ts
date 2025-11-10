import { useCallback, useMemo } from "react";
import { z } from "zod";
import { useUrlFilters } from "./use-url-filters";
import { EXTERNAL_WITHDRAWAL_TYPE } from "../constants";

/**
 * External Withdrawal Form URL State Hook
 *
 * Important behaviors:
 * - Manages 3-stage form navigation (Basic Info → Item Selection → Review)
 * - Manages selected items, their quantities and prices in URL state
 * - Manages form data (withdrawerName, type, notes) in URL state
 * - Handles form validation state across stages
 * - Persists all state in URL for page refresh recovery
 * - Use preserveQuantitiesOnDeselect option to keep values when deselecting items
 */

export type ExternalWithdrawalFormStage = 1 | 2 | 3;

export interface ExternalWithdrawalFormValidationState {
  stage1Valid: boolean;
  stage2Valid: boolean;
  canProceedToStage2: boolean;
  canProceedToStage3: boolean;
  canSubmit: boolean;
  errors: {
    withdrawerName?: string;
    selectedItems?: string;
    quantities?: Record<string, string>;
    prices?: Record<string, string>;
  };
}

interface UseExternalWithdrawalFormUrlStateOptions {
  defaultQuantity?: number;
  defaultPrice?: number;
  preserveQuantitiesOnDeselect?: boolean;
  defaultPageSize?: number;
  validateOnStageChange?: boolean;
  initialData?: {
    withdrawerName?: string;
    type?: EXTERNAL_WITHDRAWAL_TYPE;
    notes?: string;
    selectedItems?: Set<string>;
    quantities?: Record<string, number>;
    prices?: Record<string, number>;
  };
}

// Filter schemas for external withdrawal form
const externalWithdrawalFormFilterConfig = {
  // Stage navigation
  stage: {
    schema: z.coerce.number().int().min(1).max(3).default(1),
    defaultValue: 1 as ExternalWithdrawalFormStage,
    debounceMs: 0, // Immediate stage changes
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

  // Form data state (persisted in URL)
  withdrawerName: {
    schema: z.string().default(""),
    defaultValue: "",
    debounceMs: 0, // Immediate update for better typing experience
  },
  type: {
    schema: z.nativeEnum(EXTERNAL_WITHDRAWAL_TYPE).default(EXTERNAL_WITHDRAWAL_TYPE.RETURNABLE),
    defaultValue: EXTERNAL_WITHDRAWAL_TYPE.RETURNABLE,
    debounceMs: 0,
  },
  notes: {
    schema: z.string().default(""),
    defaultValue: "",
    debounceMs: 100, // Reduced debounce for better typing experience
  },

  // Form validation state
  formTouched: {
    schema: z.coerce.boolean().default(false),
    defaultValue: false,
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

export function useExternalWithdrawalFormUrlState(options: UseExternalWithdrawalFormUrlStateOptions = {}) {
  const { defaultQuantity = 1, defaultPrice = 0, preserveQuantitiesOnDeselect = false, defaultPageSize = 40, validateOnStageChange = true, initialData } = options;

  // Update externalWithdrawalFormFilterConfig with custom defaults and initial data
  const configWithDefaults = useMemo(() => {
    const config = { ...externalWithdrawalFormFilterConfig };

    // Update page size if custom
    if (defaultPageSize !== 40) {
      config.pageSize = {
        ...config.pageSize,
        defaultValue: defaultPageSize as any,
        schema: z.coerce.number().int().positive().min(1).max(100).default(defaultPageSize),
      };
    }

    // Apply initial data if provided
    if (initialData) {
      if (initialData.withdrawerName !== undefined) {
        config.withdrawerName = {
          ...config.withdrawerName,
          defaultValue: initialData.withdrawerName as any,
        };
      }
      if (initialData.type !== undefined) {
        config.type = {
          ...config.type,
          defaultValue: initialData.type as any,
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
    }

    return config;
  }, [defaultPageSize, initialData]);

  const { filters, setFilter, setFilters, resetFilter, resetFilters, isFilterActive, activeFilterCount } = useUrlFilters(configWithDefaults);

  // Convert selectedItems array to Set for easier manipulation
  const selectedItems = useMemo(() => {
    return new Set<string>(filters.selectedItems || []);
  }, [filters.selectedItems]);

  // Memoized state values
  const stage = (filters.stage || 1) as ExternalWithdrawalFormStage;
  const quantities = filters.quantities || {};
  const prices = filters.prices || {};
  const withdrawerName = filters.withdrawerName || "";
  const type = filters.type !== undefined ? filters.type : EXTERNAL_WITHDRAWAL_TYPE.RETURNABLE;
  const notes = filters.notes || "";
  const formTouched = filters.formTouched !== undefined ? filters.formTouched : false;
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

  const updatePrices = useCallback(
    (newPrices: Record<string, number>) => {
      const filtered = Object.fromEntries(Object.entries(newPrices).filter(([_, v]) => v >= 0));

      setFilter("prices", Object.keys(filtered).length > 0 ? filtered : undefined);
    },
    [setFilter],
  );

  const updateWithdrawerName = useCallback(
    (name: string) => {
      setFilter("withdrawerName", name === "" ? undefined : name);
    },
    [setFilter],
  );

  const updateType = useCallback(
    (value: EXTERNAL_WITHDRAWAL_TYPE) => {
      setFilter("type", value === EXTERNAL_WITHDRAWAL_TYPE.RETURNABLE ? undefined : value);
    },
    [setFilter],
  );

  const updateNotes = useCallback(
    (text: string) => {
      setFilter("notes", text === "" ? undefined : text);
    },
    [setFilter],
  );

  // Form touched state
  const setFormTouched = useCallback(
    (touched: boolean) => {
      setFilter("formTouched", touched === false ? undefined : touched);
    },
    [setFilter],
  );

  // Stage navigation
  const setStage = useCallback(
    (newStage: ExternalWithdrawalFormStage) => {
      setFilter("stage", newStage === 1 ? undefined : newStage);
    },
    [setFilter],
  );

  // Form validation logic
  const validation = useMemo((): ExternalWithdrawalFormValidationState => {
    const errors: ExternalWithdrawalFormValidationState["errors"] = {};

    // Stage 1 validation (Basic Info)
    let stage1Valid = true;
    if (!withdrawerName?.trim() || (withdrawerName?.trim().length || 0) < 2) {
      errors.withdrawerName = "Nome do retirador deve ter pelo menos 2 caracteres";
      stage1Valid = false;
    }

    // Stage 2 validation (Item Selection)
    let stage2Valid = true;
    if (selectedItems.size === 0) {
      errors.selectedItems = "Selecione pelo menos um item";
      stage2Valid = false;
    }

    // Validate quantities
    const quantityErrors: Record<string, string> = {};
    Array.from(selectedItems).forEach((itemId) => {
      const quantity = quantities[itemId];
      if (!quantity || quantity < 0.01) {
        quantityErrors[itemId] = "Quantidade deve ser maior que 0";
        stage2Valid = false;
      }
    });
    if (Object.keys(quantityErrors).length > 0) {
      errors.quantities = quantityErrors;
    }

    // Validate prices (optional, but if set must be >= 0)
    const priceErrors: Record<string, string> = {};
    Array.from(selectedItems).forEach((itemId) => {
      const price = prices[itemId];
      if (price !== undefined && price < 0) {
        priceErrors[itemId] = "Preço deve ser maior ou igual a 0";
      }
    });
    if (Object.keys(priceErrors).length > 0) {
      errors.prices = priceErrors;
    }

    return {
      stage1Valid,
      stage2Valid,
      canProceedToStage2: stage1Valid,
      canProceedToStage3: stage1Valid && stage2Valid,
      canSubmit: stage1Valid && stage2Valid,
      errors,
    };
  }, [withdrawerName, selectedItems, quantities, prices]);

  // Stage navigation helpers
  const goToNextStage = useCallback(() => {
    if (stage < 3) {
      const nextStage = (stage + 1) as ExternalWithdrawalFormStage;

      // Validate before proceeding if validation is enabled
      if (validateOnStageChange) {
        if (stage === 1 && !validation.canProceedToStage2) {
          setFormTouched(true);
          return false;
        }
        if (stage === 2 && !validation.canProceedToStage3) {
          setFormTouched(true);
          return false;
        }
      }

      setStage(nextStage);
      setFormTouched(true);
      return true;
    }
    return false;
  }, [stage, validation, validateOnStageChange, setStage, setFormTouched]);

  const goToPrevStage = useCallback(() => {
    if (stage > 1) {
      const prevStage = (stage - 1) as ExternalWithdrawalFormStage;
      setStage(prevStage);
      return true;
    }
    return false;
  }, [stage, setStage]);

  const goToStage = useCallback(
    (targetStage: ExternalWithdrawalFormStage) => {
      // Validate intermediary stages if validation is enabled
      if (validateOnStageChange && targetStage > stage) {
        if (targetStage >= 2 && !validation.canProceedToStage2) {
          setFormTouched(true);
          return false;
        }
        if (targetStage >= 3 && !validation.canProceedToStage3) {
          setFormTouched(true);
          return false;
        }
      }

      setStage(targetStage);
      setFormTouched(true);
      return true;
    },
    [stage, validation, validateOnStageChange, setStage, setFormTouched],
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
    (itemId: string, quantity?: number, price?: number) => {
      const newSelected = new Set(selectedItems);
      const newQuantities = { ...quantities };
      const newPrices = { ...prices };

      if (newSelected.has(itemId)) {
        // Deselect
        newSelected.delete(itemId);
        if (!preserveQuantitiesOnDeselect) {
          delete newQuantities[itemId];
          delete newPrices[itemId];
        }
      } else {
        // Select
        newSelected.add(itemId);
        newQuantities[itemId] = quantity || quantities[itemId] || defaultQuantity;
        newPrices[itemId] = price || prices[itemId] || defaultPrice;
      }

      // Batch update all related state
      // Only update if there are actual changes
      const hasChanges =
        newSelected.size !== selectedItems.size || JSON.stringify(newQuantities) !== JSON.stringify(quantities) || JSON.stringify(newPrices) !== JSON.stringify(prices);

      if (hasChanges) {
        setFilters({
          selectedItems: newSelected.size > 0 ? Array.from(newSelected) : undefined,
          quantities: Object.keys(newQuantities).length > 0 ? newQuantities : undefined,
          prices: Object.keys(newPrices).length > 0 ? newPrices : undefined,
        });
      }
    },
    [selectedItems, quantities, prices, defaultQuantity, defaultPrice, preserveQuantitiesOnDeselect, setFilters],
  );

  // Helper to clear all selections
  const clearAllSelections = useCallback(() => {
    const resetData: any = {
      selectedItems: undefined,
    };

    if (!preserveQuantitiesOnDeselect) {
      resetData.quantities = undefined;
      resetData.prices = undefined;
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

      // Include all related state to avoid race conditions
      const currentPrices = { ...prices };

      // Batch update to avoid race conditions - include all related state
      setFilters({
        selectedItems: Array.from(newSelected),
        quantities: Object.keys(newQuantities).length > 0 ? newQuantities : undefined,
        prices: Object.keys(currentPrices).length > 0 ? currentPrices : undefined,
      });
    },
    [quantities, selectedItems, prices, setFilters],
  );

  // Helper to set price for an item
  const setItemPrice = useCallback(
    (itemId: string, price: number) => {
      // Validate price is at least 0
      if (price < 0) {
        return;
      }
      const newPrices = { ...prices, [itemId]: price };
      updatePrices(newPrices);
    },
    [prices, updatePrices],
  );

  // Get selected items with data
  const getSelectedItemsWithData = useCallback(() => {
    return Array.from(selectedItems).map((id) => ({
      id,
      quantity: quantities[id] || defaultQuantity,
      price: prices[id] || defaultPrice,
    }));
  }, [selectedItems, quantities, prices, defaultQuantity, defaultPrice]);

  // Form data helpers
  const getFormData = useCallback(() => {
    return {
      withdrawerName: withdrawerName?.trim() || "",
      type,
      notes: notes?.trim() || undefined,
      items: getSelectedItemsWithData().map((item) => ({
        itemId: item.id,
        quantity: item.quantity,
        unitPrice: item.price > 0 ? item.price : undefined,
      })),
    };
  }, [withdrawerName, type, notes, getSelectedItemsWithData]);

  const resetForm = useCallback(() => {
    setFilters({
      stage: undefined,
      selectedItems: undefined,
      quantities: undefined,
      prices: undefined,
      withdrawerName: undefined,
      type: undefined,
      notes: undefined,
      formTouched: undefined,
    });
  }, [setFilters]);

  const resetFormData = useCallback(() => {
    setFilters({
      withdrawerName: undefined,
      type: undefined,
      notes: undefined,
      formTouched: undefined,
    });
  }, [setFilters]);

  // Check if form has any data
  const hasFormData = useMemo(() => {
    return (withdrawerName?.trim() || "") !== "" || type !== EXTERNAL_WITHDRAWAL_TYPE.RETURNABLE || (notes?.trim() || "") !== "" || selectedItems.size > 0;
  }, [withdrawerName, type, notes, selectedItems.size]);

  // Check if specific stages have data
  const stageHasData = useMemo(() => {
    return {
      stage1: (withdrawerName?.trim() || "") !== "" || type !== EXTERNAL_WITHDRAWAL_TYPE.RETURNABLE || (notes?.trim() || "") !== "",
      stage2: selectedItems.size > 0,
      stage3: true, // Review stage always accessible if previous stages are valid
    };
  }, [withdrawerName, type, notes, selectedItems.size]);

  // Form progress calculation
  const formProgress = useMemo(() => {
    let completed = 0;
    let total = 2; // 2 required stages (basic info + items)

    if (validation.stage1Valid) completed++;
    if (validation.stage2Valid) completed++;

    return {
      completed,
      total,
      percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  }, [validation.stage1Valid, validation.stage2Valid]);

  return {
    // Stage Navigation State
    stage,
    validation,
    formTouched,
    formProgress,
    hasFormData,
    stageHasData,

    // Core Form State
    selectedItems,
    quantities,
    prices,
    withdrawerName,
    type,
    notes,

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

    // Stage Navigation Functions
    setStage,
    goToNextStage,
    goToPrevStage,
    goToStage,
    setFormTouched,

    // Form Data Update Functions
    updateSelectedItems,
    updateQuantities,
    updatePrices,
    updateWithdrawerName,
    updateType,
    updateNotes,

    // Filter Update Functions
    setShowSelectedOnly,
    setSearchTerm,
    setShowInactive,
    setCategoryIds,
    setBrandIds,
    setSupplierIds,
    setPage,
    setPageSize,
    setTotalRecords,

    // Item Management Helper Functions
    toggleItemSelection,
    clearAllSelections,
    setItemQuantity,
    setItemPrice,
    getSelectedItemsWithData,

    // Form Management Helper Functions
    getFormData,
    resetForm,
    resetFormData,

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

/**
 * Usage Examples:
 *
 * Basic usage with stage navigation:
 * ```tsx
 * const {
 *   stage,
 *   validation,
 *   formTouched,
 *   withdrawerName,
 *   willReturn,
 *   notes,
 *   selectedItems,
 *   quantities,
 *   prices,
 *   goToNextStage,
 *   goToPrevStage,
 *   updateWithdrawerName,
 *   updateWillReturn,
 *   updateNotes,
 *   toggleItemSelection,
 *   getFormData,
 * } = useExternalWithdrawalFormUrlState();
 *
 * // Stage 1: Basic Info Form
 * if (stage === 1) {
 *   return (
 *     <div>
 *       <input
 *         value={withdrawerName}
 *         onChange={(e) => updateWithdrawerName(e.target.value)}
 *         placeholder="Nome do retirador"
 *       />
 *       <input
 *         type="checkbox"
 *         checked={willReturn}
 *         onChange={(e) => updateWillReturn(e.target.checked)}
 *       />
 *       <textarea
 *         value={notes}
 *         onChange={(e) => updateNotes(e.target.value)}
 *         placeholder="Observações (opcional)"
 *       />
 *       {formTouched && validation.errors.withdrawerName && (
 *         <p className="error">{validation.errors.withdrawerName}</p>
 *       )}
 *       <button
 *         onClick={goToNextStage}
 *         disabled={!validation.canProceedToStage2}
 *       >
 *         Próximo
 *       </button>
 *     </div>
 *   );
 * }
 *
 * // Stage 2: Item Selection
 * if (stage === 2) {
 *   return (
 *     <div>
 *       {items.map(item => (
 *         <div key={item.id}>
 *           <input
 *             type="checkbox"
 *             checked={selectedItems.has(item.id)}
 *             onChange={() => toggleItemSelection(item.id)}
 *           />
 *           {selectedItems.has(item.id) && (
 *             <>
 *               <input
 *                 type="number"
 *                 value={quantities[item.id] || 1}
 *                 onChange={(e) => setItemQuantity(item.id, Number(e.target.value))}
 *                 placeholder="Quantidade"
 *               />
 *               <input
 *                 type="number"
 *                 value={prices[item.id] || 0}
 *                 onChange={(e) => setItemPrice(item.id, Number(e.target.value))}
 *                 placeholder="Preço (opcional)"
 *               />
 *             </>
 *           )}
 *         </div>
 *       ))}
 *       {formTouched && validation.errors.selectedItems && (
 *         <p className="error">{validation.errors.selectedItems}</p>
 *       )}
 *       <button onClick={goToPrevStage}>Anterior</button>
 *       <button
 *         onClick={goToNextStage}
 *         disabled={!validation.canProceedToStage3}
 *       >
 *         Próximo
 *       </button>
 *     </div>
 *   );
 * }
 *
 * // Stage 3: Review and Submit
 * if (stage === 3) {
 *   const formData = getFormData();
 *
 *   return (
 *     <div>
 *       <h3>Revisão</h3>
 *       <p>Retirador: {formData.withdrawerName}</p>
 *       <p>Irá retornar: {formData.willReturn ? 'Sim' : 'Não'}</p>
 *       <p>Itens: {formData.items.length}</p>
 *       <button onClick={goToPrevStage}>Anterior</button>
 *       <button
 *         onClick={() => onSubmit(formData)}
 *         disabled={!validation.canSubmit}
 *       >
 *         Confirmar Retirada
 *       </button>
 *     </div>
 *   );
 * }
 * ```
 *
 * Advanced usage with custom validation:
 * ```tsx
 * const hook = useExternalWithdrawalFormUrlState({
 *   defaultQuantity: 1,
 *   defaultPrice: 0,
 *   preserveQuantitiesOnDeselect: true,
 *   validateOnStageChange: false, // Manual validation
 * });
 *
 * const handleCustomNext = () => {
 *   if (hook.stage === 1 && !hook.validation.canProceedToStage2) {
 *     // Show custom validation messages
 *     toast.error('Preencha todos os campos obrigatórios');
 *     hook.setFormTouched(true);
 *     return;
 *   }
 *   hook.goToNextStage();
 * };
 * ```
 *
 * State monitoring and progress tracking:
 * ```tsx
 * const { formProgress, stageHasData, hasFormData } = useExternalWithdrawalFormUrlState();
 *
 * // Show progress bar
 * <div className="progress">
 *   <div
 *     className="progress-bar"
 *     style={{ width: `${formProgress.percentage}%` }}
 *   />
 *   <span>{formProgress.completed} de {formProgress.total} etapas concluídas</span>
 * </div>
 *
 * // Warn about unsaved changes
 * useEffect(() => {
 *   const handleBeforeUnload = (e: BeforeUnloadEvent) => {
 *     if (hasFormData) {
 *       e.preventDefault();
 *       e.returnValue = '';
 *     }
 *   };
 *
 *   window.addEventListener('beforeunload', handleBeforeUnload);
 *   return () => window.removeEventListener('beforeunload', handleBeforeUnload);
 * }, [hasFormData]);
 * ```
 */
