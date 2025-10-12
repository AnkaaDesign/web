# Statistics Pages

This directory contains comprehensive, entity-specific statistics pages for deep-dive analytics across all major business areas.

## Overview

Each statistics page provides:
- **Real-time KPI cards** with trend indicators
- **Interactive charts and visualizations** for data exploration
- **Detailed data tables** with sorting, filtering, and export capabilities
- **Drill-down modals** for deeper analysis
- **Comparison views** for period-over-period analysis
- **Responsive layouts** that work on all devices

## Pages

### 1. Inventory Statistics (`/statistics/inventory.tsx`)

Comprehensive inventory analytics with deep insights into stock levels, consumption patterns, and reorder needs.

**Sections:**
- **Overview Cards:**
  - Total items in stock
  - Total inventory value
  - Items below reorder point
  - Items at critical stock levels

- **ABC/XYZ Classification:**
  - ABC analysis by value (A: 80%, B: 15%, C: 5%)
  - XYZ analysis by demand variability
  - Interactive drill-down into each classification

- **Stock Analysis:**
  - Stock levels by category with value breakdown
  - Stock levels by supplier
  - Dead stock identification
  - Fast-moving items tracking

- **Consumption Analytics:**
  - Monthly consumption trends
  - Consumption by category and sector
  - Seasonal pattern identification
  - Forecasting for future needs

- **Reorder Analysis:**
  - Items to reorder sorted by priority
  - Reorder point vs current stock
  - Lead time analysis
  - Suggested order quantities

- **Value Analysis:**
  - Inventory value over time
  - Value by category and classification
  - Cost trends and analysis

### 2. Production Statistics (`/statistics/production.tsx`)

Complete production analytics tracking task performance, cycle times, and efficiency metrics.

**Sections:**
- **Overview Cards:**
  - Active tasks count
  - Completed tasks this month
  - Average cycle time
  - On-time completion rate

- **Task Analytics:**
  - Tasks by status (pie chart)
  - Tasks by sector (bar chart)
  - Task completion trends
  - Task creation vs completion
  - Backlog analysis

- **Performance Metrics:**
  - Cycle time trends by task type
  - Cycle time by sector
  - Completion rate by sector
  - Efficiency trends over time

- **Sector Analysis:**
  - Tasks per sector with performance metrics
  - Bottleneck identification
  - Resource utilization analysis

- **Paint Analytics:**
  - Paint usage trends
  - Most used colors
  - Paint types distribution
  - Formula efficiency metrics

- **Customer Analytics:**
  - Tasks by customer
  - Customer satisfaction scores
  - Repeat customer tracking
  - Revenue by customer

### 3. Orders Statistics (`/statistics/orders.tsx`)

Detailed order analytics covering supplier performance, fulfillment rates, and spending patterns.

**Sections:**
- **Overview Cards:**
  - Pending orders count
  - Orders placed this month
  - Total spending
  - Average lead time

- **Order Analytics:**
  - Orders by status breakdown
  - Orders by supplier
  - Order value trends
  - Order frequency analysis

- **Fulfillment Analytics:**
  - Fulfillment rate tracking
  - Partial fulfillment identification
  - Overdue orders list
  - Average fulfillment time

- **Supplier Performance:**
  - On-time delivery rate per supplier
  - Quality metrics and ratings
  - Price comparison across suppliers
  - Lead time comparison
  - Order volume by supplier

- **Spending Analysis:**
  - Spending trends over time
  - Spending by category breakdown
  - Spending by supplier
  - Budget vs actual comparison

- **Item Analysis:**
  - Most ordered items
  - Critical items tracking
  - Price trends per item

### 4. HR Statistics (`/statistics/hr.tsx`)

Comprehensive HR analytics tracking employee metrics, performance, and compliance.

**Sections:**
- **Overview Cards:**
  - Total employees
  - Active employees
  - New hires this month
  - Turnover rate

- **Employee Analytics:**
  - Employees by sector distribution
  - Employees by position
  - Employees by status
  - Hiring trends
  - Termination trends

- **Performance Metrics:**
  - Performance level distribution (Excellent, Very Good, Good, Regular, Unsatisfactory)
  - Performance trends over time
  - Top performers identification
  - Improvement needs tracking

- **Bonus Analytics:**
  - Bonus distribution overview
  - Bonus trends over time
  - Bonus by sector
  - Bonus by position
  - Performance impact correlation

- **Payroll Analytics:**
  - Payroll costs over time
  - Costs by sector
  - Costs by position
  - Salary distribution analysis
  - Average salary by role

- **Warning Analytics:**
  - Warnings by category
  - Warnings by severity
  - Warnings by sector
  - Trends over time

- **Attendance:**
  - Vacation trends
  - Absence patterns
  - Sector coverage analysis

- **PPE Analytics:**
  - PPE deliveries tracking
  - PPE costs breakdown
  - PPE by type
  - Delivery compliance rate

### 5. Financial Statistics (`/statistics/financial.tsx`)

Complete financial analytics with revenue tracking, cost analysis, and profitability metrics.

**Sections:**
- **Overview Cards:**
  - Total revenue
  - Total costs
  - Profit margin
  - Monthly profit

- **Revenue Analytics:**
  - Revenue trends over time
  - Revenue by customer (top performers)
  - Revenue by task type
  - Revenue by sector
  - Revenue forecasting

- **Cost Analysis:**
  - Cost trends over time
  - Cost by category (materials, labor, overhead)
  - Cost by sector
  - Cost by project
  - Cost optimization opportunities

- **Profitability:**
  - Profit margin trends
  - Profitability by customer
  - Profitability by task type
  - Profitability by sector

- **Budget Tracking:**
  - Budget vs actual comparison
  - Variance analysis
  - Category breakdowns
  - Alerts for budget overruns

- **Cash Flow:**
  - Accounts receivable tracking
  - Accounts payable tracking
  - Payment status overview
  - Collection rates

## Common Components

All statistics pages use shared components for consistency:

### StatisticsPageLayout
Common layout structure with:
- Page header with breadcrumbs
- Date range selector (global for page)
- Export button (PDF, Excel)
- Filter panel (sidebar or top)
- Content area with responsive grid

### KPICard
Displays key performance indicators with:
- Current value
- Trend indicator (up/down arrow)
- Percentage change from previous period
- Target progress bar
- Click for drill-down

### DetailedDataTable
Feature-rich data table with:
- Column sorting
- Search/filter
- Pagination
- Export to CSV
- Row click handlers
- Custom cell renderers

### DrillDownModal
Modal for detailed exploration with:
- Additional charts
- Raw data tables
- Export functionality
- Tabbed views (Chart/Table/Details)

### ComparisonView
Side-by-side period comparison with:
- Dual data sets
- Difference highlighting
- Percentage changes
- Visual indicators

### TrendIndicator
Shows trends with:
- Up/down/neutral arrows
- Percentage change
- Optional sparkline
- Color coding (good/warning/bad)

## Data Fetching

All pages use React Query hooks for data fetching:

```typescript
import { useInventoryStatistics } from "@/hooks/use-inventory-statistics";

const { data, isLoading, error } = useInventoryStatistics(filters);
```

### Available Hooks:
- `useInventoryStatistics(filters)` - Inventory overview data
- `useStockTrends(filters)` - Stock trend data
- `useConsumptionStatistics(filters)` - Consumption patterns
- `useStockMetrics(filters)` - Detailed stock metrics
- `useStatisticsFilters(initialFilters)` - Filter state management

## Features

### 1. Deep Linking
All pages support URL-based state for:
- Filter configurations
- Date ranges
- Selected views
- Sort orders

Example: `/statistics/inventory?dateRange=last30days&category=5&sortBy=value`

### 2. Export Capabilities
Users can export data in multiple formats:
- **PDF** - Full page reports with charts
- **Excel** - Structured data tables
- **CSV** - Raw data for analysis

### 3. Real-time Updates
Pages automatically refresh data at configurable intervals:
- KPI cards: Every 30 seconds
- Charts: Every 2 minutes
- Tables: Every 5 minutes

### 4. Responsive Design
All pages work seamlessly across devices:
- Desktop: Full layout with sidebars
- Tablet: Adaptive grid
- Mobile: Stacked vertical layout

### 5. Accessibility
All components are fully accessible:
- Keyboard navigation
- Screen reader support
- ARIA labels
- Color contrast compliance

## Usage Example

```tsx
import { InventoryStatisticsPage } from "@/pages/statistics";

// Use in router
<Route path="/statistics/inventory" element={<InventoryStatisticsPage />} />
```

## Styling

All pages use:
- **Tailwind CSS** for utility-first styling
- **Radix UI** for accessible components
- **Consistent color palette** across all visualizations
- **Dark mode support** built-in

## Performance

Optimizations include:
- **React Query caching** for data persistence
- **Progressive loading** with skeleton screens
- **Lazy loading** for heavy components
- **Memoization** for expensive calculations
- **Virtual scrolling** for large data sets

## Future Enhancements

Planned improvements:
- [ ] Customizable dashboard layouts
- [ ] Drag-and-drop widget arrangement
- [ ] Saved filter presets
- [ ] Email report scheduling
- [ ] Advanced forecasting with ML
- [ ] Collaborative annotations
- [ ] Real-time collaboration
- [ ] Mobile apps for iOS/Android

## Contributing

When adding new statistics pages:
1. Follow the established pattern in existing pages
2. Use shared components for consistency
3. Implement proper TypeScript types
4. Add loading and error states
5. Include comprehensive comments
6. Ensure accessibility compliance
7. Add responsive design
8. Test with real API data

## API Integration

All pages are designed to work with real API endpoints. Mock data is used for development only. The actual implementation should:

1. Replace mock data with API calls
2. Handle loading states properly
3. Implement error handling
4. Add retry mechanisms
5. Cache data appropriately
6. Validate data integrity

Example API structure:
```typescript
// GET /api/statistics/inventory
{
  totalItems: number;
  totalValue: number;
  lowStockItems: number;
  criticalItems: number;
  topCategories: Array<{
    id: string;
    name: string;
    itemCount: number;
    totalValue: number;
  }>;
  // ... more fields
}
```

## License

These components are part of the Ankaa ERP system and are proprietary.
