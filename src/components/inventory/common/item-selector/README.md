# Item Selector - Shared Component System

A comprehensive, reusable item selection table for forms across the inventory system. Built to provide a consistent, powerful, and user-friendly experience for selecting items in activities, borrows, external withdrawals, and orders.

## 🎯 Overview

The Item Selector is a **production-ready, enterprise-grade** component system that replaces multiple form-specific item selectors with a single, robust, well-structured solution.

### Key Features

✅ **Full Filter System** - 15+ filter types matching the main item list
✅ **Column Visibility** - Customizable columns with persistence
✅ **Fixed Columns** - Mark essential columns that cannot be hidden
✅ **Editable Fields** - Quantity, price, ICMS, IPI inputs per item
✅ **Pagination & Sorting** - Server-side with multi-column support
✅ **Show Selected Only** - Focus on selected items
✅ **Filter Indicators** - Visual badges with individual removal
✅ **URL State Management** - Optional synchronization with URL params
✅ **localStorage Persistence** - Column preferences per form
✅ **Responsive Design** - Works on all screen sizes
✅ **Performance Optimized** - Debounced search, efficient rendering
✅ **Fully Typed** - Complete TypeScript support

## 📁 File Structure

```
src/components/inventory/common/item-selector/
├── README.md                              # This file
├── USAGE.md                               # Detailed API documentation
├── MIGRATION_GUIDE.md                     # Migration guide from old selectors
├── index.ts                               # Public exports
├── item-selector-types.ts                 # TypeScript type definitions
├── item-selector-columns.tsx              # Column definitions
├── item-selector-table.tsx                # Main table component ⭐
├── item-selector-filters.tsx              # Filter modal component
├── item-selector-column-visibility.tsx    # Column visibility manager
├── item-selector-filter-indicator.tsx     # Filter indicator badges
└── item-selector-filter-utils.ts          # Filter utilities
```

## 🚀 Quick Start

### Basic Example

```tsx
import { ItemSelectorTable } from '@/components/inventory/common/item-selector';

function MyForm() {
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const handleSelectItem = (itemId: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
      const newQuantities = { ...quantities };
      delete newQuantities[itemId];
      setQuantities(newQuantities);
    } else {
      newSelected.add(itemId);
      setQuantities({ ...quantities, [itemId]: 1 });
    }
    setSelectedItems(newSelected);
  };

  return (
    <ItemSelectorTable
      selectedItems={selectedItems}
      onSelectItem={handleSelectItem}
      onSelectAll={() => {}}
      quantities={quantities}
      onQuantityChange={(id, val) => setQuantities({ ...quantities, [id]: val })}
      editableColumns={{ showQuantityInput: true }}
      storageKey="my-form-items"
      fixedColumnsConfig={{
        fixedColumns: ['name'],
      }}
    />
  );
}
```

## 📖 Documentation

### 1. [USAGE.md](./USAGE.md) - Comprehensive Usage Guide
- Full API reference
- Props documentation
- Configuration examples per form type
- Available filters list
- Advanced usage patterns

### 2. [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) - Migration from Old Selectors
- Step-by-step migration process
- Before/after code examples
- Testing checklist
- Troubleshooting guide

## 🎨 Form-Specific Configurations

### Activity Form

```tsx
<ItemSelectorTable
  // ... basic props
  editableColumns={{ showQuantityInput: true }}
  fixedColumnsConfig={{ fixedColumns: ['name'] }}
  storageKey="activity-item-selector"
/>
```

**Fixed Columns**: name (essencial para identificar o item)
**Editable**: Quantity only

### Borrow Form (Tool Loans)

```tsx
<ItemSelectorTable
  // ... basic props
  editableColumns={{ showQuantityInput: true }}
  fixedColumnsConfig={{
    fixedColumns: ['name', 'quantity'],
    fixedReasons: {
      name: 'Essencial para identificar o item',
      quantity: 'Necessário para verificar estoque disponível',
    },
  }}
  storageKey="borrow-item-selector"
  additionalFilters={{
    where: { category: { type: 'TOOL' } },
  }}
/>
```

**Fixed Columns**: name, quantity (stock critical for loans)
**Pre-Filter**: Only TOOL category items
**Editable**: Quantity only

### External Withdrawal Form

```tsx
<ItemSelectorTable
  // ... basic props
  editableColumns={{
    showQuantityInput: true,
    showPriceInput: type === 'CHARGEABLE', // Conditional
  }}
  fixedColumnsConfig={{ fixedColumns: ['name'] }}
  storageKey="external-withdrawal-item-selector"
/>
```

**Fixed Columns**: name
**Editable**: Quantity always, Price conditionally (CHARGEABLE type)

### Order Form (Purchase Orders)

```tsx
<ItemSelectorTable
  // ... basic props
  editableColumns={{
    showQuantityInput: true,
    showPriceInput: true,
    showIcmsInput: true,
    showIpiInput: true,
  }}
  fixedColumnsConfig={{ fixedColumns: ['name'] }}
  storageKey="order-item-selector"
/>
```

**Fixed Columns**: name (inputs are auto-fixed)
**Editable**: Quantity, Price, ICMS, IPI

## 🔍 Available Filters

The component includes **ALL** filters from the main item list:

| Category | Filters |
|----------|---------|
| **Basic** | Status (active/inactive/both), Assign to User |
| **Entity** | Categories, Brands, Suppliers (multi-select with async loading) |
| **Stock** | Stock Levels (critical, out of stock, low, normal, overstock, etc.) |
| **Ranges** | Quantity, Price, ICMS, IPI, Monthly Consumption |
| **Dates** | Created Date, Updated Date |

All filters support:
- Individual removal via filter indicators
- Clear all option
- URL state synchronization (optional)
- Persistent state during navigation

## 📊 Available Columns

All columns from the main item list are available:

**Primary**: uniCode, name, brand, category, measures, quantity, monthlyConsumption, price, totalPrice

**Secondary**: CA, barcodes, maxQuantity, reorderPoint, ICMS, IPI, supplier, ppeType, shouldAssignToUser, estimatedLeadTime, status, activitiesCount, createdAt

**Editable** (configurable): quantityInput, priceInput, icmsInput, ipiInput

Users can show/hide columns via the "Colunas" button. Preferences are saved per `storageKey`.

## 🔒 Fixed Columns

Columns can be marked as "fixed" to prevent users from hiding essential information:

```tsx
fixedColumnsConfig={{
  fixedColumns: ['name', 'quantity'],
  fixedReasons: {
    name: 'Essencial para identificar o item',
    quantity: 'Necessário para verificar estoque disponível',
  },
}}
```

Fixed columns:
- Show a lock icon 🔒
- Cannot be toggled off
- Display tooltip explaining why they're required
- Are always visible regardless of user preferences

**Auto-fixed**: checkbox, editable input columns

## ⚡ Performance

- **Debounced Search**: 300ms debounce reduces API calls
- **Server-side Pagination**: Efficient with large datasets
- **Optimized Rendering**: Memoization prevents unnecessary re-renders
- **Async Entity Loading**: Categories, brands, suppliers load on-demand
- **Column Visibility**: Changes don't trigger data refetch

## 🧪 Testing

After integration, verify:

- [ ] Selection works (click row to select/deselect)
- [ ] Editable inputs work and update state
- [ ] Search with debounce
- [ ] All filters apply correctly
- [ ] Filter indicators show and can be removed
- [ ] Column visibility persists in localStorage
- [ ] Fixed columns cannot be hidden
- [ ] Pagination works
- [ ] Sorting works (single and multi-column)
- [ ] Show selected only toggle
- [ ] URL state preserved (if enabled)

## 🛠️ Development

### Adding New Editable Columns

To add a new editable column type:

1. Add to `EditableColumnsConfig` in `item-selector-types.ts`
2. Add the column definition in `createItemSelectorColumns()` in `item-selector-columns.tsx`
3. Add the value record and handler props to `ItemSelectorTableProps`
4. Update the context in `item-selector-table.tsx`
5. Update documentation

### Adding New Filters

Filters are shared with the main item list. To add a new filter:

1. Add to `ItemGetManyFormData` schema
2. Update `ItemSelectorFilters` component to include the new filter UI
3. Update `extractActiveFilters` in filter utilities to display the filter indicator
4. Update `createFilterRemover` to handle removal
5. Update API to support the filter

## 📝 Best Practices

1. **Use Unique Storage Keys**: Each form should have a unique `storageKey`
   - ✅ "activity-item-selector"
   - ✅ "borrow-item-selector"
   - ❌ "item-selector" (too generic)

2. **Mark Essential Columns as Fixed**: Columns required for the form's business logic should be fixed
   - Activity: name
   - Borrow: name, quantity (stock)
   - External Withdrawal: name
   - Order: name (inputs auto-fixed)

3. **Use Conditional Editable Columns**: Show inputs only when needed
   ```tsx
   editableColumns={{
     showPriceInput: withdrawalType === 'CHARGEABLE',
   }}
   ```

4. **Leverage Additional Filters**: Pre-filter items for specific use cases
   ```tsx
   additionalFilters={{
     where: { category: { type: 'TOOL' } }, // Borrow form
   }}
   ```

5. **Handle URL State Carefully**: Only use URL state if you need shareable/bookmarkable filtered views

## 🏗️ Architecture

### Component Hierarchy

```
ItemSelectorTable (Main)
├── TableSearchInput
├── ShowSelectedToggle
├── FilterButton → ItemSelectorFilters (Modal)
│   ├── Status Filter (Combobox)
│   ├── Entity Filters (Async Combobox)
│   ├── Stock Filters (Combobox)
│   └── Range Filters (Input pairs)
├── ItemSelectorColumnVisibility (Popover)
│   └── Column toggles with fixed support
├── FilterIndicators (Active filter badges)
├── Table (Items with sorting, selection)
│   ├── Header (with sort icons)
│   ├── Rows (click to select)
│   └── Editable cells (quantity, price, etc.)
└── SimplePaginationAdvanced
```

### State Management

- **Local State**: Immediate UI updates (search, temp filters)
- **URL State** (optional): Shareable filtered views
- **localStorage**: Column visibility preferences
- **Server State**: Items fetched via React Query

### Data Flow

```
User Action → Local State → Debounce → API Query → React Query Cache → Render
              └→ URL Update (optional)
              └→ localStorage (column visibility)
```

## 🤝 Contributing

When updating the shared item selector:

1. Ensure backward compatibility
2. Update all documentation
3. Test with all four forms
4. Update migration guide if API changes
5. Add examples for new features

## 📄 License

Internal use only. Part of the inventory management system.

## 🆘 Support

For questions or issues:

1. Check [USAGE.md](./USAGE.md) for API reference
2. Check [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) for integration help
3. Review type definitions in `item-selector-types.ts`
4. Contact the development team

---

**Built with ❤️ for maximum reusability, robustness, and developer experience.**
