# Comprehensive Filtering and Grouping System

A powerful, user-friendly filtering and grouping system built with React and Radix UI components.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Components](#components)
- [Hooks](#hooks)
- [Presets](#presets)
- [Usage Examples](#usage-examples)
- [Features](#features)

## Overview

This system provides a complete solution for filtering and grouping data in your application with:

- **Type-safe filter builders**
- **Advanced query construction**
- **Drag-and-drop grouping**
- **Aggregation support**
- **Preset management**
- **URL synchronization**
- **Real-time validation**
- **Responsive design**

## Architecture

```
/src
├── components/
│   ├── filters/
│   │   ├── DateRangeFilter.tsx          # Date range selection with presets
│   │   ├── StatusFilter.tsx             # Multi-select status filter
│   │   ├── NumericRangeFilter.tsx       # Min/max numeric filtering
│   │   ├── SearchFilter.tsx             # Debounced text search
│   │   ├── BooleanFilter.tsx            # Toggle filters
│   │   ├── EnumFilter.tsx               # Enum/select filters
│   │   ├── CategoryFilter.tsx           # Hierarchical category selection
│   │   ├── UserFilter.tsx               # User selector with search
│   │   ├── FilterPanel.tsx              # Main filter container
│   │   ├── advanced/
│   │   │   ├── AdvancedFilterBuilder.tsx  # Visual query builder
│   │   │   └── FilterCondition.tsx        # Single filter condition
│   │   └── ui/
│   │       ├── FilterBadge.tsx          # Filter display badge
│   │       ├── FilterChip.tsx           # Removable filter chip
│   │       ├── FilterSummary.tsx        # Active filters summary
│   │       ├── FilterDialog.tsx         # Filter modal
│   │       └── FilterDrawer.tsx         # Filter side drawer
│   └── grouping/
│       ├── GroupBySelector.tsx          # Drag-drop grouping
│       ├── AggregationSelector.tsx      # Aggregation functions
│       └── GroupingPreview.tsx          # Group structure preview
├── hooks/
│   └── filters/
│       ├── useFilterState.ts            # Filter state management
│       ├── useGroupByState.ts           # Grouping state management
│       └── useFilterPresets.ts          # Preset management
├── lib/
│   └── filters/
│       ├── filter-presets.ts            # Predefined filters
│       └── grouping-presets.ts          # Predefined groupings
└── utils/
    └── table-filter-utils.ts            # Core filter utilities
```

## Components

### Basic Filters

#### DateRangeFilter

Date range selection with predefined presets.

```tsx
import { DateRangeFilter } from "@/components/common/filters";

function MyComponent() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>();

  return (
    <DateRangeFilter
      value={dateRange}
      onChange={setDateRange}
      placeholder="Selecione período"
    />
  );
}
```

**Props:**
- `value`: Current date range
- `onChange`: Callback when range changes
- `placeholder`: Placeholder text
- `presets`: Custom preset configurations

#### StatusFilter

Multi-select status filter with checkboxes.

```tsx
import { StatusFilter } from "@/components/common/filters";

const statusOptions = [
  { value: "ACTIVE", label: "Ativo", color: "#10b981" },
  { value: "INACTIVE", label: "Inativo", color: "#ef4444" },
];

function MyComponent() {
  const [statuses, setStatuses] = useState<string[]>([]);

  return (
    <StatusFilter
      value={statuses}
      onChange={setStatuses}
      options={statusOptions}
    />
  );
}
```

#### NumericRangeFilter

Min/max numeric filtering with optional currency/percentage formatting.

```tsx
import { NumericRangeFilter } from "@/components/common/filters";

function MyComponent() {
  const [priceRange, setPriceRange] = useState<NumericRange>();

  return (
    <NumericRangeFilter
      value={priceRange}
      onChange={setPriceRange}
      prefix="R$ "
      minPlaceholder="Preço mínimo"
      maxPlaceholder="Preço máximo"
    />
  );
}
```

#### SearchFilter

Debounced text search with clear button.

```tsx
import { SearchFilter } from "@/components/common/filters";

function MyComponent() {
  const [search, setSearch] = useState("");

  return (
    <SearchFilter
      value={search}
      onChange={setSearch}
      debounceMs={300}
      placeholder="Buscar..."
    />
  );
}
```

### Filter Panel

Main container for organizing multiple filters in collapsible sections.

```tsx
import { FilterPanel, DateRangeFilter, StatusFilter } from "@/components/common/filters";

function MyComponent() {
  const sections = [
    {
      id: "time",
      title: "Período",
      content: <DateRangeFilter value={dateRange} onChange={setDateRange} />,
      badge: dateRange ? 1 : 0,
    },
    {
      id: "status",
      title: "Status",
      content: <StatusFilter value={statuses} onChange={setStatuses} options={statusOptions} />,
      badge: statuses.length,
    },
  ];

  return (
    <FilterPanel
      sections={sections}
      activeFiltersCount={activeCount}
      onApply={handleApply}
      onReset={handleReset}
    />
  );
}
```

### Advanced Filter Builder

Visual query builder with AND/OR logic and nested conditions.

```tsx
import { AdvancedFilterBuilder } from "@/components/common/filters/advanced";

const fields = {
  name: {
    key: "name",
    label: "Nome",
    dataType: "string" as const,
    operators: ["contains", "equals", "startsWith"] as const,
  },
  price: {
    key: "price",
    label: "Preço",
    dataType: "number" as const,
    operators: ["equals", "greaterThan", "lessThan", "between"] as const,
  },
};

function MyComponent() {
  const [definition, setDefinition] = useState<FilterDefinition>(defaultDefinition);

  return (
    <AdvancedFilterBuilder
      definition={definition}
      fields={fields}
      onChange={setDefinition}
      onApply={handleApply}
    />
  );
}
```

### Grouping Components

#### GroupBySelector

Drag-and-drop interface for configuring data grouping hierarchy.

```tsx
import { GroupBySelector } from "@/components/common/filters/grouping";

const availableFields = [
  { field: "status", label: "Status", dataType: "string" },
  { field: "category", label: "Categoria", dataType: "string" },
  { field: "sector", label: "Setor", dataType: "string" },
];

function MyComponent() {
  const [groups, setGroups] = useState<GroupByField[]>([]);

  return (
    <GroupBySelector
      value={groups}
      onChange={setGroups}
      availableFields={availableFields}
      maxGroups={3}
    />
  );
}
```

#### AggregationSelector

Configure aggregation functions (sum, avg, count, etc.) for grouped data.

```tsx
import { AggregationSelector } from "@/components/common/filters/grouping";

const availableFields = [
  { field: "totalValue", label: "Valor Total", dataType: "number" },
  { field: "quantity", label: "Quantidade", dataType: "number" },
];

function MyComponent() {
  const [aggregations, setAggregations] = useState<Aggregation[]>([]);

  return (
    <AggregationSelector
      value={aggregations}
      onChange={setAggregations}
      availableFields={availableFields}
    />
  );
}
```

### UI Components

#### FilterSummary

Display active filters as removable chips.

```tsx
import { FilterSummary } from "@/components/common/filters/ui";

const filters = [
  { id: "status", label: "Status", value: "Ativo", onRemove: () => clearStatus() },
  { id: "date", label: "Data", value: "Últimos 7 dias", onRemove: () => clearDate() },
];

function MyComponent() {
  return (
    <FilterSummary
      filters={filters}
      onClearAll={clearAllFilters}
      maxVisible={5}
    />
  );
}
```

## Hooks

### useFilterState

Manage filter definition state with URL synchronization.

```tsx
import { useFilterState } from "@/hooks/filters";

function MyComponent() {
  const {
    definition,
    setDefinition,
    clearFilters,
    hasActiveFilters,
    applyFilters,
    resetFilters,
  } = useFilterState({
    defaultDefinition,
    syncWithUrl: true,
    onChange: (def) => console.log("Filters changed:", def),
  });

  return (
    <div>
      <AdvancedFilterBuilder
        definition={definition}
        onChange={setDefinition}
        fields={fields}
      />
      <button onClick={applyFilters}>Aplicar</button>
      <button onClick={clearFilters}>Limpar</button>
    </div>
  );
}
```

### useGroupByState

Manage grouping and aggregation state.

```tsx
import { useGroupByState } from "@/hooks/filters";

function MyComponent() {
  const {
    groups,
    aggregations,
    setGroups,
    setAggregations,
    addGroup,
    removeGroup,
    clearGrouping,
    hasActiveGrouping,
  } = useGroupByState({
    onChange: (state) => console.log("Grouping changed:", state),
  });

  return (
    <GroupBySelector
      value={groups}
      onChange={setGroups}
      availableFields={availableFields}
    />
  );
}
```

### useFilterPresets

Load and save filter presets.

```tsx
import { useFilterPresets } from "@/hooks/filters";

function MyComponent() {
  const {
    presets,
    loadPreset,
    savePreset,
    deletePreset,
    selectedPresetId,
    selectPreset,
  } = useFilterPresets({
    userId: currentUser.id,
    autoLoad: true,
  });

  const handleSavePreset = async () => {
    await savePreset({
      id: `preset-${Date.now()}`,
      name: "Meu Filtro",
      groups: currentDefinition.groups,
    });
  };

  return (
    <div>
      {presets.map((preset) => (
        <button key={preset.id} onClick={() => loadPreset(preset.id)}>
          {preset.name}
        </button>
      ))}
      <button onClick={handleSavePreset}>Salvar Preset</button>
    </div>
  );
}
```

## Presets

### Filter Presets

Predefined filter configurations for common use cases.

```tsx
import { FILTER_PRESETS, getPreset } from "@/lib/filters";

// Time-based presets
const last7Days = getPreset("last-7-days");
const thisMonth = getPreset("this-month");
const thisYear = getPreset("this-year");

// Entity-specific presets
const activeItems = getPreset("active-items");
const pendingOrders = getPreset("pending-orders");
const overdueTasks = getPreset("overdue-tasks");

// Inventory presets
const criticalStock = getPreset("critical-stock");
const noStock = getPreset("no-stock");
```

### Grouping Presets

Predefined grouping configurations.

```tsx
import { GROUPING_PRESETS, getGroupingPreset } from "@/lib/filters";

const byStatus = getGroupingPreset("by-status");
const bySector = getGroupingPreset("by-sector");
const byMonth = getGroupingPreset("by-month");
const byCategoryAndStatus = getGroupingPreset("by-category-and-status");
```

## Usage Examples

### Complete Filter Panel Example

```tsx
import { useState } from "react";
import {
  FilterPanel,
  DateRangeFilter,
  StatusFilter,
  NumericRangeFilter,
  SearchFilter,
  CategoryFilter,
  UserFilter,
} from "@/components/common/filters";

function InventoryFilters() {
  const [dateRange, setDateRange] = useState<DateRange>();
  const [statuses, setStatuses] = useState<string[]>([]);
  const [priceRange, setPriceRange] = useState<NumericRange>();
  const [search, setSearch] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [users, setUsers] = useState<string[]>([]);

  const sections = [
    {
      id: "search",
      title: "Busca",
      content: <SearchFilter value={search} onChange={setSearch} />,
      defaultOpen: true,
    },
    {
      id: "time",
      title: "Período",
      content: <DateRangeFilter value={dateRange} onChange={setDateRange} />,
      badge: dateRange ? 1 : 0,
    },
    {
      id: "status",
      title: "Status",
      content: <StatusFilter value={statuses} onChange={setStatuses} options={statusOptions} />,
      badge: statuses.length,
    },
    {
      id: "price",
      title: "Preço",
      content: <NumericRangeFilter value={priceRange} onChange={setPriceRange} prefix="R$ " />,
      badge: priceRange ? 1 : 0,
    },
    {
      id: "category",
      title: "Categorias",
      content: <CategoryFilter value={categories} onChange={setCategories} categories={categoryTree} />,
      badge: categories.length,
    },
    {
      id: "user",
      title: "Responsável",
      content: <UserFilter value={users} onChange={setUsers} users={userList} />,
      badge: users.length,
    },
  ];

  const activeCount = [dateRange, statuses.length, priceRange, categories.length, users.length].filter(Boolean).length;

  return (
    <FilterPanel
      sections={sections}
      activeFiltersCount={activeCount}
      onApply={handleApplyFilters}
      onReset={handleResetFilters}
      onSavePreset={handleSavePreset}
    />
  );
}
```

### Advanced Filters with Grouping

```tsx
import { useState } from "react";
import { AdvancedFilterBuilder } from "@/components/common/filters/advanced";
import { GroupBySelector, AggregationSelector } from "@/components/common/filters/grouping";
import { useFilterState, useGroupByState } from "@/hooks/filters";

function DataAnalysisPage() {
  const { definition, setDefinition, applyFilters } = useFilterState({
    syncWithUrl: true,
  });

  const { groups, aggregations, setGroups, setAggregations, applyGrouping } = useGroupByState();

  return (
    <div className="space-y-6">
      <AdvancedFilterBuilder
        definition={definition}
        fields={filterFields}
        onChange={setDefinition}
        onApply={applyFilters}
      />

      <GroupBySelector
        value={groups}
        onChange={setGroups}
        availableFields={groupingFields}
      />

      <AggregationSelector
        value={aggregations}
        onChange={setAggregations}
        availableFields={aggregationFields}
      />

      <button onClick={applyGrouping}>Aplicar Agrupamento</button>
    </div>
  );
}
```

## Features

### Type Safety

All filter components are fully type-safe with TypeScript:

```tsx
import { FilterDefinition, FilterFieldDefinition } from "@/utils/table-filter-utils";

// Type-safe field definitions
const fields: Record<string, FilterFieldDefinition> = {
  name: {
    key: "name",
    label: "Nome",
    dataType: "string",
    operators: ["contains", "equals"],
  },
};
```

### URL Synchronization

Filters automatically sync with URL parameters:

```tsx
const { definition } = useFilterState({
  syncWithUrl: true,
  urlParamName: "filters",
});
```

### Real-time Validation

Filters validate in real-time:

```tsx
<AdvancedFilterBuilder
  enableValidation={true}
  validationMessages={{
    required: "Campo obrigatório",
    min: "Valor muito pequeno",
  }}
/>
```

### Responsive Design

All components are mobile-friendly:

```tsx
// Use FilterDrawer on mobile, FilterDialog on desktop
const isMobile = useMediaQuery("(max-width: 768px)");

{isMobile ? (
  <FilterDrawer open={open} onOpenChange={setOpen}>
    {filterContent}
  </FilterDrawer>
) : (
  <FilterDialog open={open} onOpenChange={setOpen}>
    {filterContent}
  </FilterDialog>
)}
```

### Keyboard Shortcuts

Filters support keyboard navigation and shortcuts for accessibility.

### Performance

- Debounced search inputs
- Optimized re-renders
- Virtual scrolling for large lists
- Lazy loading of filter options

## Best Practices

1. **Use FilterPanel** for organizing multiple filters
2. **Enable URL sync** for shareable filter states
3. **Provide presets** for common filter combinations
4. **Use FilterSummary** to show active filters
5. **Implement validation** for required fields
6. **Add loading states** when fetching filter options
7. **Support keyboard navigation** for accessibility
8. **Test on mobile** devices for responsive design

## Integration with API

```tsx
import { convertFilterDefinitionToQuery } from "@/utils/table-filter-utils";

function MyComponent() {
  const { definition } = useFilterState();

  const fetchData = async () => {
    const queryParams = convertFilterDefinitionToQuery(definition);
    const response = await api.get("/items", { params: queryParams });
    return response.data;
  };

  const { data } = useQuery(["items", definition], fetchData);
}
```

## License

Part of the Ankaa Web application.
