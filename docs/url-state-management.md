# Comprehensive URL State Management Architecture

## Overview

This document describes the comprehensive URL state management architecture for the Ankaa project, designed to handle complex table state including pagination, sorting, filtering, search, and selection with type safety, immediate UI updates, and race condition prevention.

## Architecture Components

### 1. URL State Coordinator (`use-url-state-coordinator.ts`)

The core coordinator that manages URL updates with debouncing, conflict resolution, and browser navigation handling.

#### Key Features:

- **Debounced Updates**: Different debounce intervals for different action types
- **Race Condition Prevention**: Prevents conflicts between rapid updates
- **Browser Navigation Support**: Handles back/forward navigation correctly
- **Conflict Resolution**: Resolves conflicting updates based on priority
- **Queue Management**: Batches updates for optimal performance

#### Usage:

```typescript
const { searchParams, queueUpdate, batchUpdates, getParamName, processQueue } = useUrlStateCoordinator({
  namespace: "items",
  debounceMs: {
    search: 300,
    filter: 100,
    pagination: 0,
    sorting: 0,
    selection: 50,
  },
  enableBrowserHistorySync: true,
  maxQueueSize: 50,
});
```

### 2. Unified Table State Hook (`use-unified-table-state.ts`)

High-level hook that combines all table functionality with URL persistence.

#### Features:

- **Complete Table State**: Pagination, sorting, filtering, search, selection
- **URL Persistence**: All state stored in URL for deep linking
- **Immediate UI Updates**: State updates immediately, URL updates are debounced
- **Keyboard Selection**: Ctrl+click, Shift+click support
- **Selection Modes**: Page-level, filtered, or all items
- **Type Safety**: Fully typed with generics

#### Example:

```typescript
const {
  // Pagination
  page,
  pageSize,
  setPage,
  setPageSize,

  // Sorting (multi-column support)
  sortConfigs,
  toggleSort,
  getSortDirection,
  getSortOrder,

  // Search & Filters
  searchingFor,
  displaySearchText,
  setSearch,
  filters,
  setFilters,
  clearAllFilters,

  // Selection with URL persistence
  selectedIds,
  selectionMode,
  selectionCount,
  toggleSelection,
  handleKeyboardSelection,
  selectAll,
  selectAllFiltered,
  selectAllAcrossPages,

  // Utilities
  processQueue,
} = useUnifiedTableState<ItemFilters>({
  namespace: "items",
  defaultPageSize: 40,
  defaultSort: [{ column: "name", direction: "asc" }],
  serializeToUrl: customSerializer,
  deserializeFromUrl: customDeserializer,
  searchDebounceMs: 300,
  automaticPageReset: true,
});
```

### 3. Type-Safe URL Parameters (`use-url-params.ts`)

Utility for type-safe URL parameter handling with schema validation.

#### Built-in Configurations:

```typescript
// Basic types
const stringParam = urlParamConfigs.string("default");
const numberParam = urlParamConfigs.number(0);
const booleanParam = urlParamConfigs.boolean(false);

// Arrays
const stringArrayParam = urlParamConfigs.stringArray([]);
const numberArrayParam = urlParamConfigs.numberArray([]);

// Date types
const dateParam = urlParamConfigs.date();
const dateRangeParam = urlParamConfigs.dateRange({});

// Ranges
const numberRangeParam = urlParamConfigs.numberRange({});

// Enums
const statusParam = urlParamConfigs.enum(Object.values(STATUS), STATUS.ACTIVE);

// Custom objects
const customParam = urlParamConfigs.object(schema, defaultValue);
```

#### Creating Type-Safe Configurations:

```typescript
const itemFilterConfigs = createUrlParamConfig<ItemFilters>({
  isActive: urlParamConfigs.boolean(true),
  status: urlParamConfigs.enum(Object.values(ITEM_STATUS), ""),
  stockLevels: urlParamConfigs.stringArray([]),
  categoryIds: urlParamConfigs.stringArray([]),
  priceRange: urlParamConfigs.numberRange({}),
  createdAt: urlParamConfigs.dateRange({}),
});
```

### 4. Enhanced Filter Utils (`table-filter-utils.ts`)

Comprehensive filtering system with type-safe builders and validation.

#### Filter Builders:

```typescript
// String filters
StringFilterBuilder.contains("name", "search term");
StringFilterBuilder.startsWith("code", "ABC");
StringFilterBuilder.in("category", ["A", "B", "C"]);

// Number filters
NumberFilterBuilder.between("price", 10, 100);
NumberFilterBuilder.greaterThan("quantity", 0);

// Date filters
DateFilterBuilder.between("createdAt", startDate, endDate);
DateFilterBuilder.thisMonth("updatedAt");
DateFilterBuilder.today("lastAccessed");

// Boolean filters
BooleanFilterBuilder.isTrue("isActive");
BooleanFilterBuilder.isFalse("isDeleted");
```

#### Filter Definitions:

```typescript
interface FilterDefinition {
  id: string;
  name: string;
  description?: string;
  groups: FilterGroup[];
  isPreset?: boolean;
  createdBy?: string;
  createdAt?: Date;
}

interface FilterGroup {
  conditions: FilterCondition[];
  operator: "AND" | "OR";
  groups?: FilterGroup[];
}
```

## Implementation Examples

### Basic Table with URL State

```typescript
function ItemTable() {
  const {
    page, pageSize, setPage, setPageSize,
    sortConfigs, toggleSort,
    searchingFor, setSearch,
    selectedIds, toggleSelection,
  } = useUnifiedTableState({
    namespace: "items",
    defaultPageSize: 20,
  });

  return (
    <div>
      <input
        value={searchingFor}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search..."
      />

      <table>
        <thead>
          <tr>
            <th onClick={() => toggleSort("name")}>
              Name {getSortDirection("name") === "asc" ? "↑" : "↓"}
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map(item => (
            <tr
              key={item.id}
              className={selectedIds.includes(item.id) ? "selected" : ""}
              onClick={() => toggleSelection(item.id)}
            >
              <td>{item.name}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div>
        Page {page + 1} of {totalPages}
        <button onClick={() => setPage(page - 1)}>Previous</button>
        <button onClick={() => setPage(page + 1)}>Next</button>
      </div>
    </div>
  );
}
```

### Advanced Filtering with Type Safety

```typescript
interface ProductFilters {
  category: string;
  priceRange: { min?: number; max?: number };
  inStock: boolean;
  tags: string[];
  dateRange: { gte?: Date; lte?: Date };
}

const filterConfigs = createUrlParamConfig<ProductFilters>({
  category: urlParamConfigs.enum(CATEGORIES, ""),
  priceRange: urlParamConfigs.numberRange({}),
  inStock: urlParamConfigs.boolean(false),
  tags: urlParamConfigs.stringArray([]),
  dateRange: urlParamConfigs.dateRange({}),
});

function ProductTable() {
  const {
    filters,
    setFilters,
    clearAllFilters,
  } = useUnifiedTableState<ProductFilters>({
    namespace: "products",
    serializeToUrl: (filters) => {
      const { values, serialize } = useUrlParams(filterConfigs, new URLSearchParams());
      return serialize(filters);
    },
    deserializeFromUrl: (params) => {
      const { values } = useUrlParams(filterConfigs, params);
      return values;
    },
  });

  return (
    <div>
      <select
        value={filters.category}
        onChange={(e) => setFilters({ ...filters, category: e.target.value })}
      >
        <option value="">All Categories</option>
        {CATEGORIES.map(cat => (
          <option key={cat} value={cat}>{cat}</option>
        ))}
      </select>

      <input
        type="number"
        placeholder="Min Price"
        value={filters.priceRange?.min || ""}
        onChange={(e) => setFilters({
          ...filters,
          priceRange: {
            ...filters.priceRange,
            min: e.target.value ? Number(e.target.value) : undefined
          }
        })}
      />

      <button onClick={clearAllFilters}>Clear Filters</button>
    </div>
  );
}
```

### Keyboard Selection Support

```typescript
function ItemRow({ item, allPageIds, onSelect }) {
  const { handleKeyboardSelection } = useUnifiedTableState();

  return (
    <tr
      onClick={(e) => handleKeyboardSelection(item.id, allPageIds, e)}
      className={isSelected(item.id) ? "selected" : ""}
    >
      <td>{item.name}</td>
    </tr>
  );
}
```

## URL Structure

The URL contains all table state in a clean, readable format:

```
/items/list?
  items_page=2&
  items_pageSize=50&
  items_sort=[{"column":"name","direction":"asc"},{"column":"price","direction":"desc"}]&
  items_search=laptop&
  items_selected=["id1","id2","id3"]&
  items_showSelectedOnly=true&
  items_selectionMode=filtered&
  category=electronics&
  priceMin=100&
  priceMax=500&
  inStock=true&
  createdAfter=2024-01-01T00:00:00.000Z
```

### URL Parameter Naming

- **Namespaced**: All table-specific params use namespace prefix (e.g., `items_page`)
- **Clean Names**: Filter params use clean names (e.g., `category`, `priceMin`)
- **Type-Aware**: Values are properly serialized based on type
- **Default Exclusion**: Default values are excluded to keep URLs clean

## Performance Optimizations

### 1. Debounced Updates

- Search: 300ms debounce
- Filters: 100ms debounce
- Pagination/Sorting: Immediate
- Selection: 50ms batch debounce

### 2. Race Condition Prevention

- Navigation detection prevents conflicts
- Update queue with priority system
- Conflict resolution based on action types

### 3. Memory Management

- Queue size limits prevent memory leaks
- Automatic cleanup on unmount
- Efficient state updates with minimal re-renders

### 4. Browser Optimization

- `replace: true` for most updates to avoid history pollution
- Proper popstate handling for back/forward navigation
- URL change detection for external modifications

## Advanced Features

### 1. Selection Modes

```typescript
// Page-level selection (default)
setSelectionMode("page");

// Select all filtered items
setSelectionMode("filtered");
selectAllFiltered(filteredIds);

// Select across all pages
setSelectionMode("all");
selectAllAcrossPages(totalCount, getAllIds);
```

### 2. Multi-Column Sorting

```typescript
// First click: Add ascending sort
toggleSort("name"); // [{column: 'name', direction: 'asc'}]

// Second click: Change to descending
toggleSort("name"); // [{column: 'name', direction: 'desc'}]

// Third click: Remove sort
toggleSort("name"); // []

// Multiple columns maintain order
toggleSort("name"); // Primary sort
toggleSort("price"); // Secondary sort
// [{column: 'name', direction: 'asc'}, {column: 'price', direction: 'asc'}]
```

### 3. Filter Presets

```typescript
const preset = createFilterPreset("High Value Items", [createFilterGroup([NumberFilterBuilder.greaterThan("price", 1000), BooleanFilterBuilder.isTrue("inStock")], "AND")], {
  description: "Items over $1000 that are in stock",
});

await filterPresetStorage.savePreset(preset);
```

### 4. Deep Linking

All state is preserved in URLs, enabling:

- **Bookmarkable Searches**: Save and share filtered views
- **Browser Navigation**: Back/forward works correctly
- **State Restoration**: Reload page maintains all state
- **Cross-Tab Sync**: Multiple tabs stay synchronized

## Testing

The architecture includes comprehensive testing utilities:

```typescript
// Test URL state changes
const { result } = renderHook(() => useUnifiedTableState());

act(() => {
  result.current.setPage(2);
  result.current.setSearch("test");
  result.current.toggleSort("name");
});

expect(window.location.search).toContain("page=3");
expect(window.location.search).toContain("search=test");
expect(window.location.search).toContain("sort=");
```

## Migration Guide

### From Existing Table State

1. **Replace existing hooks**:

   ```typescript
   // Before
   const [page, setPage] = useState(0);
   const [filters, setFilters] = useState({});

   // After
   const { page, setPage, filters, setFilters } = useUnifiedTableState();
   ```

2. **Update filter handling**:

   ```typescript
   // Before
   const handleFilterChange = (key, value) => {
     setFilters((prev) => ({ ...prev, [key]: value }));
   };

   // After
   const handleFilterChange = (newFilters) => {
     setFilters(newFilters);
   };
   ```

3. **Add URL serialization**:

   ```typescript
   const configs = createUrlParamConfig<YourFilters>({
     // Define your filter configurations
   });

   const { tableState } = useUnifiedTableState({
     serializeToUrl: (filters) => serialize(filters),
     deserializeFromUrl: (params) => deserialize(params),
   });
   ```

## Best Practices

### 1. Namespace Usage

- Always use namespaces for multi-table pages
- Use entity names (e.g., "items", "orders", "users")
- Keep namespaces short but descriptive

### 2. Filter Design

- Group related filters logically
- Use appropriate data types for each filter
- Provide clear labels and validation
- Consider default values carefully

### 3. Performance

- Use debouncing for search inputs
- Implement server-side filtering for large datasets
- Consider virtual scrolling for large lists
- Cache filter options when possible

### 4. User Experience

- Provide clear filter indicators
- Allow easy filter clearing
- Show loading states during updates
- Maintain selection across filter changes when appropriate

### 5. Type Safety

- Define strong types for filter structures
- Use Zod schemas for validation
- Leverage TypeScript's type inference
- Test type safety with different data shapes

## Troubleshooting

### Common Issues

1. **URL not updating**: Check namespace configuration and debounce settings
2. **State conflicts**: Verify no duplicate state management
3. **Performance issues**: Review debounce timing and update frequency
4. **Type errors**: Ensure filter configurations match interface definitions
5. **Browser navigation**: Check popstate handling and navigation detection

### Debug Tools

The architecture includes built-in debugging:

```typescript
// Enable debug mode
const { processQueue } = useUnifiedTableState({
  debug: true, // Logs all state changes
});

// Manual queue processing
processQueue(); // Force immediate URL update

// Inspect current state
console.log({
  searchParams: searchParams.toString(),
  queueLength: updateQueueRef.current.length,
  isNavigating: isNavigatingRef.current,
});
```

## Conclusion

This comprehensive URL state management architecture provides a robust, type-safe, and performant solution for complex table state management. It ensures immediate UI updates, prevents race conditions, supports deep linking, and maintains excellent user experience across all table operations.

The architecture is designed to be:

- **Scalable**: Handles complex filtering and large datasets
- **Maintainable**: Clear separation of concerns and comprehensive typing
- **User-Friendly**: Immediate feedback and smooth interactions
- **Developer-Friendly**: Excellent TypeScript support and debugging tools
- **Future-Proof**: Extensible design for additional features
