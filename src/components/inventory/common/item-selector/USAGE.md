# Item Selector - Usage Guide

A comprehensive, reusable item selection table for forms across the application.

## Features

- ✅ Full filter system (15+ filter types matching main item list)
- ✅ Column visibility with fixed columns support
- ✅ Editable fields (quantity, price, ICMS, IPI)
- ✅ Pagination, sorting, selection
- ✅ Show selected only toggle
- ✅ Filter indicators with individual removal
- ✅ URL state management support
- ✅ Persistent column preferences
- ✅ Responsive design

## Basic Usage

```tsx
import { ItemSelectorTable } from '@/components/inventory/common/item-selector';

function MyForm() {
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const handleSelectItem = (itemId: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
      // Clean up associated data
      const newQuantities = { ...quantities };
      delete newQuantities[itemId];
      setQuantities(newQuantities);
    } else {
      newSelected.add(itemId);
      // Initialize with default quantity
      setQuantities({ ...quantities, [itemId]: 1 });
    }
    setSelectedItems(newSelected);
  };

  const handleQuantityChange = (itemId: string, value: number) => {
    setQuantities({ ...quantities, [itemId]: value });
  };

  return (
    <ItemSelectorTable
      selectedItems={selectedItems}
      onSelectItem={handleSelectItem}
      onSelectAll={() => {/* implement if needed */}}
      quantities={quantities}
      onQuantityChange={handleQuantityChange}
      editableColumns={{ showQuantityInput: true }}
      storageKey="my-form-item-selector"
      fixedColumnsConfig={{
        fixedColumns: ['name'],
      }}
    />
  );
}
```

## Configuration by Form Type

### 1. Activity Form (Inventory Movements)

```tsx
<ItemSelectorTable
  selectedItems={selectedItems}
  onSelectItem={handleSelectItem}
  onSelectAll={handleSelectAll}
  quantities={quantities}
  onQuantityChange={handleQuantityChange}
  editableColumns={{
    showQuantityInput: true,
  }}
  fixedColumnsConfig={{
    fixedColumns: ['name'], // Only name is required
    fixedReasons: {
      name: 'Essencial para identificar o item',
    },
  }}
  storageKey="activity-item-selector"
  enableAdvancedFilters={true}
/>
```

### 2. Borrow Form (Tool Loans)

```tsx
<ItemSelectorTable
  selectedItems={selectedItems}
  onSelectItem={handleSelectItem}
  onSelectAll={handleSelectAll}
  quantities={quantities}
  onQuantityChange={handleQuantityChange}
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

### 3. External Withdrawal Form

```tsx
<ItemSelectorTable
  selectedItems={selectedItems}
  onSelectItem={handleSelectItem}
  onSelectAll={handleSelectAll}
  quantities={quantities}
  prices={prices}
  onQuantityChange={handleQuantityChange}
  onPriceChange={handlePriceChange}
  editableColumns={{
    showQuantityInput: true,
    showPriceInput: type === 'CHARGEABLE', // Conditional based on withdrawal type
  }}
  fixedColumnsConfig={{
    fixedColumns: ['name'],
    fixedReasons: {
      name: 'Essencial para identificar o item',
    },
  }}
  storageKey="external-withdrawal-item-selector"
  enableAdvancedFilters={true}
/>
```

### 4. Order Form (Purchase Orders)

```tsx
<ItemSelectorTable
  selectedItems={selectedItems}
  onSelectItem={handleSelectItem}
  onSelectAll={handleSelectAll}
  quantities={quantities}
  prices={prices}
  icmses={icmses}
  ipis={ipis}
  onQuantityChange={handleQuantityChange}
  onPriceChange={handlePriceChange}
  onIcmsChange={handleIcmsChange}
  onIpiChange={handleIpiChange}
  editableColumns={{
    showQuantityInput: true,
    showPriceInput: true,
    showIcmsInput: true,
    showIpiInput: true,
  }}
  fixedColumnsConfig={{
    fixedColumns: ['name'], // Quantity and price inputs are auto-fixed
    fixedReasons: {
      name: 'Essencial para identificar o item',
    },
  }}
  storageKey="order-item-selector"
  enableAdvancedFilters={true}
/>
```

## Props Reference

### Required Props

- `selectedItems: Set<string>` - Currently selected item IDs
- `onSelectItem: (itemId: string) => void` - Handler for item selection toggle
- `onSelectAll: () => void` - Handler for select all action
- `storageKey: string` - Unique key for localStorage persistence (e.g., "activity-item-selector")

### Editable Fields

```tsx
editableColumns?: {
  showQuantityInput?: boolean;  // Show quantity input column
  showPriceInput?: boolean;     // Show price input column
  showIcmsInput?: boolean;      // Show ICMS % input column
  showIpiInput?: boolean;       // Show IPI % input column
}

quantities?: Record<string, number>;
prices?: Record<string, number>;
icmses?: Record<string, number>;
ipis?: Record<string, number>;

onQuantityChange?: (itemId: string, value: number) => void;
onPriceChange?: (itemId: string, value: number) => void;
onIcmsChange?: (itemId: string, value: number) => void;
onIpiChange?: (itemId: string, value: number) => void;
```

### Fixed Columns Configuration

```tsx
fixedColumnsConfig?: {
  fixedColumns: string[];           // Column keys that cannot be hidden
  fixedReasons?: Record<string, string>; // Tooltip text explaining why columns are fixed
}
```

**Note**: Editable columns (quantity, price inputs) are automatically fixed and cannot be hidden.

### Additional Filters

```tsx
additionalFilters?: Partial<ItemGetManyFormData>;
```

Use this to pre-filter items (e.g., only TOOL category for borrow form):

```tsx
additionalFilters={{
  where: {
    category: { type: 'TOOL' }
  }
}}
```

### URL State Management (Optional)

For forms that need URL state synchronization:

```tsx
page?: number;                    // Current page (1-based)
pageSize?: number;                // Items per page
showSelectedOnly?: boolean;       // Show selected only toggle state
searchTerm?: string;              // Current search term
filters?: Partial<ItemGetManyFormData>; // Current filters

onPageChange?: (page: number) => void;
onPageSizeChange?: (pageSize: number) => void;
onShowSelectedOnlyChange?: (value: boolean) => void;
onSearchTermChange?: (term: string) => void;
onFiltersChange?: (filters: Partial<ItemGetManyFormData>) => void;
```

## Available Filters

The item selector includes all filters from the main item list:

### Basic Filters
- Status (active/inactive/both)
- Assign to User (yes/no/both)

### Entity Filters
- Categories (multi-select with async loading)
- Brands (multi-select with async loading)
- Suppliers (multi-select with async loading)

### Stock Filters
- Stock Levels (critical, out of stock, low, normal, overstock, etc.)

### Range Filters
- Quantity Range (min/max)
- Price Range (min/max)
- ICMS Range (min/max %)
- IPI Range (min/max %)
- Monthly Consumption Range (min/max)

### Date Filters
- Created Date (from/to)
- Updated Date (from/to)

## Column Visibility

Users can show/hide columns via the "Colunas" button. Visibility preferences are saved to localStorage per `storageKey`.

**Fixed columns** (specified in `fixedColumnsConfig`) cannot be hidden and show a lock icon with tooltip explanation.

## Storage Keys Convention

Use descriptive, unique keys for each form:

- `"activity-item-selector"` - Activity form
- `"borrow-item-selector"` - Borrow form
- `"external-withdrawal-item-selector"` - External withdrawal form
- `"order-item-selector"` - Order form
- `"production-task-item-selector"` - Production task form (if needed)

## Advanced Usage

### Custom Filter Combination

```tsx
<ItemSelectorTable
  // ... other props
  additionalFilters={{
    where: {
      category: { type: 'TOOL' },
      isActive: true,
      brand: { name: { contains: 'Bosch' } },
    },
    stockLevels: ['NORMAL', 'OVERSTOCK'], // Only show items with good stock
  }}
/>
```

### Conditional Editable Columns

```tsx
const [withdrawalType, setWithdrawalType] = useState<'RETURNABLE' | 'CHARGEABLE'>('RETURNABLE');

<ItemSelectorTable
  // ... other props
  editableColumns={{
    showQuantityInput: true,
    showPriceInput: withdrawalType === 'CHARGEABLE', // Only for chargeable withdrawals
  }}
/>
```

## Styling

The component uses Tailwind CSS and is fully responsive. You can pass a `className` prop for additional styling:

```tsx
<ItemSelectorTable
  className="min-h-[600px]"
  // ... other props
/>
```

## Performance Notes

- Search is debounced (300ms) to reduce API calls
- Pagination is efficient with server-side filtering
- Column visibility changes don't trigger data refetch
- Async entity loading (categories, brands, suppliers) with pagination
