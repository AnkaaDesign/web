// Core Utilities & Factories
export * from "./query-keys";
export {
  createEntityHooks,
  createSpecializedQueryHook,
} from "./create-entity-hooks";
export type {
  EntityService,
  QueryKeys,
  EntityHooksConfig,
  SpecializedQueryConfig,
} from "./create-entity-hooks";
export * from "./use-edit-form";
export * from "./create-form-url-state";

// Authentication
export * from "./use-auth";
export * from "./use-privileges";

// UI & Form Hooks
export * from "./use-search-input";
export { useAdvancedSearch } from "./use-advanced-search";
export type {
  SearchField,
  SearchSuggestion,
  SearchEmptyState,
  UseAdvancedSearchOptions,
  UseAdvancedSearchReturn,
} from "./use-advanced-search";

// Table & Data
export * from "./use-table-state";
export * from "./use-table-filters";
export {
  useUnifiedTableState,
} from "./use-unified-table-state";
export type {
  SortConfig,
  SearchState,
  TableStatePreset,
  UnifiedTableState,
  UseUnifiedTableStateOptions,
  UseUnifiedTableStateReturn,
} from "./use-unified-table-state";
// NOTE: PaginationState, SelectionState, SortState, FilterState from use-unified-table-state
// are intentionally excluded to avoid conflicts with use-table-state.
// Import directly from "@/hooks/common/use-unified-table-state" if the unified versions are needed.
export * from "./use-column-widths";
export * from "./use-column-visibility";
export * from "./use-advanced-table-selection";
export {
  usePaginationState,
} from "./use-pagination-state";
export type {
  PaginationMeta,
  PaginationActions,
  UsePaginationStateOptions,
} from "./use-pagination-state";
// NOTE: PaginationState from use-pagination-state excluded to avoid conflict with use-table-state

// URL State
export * from "./use-url-state";
export * from "./use-url-params";
export * from "./use-url-filters";
export * from "./use-url-state-coordinator";

// Socket & Real-time
export * from "./use-socket";
export * from "./use-notification-socket";
export * from "./use-notification-center";

// Files & Media
export * from "./use-file";
export * from "./use-media-viewer";

// Preferences & Dashboard
export * from "./use-preferences";
export * from "./use-dashboard";
export * from "./use-page-tracker";

// Utility Hooks
export * from "./use-toast";
export * from "./use-debounce";
export * from "./use-debounced-value";
export * from "./use-throttler";
export * from "./use-cancelable-query";
export * from "./use-stable-query";
export * from "./use-batch-result-dialog";
export * from "./use-entity-details";
export * from "./use-dynamic-grid";
export * from "./use-infinite-scroll";
export * from "./use-scrollbar-width";
export * from "./use-section-visibility";
export * from "./use-smart-menu-position";

// Lookup Hooks
export * from "./use-cep-lookup";
export * from "./use-cnpj-autocomplete";
export * from "./use-cnpj-lookup";

// Filters
export * from "./filters";

// NOTE: query-error-monitor is NOT exported here to prevent module initialization issues
// It should be imported directly when needed: import { queryErrorMonitor } from "@/hooks/common/query-error-monitor"
