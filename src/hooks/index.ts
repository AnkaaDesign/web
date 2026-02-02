// packages/hooks/src/index.ts

// =====================================================
// Core Utilities & Factories
// =====================================================
export * from "./queryKeys";
export {
  createEntityHooks,
  createSpecializedQueryHook,
} from "./createEntityHooks";
export type {
  EntityService,
  QueryKeys,
  EntityHooksConfig,
  SpecializedQueryConfig,
} from "./createEntityHooks";
export * from "./useEditForm";

// =====================================================
// Authentication Hooks
// =====================================================
export * from "./useAuth";
export * from "./usePrivileges";

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
export * from "./useActivity";
export * from "./useTask";
export * from "./useOrder";
export * from "./useOrderItem";
export * from "./useOrderSchedule";
export * from "./useServiceOrder";
export * from "./useObservation";
export * from "./useCut";
export * from "./useAirbrushing";

// =====================================================
// Paint Module Hooks
// =====================================================
export * from "./paint"; // Consolidated paint hooks
export * from "./usePaint";
export * from "./paintType";
export * from "./usePaintBrand";
export * from "./usePaintFormula";
export * from "./usePaintFormulaComponent";
export * from "./usePaintProduction";
// =====================================================
// People Module Hooks
// =====================================================
export * from "./useUser";
export * from "./usePosition";
export * from "./usePositionRemuneration";
export * from "./useSector";
export * from "./useRepresentative";
export * from "./bonus";
export * from "./payroll";
export * from "./useHoliday";
export * from "./useVacation";
export * from "./useWarning";
export * from "./useBorrow";
export * from "./usePpe";
export * from "./useTeamStaff";

// =====================================================
// Stock Module Hooks
// =====================================================
export * from "./useItem";
export * from "./useItemBrand";
export * from "./useItemCategory";
export * from "./usePrice";
export * from "./useSupplier";
export * from "./useExternalWithdrawal";
export * from "./useMaintenance";

// =====================================================
// Common Module Hooks
// =====================================================
export * from "./useFile";
export * from "./useNotification";
export * from "./usePreferences";
export * from "./useChangelog";
export * from "./dashboard";
export * from "./useMediaViewer";

// =====================================================
// Real-time Communication Hooks
// =====================================================
export * from "./use-socket";
export * from "./use-notification-socket";

// =====================================================
// Other Module Hooks
// =====================================================
export * from "./useCustomer";
export * from "./use-cnpj-autocomplete";
export * from "./useLayout";
export * from "./useLayoutSection";

// =====================================================
// Server Management Hooks
// =====================================================
export * from "./useServer";
export * from "./useBackup";
export * from "./deployment";

// =====================================================
// Integration Hooks
// =====================================================
export * from "./secullum";

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
