// packages/hooks/src/index.ts

// =====================================================
// Core Utilities & Factories
// =====================================================
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

// =====================================================
// Authentication Hooks
// =====================================================
export * from "./use-auth";
export * from "./use-privileges";

// =====================================================
// UI & Form Hooks
// =====================================================
export * from "./use-search-input";
export { useAdvancedSearch } from "./use-advanced-search";
export type {
  SearchField,
  SearchSuggestion,
  SearchEmptyState,
  UseAdvancedSearchOptions,
  UseAdvancedSearchReturn,
} from "./use-advanced-search";

// =====================================================
// Work Module Hooks
// =====================================================
export * from "./use-activity";
export * from "./use-task";
export * from "./use-order";
export * from "./use-order-item";
export * from "./use-order-schedule";
export * from "./use-service-order";
export * from "./use-observation";
export * from "./use-cut";
export * from "./use-airbrushing";

// =====================================================
// Paint Module Hooks
// =====================================================
export * from "./paint-hooks"; // Consolidated paint hooks
export * from "./use-paint";
export * from "./use-paint-type";
export * from "./use-paint-brand";
export * from "./use-paint-formula";
export * from "./use-paint-formula-component";
export * from "./use-paint-production";
// =====================================================
// People Module Hooks
// =====================================================
export * from "./use-user";
export * from "./use-position";
export * from "./use-position-remuneration";
export * from "./use-sector";
export * from "./use-representative";
export * from "./use-bonus";
export * from "./use-payroll";
export * from "./use-holiday";
export * from "./use-vacation";
export * from "./use-warning";
export * from "./use-borrow";
export * from "./use-ppe";
export * from "./use-team-staff";

// =====================================================
// Stock Module Hooks
// =====================================================
export * from "./use-item";
export * from "./use-item-brand";
export * from "./use-item-category";
export * from "./use-supplier";
export * from "./use-external-withdrawal";
export * from "./use-maintenance";

// =====================================================
// Common Module Hooks
// =====================================================
export * from "./use-file";
export * from "./use-notification";
export * from "./use-preferences";
export * from "./use-changelog";
export * from "./use-dashboard";
export * from "./use-media-viewer";

// =====================================================
// Real-time Communication Hooks
// =====================================================
export * from "./use-socket";
export * from "./use-notification-socket";

// =====================================================
// Other Module Hooks
// =====================================================
export * from "./use-customer";
export * from "./use-cnpj-autocomplete";
export * from "./use-layout";
export * from "./use-layout-section";

// =====================================================
// Server Management Hooks
// =====================================================
export * from "./use-server";
export * from "./use-backup";
export * from "./use-deployment";

// =====================================================
// Integration Hooks
// =====================================================
export * from "./use-secullum";

// =====================================================
// Table & UI Utilities
// =====================================================
export * from "./use-column-widths";

// =====================================================
// Monitoring & Utilities
// =====================================================
// NOTE: query-error-monitor is NOT exported here to prevent module initialization issues
// It should be imported directly when needed: import { queryErrorMonitor } from "./query-error-monitor"
// This prevents the monitor from being bundled with every hooks import, avoiding QueryClient race conditions
