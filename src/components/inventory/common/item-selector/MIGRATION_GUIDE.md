# Migration Guide: Updating Forms to Use ItemSelectorTable

This guide shows how to replace existing item selector components with the new shared `ItemSelectorTable`.

## Benefits of Migration

- ✅ **Full filter system** - All 15+ filters matching main item list
- ✅ **Column visibility** - Users can customize which columns to show
- ✅ **Fixed columns support** - Mark essential columns that cannot be hidden
- ✅ **Consistent UX** - Same experience across all forms
- ✅ **Maintainability** - Single source of truth for item selection logic
- ✅ **Less code** - Simpler integration, less boilerplate

## Order Form Migration

### Before (Old OrderItemSelector)

```tsx
import { OrderItemSelector } from "./order-item-selector";

<OrderItemSelector
  selectedItems={selectedItems}
  onSelectItem={handleSelectItem}
  onSelectAll={() => {}}
  onQuantityChange={handleQuantityChange}
  onPriceChange={handlePriceChange}
  onIcmsChange={handleIcmsChange}
  onIpiChange={handleIpiChange}
  quantities={quantities}
  prices={prices}
  icmses={icmses}
  ipis={ipis}
  isSelected={(itemId) => selectedItems.has(itemId)}
  showQuantityInput={true}
  showPriceInput={true}
  showIcmsInput={true}
  showIpiInput={true}
  showSelectedOnly={showSelectedOnly}
  searchTerm={searchTerm}
  showInactive={showInactive}
  categoryIds={categoryIds}
  brandIds={brandIds}
  supplierIds={supplierIds}
  page={page}
  pageSize={pageSize}
  totalRecords={totalRecords}
  onPageChange={setPage}
  onPageSizeChange={setPageSize}
  onTotalRecordsChange={setTotalRecords}
  onShowSelectedOnlyChange={setShowSelectedOnly}
  onSearchTermChange={setSearchTerm}
  onShowInactiveChange={setShowInactive}
  onCategoryIdsChange={setCategoryIds}
  onBrandIdsChange={setBrandIds}
  onSupplierIdsChange={setSupplierIds}
  onBatchFiltersChange={setBatchFilters}
  updateSelection={batchUpdateSelection}
  className="flex-1 min-h-0"
/>
```

### After (New ItemSelectorTable)

```tsx
import { ItemSelectorTable } from '@/components/inventory/common/item-selector';

// If you need URL state management, convert the discrete filter props into a filters object
const filters = useMemo(() => ({
  showInactive,
  categoryIds,
  brandIds,
  supplierIds,
  // ... other filters from URL state
}), [showInactive, categoryIds, brandIds, supplierIds]);

const handleFiltersChange = useCallback((newFilters: Partial<ItemGetManyFormData>) => {
  // Update individual URL params
  if (newFilters.showInactive !== undefined) setShowInactive(newFilters.showInactive);
  if (newFilters.categoryIds !== undefined) setCategoryIds(newFilters.categoryIds);
  if (newFilters.brandIds !== undefined) setBrandIds(newFilters.brandIds);
  if (newFilters.supplierIds !== undefined) setSupplierIds(newFilters.supplierIds);
  // ... handle other filter changes
}, [setShowInactive, setCategoryIds, setBrandIds, setSupplierIds]);

<ItemSelectorTable
  selectedItems={selectedItems}
  onSelectItem={toggleItemSelection}
  onSelectAll={() => {/* implement if needed */}}
  quantities={quantities}
  prices={prices}
  icmses={icmses}
  ipis={ipis}
  onQuantityChange={setItemQuantity}
  onPriceChange={setItemPrice}
  onIcmsChange={setItemIcms}
  onIpiChange={setItemIpi}
  editableColumns={{
    showQuantityInput: true,
    showPriceInput: true,
    showIcmsInput: true,
    showIpiInput: true,
  }}
  fixedColumnsConfig={{
    fixedColumns: ['name'], // Only name is truly required (inputs are auto-fixed)
    fixedReasons: {
      name: 'Essencial para identificar o item sendo pedido',
    },
  }}
  storageKey="order-item-selector"
  // Optional URL state management
  page={page}
  pageSize={pageSize}
  showSelectedOnly={showSelectedOnly}
  searchTerm={searchTerm}
  filters={filters}
  onPageChange={setPage}
  onPageSizeChange={setPageSize}
  onShowSelectedOnlyChange={setShowSelectedOnly}
  onSearchTermChange={setSearchTerm}
  onFiltersChange={handleFiltersChange}
  className="flex-1 min-h-0"
/>
```

### Key Changes

1. **Import** - Changed from local component to shared component
2. **Filter Management** - Filters are now passed as a single object instead of discrete props
3. **Filter Handler** - Single `onFiltersChange` handler instead of multiple individual handlers
4. **Editable Columns** - Configured via `editableColumns` object
5. **Fixed Columns** - New `fixedColumnsConfig` to mark required columns
6. **Storage Key** - Added for column visibility persistence
7. **Removed Props** - No need for `isSelected`, `onBatchFiltersChange`, `updateSelection`, `onTotalRecordsChange`

## Activity Form Migration

### After (New ItemSelectorTable)

```tsx
import { ItemSelectorTable } from '@/components/inventory/common/item-selector';

<ItemSelectorTable
  selectedItems={selectedItems}
  onSelectItem={toggleItemSelection}
  onSelectAll={() => {/* implement select all logic */}}
  quantities={quantities}
  onQuantityChange={setItemQuantity}
  editableColumns={{
    showQuantityInput: true, // Only need quantity for activity
  }}
  fixedColumnsConfig={{
    fixedColumns: ['name'],
    fixedReasons: {
      name: 'Essencial para identificar o item sendo movimentado',
    },
  }}
  storageKey="activity-item-selector"
  enableAdvancedFilters={true}
/>
```

## Borrow Form Migration

### After (New ItemSelectorTable)

```tsx
import { ItemSelectorTable } from '@/components/inventory/common/item-selector';

<ItemSelectorTable
  selectedItems={selectedItems}
  onSelectItem={toggleItemSelection}
  onSelectAll={() => {/* implement select all logic */}}
  quantities={quantities}
  onQuantityChange={setItemQuantity}
  editableColumns={{
    showQuantityInput: true,
  }}
  fixedColumnsConfig={{
    fixedColumns: ['name', 'quantity'], // Stock is critical for borrows
    fixedReasons: {
      name: 'Essencial para identificar o item',
      quantity: 'Necessário para verificar estoque disponível e evitar empréstimos acima do estoque',
    },
  }}
  storageKey="borrow-item-selector"
  additionalFilters={{
    // Only show TOOL category items
    where: {
      category: {
        type: 'TOOL',
      },
    },
  }}
  enableAdvancedFilters={true}
/>
```

### Key Addition

- **additionalFilters** - Pre-filter to only show TOOL category items for borrow form

## External Withdrawal Form Migration

### After (New ItemSelectorTable)

```tsx
import { ItemSelectorTable } from '@/components/inventory/common/item-selector';

const [withdrawalType, setWithdrawalType] = useState<'RETURNABLE' | 'CHARGEABLE' | 'COMPLIMENTARY'>('RETURNABLE');

<ItemSelectorTable
  selectedItems={selectedItems}
  onSelectItem={toggleItemSelection}
  onSelectAll={() => {/* implement select all logic */}}
  quantities={quantities}
  prices={prices}
  onQuantityChange={setItemQuantity}
  onPriceChange={setItemPrice}
  editableColumns={{
    showQuantityInput: true,
    showPriceInput: withdrawalType === 'CHARGEABLE', // Conditional based on type
  }}
  fixedColumnsConfig={{
    fixedColumns: ['name'],
    fixedReasons: {
      name: 'Essencial para identificar o item sendo retirado',
    },
  }}
  storageKey="external-withdrawal-item-selector"
  enableAdvancedFilters={true}
/>
```

### Key Addition

- **Conditional editable columns** - Price input only shown for CHARGEABLE withdrawals

## Step-by-Step Migration Process

### 1. Update Imports

```tsx
// Remove old import
// import { OrderItemSelector } from "./order-item-selector";

// Add new import
import { ItemSelectorTable } from '@/components/inventory/common/item-selector';
import type { ItemGetManyFormData } from "../../../../schemas";
```

### 2. Consolidate Filter State (if using URL state)

If your form has discrete filter props like `showInactive`, `categoryIds`, etc., create a consolidated filters object:

```tsx
const filters = useMemo(() => ({
  showInactive,
  categoryIds,
  brandIds,
  supplierIds,
  stockLevels,
  quantityRange,
  // ... include all your filter state
}), [showInactive, categoryIds, brandIds, supplierIds, stockLevels, quantityRange]);
```

### 3. Create Filter Change Handler

```tsx
const handleFiltersChange = useCallback((newFilters: Partial<ItemGetManyFormData>) => {
  // Map the filters object back to individual state setters
  if (newFilters.showInactive !== undefined) setShowInactive(newFilters.showInactive);
  if (newFilters.categoryIds !== undefined) setCategoryIds(newFilters.categoryIds);
  if (newFilters.brandIds !== undefined) setBrandIds(newFilters.brandIds);
  if (newFilters.supplierIds !== undefined) setSupplierIds(newFilters.supplierIds);
  if (newFilters.stockLevels !== undefined) setStockLevels(newFilters.stockLevels);
  if (newFilters.quantityRange !== undefined) setQuantityRange(newFilters.quantityRange);
  // ... handle all filter types
}, [/* include all setters */]);
```

### 4. Replace Component

Replace the old selector component with `ItemSelectorTable` using the configuration appropriate for your form type (see examples above).

### 5. Remove Old Component Files

After migration is complete and tested, you can safely delete the old selector component files:

- `order-item-selector.tsx`
- `activity-item-selector.tsx`
- `borrow-item-selector.tsx`
- `external-withdrawal-item-selector.tsx`

And any associated files like:
- `filter-utils.tsx` (if form-specific)
- `filter-indicator.tsx` (if form-specific)
- `use-direct-filter-update.ts` (if form-specific)

## Testing Checklist

After migration, verify:

- [ ] Item selection works (single click selects/deselects)
- [ ] Editable fields work (quantity, price, icms, ipi as configured)
- [ ] Search works with debounce
- [ ] All filters work (status, categories, brands, suppliers, ranges, dates, stock levels)
- [ ] Filter indicators show and can be removed individually
- [ ] Column visibility works and persists in localStorage
- [ ] Fixed columns cannot be hidden
- [ ] Pagination works
- [ ] Sorting works (click headers to sort)
- [ ] Show selected only toggle works
- [ ] URL state is preserved on refresh (if using URL state)
- [ ] Performance is good (no unnecessary re-renders)

## Benefits Summary

| Feature | Old Approach | New Approach |
|---------|-------------|--------------|
| **Filters** | Basic (5 filters) | Complete (15+ filters) |
| **Column Visibility** | ❌ Not available | ✅ Full support with persistence |
| **Fixed Columns** | ❌ Not available | ✅ Supports fixed columns with tooltips |
| **Filter Indicators** | ⚠️ Basic | ✅ Complete with individual removal |
| **Code Reuse** | ❌ Duplicated across forms | ✅ Single shared component |
| **Maintenance** | ⚠️ Update 4+ files | ✅ Update 1 file |
| **Consistency** | ⚠️ Different per form | ✅ Consistent UX |
| **Documentation** | ⚠️ Limited | ✅ Comprehensive |

## Troubleshooting

### Issue: Filters not updating URL state

**Solution**: Make sure you're passing `onFiltersChange` and mapping the filter object back to individual state setters.

### Issue: Column visibility not persisting

**Solution**: Ensure `storageKey` is unique per form and doesn't conflict with other components.

### Issue: Editable inputs not working

**Solution**: Check that you're passing the value records (`quantities`, `prices`, etc.) and the change handlers (`onQuantityChange`, `onPriceChange`, etc.).

### Issue: Fixed columns still showing toggle

**Solution**: Ensure the column key is in the `fixedColumns` array. Note: checkbox and editable input columns are automatically fixed.

## Need Help?

- Check the [USAGE.md](./USAGE.md) file for detailed API documentation
- Look at the type definitions in `item-selector-types.ts`
- Reference the column definitions in `item-selector-columns.tsx`
- See the main component implementation in `item-selector-table.tsx`
