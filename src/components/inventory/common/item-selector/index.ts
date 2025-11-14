/**
 * Shared Item Selector Components
 *
 * A comprehensive, reusable item selection system for forms across the application.
 * Provides full filtering, column visibility, sorting, and selection capabilities.
 *
 * @example
 * ```tsx
 * import { ItemSelectorTable } from '@/components/inventory/common/item-selector';
 *
 * <ItemSelectorTable
 *   selectedItems={selectedItems}
 *   onSelectItem={handleSelectItem}
 *   onSelectAll={handleSelectAll}
 *   quantities={quantities}
 *   onQuantityChange={handleQuantityChange}
 *   editableColumns={{ showQuantityInput: true }}
 *   fixedColumnsConfig={{
 *     fixedColumns: ['name', 'quantity'],
 *     fixedReasons: {
 *       quantity: 'Necessário para ver estoque disponível'
 *     }
 *   }}
 *   storageKey="activity-item-selector"
 * />
 * ```
 */

export { ItemSelectorTable } from "./item-selector-table";
export { ItemSelectorFilters } from "./item-selector-filters";
export { ItemSelectorColumnVisibility } from "./item-selector-column-visibility";
export { FilterIndicators } from "./item-selector-filter-indicator";
export { createItemSelectorColumns, getDefaultVisibleColumns } from "./item-selector-columns";
export { extractActiveFilters, createFilterRemover } from "./item-selector-filter-utils";

export type {
  ItemSelectorColumn,
  ItemSelectorContext,
  EditableColumnsConfig,
  FixedColumnsConfig,
  ItemSelectorTableProps,
  ActiveFilter,
} from "./item-selector-types";
