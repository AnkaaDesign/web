/**
 * Filter Components
 * Comprehensive filtering system for statistics and data management
 */

// Basic filters
export { DateRangeFilter } from "./DateRangeFilter";
export type { DateRange, DateRangeFilterProps } from "./DateRangeFilter";

export { StatusFilter } from "./StatusFilter";
export type { StatusOption, StatusFilterProps } from "./StatusFilter";

export { NumericRangeFilter } from "./NumericRangeFilter";
export type { NumericRange, NumericRangeFilterProps } from "./NumericRangeFilter";

export { SearchFilter } from "./SearchFilter";
export type { SearchFilterProps } from "./SearchFilter";

export { BooleanFilter } from "./BooleanFilter";
export type { BooleanFilterProps } from "./BooleanFilter";

export { EnumFilter } from "./EnumFilter";
export type { EnumOption, EnumFilterProps } from "./EnumFilter";

export { CategoryFilter } from "./CategoryFilter";
export type { CategoryNode, CategoryFilterProps } from "./CategoryFilter";

export { UserFilter } from "./UserFilter";
export type { User, UserFilterProps } from "./UserFilter";

// Main filter panel
export { FilterPanel } from "./FilterPanel";
export type { FilterSection, FilterPanelProps } from "./FilterPanel";

// Advanced filter builder (already exists)
export { AdvancedFilterDialog } from "./advanced-filter-dialog";
export type { AdvancedFilterDialogProps } from "./advanced-filter-dialog";

export { FilterAutocomplete } from "./filter-autocomplete";
export type { FilterSuggestion, SuggestionProvider } from "./filter-autocomplete";

// Re-export existing utilities
export * from "@/utils/table-filter-utils";
