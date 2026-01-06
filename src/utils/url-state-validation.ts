import { ACTIVITY_OPERATION } from "../constants";
import type { ActivityFormUrlState } from "./activity-url-state";

/**
 * URL State validation and recovery utilities
 */

export interface UrlStateValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  correctedState?: Partial<ActivityFormUrlState>;
}

export interface UrlStateValidationOptions {
  strict?: boolean; // If true, validation is more strict
  maxSelectedItems?: number;
  maxQuantity?: number;
  allowedOperations?: ACTIVITY_OPERATION[];
}

/**
 * Validates URL state structure and values
 */
export function validateUrlState(state: Partial<ActivityFormUrlState>, options: UrlStateValidationOptions = {}): UrlStateValidationResult {
  const { strict = false, maxSelectedItems = 100, maxQuantity = 999999, allowedOperations = Object.values(ACTIVITY_OPERATION) } = options;

  const errors: string[] = [];
  const warnings: string[] = [];
  const correctedState: Partial<ActivityFormUrlState> = { ...state };

  // Validate operation
  if (state.operation && !allowedOperations.includes(state.operation)) {
    errors.push(`Invalid operation: ${state.operation}`);
    correctedState.operation = ACTIVITY_OPERATION.OUTBOUND;
  }

  // Validate globalUserId format
  if (state.globalUserId) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(state.globalUserId)) {
      errors.push(`Invalid globalUserId format: ${state.globalUserId}`);
      correctedState.globalUserId = undefined;
    }
  }

  // Validate selectedIds
  if (state.selectedIds) {
    if (!Array.isArray(state.selectedIds)) {
      errors.push("selectedIds must be an array");
      correctedState.selectedIds = [];
    } else {
      // Check for valid item IDs
      const invalidIds: string[] = [];
      const validIds: string[] = [];

      state.selectedIds.forEach((id: any) => {
        if (typeof id !== "string" || id.length === 0) {
          invalidIds.push(String(id));
        } else {
          validIds.push(id);
        }
      });

      if (invalidIds.length > 0) {
        errors.push(`Invalid item IDs: ${invalidIds.join(", ")}`);
        correctedState.selectedIds = validIds;
      }

      // Check max selected items
      if (state.selectedIds.length > maxSelectedItems) {
        warnings.push(`Too many selected items (${state.selectedIds.length}), limit is ${maxSelectedItems}`);
        if (strict) {
          correctedState.selectedIds = state.selectedIds.slice(0, maxSelectedItems);
        }
      }
    }
  }

  // Validate quantityAssignments
  if (state.quantityAssignments) {
    if (typeof state.quantityAssignments !== "object" || state.quantityAssignments === null) {
      errors.push("quantityAssignments must be an object");
      correctedState.quantityAssignments = {};
    } else {
      const correctedQuantities: Record<string, number> = {};

      Object.entries(state.quantityAssignments).forEach(([id, quantity]) => {
        // Validate quantity value
        if (typeof quantity !== "number" || isNaN(quantity) || quantity <= 0) {
          errors.push(`Invalid quantity for item ${id}: ${quantity}`);
          correctedQuantities[id] = 1;
        } else if (quantity > maxQuantity) {
          warnings.push(`Quantity for item ${id} exceeds maximum (${quantity} > ${maxQuantity})`);
          correctedQuantities[id] = strict ? maxQuantity : quantity;
        } else {
          correctedQuantities[id] = quantity;
        }
      });

      correctedState.quantityAssignments = correctedQuantities;
    }
  }

  // Validate string fields
  const stringFields: (keyof ActivityFormUrlState)[] = ["search"];
  stringFields.forEach((field) => {
    if (state[field] !== undefined && typeof state[field] !== "string") {
      errors.push(`${String(field)} must be a string`);
      (correctedState as any)[field] = "";
    }
  });

  // Validate boolean fields in filters
  if (state.filters) {
    const booleanFields: (keyof NonNullable<ActivityFormUrlState["filters"]>)[] = ["showInactive", "showSelectedOnly"];
    booleanFields.forEach((field) => {
      if (state.filters![field] !== undefined && typeof state.filters![field] !== "boolean") {
        errors.push(`${String(field)} must be a boolean`);
        if (!correctedState.filters)
          correctedState.filters = {
            showInactive: false,
            showSelectedOnly: false,
            categoryIds: [],
            brandIds: [],
            supplierIds: [],
          };
        (correctedState.filters as any)[field] = false;
      }
    });
  }

  // Validate array fields in filters
  if (state.filters) {
    const arrayFields: (keyof NonNullable<ActivityFormUrlState["filters"]>)[] = ["categoryIds", "brandIds", "supplierIds"];
    arrayFields.forEach((field) => {
      if (state.filters![field] !== undefined) {
        if (!Array.isArray(state.filters![field])) {
          errors.push(`${String(field)} must be an array`);
          if (!correctedState.filters)
            correctedState.filters = {
              showInactive: false,
              showSelectedOnly: false,
              categoryIds: [],
              brandIds: [],
              supplierIds: [],
            };
          (correctedState.filters as any)[field] = [];
        } else {
          const array = state.filters![field] as string[];
          const validItems = array.filter((item) => typeof item === "string" && item.length > 0);
          if (validItems.length !== array.length) {
            warnings.push(`Some invalid items removed from ${String(field)}`);
            if (!correctedState.filters)
              correctedState.filters = {
                showInactive: false,
                showSelectedOnly: false,
                categoryIds: [],
                brandIds: [],
                supplierIds: [],
              };
            (correctedState.filters as any)[field] = validItems;
          }
        }
      }
    });
  }

  // Cross-validation: quantities should match selected items
  if (state.selectedIds && state.quantityAssignments) {
    const selectedIds = state.selectedIds;
    const quantityIds = Object.keys(state.quantityAssignments);

    // Check for quantities without selection
    const orphanQuantities = quantityIds.filter((id) => !selectedIds.includes(id));
    if (orphanQuantities.length > 0) {
      warnings.push(`Quantities exist for unselected items: ${orphanQuantities.join(", ")}`);
      if (strict) {
        const cleanedQuantities = { ...correctedState.quantityAssignments };
        orphanQuantities.forEach((id) => delete cleanedQuantities![id]);
        correctedState.quantityAssignments = cleanedQuantities;
      }
    }

    // Check for selections without quantities
    const missingQuantities = selectedIds.filter((id) => !quantityIds.includes(id));
    if (missingQuantities.length > 0) {
      warnings.push(`Missing quantities for selected items: ${missingQuantities.join(", ")}`);
      const updatedQuantities = { ...correctedState.quantityAssignments };
      missingQuantities.forEach((id) => {
        updatedQuantities![id] = 1;
      });
      correctedState.quantityAssignments = updatedQuantities;
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    correctedState: errors.length > 0 || warnings.length > 0 ? correctedState : undefined,
  };
}

/**
 * Sanitizes URL state by removing invalid values and correcting issues
 */
export function sanitizeUrlState(state: Partial<ActivityFormUrlState>, options: UrlStateValidationOptions = {}): ActivityFormUrlState {
  const validation = validateUrlState(state, { ...options, strict: true });

  if (validation.correctedState) {
    return {
      selectedIds: validation.correctedState.selectedIds || [],
      operation: validation.correctedState.operation,
      reason: validation.correctedState.reason,
      globalUserId: validation.correctedState.globalUserId,
      quantityAssignments: validation.correctedState.quantityAssignments,
      globalQuantity: validation.correctedState.globalQuantity,
      page: validation.correctedState.page || 1,
      limit: validation.correctedState.limit || 40,
      search: validation.correctedState.search,
      filters: validation.correctedState.filters || {
        showInactive: false,
        showSelectedOnly: false,
        categoryIds: [],
        brandIds: [],
        supplierIds: [],
      },
    };
  }

  return {
    selectedIds: state.selectedIds || [],
    operation: state.operation,
    reason: state.reason,
    globalUserId: state.globalUserId,
    quantityAssignments: state.quantityAssignments,
    globalQuantity: state.globalQuantity,
    page: state.page || 1,
    limit: state.limit || 40,
    search: state.search,
    filters: state.filters || {
      showInactive: false,
      showSelectedOnly: false,
      categoryIds: [],
      brandIds: [],
      supplierIds: [],
    },
  };
}

/**
 * Checks if URL state is empty/default
 */
export function isEmptyUrlState(state: Partial<ActivityFormUrlState>): boolean {
  return (
    (!state.selectedIds || state.selectedIds.length === 0) &&
    (!state.quantityAssignments || Object.keys(state.quantityAssignments).length === 0) &&
    (!state.search || state.search.length === 0) &&
    (!state.filters?.categoryIds || state.filters.categoryIds.length === 0) &&
    (!state.filters?.brandIds || state.filters.brandIds.length === 0) &&
    (!state.filters?.supplierIds || state.filters.supplierIds.length === 0) &&
    !state.filters?.showInactive &&
    !state.filters?.showSelectedOnly &&
    (!state.globalUserId || state.globalUserId.length === 0) &&
    (!state.operation || state.operation === ACTIVITY_OPERATION.OUTBOUND)
  );
}

/**
 * Compares two URL states for equality
 */
export function compareUrlStates(state1: Partial<ActivityFormUrlState>, state2: Partial<ActivityFormUrlState>): boolean {
  // Compare primitive fields
  const primitiveFields: (keyof ActivityFormUrlState)[] = ["operation", "globalUserId", "search", "page", "limit", "globalQuantity", "reason"];

  for (const field of primitiveFields) {
    if (state1[field] !== state2[field]) {
      return false;
    }
  }

  // Compare selectedIds array
  const arr1 = state1.selectedIds || [];
  const arr2 = state2.selectedIds || [];
  if (arr1.length !== arr2.length || !arr1.every((item, index) => item === arr2[index])) {
    return false;
  }

  // Compare quantityAssignments object
  const quantities1 = state1.quantityAssignments || {};
  const quantities2 = state2.quantityAssignments || {};
  const keys1 = Object.keys(quantities1);
  const keys2 = Object.keys(quantities2);
  if (keys1.length !== keys2.length || !keys1.every((key) => quantities1[key] === quantities2[key])) {
    return false;
  }

  // Compare filters object
  const filters1 = state1.filters || { showInactive: false, showSelectedOnly: false, categoryIds: [], brandIds: [], supplierIds: [] };
  const filters2 = state2.filters || { showInactive: false, showSelectedOnly: false, categoryIds: [], brandIds: [], supplierIds: [] };

  if (filters1.showInactive !== filters2.showInactive || filters1.showSelectedOnly !== filters2.showSelectedOnly) {
    return false;
  }

  const arrayFields: (keyof NonNullable<ActivityFormUrlState["filters"]>)[] = ["categoryIds", "brandIds", "supplierIds"];
  for (const field of arrayFields) {
    const arr1 = Array.isArray(filters1[field]) ? (filters1[field] as string[]) : [];
    const arr2 = Array.isArray(filters2[field]) ? (filters2[field] as string[]) : [];
    if (arr1.length !== arr2.length || !arr1.every((item, index) => item === arr2[index])) {
      return false;
    }
  }

  return true;
}

/**
 * Merges two URL states, with the second one taking precedence
 */
export function mergeUrlStates(base: Partial<ActivityFormUrlState>, override: Partial<ActivityFormUrlState>): ActivityFormUrlState {
  const merged: ActivityFormUrlState = {
    selectedIds: override.selectedIds ?? base.selectedIds ?? [],
    operation: override.operation ?? base.operation,
    reason: override.reason ?? base.reason,
    globalUserId: override.globalUserId ?? base.globalUserId,
    quantityAssignments: { ...(base.quantityAssignments || {}), ...(override.quantityAssignments || {}) },
    globalQuantity: override.globalQuantity ?? base.globalQuantity,
    page: override.page ?? base.page ?? 1,
    limit: override.limit ?? base.limit ?? 40,
    search: override.search ?? base.search,
    filters: {
      showInactive: override.filters?.showInactive ?? base.filters?.showInactive ?? false,
      showSelectedOnly: override.filters?.showSelectedOnly ?? base.filters?.showSelectedOnly ?? false,
      categoryIds: override.filters?.categoryIds ?? base.filters?.categoryIds ?? [],
      brandIds: override.filters?.brandIds ?? base.filters?.brandIds ?? [],
      supplierIds: override.filters?.supplierIds ?? base.filters?.supplierIds ?? [],
    },
  };

  return merged;
}

/**
 * Calculates URL state statistics
 */
export function getUrlStateStats(state: Partial<ActivityFormUrlState>) {
  const quantities = state.quantityAssignments || {};
  return {
    selectedItemsCount: state.selectedIds?.length ?? 0,
    quantitiesCount: Object.keys(quantities).length,
    totalQuantity: Object.values(quantities).reduce((sum: number, qty: number) => sum + qty, 0),
    filtersCount: [
      state.search && state.search.length > 0 ? 1 : 0,
      state.filters?.showInactive ? 1 : 0,
      (state.filters?.categoryIds?.length ?? 0) > 0 ? 1 : 0,
      (state.filters?.brandIds?.length ?? 0) > 0 ? 1 : 0,
      (state.filters?.supplierIds?.length ?? 0) > 0 ? 1 : 0,
    ].reduce((sum, count) => sum + count, 0),
    hasUserSelection: Boolean(state.globalUserId),
    isInboundOperation: state.operation === ACTIVITY_OPERATION.INBOUND,
    showSelectedOnlyEnabled: Boolean(state.filters?.showSelectedOnly),
    isEmpty: isEmptyUrlState(state),
  };
}

/**
 * Creates a human-readable summary of URL state
 */
export function createUrlStateSummary(state: Partial<ActivityFormUrlState>): string {
  const stats = getUrlStateStats(state);
  const parts: string[] = [];

  if (stats.selectedItemsCount > 0) {
    parts.push(`${stats.selectedItemsCount} item${stats.selectedItemsCount > 1 ? "ns" : ""} selecionado${stats.selectedItemsCount > 1 ? "s" : ""}`);
  }

  if (stats.totalQuantity > 0) {
    parts.push(`quantidade total: ${stats.totalQuantity}`);
  }

  if (state.operation) {
    parts.push(`operação: ${state.operation === ACTIVITY_OPERATION.INBOUND ? "entrada" : "saída"}`);
  }

  if (state.globalUserId) {
    parts.push("usuário selecionado");
  }

  if (stats.filtersCount > 0) {
    parts.push(`${stats.filtersCount} filtro${stats.filtersCount > 1 ? "s" : ""} ativo${stats.filtersCount > 1 ? "s" : ""}`);
  }

  if (state.filters?.showSelectedOnly) {
    parts.push("apenas selecionados");
  }

  return parts.length > 0 ? parts.join(", ") : "Estado vazio";
}

/**
 * Error recovery strategies
 */
export const urlStateRecoveryStrategies = {
  /**
   * Attempt to recover from corrupted URL parameters
   */
  recoverFromCorruptedUrl: (searchParams: URLSearchParams): Partial<ActivityFormUrlState> => {
    const recovered: Partial<ActivityFormUrlState> = {};

    // Try to recover operation
    const operation = searchParams.get("operation");
    if (operation && Object.values(ACTIVITY_OPERATION).includes(operation as ACTIVITY_OPERATION)) {
      recovered.operation = operation as ACTIVITY_OPERATION;
    }

    // Try to recover user ID
    const globalUserId = searchParams.get("globalUserId");
    if (globalUserId && /^[0-9a-f-]{36}$/i.test(globalUserId)) {
      recovered.globalUserId = globalUserId;
    }

    // Try to recover selected items
    const selectedItems = searchParams.get("selectedIds");
    if (selectedItems) {
      try {
        const items = selectedItems.split(",").filter(Boolean);
        recovered.selectedIds = items;
      } catch (error) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn("Failed to recover selected items:", error);
        }
      }
    }

    // Try to recover quantities
    const quantities = searchParams.get("quantityAssignments");
    if (quantities) {
      try {
        const parsed = JSON.parse(quantities);
        if (typeof parsed === "object" && parsed !== null) {
          recovered.quantityAssignments = parsed;
        }
      } catch (error) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn("Failed to recover quantities:", error);
        }
      }
    }

    // Try to recover search term
    const searchTerm = searchParams.get("search");
    if (searchTerm) {
      recovered.search = decodeURIComponent(searchTerm);
    }

    // Try to recover boolean flags
    const showInactive = searchParams.get("showInactive");
    const showSelectedOnly = searchParams.get("showSelectedOnly");

    if (showInactive === "true" || showInactive === "false" || showSelectedOnly === "true" || showSelectedOnly === "false") {
      recovered.filters = {
        showInactive: showInactive === "true",
        showSelectedOnly: showSelectedOnly === "true",
        categoryIds: [],
        brandIds: [],
        supplierIds: [],
      };
    }

    // Try to recover array fields
    ["categoryIds", "brandIds", "supplierIds"].forEach((field) => {
      const value = searchParams.get(field);
      if (value) {
        try {
          const items = value.split(",").filter(Boolean);
          if (!recovered.filters) {
            recovered.filters = {
              showInactive: false,
              showSelectedOnly: false,
              categoryIds: [],
              brandIds: [],
              supplierIds: [],
            };
          }
          (recovered.filters as any)[field] = items;
        } catch (error) {
          if (process.env.NODE_ENV !== 'production') {
            console.warn(`Failed to recover ${field}:`, error);
          }
        }
      }
    });

    return recovered;
  },

  /**
   * Create a minimal valid state from any input
   */
  createMinimalValidState: (): ActivityFormUrlState => ({
    selectedIds: [],
    operation: undefined,
    reason: undefined,
    globalUserId: undefined,
    quantityAssignments: undefined,
    globalQuantity: undefined,
    page: 1,
    limit: 40,
    search: undefined,
    filters: {
      showInactive: false,
      showSelectedOnly: false,
      categoryIds: [],
      brandIds: [],
      supplierIds: [],
    },
  }),

  /**
   * Attempt to preserve as much state as possible while fixing errors
   */
  preservativeRecover: (corruptedState: any): ActivityFormUrlState => {
    const minimal = urlStateRecoveryStrategies.createMinimalValidState();

    if (!corruptedState || typeof corruptedState !== "object") {
      return minimal;
    }

    const validation = validateUrlState(corruptedState, { strict: true });
    return sanitizeUrlState(validation.correctedState || corruptedState);
  },
};
