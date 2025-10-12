# Configurable Chart System

A comprehensive, flexible chart system for React applications built with TypeScript, Recharts, and ECharts.

## Features

- **Multiple Chart Types**: Line, Bar, Pie, Area, Heatmap, Funnel, and Combo charts
- **Dynamic Configuration**: JSON-based configuration for easy chart creation and modification
- **Data Transformers**: Built-in transformers for time-series, categorical, comparison, aggregation, and pivot data
- **Interactive Features**: Zoom, pan, brush selection, drill-down capabilities
- **Export Functionality**: Export charts as PNG, SVG, PDF, or data as CSV/Excel
- **Filters**: Dynamic filtering system with multiple operators
- **Real-time Updates**: Support for auto-refresh intervals
- **Responsive Design**: Mobile-friendly and adaptable layouts
- **Accessibility**: ARIA labels and keyboard navigation support
- **Type Safety**: Full TypeScript support with comprehensive type definitions

## Architecture

```
/lib/charts/
├── chart-config.ts          # Core configuration types and builders
├── chart-registry.ts         # Pre-configured chart definitions
├── transformers/
│   ├── time-series-transformer.ts    # Time-series data transformation
│   ├── category-transformer.ts       # Categorical data transformation
│   ├── comparison-transformer.ts     # Comparison and YoY analysis
│   ├── aggregation-transformer.ts    # Aggregation and grouping
│   └── pivot-transformer.ts          # Pivot tables and heatmaps
└── index.ts                  # Main export file

/components/charts/
├── ConfigurableChart.tsx     # Main chart component
├── ChartContainer.tsx        # Wrapper with controls
├── ChartFilters.tsx          # Filter UI
├── ChartLegend.tsx           # Legend component
├── ChartTooltip.tsx          # Tooltip component
├── LineChart.tsx             # Line chart implementation
├── BarChart.tsx              # Bar chart implementation
├── PieChart.tsx              # Pie chart implementation
├── AreaChart.tsx             # Area chart implementation
├── HeatmapChart.tsx          # Heatmap implementation (ECharts)
├── FunnelChart.tsx           # Funnel chart (ECharts)
├── ComboChart.tsx            # Combination chart
├── config/
│   ├── ChartConfigPanel.tsx      # Main config UI
│   ├── ChartTypeSelector.tsx     # Chart type selector
│   ├── DatasetSelector.tsx       # Data source config
│   ├── AxisConfigurator.tsx      # Axis configuration
│   ├── SeriesConfigurator.tsx    # Series configuration
│   ├── ColorPicker.tsx           # Color picker
│   └── FilterBuilder.tsx         # Filter builder
└── index.ts                  # Component exports
```

## Quick Start

### 1. Using a Pre-configured Chart

```typescript
import { ConfigurableChart } from '@/components/charts';
import { CHART_REGISTRY } from '@/lib/charts/chart-registry';

function InventoryDashboard() {
  const config = CHART_REGISTRY['inventory-stock-levels'];

  return <ConfigurableChart config={config} />;
}
```

### 2. Creating a Custom Chart

```typescript
import { ConfigurableChart } from '@/components/charts';
import { createChartConfig, createSeriesConfig, createAxisConfig } from '@/lib/charts';

function CustomChart() {
  const config = createChartConfig({
    id: 'custom-sales-chart',
    type: 'line',
    title: 'Sales Trends',
    description: 'Monthly sales data',
    dataSource: {
      type: 'api',
      endpoint: '/api/sales/monthly',
    },
    xAxis: createAxisConfig({
      dataKey: 'month',
      type: 'time',
      label: 'Month',
    }),
    yAxis: createAxisConfig({
      type: 'number',
      label: 'Sales',
      unit: '$',
    }),
    series: [
      createSeriesConfig({
        name: 'Revenue',
        dataKey: 'revenue',
        color: '#10b981',
      }),
    ],
  });

  return <ConfigurableChart config={config} />;
}
```

### 3. Using with Static Data

```typescript
const data = [
  { month: '2024-01', sales: 15000 },
  { month: '2024-02', sales: 18000 },
  { month: '2024-03', sales: 22000 },
];

<ConfigurableChart config={config} data={data} />
```

## Configuration Options

### Chart Configuration

```typescript
interface ChartConfiguration {
  id: string;                    // Unique identifier
  type: ChartType;               // Chart type
  title: string;                 // Chart title
  description?: string;          // Description
  category?: string;             // Category for grouping

  // Data
  dataSource: DataSourceConfig;  // Data source configuration

  // Axes
  xAxis?: AxisConfig;
  yAxis?: AxisConfig;
  secondaryYAxis?: AxisConfig;   // For combo charts

  // Series
  series: SeriesConfig[];        // Data series

  // Visual
  style?: StyleConfig;
  legend?: LegendConfig;
  tooltip?: TooltipConfig;

  // Features
  filters?: FilterConfig[];
  refreshInterval?: number;
  export?: ExportConfig;
  interaction?: InteractionConfig;
}
```

### Data Transformers

#### Time Series Transformer

```typescript
import { TimeSeriesTransformer } from '@/lib/charts/transformers';

const transformed = TimeSeriesTransformer.transform(data, {
  dateKey: 'date',
  valueKeys: ['sales', 'profit'],
  dateFormat: 'iso',
  groupBy: 'month',
  fillMissingDates: true,
  fillValue: 'interpolate',
});

// Calculate moving average
const withMA = TimeSeriesTransformer.calculateMovingAverage(
  transformed,
  'sales',
  7  // 7-day window
);
```

#### Category Transformer

```typescript
import { CategoryTransformer } from '@/lib/charts/transformers';

const categorized = CategoryTransformer.transform(data, {
  categoryKey: 'product',
  valueKeys: ['quantity'],
  aggregation: 'sum',
  sortBy: 'quantity',
  sortOrder: 'desc',
  limit: 10,
  groupOthers: true,
});

// Convert to pie format
const pieData = CategoryTransformer.toPieFormat(
  categorized,
  'product',
  'quantity'
);
```

#### Comparison Transformer

```typescript
import { ComparisonTransformer } from '@/lib/charts/transformers';

// Year-over-year comparison
const yoy = ComparisonTransformer.yearOverYear(
  data,
  'date',
  ['revenue'],
  2024,
  2023
);

// Period-over-period
const pop = ComparisonTransformer.periodOverPeriod(
  currentData,
  previousData,
  {
    currentPeriodKey: 'current',
    previousPeriodKey: 'previous',
    dateKey: 'date',
    valueKeys: ['sales'],
  }
);
```

#### Aggregation Transformer

```typescript
import { AggregationTransformer } from '@/lib/charts/transformers';

const aggregated = AggregationTransformer.aggregate(data, {
  groupBy: ['region', 'product'],
  aggregations: [
    { field: 'sales', operation: 'sum', alias: 'totalSales' },
    { field: 'quantity', operation: 'avg', alias: 'avgQuantity' },
  ],
  having: {
    field: 'totalSales',
    operator: 'gte',
    value: 10000,
  },
});
```

#### Pivot Transformer

```typescript
import { PivotTransformer } from '@/lib/charts/transformers';

const pivoted = PivotTransformer.pivot(data, {
  rowKey: 'product',
  columnKey: 'month',
  valueKey: 'sales',
  aggregation: 'sum',
});

// Correlation matrix
const correlation = PivotTransformer.correlationMatrix(
  data,
  ['sales', 'marketing', 'satisfaction']
);

// Heatmap format
const heatmap = PivotTransformer.toHeatmap(data, {
  xKey: 'hour',
  yKey: 'day',
  valueKey: 'traffic',
  normalize: true,
  normalizeBy: 'row',
});
```

## Chart Registry

Access pre-configured charts from the registry:

```typescript
import { CHART_REGISTRY, getChartConfig, getChartsByCategory } from '@/lib/charts';

// Get specific chart
const chart = getChartConfig('inventory-stock-levels');

// Get all charts in category
const inventoryCharts = getChartsByCategory('inventory');

// Available categories:
// - inventory
// - production
// - orders
// - hr
// - financial
```

### Available Charts

**Inventory:**
- `inventory-stock-levels` - Current stock levels by item
- `inventory-abc-analysis` - ABC classification
- `inventory-consumption-trends` - Consumption over time
- `inventory-turnover-rate` - Turnover by category
- `inventory-value-by-location` - Value by storage location

**Production:**
- `production-task-status` - Task status distribution
- `production-completion-rate` - Daily completion rate
- `production-cycle-time` - Average cycle time by stage
- `production-output-trends` - Output and efficiency
- `production-defect-rate` - Quality tracking

**Orders:**
- `orders-fulfillment-rate` - Fulfillment percentage
- `orders-supplier-comparison` - Supplier performance
- `orders-status-funnel` - Order progression
- `orders-value-trends` - Order value over time

**HR:**
- `hr-performance-distribution` - Performance ratings
- `hr-bonus-trends` - Bonus distribution
- `hr-attendance-heatmap` - Attendance patterns
- `hr-department-headcount` - Headcount by department
- `hr-turnover-rate` - Turnover tracking

**Financial:**
- `financial-revenue-trends` - Revenue over time
- `financial-cost-breakdown` - Cost categories
- `financial-profit-margin` - Profit margin analysis
- `financial-cash-flow` - Cash inflow/outflow

## Chart Configuration UI

Build charts visually using the configuration panel:

```typescript
import { ChartConfigPanel } from '@/components/charts/config';
import { useState } from 'react';
import { createChartConfig } from '@/lib/charts';

function ChartBuilder() {
  const [config, setConfig] = useState(
    createChartConfig({
      id: 'new-chart',
      type: 'line',
      title: 'New Chart',
      dataSource: { type: 'api' },
    })
  );

  const handleSave = (newConfig) => {
    // Save to database or state management
    console.log('Saving chart:', newConfig);
  };

  return (
    <ChartConfigPanel
      config={config}
      onChange={setConfig}
      onSave={handleSave}
    />
  );
}
```

## Export Functionality

```typescript
// Enable export in configuration
const config = createChartConfig({
  // ... other config
  export: {
    enabled: true,
    formats: ['png', 'csv', 'excel'],
    filename: 'my-chart',
  },
});

// Or programmatically
<ConfigurableChart
  config={config}
  onExport={(format) => {
    console.log('Exporting as', format);
  }}
/>
```

## Filters

```typescript
import { createFilterConfig } from '@/lib/charts';

const config = createChartConfig({
  // ... other config
  filters: [
    createFilterConfig('status', 'equals', 'active', {
      label: 'Status',
      type: 'select',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Inactive', value: 'inactive' },
      ],
    }),
    createFilterConfig('date', 'between', ['2024-01-01', '2024-12-31'], {
      label: 'Date Range',
      type: 'date',
    }),
  ],
});
```

## Real-time Updates

```typescript
const config = createChartConfig({
  // ... other config
  refreshInterval: 30000, // Refresh every 30 seconds
});
```

## Best Practices

1. **Use Transformers**: Always use data transformers instead of manual data manipulation
2. **Chart Registry**: Add reusable charts to the registry for consistency
3. **Type Safety**: Leverage TypeScript types for better IDE support
4. **Performance**: Use aggregation transformers for large datasets
5. **Accessibility**: Always provide meaningful titles and descriptions
6. **Colors**: Use the color picker for consistent color schemes
7. **Responsive**: Enable responsive sizing for mobile support

## Performance Tips

1. **Data Aggregation**: Aggregate data on the backend when possible
2. **Caching**: Enable caching for API data sources
3. **Limit Series**: Keep series count reasonable (< 10 for line charts)
4. **Lazy Loading**: Load chart data on demand
5. **Debounce Filters**: Debounce filter changes to reduce re-renders

## Troubleshooting

### Chart Not Rendering

- Verify data format matches series dataKeys
- Check console for validation errors
- Ensure data is not empty

### Export Not Working

- Verify html2canvas is installed
- Check export formats in configuration
- Ensure chart is fully rendered before export

### Performance Issues

- Reduce data points (aggregate or sample)
- Disable animations for large datasets
- Use virtual scrolling for tables

## Contributing

When adding new features:

1. Add types to `chart-config.ts`
2. Create transformer functions in `transformers/`
3. Update registry in `chart-registry.ts`
4. Add configuration UI in `config/`
5. Document in this README

## License

Internal use only.
