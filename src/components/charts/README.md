# Chart Components Library

A comprehensive, production-ready library of reusable chart components built with React, Recharts, and Tailwind CSS.

## Features

- **Universal Chart Wrapper** - Loading, error, empty states, export (PNG, PDF, CSV, Excel), fullscreen mode
- **Interactive Components** - Tooltips, legends, click handlers, zoom/pan
- **Responsive Design** - Mobile-first, adapts to all screen sizes
- **TypeScript First** - Full type safety with comprehensive prop types
- **Dark Mode Support** - Automatic theme adaptation
- **Accessibility** - ARIA labels, keyboard navigation
- **Performance Optimized** - React.memo, efficient re-renders
- **Export Ready** - PNG, PDF, CSV, Excel export built-in

## Directory Structure

```
/components/charts/
├── base/                    # Base infrastructure components
│   ├── ChartWrapper.tsx     # Universal wrapper with all features
│   ├── ChartHeader.tsx      # Header with title, actions, time range
│   ├── ChartLegend.tsx      # Interactive legend
│   └── ChartTooltip.tsx     # Rich tooltip component
│
├── utils/                   # Utility functions
│   ├── chart-colors.ts      # Color palettes and helpers
│   ├── chart-formatters.ts  # Value formatters (currency, %, dates)
│   └── chart-data-helpers.ts # Data transformation utilities
│
├── business/                # Business-specific charts
│   ├── InventoryLevelChart.tsx
│   └── TaskStatusDistribution.tsx
│
├── composed/                # Composition components
│   ├── DashboardCard.tsx    # Dashboard card wrapper
│   └── ChartGrid.tsx        # Responsive grid layout
│
├── TimeSeriesChart.tsx      # Line charts with trends, MA, annotations
├── BarChartComponent.tsx    # Vertical/horizontal bars
├── PieChartComponent.tsx    # Pie/donut charts
├── AreaChartComponent.tsx   # Area charts (stacked, percentage)
└── index.ts                 # Main exports
```

## Installation

The library uses the following dependencies (already in package.json):
- `recharts` - Chart rendering
- `date-fns` - Date formatting
- `html2canvas` - PNG export
- `jspdf` - PDF export
- `xlsx` - Excel export

## Quick Start

### Basic Usage

```typescript
import { TimeSeriesChart } from '@/components/charts';

function MyDashboard() {
  const data = [
    { date: '2024-01-01', revenue: 1000, costs: 600 },
    { date: '2024-01-02', revenue: 1200, costs: 650 },
    // ...
  ];

  const series = [
    { key: 'revenue', name: 'Receita', color: '#10b981' },
    { key: 'costs', name: 'Custos', color: '#ef4444' },
  ];

  return (
    <TimeSeriesChart
      data={data}
      series={series}
      title="Receita vs Custos"
      description="Análise financeira mensal"
      height={400}
      showMovingAverage
      showTrendLine
      onRefresh={refetchData}
    />
  );
}
```

## Component Documentation

### Base Components

#### ChartWrapper

Universal wrapper for all charts with built-in features.

**Props:**
```typescript
interface ChartWrapperProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
  icon?: React.ReactNode;

  // State
  isLoading?: boolean;
  error?: Error | string | null;
  isEmpty?: boolean;

  // Features
  showExport?: boolean;      // Export dropdown
  showRefresh?: boolean;     // Refresh button
  showFullscreen?: boolean;  // Fullscreen mode
  showSettings?: boolean;    // Settings menu

  // Callbacks
  onRefresh?: () => void;
  onExport?: (format: 'png' | 'pdf' | 'csv' | 'excel') => void;

  // Export data
  exportData?: {
    headers: string[];
    rows: (string | number)[][];
  };
}
```

**Example:**
```typescript
<ChartWrapper
  title="Monthly Sales"
  isLoading={isLoading}
  error={error}
  onRefresh={handleRefresh}
  exportData={{ headers: ['Month', 'Sales'], rows: [...] }}
>
  {/* Your chart content */}
</ChartWrapper>
```

#### ChartHeader

Standardized header for charts.

**Props:**
```typescript
interface ChartHeaderProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  info?: string;              // Tooltip info
  children?: React.ReactNode; // Action buttons

  // Time range selector
  showTimeRange?: boolean;
  timeRange?: string;
  onTimeRangeChange?: (value: string) => void;
}
```

#### ChartLegend

Interactive legend with show/hide functionality.

**Props:**
```typescript
interface ChartLegendProps {
  items: Array<{
    key: string;
    label: string;
    color: string;
    value?: number;
    percentage?: number;
  }>;
  onToggle?: (key: string, hidden: boolean) => void;
  showValues?: boolean;
  showPercentage?: boolean;
  interactive?: boolean;
}
```

### Specialized Charts

#### TimeSeriesChart

Line chart for time-based data with advanced features.

**Features:**
- Multiple series
- Moving averages
- Trend lines
- Annotations
- Zoom/pan with brush
- Dual Y-axes

**Props:**
```typescript
interface TimeSeriesChartProps {
  data: Array<{ date: Date | string; [key: string]: any }>;
  series: Array<{
    key: string;
    name: string;
    color?: string;
    yAxisId?: 'left' | 'right';
  }>;

  // Advanced features
  showMovingAverage?: boolean;
  movingAverageWindow?: number;
  showTrendLine?: boolean;
  showBrush?: boolean;
  annotations?: Array<{
    date: Date | string;
    label: string;
    color?: string;
  }>;
}
```

**Example:**
```typescript
<TimeSeriesChart
  data={salesData}
  series={[
    { key: 'sales', name: 'Vendas', color: '#10b981' },
    { key: 'target', name: 'Meta', color: '#f59e0b', yAxisId: 'right' },
  ]}
  showMovingAverage
  movingAverageWindow={7}
  showTrendLine
  showBrush
  annotations={[
    { date: '2024-01-15', label: 'Lançamento', color: '#3b82f6' }
  ]}
/>
```

#### BarChartComponent

Versatile bar chart (vertical/horizontal, grouped/stacked).

**Features:**
- Vertical or horizontal orientation
- Grouped or stacked layout
- Percentage stacking
- Value labels
- Target lines
- Color by value

**Props:**
```typescript
interface BarChartComponentProps {
  data: Array<{ name: string; [key: string]: any }>;
  series: Array<{
    key: string;
    name: string;
    color?: string;
    stackId?: string;
  }>;

  orientation?: 'vertical' | 'horizontal';
  layout?: 'grouped' | 'stacked' | 'stacked-percentage';
  showValueLabels?: boolean;
  targetValue?: number;
  colorByValue?: boolean;
}
```

**Example:**
```typescript
<BarChartComponent
  data={departmentData}
  series={[
    { key: 'q1', name: 'Q1', stackId: 'stack' },
    { key: 'q2', name: 'Q2', stackId: 'stack' },
  ]}
  layout="stacked"
  orientation="horizontal"
  showValueLabels
  targetValue={100000}
/>
```

#### PieChartComponent

Pie/donut chart with interactive segments.

**Features:**
- Pie, donut, and semi-circle modes
- Interactive segments
- Percentage labels
- Center labels (for donut)
- Click handlers

**Props:**
```typescript
interface PieChartComponentProps {
  data: Array<{ name: string; value: number }>;
  variant?: 'pie' | 'donut' | 'semi-circle';
  showLabels?: boolean;
  showPercentages?: boolean;
  centerLabel?: string;
  centerValue?: string | number;
  onSegmentClick?: (data: any) => void;
}
```

**Example:**
```typescript
<PieChartComponent
  data={[
    { name: 'Produto A', value: 400 },
    { name: 'Produto B', value: 300 },
    { name: 'Produto C', value: 200 },
  ]}
  variant="donut"
  showPercentages
  centerLabel="Total"
  centerValue={900}
  onSegmentClick={(item) => console.log(item)}
/>
```

#### AreaChartComponent

Area chart with stacking and gradient fills.

**Features:**
- Stacked or overlapping areas
- Percentage mode
- Stream graph
- Gradient fills
- Smooth or linear curves

**Props:**
```typescript
interface AreaChartComponentProps {
  data: Array<{ date: Date | string; [key: string]: any }>;
  series: Array<{ key: string; name: string; color?: string }>;
  layout?: 'default' | 'stacked' | 'percentage' | 'stream';
  fillOpacity?: number;
  useGradient?: boolean;
  curved?: boolean;
}
```

### Business Charts

#### InventoryLevelChart

Specialized chart for inventory management.

**Features:**
- Current stock levels
- Reorder point indicators
- Safety stock lines
- Color by status (critical/low/normal)
- ABC category colors

**Props:**
```typescript
interface InventoryLevelChartProps {
  data: Array<{
    name: string;
    currentStock: number;
    reorderPoint: number;
    safetyStock: number;
    unit: string;
    category?: 'A' | 'B' | 'C';
  }>;
  showReorderPoints?: boolean;
  showSafetyStock?: boolean;
  colorByStatus?: boolean;
}
```

**Example:**
```typescript
<InventoryLevelChart
  data={inventoryItems}
  showReorderPoints
  showSafetyStock
  colorByStatus
  onItemClick={(item) => navigateToItem(item.id)}
/>
```

#### TaskStatusDistribution

Pie chart for task status breakdown.

**Props:**
```typescript
interface TaskStatusDistributionProps {
  data: {
    pending: number;
    in_progress: number;
    completed: number;
    cancelled: number;
  };
  variant?: 'pie' | 'donut';
}
```

### Composition Components

#### DashboardCard

Standardized card wrapper for dashboard charts.

**Features:**
- Consistent styling
- Actions menu (expand, refresh, export, remove)
- Drag handle for rearranging
- Loading states

**Example:**
```typescript
<DashboardCard
  title="Sales Overview"
  subtitle="Last 30 days"
  icon={<TrendingUp />}
  onExpand={handleExpand}
  onRefresh={handleRefresh}
  onExport={handleExport}
  draggable
>
  <TimeSeriesChart {...chartProps} />
</DashboardCard>
```

#### ChartGrid

Responsive grid layout for multiple charts.

**Example:**
```typescript
<ChartGrid columns={2} gap="md">
  <TimeSeriesChart {...} />
  <BarChartComponent {...} />
  <PieChartComponent {...} />
  <AreaChartComponent {...} />
</ChartGrid>
```

## Utilities

### Color Palettes

```typescript
import { COLOR_PALETTES } from '@/components/charts/utils';

// Available palettes
COLOR_PALETTES.primary      // General purpose
COLOR_PALETTES.status       // Task/order statuses
COLOR_PALETTES.inventory    // Inventory statuses
COLOR_PALETTES.abc          // ABC analysis
COLOR_PALETTES.financial    // Revenue/cost/profit
COLOR_PALETTES.sequential   // Continuous data
COLOR_PALETTES.diverging    // Data with midpoint
```

### Formatters

```typescript
import {
  formatCurrency,
  formatPercentage,
  formatNumber,
  formatDate,
  formatDuration,
} from '@/components/charts/utils';

formatCurrency(1234.56)           // "R$ 1.234,56"
formatPercentage(0.156)           // "15.6%"
formatNumber(1234567)             // "1.234.567"
formatDate(new Date())            // "12/10/2025"
formatDuration(25.5)              // "1d 1h"
```

### Data Helpers

```typescript
import {
  aggregateByPeriod,
  calculateMovingAverage,
  calculateTrend,
  groupByCategory,
  getTopN,
} from '@/components/charts/utils';

// Aggregate daily data to monthly
const monthly = aggregateByPeriod(data, 'month', 'date', 'value');

// Calculate 7-day moving average
const withMA = calculateMovingAverage(data, 7);

// Get top 5 items
const top5 = getTopN(data, 5, 'value');
```

## Best Practices

### Performance

1. **Use React.memo**: All chart components are memoized
2. **Memoize data**: Use `useMemo` for data transformations
3. **Virtualize large datasets**: Consider pagination or virtualization for >1000 points

```typescript
const processedData = useMemo(() => {
  return transformData(rawData);
}, [rawData]);
```

### Data Structure

Always provide data in consistent format:

```typescript
// Time series
const timeSeriesData = [
  { date: '2024-01-01', value: 100 },
  { date: '2024-01-02', value: 120 },
];

// Categories
const categoryData = [
  { name: 'Category A', value: 100 },
  { name: 'Category B', value: 200 },
];
```

### Error Handling

All charts handle loading and error states:

```typescript
<TimeSeriesChart
  data={data}
  series={series}
  isLoading={isLoading}
  error={error}
  onRefresh={refetch}
/>
```

### Accessibility

- All charts have ARIA labels
- Interactive elements are keyboard accessible
- Sufficient color contrast
- Tooltips provide text alternatives for visual data

## Examples

### Complete Dashboard Example

```typescript
import {
  ChartGrid,
  DashboardCard,
  TimeSeriesChart,
  BarChartComponent,
  PieChartComponent,
  InventoryLevelChart,
} from '@/components/charts';

function Dashboard() {
  return (
    <ChartGrid columns={2} gap="md">
      <DashboardCard
        title="Revenue Trend"
        onRefresh={refetchRevenue}
        onExport={exportRevenue}
      >
        <TimeSeriesChart
          data={revenueData}
          series={[{ key: 'revenue', name: 'Revenue' }]}
          showMovingAverage
          showTrendLine
        />
      </DashboardCard>

      <DashboardCard title="Sales by Category">
        <PieChartComponent
          data={categoryData}
          variant="donut"
          showPercentages
        />
      </DashboardCard>

      <DashboardCard title="Inventory Levels">
        <InventoryLevelChart
          data={inventoryData}
          showReorderPoints
          colorByStatus
        />
      </DashboardCard>

      <DashboardCard title="Monthly Comparison">
        <BarChartComponent
          data={monthlyData}
          series={[
            { key: 'current', name: 'This Year' },
            { key: 'previous', name: 'Last Year' },
          ]}
          layout="grouped"
        />
      </DashboardCard>
    </ChartGrid>
  );
}
```

## TypeScript Support

All components are fully typed with comprehensive prop interfaces:

```typescript
import type {
  TimeSeriesChartProps,
  BarChartComponentProps,
  PieChartComponentProps,
  ChartWrapperProps,
} from '@/components/charts';
```

## Contributing

When adding new chart types:

1. Extend base components when possible
2. Use ChartWrapper for consistent UI
3. Accept data as props (no internal fetching)
4. Support export functionality
5. Handle loading/error states
6. Add TypeScript interfaces
7. Document props and examples

## License

Part of the Ankaa Web application.
