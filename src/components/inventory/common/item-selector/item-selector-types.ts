import type { Item, ItemGetManyFormData } from "../../../../types";
import type { ReactNode } from "react";

/**
 * Column definition for item selector table
 * Extends the base column with additional properties for editability and fixed state
 */
export interface ItemSelectorColumn {
  /** Unique identifier for the column */
  key: string;
  /** Display header text */
  header: string;
  /** Render function for cell content */
  accessor: (item: Item, context?: ItemSelectorContext) => ReactNode;
  /** Whether the column is sortable */
  sortable?: boolean;
  /** CSS class name for styling/width */
  className?: string;
  /** Text alignment */
  align?: "left" | "center" | "right";
  /** Whether this column cannot be hidden (checkbox, name, required inputs) */
  fixed?: boolean;
  /** Whether this column is an editable input field */
  editable?: boolean;
  /** Helper text to show why a column is fixed */
  fixedReason?: string;
}

/**
 * Context passed to column accessors for rendering editable fields
 */
export interface ItemSelectorContext {
  /** Selected item IDs */
  selectedItems: Set<string>;
  /** Quantity values per item */
  quantities?: Record<string, number>;
  /** Price values per item */
  prices?: Record<string, number>;
  /** ICMS values per item */
  icmses?: Record<string, number>;
  /** IPI values per item */
  ipis?: Record<string, number>;
  /** Handler for quantity changes */
  onQuantityChange?: (itemId: string, value: number) => void;
  /** Handler for price changes */
  onPriceChange?: (itemId: string, value: number) => void;
  /** Handler for ICMS changes */
  onIcmsChange?: (itemId: string, value: number) => void;
  /** Handler for IPI changes */
  onIpiChange?: (itemId: string, value: number) => void;
  /** Handler for item selection - can optionally pass item data (quantity, price, icms, ipi) */
  onSelectItem?: (itemId: string, quantity?: number, price?: number, icms?: number, ipi?: number) => void;
  /** Check if an item is selected */
  isSelected?: (itemId: string) => boolean;
}

/**
 * Configuration for which editable columns to show
 */
export interface EditableColumnsConfig {
  /** Show quantity input column */
  showQuantityInput?: boolean;
  /** Show price input column */
  showPriceInput?: boolean;
  /** Show ICMS input column */
  showIcmsInput?: boolean;
  /** Show IPI input column */
  showIpiInput?: boolean;
}

/**
 * Configuration for fixed columns based on entity requirements
 */
export interface FixedColumnsConfig {
  /** Columns that must always be visible */
  fixedColumns: string[];
  /** Reason why columns are fixed (for tooltip/help text) */
  fixedReasons?: Record<string, string>;
}

/**
 * Props for ItemSelectorTable component
 */
export interface ItemSelectorTableProps {
  /** Currently selected item IDs */
  selectedItems: Set<string>;
  /** Handler for item selection - receives item data (quantity/stock, price, icms, ipi) when selecting */
  onSelectItem: (itemId: string, quantity?: number, price?: number, icms?: number, ipi?: number) => void;
  /** Handler for select all */
  onSelectAll: () => void;
  /** Optional className for styling */
  className?: string;

  // Editable field values
  /** Quantity values per item */
  quantities?: Record<string, number>;
  /** Price values per item */
  prices?: Record<string, number>;
  /** ICMS values per item */
  icmses?: Record<string, number>;
  /** IPI values per item */
  ipis?: Record<string, number>;

  // Editable field handlers
  /** Handler for quantity changes */
  onQuantityChange?: (itemId: string, value: number) => void;
  /** Handler for price changes */
  onPriceChange?: (itemId: string, value: number) => void;
  /** Handler for ICMS changes */
  onIcmsChange?: (itemId: string, value: number) => void;
  /** Handler for IPI changes */
  onIpiChange?: (itemId: string, value: number) => void;

  // Column configuration
  /** Which editable columns to show */
  editableColumns?: EditableColumnsConfig;
  /** Which columns are fixed and cannot be hidden */
  fixedColumnsConfig?: FixedColumnsConfig;
  /** Storage key for column visibility persistence (e.g., "activity-item-selector") */
  storageKey: string;
  /** Default visible columns (overrides automatic defaults) */
  defaultColumns?: string[];

  // Filter configuration
  /** Additional filters to apply (e.g., category type for borrow) */
  additionalFilters?: Partial<ItemGetManyFormData>;
  /** Whether to enable all filters or limit to basic ones */
  enableAdvancedFilters?: boolean;

  // State management (optional - for URL state sync)
  /** Current page (1-based) */
  page?: number;
  /** Page size */
  pageSize?: number;
  /** Show selected only toggle state */
  showSelectedOnly?: boolean;
  /** Search term */
  searchTerm?: string;
  /** Current filters */
  filters?: Partial<ItemGetManyFormData>;
  /** Handler for page change */
  onPageChange?: (page: number) => void;
  /** Handler for page size change */
  onPageSizeChange?: (pageSize: number) => void;
  /** Handler for show selected only toggle */
  onShowSelectedOnlyChange?: (value: boolean) => void;
  /** Handler for search term change */
  onSearchTermChange?: (term: string) => void;
  /** Handler for filter changes */
  onFiltersChange?: (filters: Partial<ItemGetManyFormData>) => void;
}

/**
 * Active filter for display in filter indicators
 */
export interface ActiveFilter {
  /** Filter identifier */
  key: string;
  /** Display label */
  label: string;
  /** Display value */
  value: string | ReactNode;
  /** Icon component */
  icon?: any;
  /** Handler to remove this filter */
  onRemove: () => void;
  /** For array filters, the specific item value to remove */
  itemValue?: any;
}
