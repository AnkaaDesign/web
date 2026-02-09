/**
 * Chart Registry
 *
 * Central registry of all available chart configurations for the application.
 * Organized by domain: inventory, production, orders, HR, financial, etc.
 */

import {
  createChartConfig,
  createSeriesConfig,
  createAxisConfig,
  createDataSourceConfig,
} from './chart-config';
import type { ChartConfiguration } from './chart-config';

// ============================================================================
// Inventory Charts
// ============================================================================

export const INVENTORY_CHARTS = {
  'inventory-stock-levels': createChartConfig({
    id: 'inventory-stock-levels',
    type: 'bar',
    title: 'Stock Levels by Item',
    description: 'Current inventory levels across all items',
    category: 'inventory',
    dataSource: createDataSourceConfig('api', {
      endpoint: '/api/inventory/stock-levels',
      transform: 'inventoryStockTransform',
    }),
    xAxis: createAxisConfig({
      label: 'Item',
      dataKey: 'itemName',
      type: 'category',
    }),
    yAxis: createAxisConfig({
      label: 'Quantity',
      type: 'number',
      unit: 'units',
    }),
    series: [
      createSeriesConfig({
        name: 'Current Stock',
        dataKey: 'currentQuantity',
        color: '#3b82f6',
      }),
      createSeriesConfig({
        name: 'Minimum Stock',
        dataKey: 'minimumStock',
        color: '#ef4444',
        type: 'line',
      }),
    ],
  }),

  'inventory-abc-analysis': createChartConfig({
    id: 'inventory-abc-analysis',
    type: 'pie',
    title: 'ABC Analysis',
    description: 'Inventory classification by value',
    category: 'inventory',
    dataSource: createDataSourceConfig('api', {
      endpoint: '/api/inventory/abc-analysis',
    }),
    series: [
      createSeriesConfig({
        name: 'Classification',
        dataKey: 'value',
      }),
    ],
    style: {
      colors: ['#10b981', '#f59e0b', '#ef4444'],
    },
  }),

  'inventory-consumption-trends': createChartConfig({
    id: 'inventory-consumption-trends',
    type: 'area',
    title: 'Consumption Trends',
    description: 'Item consumption over time',
    category: 'inventory',
    dataSource: createDataSourceConfig('api', {
      endpoint: '/api/inventory/consumption-trends',
      params: { period: '30d' },
    }),
    xAxis: createAxisConfig({
      label: 'Date',
      dataKey: 'date',
      type: 'time',
    }),
    yAxis: createAxisConfig({
      label: 'Consumed Quantity',
      type: 'number',
    }),
    series: [
      createSeriesConfig({
        name: 'Consumption',
        dataKey: 'quantity',
        color: '#8b5cf6',
      }),
    ],
  }),

  'inventory-turnover-rate': createChartConfig({
    id: 'inventory-turnover-rate',
    type: 'bar',
    title: 'Inventory Turnover Rate',
    description: 'Turnover rate by item category',
    category: 'inventory',
    dataSource: createDataSourceConfig('api', {
      endpoint: '/api/inventory/turnover-rate',
    }),
    xAxis: createAxisConfig({
      label: 'Category',
      dataKey: 'category',
      type: 'category',
    }),
    yAxis: createAxisConfig({
      label: 'Turnover Rate',
      type: 'number',
      unit: 'x',
    }),
    series: [
      createSeriesConfig({
        name: 'Turnover Rate',
        dataKey: 'turnoverRate',
        color: '#06b6d4',
      }),
    ],
  }),

  'inventory-value-by-location': createChartConfig({
    id: 'inventory-value-by-location',
    type: 'bar',
    title: 'Inventory Value by Location',
    description: 'Total inventory value across storage locations',
    category: 'inventory',
    dataSource: createDataSourceConfig('api', {
      endpoint: '/api/inventory/value-by-location',
    }),
    xAxis: createAxisConfig({
      label: 'Location',
      dataKey: 'location',
      type: 'category',
    }),
    yAxis: createAxisConfig({
      label: 'Value',
      type: 'number',
      unit: '$',
    }),
    series: [
      createSeriesConfig({
        name: 'Total Value',
        dataKey: 'totalValue',
        color: '#10b981',
      }),
    ],
  }),
};

// ============================================================================
// Production Charts
// ============================================================================

export const PRODUCTION_CHARTS = {
  'production-task-status': createChartConfig({
    id: 'production-task-status',
    type: 'pie',
    title: 'Production Task Status',
    description: 'Distribution of production tasks by status',
    category: 'production',
    dataSource: createDataSourceConfig('api', {
      endpoint: '/api/production/task-status',
    }),
    series: [
      createSeriesConfig({
        name: 'Status',
        dataKey: 'count',
      }),
    ],
    style: {
      colors: ['#10b981', '#f59e0b', '#3b82f6', '#6366f1', '#ef4444'],
    },
  }),

  'production-completion-rate': createChartConfig({
    id: 'production-completion-rate',
    type: 'line',
    title: 'Production Completion Rate',
    description: 'Daily completion rate over time',
    category: 'production',
    dataSource: createDataSourceConfig('api', {
      endpoint: '/api/production/completion-rate',
      params: { period: '30d' },
    }),
    xAxis: createAxisConfig({
      label: 'Date',
      dataKey: 'date',
      type: 'time',
    }),
    yAxis: createAxisConfig({
      label: 'Completion Rate',
      type: 'number',
      unit: '%',
      domain: [0, 100],
    }),
    series: [
      createSeriesConfig({
        name: 'Completion Rate',
        dataKey: 'completionRate',
        color: '#10b981',
      }),
      createSeriesConfig({
        name: 'Target',
        dataKey: 'target',
        color: '#94a3b8',
        type: 'line',
        lineStyle: { type: 'dashed' },
      }),
    ],
  }),

  'production-cycle-time': createChartConfig({
    id: 'production-cycle-time',
    type: 'bar',
    title: 'Average Cycle Time',
    description: 'Average cycle time by production stage',
    category: 'production',
    dataSource: createDataSourceConfig('api', {
      endpoint: '/api/production/cycle-time',
    }),
    xAxis: createAxisConfig({
      label: 'Stage',
      dataKey: 'stage',
      type: 'category',
    }),
    yAxis: createAxisConfig({
      label: 'Time',
      type: 'number',
      unit: 'hours',
    }),
    series: [
      createSeriesConfig({
        name: 'Average Cycle Time',
        dataKey: 'averageTime',
        color: '#8b5cf6',
      }),
    ],
  }),

  'production-output-trends': createChartConfig({
    id: 'production-output-trends',
    type: 'combo',
    title: 'Production Output Trends',
    description: 'Production output and efficiency over time',
    category: 'production',
    dataSource: createDataSourceConfig('api', {
      endpoint: '/api/production/output-trends',
      params: { period: '90d' },
    }),
    xAxis: createAxisConfig({
      label: 'Week',
      dataKey: 'week',
      type: 'category',
    }),
    yAxis: createAxisConfig({
      label: 'Units Produced',
      type: 'number',
    }),
    secondaryYAxis: createAxisConfig({
      label: 'Efficiency',
      type: 'number',
      unit: '%',
      position: 'right',
    }),
    series: [
      createSeriesConfig({
        name: 'Units Produced',
        dataKey: 'unitsProduced',
        type: 'bar',
        color: '#3b82f6',
      }),
      createSeriesConfig({
        name: 'Efficiency',
        dataKey: 'efficiency',
        type: 'line',
        color: '#10b981',
        yAxisId: 'right',
      }),
    ],
  }),

  'production-defect-rate': createChartConfig({
    id: 'production-defect-rate',
    type: 'line',
    title: 'Defect Rate',
    description: 'Quality defect rate tracking',
    category: 'production',
    dataSource: createDataSourceConfig('api', {
      endpoint: '/api/production/defect-rate',
    }),
    xAxis: createAxisConfig({
      label: 'Date',
      dataKey: 'date',
      type: 'time',
    }),
    yAxis: createAxisConfig({
      label: 'Defect Rate',
      type: 'number',
      unit: '%',
    }),
    series: [
      createSeriesConfig({
        name: 'Defect Rate',
        dataKey: 'defectRate',
        color: '#ef4444',
      }),
      createSeriesConfig({
        name: 'Target',
        dataKey: 'target',
        color: '#94a3b8',
        lineStyle: { type: 'dashed' },
      }),
    ],
  }),
};

// ============================================================================
// Order Charts
// ============================================================================

export const ORDER_CHARTS = {
  'orders-fulfillment-rate': createChartConfig({
    id: 'orders-fulfillment-rate',
    type: 'area',
    title: 'Order Fulfillment Rate',
    description: 'Percentage of orders fulfilled on time',
    category: 'orders',
    dataSource: createDataSourceConfig('api', {
      endpoint: '/api/orders/fulfillment-rate',
      params: { period: '30d' },
    }),
    xAxis: createAxisConfig({
      label: 'Date',
      dataKey: 'date',
      type: 'time',
    }),
    yAxis: createAxisConfig({
      label: 'Fulfillment Rate',
      type: 'number',
      unit: '%',
      domain: [0, 100],
    }),
    series: [
      createSeriesConfig({
        name: 'Fulfillment Rate',
        dataKey: 'fulfillmentRate',
        color: '#10b981',
      }),
    ],
  }),

  'orders-supplier-comparison': createChartConfig({
    id: 'orders-supplier-comparison',
    type: 'bar',
    title: 'Supplier Performance Comparison',
    description: 'Compare suppliers by delivery time and quality',
    category: 'orders',
    dataSource: createDataSourceConfig('api', {
      endpoint: '/api/orders/supplier-comparison',
    }),
    xAxis: createAxisConfig({
      label: 'Supplier',
      dataKey: 'supplierName',
      type: 'category',
    }),
    yAxis: createAxisConfig({
      label: 'Average Delivery Time',
      type: 'number',
      unit: 'days',
    }),
    series: [
      createSeriesConfig({
        name: 'Delivery Time',
        dataKey: 'avgDeliveryTime',
        color: '#3b82f6',
      }),
      createSeriesConfig({
        name: 'Quality Score',
        dataKey: 'qualityScore',
        color: '#10b981',
      }),
    ],
  }),

  'orders-status-funnel': createChartConfig({
    id: 'orders-status-funnel',
    type: 'funnel',
    library: 'echarts',
    title: 'Order Status Funnel',
    description: 'Order progression through stages',
    category: 'orders',
    dataSource: createDataSourceConfig('api', {
      endpoint: '/api/orders/status-funnel',
    }),
    series: [
      createSeriesConfig({
        name: 'Orders',
        dataKey: 'count',
      }),
    ],
  }),

  'orders-value-trends': createChartConfig({
    id: 'orders-value-trends',
    type: 'line',
    title: 'Order Value Trends',
    description: 'Total order value over time',
    category: 'orders',
    dataSource: createDataSourceConfig('api', {
      endpoint: '/api/orders/value-trends',
      params: { period: '12m' },
    }),
    xAxis: createAxisConfig({
      label: 'Month',
      dataKey: 'month',
      type: 'time',
    }),
    yAxis: createAxisConfig({
      label: 'Order Value',
      type: 'number',
      unit: '$',
    }),
    series: [
      createSeriesConfig({
        name: 'Order Value',
        dataKey: 'totalValue',
        color: '#10b981',
      }),
    ],
  }),
};

// ============================================================================
// HR Charts
// ============================================================================

export const HR_CHARTS = {
  'hr-performance-distribution': createChartConfig({
    id: 'hr-performance-distribution',
    type: 'bar',
    title: 'Performance Distribution',
    description: 'Distribution of employee performance ratings',
    category: 'hr',
    dataSource: createDataSourceConfig('api', {
      endpoint: '/api/hr/performance-distribution',
    }),
    xAxis: createAxisConfig({
      label: 'Performance Rating',
      dataKey: 'rating',
      type: 'category',
    }),
    yAxis: createAxisConfig({
      label: 'Number of Employees',
      type: 'number',
    }),
    series: [
      createSeriesConfig({
        name: 'Employees',
        dataKey: 'count',
        color: '#6366f1',
      }),
    ],
  }),

  'hr-bonus-trends': createChartConfig({
    id: 'hr-bonus-trends',
    type: 'line',
    title: 'Bonus Trends',
    description: 'Bonus distribution over time',
    category: 'hr',
    dataSource: createDataSourceConfig('api', {
      endpoint: '/api/hr/bonus-trends',
      params: { period: '12m' },
    }),
    xAxis: createAxisConfig({
      label: 'Month',
      dataKey: 'month',
      type: 'time',
    }),
    yAxis: createAxisConfig({
      label: 'Total Bonus',
      type: 'number',
      unit: '$',
    }),
    series: [
      createSeriesConfig({
        name: 'Total Bonus',
        dataKey: 'totalBonus',
        color: '#10b981',
      }),
      createSeriesConfig({
        name: 'Average Bonus',
        dataKey: 'avgBonus',
        color: '#3b82f6',
      }),
    ],
  }),

  'hr-attendance-heatmap': createChartConfig({
    id: 'hr-attendance-heatmap',
    type: 'heatmap',
    library: 'echarts',
    title: 'Attendance Heatmap',
    description: 'Employee attendance patterns',
    category: 'hr',
    dataSource: createDataSourceConfig('api', {
      endpoint: '/api/hr/attendance-heatmap',
    }),
    series: [
      createSeriesConfig({
        name: 'Attendance',
        dataKey: 'value',
      }),
    ],
  }),

  'hr-department-headcount': createChartConfig({
    id: 'hr-department-headcount',
    type: 'pie',
    title: 'Headcount by Department',
    description: 'Employee distribution across departments',
    category: 'hr',
    dataSource: createDataSourceConfig('api', {
      endpoint: '/api/hr/department-headcount',
    }),
    series: [
      createSeriesConfig({
        name: 'Headcount',
        dataKey: 'count',
      }),
    ],
  }),

  'hr-turnover-rate': createChartConfig({
    id: 'hr-turnover-rate',
    type: 'combo',
    title: 'Employee Turnover Rate',
    description: 'Turnover rate and new hires over time',
    category: 'hr',
    dataSource: createDataSourceConfig('api', {
      endpoint: '/api/hr/turnover-rate',
      params: { period: '12m' },
    }),
    xAxis: createAxisConfig({
      label: 'Month',
      dataKey: 'month',
      type: 'time',
    }),
    yAxis: createAxisConfig({
      label: 'Count',
      type: 'number',
    }),
    secondaryYAxis: createAxisConfig({
      label: 'Turnover Rate',
      type: 'number',
      unit: '%',
      position: 'right',
    }),
    series: [
      createSeriesConfig({
        name: 'Departures',
        dataKey: 'departures',
        type: 'bar',
        color: '#ef4444',
      }),
      createSeriesConfig({
        name: 'New Hires',
        dataKey: 'newHires',
        type: 'bar',
        color: '#10b981',
      }),
      createSeriesConfig({
        name: 'Turnover Rate',
        dataKey: 'turnoverRate',
        type: 'line',
        color: '#f59e0b',
        yAxisId: 'right',
      }),
    ],
  }),
};

// ============================================================================
// Financial Charts
// ============================================================================

export const FINANCIAL_CHARTS = {
  'financial-revenue-trends': createChartConfig({
    id: 'financial-revenue-trends',
    type: 'area',
    title: 'Revenue Trends',
    description: 'Revenue over time with forecasting',
    category: 'financial',
    dataSource: createDataSourceConfig('api', {
      endpoint: '/api/financial/revenue-trends',
      params: { period: '12m' },
    }),
    xAxis: createAxisConfig({
      label: 'Month',
      dataKey: 'month',
      type: 'time',
    }),
    yAxis: createAxisConfig({
      label: 'Revenue',
      type: 'number',
      unit: '$',
    }),
    series: [
      createSeriesConfig({
        name: 'Actual Revenue',
        dataKey: 'actualRevenue',
        color: '#10b981',
      }),
      createSeriesConfig({
        name: 'Forecasted Revenue',
        dataKey: 'forecastedRevenue',
        color: '#94a3b8',
        lineStyle: { type: 'dashed' },
      }),
    ],
  }),

  'financial-cost-breakdown': createChartConfig({
    id: 'financial-cost-breakdown',
    type: 'pie',
    title: 'Cost Breakdown',
    description: 'Operating costs by category',
    category: 'financial',
    dataSource: createDataSourceConfig('api', {
      endpoint: '/api/financial/cost-breakdown',
    }),
    series: [
      createSeriesConfig({
        name: 'Cost',
        dataKey: 'value',
      }),
    ],
    style: {
      colors: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'],
    },
  }),

  'financial-profit-margin': createChartConfig({
    id: 'financial-profit-margin',
    type: 'combo',
    title: 'Profit Margin Analysis',
    description: 'Revenue, costs, and profit margin',
    category: 'financial',
    dataSource: createDataSourceConfig('api', {
      endpoint: '/api/financial/profit-margin',
      params: { period: '12m' },
    }),
    xAxis: createAxisConfig({
      label: 'Month',
      dataKey: 'month',
      type: 'time',
    }),
    yAxis: createAxisConfig({
      label: 'Amount',
      type: 'number',
      unit: '$',
    }),
    secondaryYAxis: createAxisConfig({
      label: 'Profit Margin',
      type: 'number',
      unit: '%',
      position: 'right',
    }),
    series: [
      createSeriesConfig({
        name: 'Revenue',
        dataKey: 'revenue',
        type: 'bar',
        color: '#10b981',
      }),
      createSeriesConfig({
        name: 'Costs',
        dataKey: 'costs',
        type: 'bar',
        color: '#ef4444',
      }),
      createSeriesConfig({
        name: 'Profit Margin',
        dataKey: 'profitMargin',
        type: 'line',
        color: '#3b82f6',
        yAxisId: 'right',
      }),
    ],
  }),

  'financial-cash-flow': createChartConfig({
    id: 'financial-cash-flow',
    type: 'bar',
    title: 'Cash Flow',
    description: 'Monthly cash inflow and outflow',
    category: 'financial',
    dataSource: createDataSourceConfig('api', {
      endpoint: '/api/financial/cash-flow',
      params: { period: '12m' },
    }),
    xAxis: createAxisConfig({
      label: 'Month',
      dataKey: 'month',
      type: 'time',
    }),
    yAxis: createAxisConfig({
      label: 'Cash Flow',
      type: 'number',
      unit: '$',
    }),
    series: [
      createSeriesConfig({
        name: 'Inflow',
        dataKey: 'inflow',
        color: '#10b981',
      }),
      createSeriesConfig({
        name: 'Outflow',
        dataKey: 'outflow',
        color: '#ef4444',
      }),
    ],
  }),
};

// ============================================================================
// Main Registry
// ============================================================================

export const CHART_REGISTRY: Record<string, ChartConfiguration> = {
  ...INVENTORY_CHARTS,
  ...PRODUCTION_CHARTS,
  ...ORDER_CHARTS,
  ...HR_CHARTS,
  ...FINANCIAL_CHARTS,
};

// ============================================================================
// Registry Utilities
// ============================================================================

export const getChartConfig = (id: string): ChartConfiguration | undefined => {
  return CHART_REGISTRY[id];
};

export const getChartsByCategory = (category: string): ChartConfiguration[] => {
  return Object.values(CHART_REGISTRY).filter((config) => config.category === category);
};

export const getAllCategories = (): string[] => {
  const categories = new Set<string>();
  Object.values(CHART_REGISTRY).forEach((config) => {
    if (config.category) {
      categories.add(config.category);
    }
  });
  return Array.from(categories).sort();
};

export const searchCharts = (query: string): ChartConfiguration[] => {
  const lowerQuery = query.toLowerCase();
  return Object.values(CHART_REGISTRY).filter(
    (config) =>
      config.title.toLowerCase().includes(lowerQuery) ||
      config.description?.toLowerCase().includes(lowerQuery) ||
      config.id.toLowerCase().includes(lowerQuery)
  );
};

export const getChartCount = (): number => {
  return Object.keys(CHART_REGISTRY).length;
};
