import { z } from "zod";
import { ACTIVITY_OPERATION, ACTIVITY_REASON } from "../constants";

// =====================
// Schema Definitions
// =====================

export const activityFormUrlStateSchema = z.object({
  // Selected items
  selectedIds: z.array(z.string().uuid()).default([]),

  // Operation configuration
  operation: z.nativeEnum(ACTIVITY_OPERATION).optional(),
  reason: z.nativeEnum(ACTIVITY_REASON).nullable().optional(),

  // User selection
  globalUserId: z.string().uuid().nullable().optional(),

  // Quantities
  quantityAssignments: z.record(z.string().uuid(), z.number().min(0.01).max(999999)).optional(),
  globalQuantity: z.number().min(0.01).max(999999).optional(),

  // Pagination
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(10).max(100).default(40),
  search: z.string().max(200).optional(),

  // Filters
  filters: z
    .object({
      showInactive: z.boolean().default(false),
      showSelectedOnly: z.boolean().default(false),
      categoryIds: z.array(z.string().uuid()).default([]),
      brandIds: z.array(z.string().uuid()).default([]),
      supplierIds: z.array(z.string().uuid()).default([]),
    })
    .default({}),
});

export type ActivityFormUrlState = z.infer<typeof activityFormUrlStateSchema>;

// =====================
// Serialization Functions
// =====================

export function serializeActivityFormToUrlParams(state: Partial<ActivityFormUrlState>): URLSearchParams {
  const params = new URLSearchParams();

  // Selected items
  if (state.selectedIds && state.selectedIds.length > 0) {
    params.set("selected", JSON.stringify(state.selectedIds));
  }

  // Operation
  if (state.operation) {
    params.set("op", state.operation);
  }

  if (state.reason) {
    params.set("reason", state.reason);
  }

  // User
  if (state.globalUserId) {
    params.set("user", state.globalUserId);
  }

  // Quantities
  if (state.globalQuantity) {
    params.set("qty", state.globalQuantity.toString());
  }

  if (state.quantityAssignments && Object.keys(state.quantityAssignments).length > 0) {
    params.set("qtys", JSON.stringify(state.quantityAssignments));
  }

  // Pagination
  if (state.page && state.page !== 1) {
    params.set("page", state.page.toString());
  }

  if (state.limit && state.limit !== 40) {
    params.set("limit", state.limit.toString());
  }

  if (state.search) {
    params.set("q", state.search);
  }

  // Filters
  if (state.filters) {
    if (state.filters.showInactive) {
      params.set("inactive", "1");
    }

    if (state.filters.showSelectedOnly) {
      params.set("selectedOnly", "1");
    }

    if (state.filters.categoryIds.length > 0) {
      params.set("cats", JSON.stringify(state.filters.categoryIds));
    }

    if (state.filters.brandIds.length > 0) {
      params.set("brands", JSON.stringify(state.filters.brandIds));
    }

    if (state.filters.supplierIds.length > 0) {
      params.set("suppliers", JSON.stringify(state.filters.supplierIds));
    }
  }

  return params;
}

export function deserializeUrlParamsToActivityForm(searchParams: URLSearchParams): Partial<ActivityFormUrlState> {
  const state: Partial<ActivityFormUrlState> = {};

  // Selected items
  const selected = searchParams.get("selected");
  if (selected) {
    try {
      state.selectedIds = JSON.parse(selected);
    } catch {}
  }

  // Operation
  const operation = searchParams.get("op");
  if (operation && Object.values(ACTIVITY_OPERATION).includes(operation as any)) {
    state.operation = operation as ACTIVITY_OPERATION;
  }

  const reason = searchParams.get("reason");
  if (reason && Object.values(ACTIVITY_REASON).includes(reason as any)) {
    state.reason = reason as ACTIVITY_REASON;
  }

  // User
  const user = searchParams.get("user");
  if (user) {
    state.globalUserId = user;
  }

  // Quantities
  const qty = searchParams.get("qty");
  if (qty) {
    const parsed = parseFloat(qty);
    if (!isNaN(parsed)) {
      state.globalQuantity = parsed;
    }
  }

  const qtys = searchParams.get("qtys");
  if (qtys) {
    try {
      state.quantityAssignments = JSON.parse(qtys);
    } catch {}
  }

  // Pagination
  const page = searchParams.get("page");
  if (page) {
    const parsed = parseInt(page, 10);
    if (!isNaN(parsed)) {
      state.page = parsed;
    }
  }

  const limit = searchParams.get("limit");
  if (limit) {
    const parsed = parseInt(limit, 10);
    if (!isNaN(parsed)) {
      state.limit = parsed;
    }
  }

  const search = searchParams.get("q");
  if (search) {
    state.search = search;
  }

  // Filters
  const filters: any = {};

  if (searchParams.get("inactive") === "1") {
    filters.showInactive = true;
  }

  if (searchParams.get("selectedOnly") === "1") {
    filters.showSelectedOnly = true;
  }

  const cats = searchParams.get("cats");
  if (cats) {
    try {
      filters.categoryIds = JSON.parse(cats);
    } catch {
      filters.categoryIds = [];
    }
  }

  const brands = searchParams.get("brands");
  if (brands) {
    try {
      filters.brandIds = JSON.parse(brands);
    } catch {
      filters.brandIds = [];
    }
  }

  const suppliers = searchParams.get("suppliers");
  if (suppliers) {
    try {
      filters.supplierIds = JSON.parse(suppliers);
    } catch {
      filters.supplierIds = [];
    }
  }

  if (Object.keys(filters).length > 0) {
    state.filters = filters;
  }

  return state;
}

export function getDefaultActivityFormValues(searchParams: URLSearchParams, baseDefaults?: Partial<ActivityFormUrlState>): ActivityFormUrlState {
  const urlState = deserializeUrlParamsToActivityForm(searchParams);

  const defaults: ActivityFormUrlState = {
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
    ...baseDefaults,
    ...urlState,
  };

  return defaults;
}

export function validateActivityFormUrlState(state: Partial<ActivityFormUrlState>): {
  isValid: boolean;
  warnings: string[];
  errors: string[];
} {
  const warnings: string[] = [];
  const errors: string[] = [];

  // Check for max items
  if (state.selectedIds && state.selectedIds.length > 50) {
    errors.push(`Too many selected items (${state.selectedIds.length}). Maximum is 50.`);
  }

  // Check for conflicting configurations
  if (state.globalQuantity && state.quantityAssignments && Object.keys(state.quantityAssignments).length > 0) {
    warnings.push("Both global quantity and individual quantities are set. Individual quantities will take precedence.");
  }

  return {
    isValid: errors.length === 0,
    warnings,
    errors,
  };
}

// =====================
// Type Definitions
// =====================

export interface ActivityFormUrlStateManager {
  state: ActivityFormUrlState;
  setState: (newState: Partial<ActivityFormUrlState>) => void;
  resetState: () => void;
  setOperation: (operation: ACTIVITY_OPERATION, reason?: ACTIVITY_REASON | null) => void;
  setGlobalUser: (userId: string | null) => void;
  selectItem: (itemId: string, quantity?: number) => void;
  deselectItem: (itemId: string) => void;
  selectAllItems: (itemIds: string[]) => void;
  clearSelection: () => void;
  setGlobalQuantity: (quantity: number) => void;
  setItemQuantity: (itemId: string, quantity: number) => void;
  setPage: (page: number) => void;
  setLimit: (limit: number) => void;
  setSearch: (search: string) => void;
  toggleFilter: (filterKey: string, value: any) => void;
  resetFilters: () => void;
  validate: () => ReturnType<typeof validateActivityFormUrlState>;
  getUrlParams: () => URLSearchParams;
  getCurrentUrl: () => string;
  getShareableUrl: () => string;
}

export interface ActivityFormUrlStateConfig {
  baseUrl?: string;
  debounceMs?: number;
  maxSelectedItems?: number;
  validateOnChange?: boolean;
  defaults?: Partial<ActivityFormUrlState>;
}
