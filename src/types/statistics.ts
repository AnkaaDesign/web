// packages/types/src/statistics.ts

import type {
  STATISTICS_GROUP_BY,
  STATISTICS_METRIC,
  STATISTICS_PERIOD,
  CHART_TYPE,
  ACTIVITY_OPERATION,
  ACTIVITY_REASON,
} from "../constants";
import type { BaseGetUniqueResponse } from "./common";

// =====================
// Chart Group By and Metric Enums
// =====================

export enum ChartGroupBy {
  SECTOR = "SECTOR",
  USER = "USER",
  CATEGORY = "CATEGORY",
  BRAND = "BRAND",
  SUPPLIER = "SUPPLIER",
  ITEM = "ITEM",
  DATE = "DATE",
  ACTIVITY_REASON = "ACTIVITY_REASON",
  ACTIVITY_OPERATION = "ACTIVITY_OPERATION",
}

export enum ChartMetric {
  QUANTITY = "QUANTITY",
  TOTAL_PRICE = "TOTAL_PRICE",
  UNIT_PRICE = "UNIT_PRICE",
  COUNT = "COUNT",
  FREQUENCY = "FREQUENCY",
  PERCENTAGE = "PERCENTAGE",
  AVERAGE = "AVERAGE",
}

// =====================
// Core Statistics Types
// =====================

export interface StatisticsFilter {
  dateRange: {
    from: Date;
    to: Date;
  };
  period: STATISTICS_PERIOD;
  groupBy?: STATISTICS_GROUP_BY;
  metric?: STATISTICS_METRIC;
  chartType?: CHART_TYPE;

  // Entity filters
  categoryIds?: string[];
  brandIds?: string[];
  supplierIds?: string[];
  userIds?: string[];
  sectorIds?: string[];
  itemIds?: string[];

  // Activity filters
  activityReasons?: ACTIVITY_REASON[];
  activityOperations?: ACTIVITY_OPERATION[];

  // Additional filters
  minValue?: number;
  maxValue?: number;
  limit?: number;
  offset?: number;

  // Aggregate options
  includeEmpty?: boolean;
  includeTotals?: boolean;
  includePercentages?: boolean;
}

export interface ConsumptionDataPoint {
  id: string;
  label: string;
  value: number;
  quantity?: number;
  totalPrice?: number;
  unitPrice?: number;
  percentage?: number;
  color?: string;
  metadata?: Record<string, any>;
  date?: Date;
  period?: string;
}

export interface ConsumptionChartData {
  chartType: CHART_TYPE;
  groupBy: STATISTICS_GROUP_BY;
  metric: STATISTICS_METRIC;
  period: STATISTICS_PERIOD;

  dataPoints: ConsumptionDataPoint[];

  summary: {
    totalValue: number;
    totalQuantity: number;
    averageValue: number;
    dataPointCount: number;
    topPerformer?: ConsumptionDataPoint;
    lowestPerformer?: ConsumptionDataPoint;
  };

  labels: string[];
  colors?: string[];

  trends?: {
    isGrowing: boolean;
    growthRate: number;
    direction: "up" | "down" | "stable";
  };

  filters: StatisticsFilter;
  generatedAt: Date;
}

// =====================
// Activity Analytics Types
// =====================

export interface ActivityAnalytics {
  totalActivities: number;
  period: STATISTICS_PERIOD;
  dateRange: {
    from: Date;
    to: Date;
  };

  activityTypes: Array<{
    type: ACTIVITY_REASON;
    count: number;
    percentage: number;
    totalQuantity: number;
    totalValue?: number;
  }>;

  operationTypes: Array<{
    operation: ACTIVITY_OPERATION;
    count: number;
    percentage: number;
    totalQuantity: number;
    totalValue?: number;
  }>;

  hourlyDistribution: Array<{
    hour: number;
    count: number;
    avgQuantity: number;
    avgValue?: number;
  }>;

  dailyDistribution: Array<{
    date: string;
    count: number;
    totalQuantity: number;
    totalValue?: number;
    incoming: number;
    outgoing: number;
    adjustments: number;
  }>;

  userRanking: Array<{
    userId: string;
    userName: string;
    activityCount: number;
    totalQuantity: number;
    totalValue?: number;
    efficiency: number;
    sectorName: string;
    avgDailyActivities: number;
  }>;

  sectorComparison: Array<{
    sectorId: string;
    sectorName: string;
    activityCount: number;
    totalQuantity: number;
    totalValue?: number;
    avgEfficiency: number;
    userCount: number;
    avgActivitiesPerUser: number;
  }>;

  peakTimes: Array<{
    timeSlot: string;
    averageActivities: number;
    description: string;
    dayOfWeek?: string;
  }>;

  trends: {
    weeklyPattern: Array<{
      dayOfWeek: string;
      averageActivities: number;
      peakHour: string;
      totalQuantity: number;
    }>;

    monthlyGrowth: {
      currentMonth: number;
      previousMonth: number;
      growthRate: number;
      quantityGrowthRate: number;
    };

    seasonalPatterns?: Array<{
      season: string;
      averageActivities: number;
      pattern: "increasing" | "decreasing" | "stable";
    }>;
  };
}

// =====================
// Stock Metrics Types
// =====================

export interface StockMetrics {
  totalItems: number;
  totalValue: number;
  averageStockLevel: number;

  stockHealth: {
    healthy: number;
    lowStock: number;
    criticalStock: number;
    overstock: number;
    outOfStock: number;
  };

  stockDistribution: Array<{
    category: string;
    count: number;
    percentage: number;
    totalValue: number;
    avgStockLevel: number;
  }>;

  topItems: {
    byValue: Array<{
      itemId: string;
      itemName: string;
      value: number;
      quantity: number;
      unitPrice: number;
      categoryName?: string;
      brandName?: string;
    }>;

    byActivity: Array<{
      itemId: string;
      itemName: string;
      activityCount: number;
      totalQuantityMoved: number;
      lastActivityDate: Date;
    }>;

    byConsumption: Array<{
      itemId: string;
      itemName: string;
      consumptionRate: number;
      monthlyConsumption: number;
      projectedRunoutDate?: Date;
    }>;
  };

  riskAnalysis: {
    criticalItems: Array<{
      itemId: string;
      itemName: string;
      currentStock: number;
      minStock: number;
      riskLevel: "critical" | "high" | "medium" | "low";
      daysUntilStockout?: number;
      recommendedAction: string;
    }>;

    overstockItems: Array<{
      itemId: string;
      itemName: string;
      currentStock: number;
      maxStock: number;
      excessQuantity: number;
      tiedCapital: number;
    }>;
  };
}

// =====================
// Forecasting Types
// =====================

export interface ForecastingMetrics {
  period: STATISTICS_PERIOD;
  horizon: number; // days
  confidence: number; // percentage

  demandForecast: Array<{
    itemId: string;
    itemName: string;
    currentStock: number;
    forecastedDemand: number;
    recommendedOrder: number;
    predictedStockoutDate?: Date;
    seasonalityFactor?: number;
    trendFactor?: number;
  }>;

  aggregatedForecast: {
    totalForecastedDemand: number;
    totalRecommendedOrders: number;
    estimatedCost: number;
    riskLevel: "low" | "medium" | "high";
  };

  seasonality: Array<{
    period: string;
    factor: number;
    description: string;
  }>;

  trends: Array<{
    itemId: string;
    itemName: string;
    trend: "increasing" | "decreasing" | "stable";
    trendStrength: number;
    volatility: number;
  }>;
}

// =====================
// Performance Metrics Types
// =====================

export interface PerformanceMetrics {
  period: STATISTICS_PERIOD;

  stockTurnover: {
    overall: number;
    byCategory: Array<{
      categoryId: string;
      categoryName: string;
      turnoverRate: number;
      avgInventoryValue: number;
      costOfGoodsSold: number;
    }>;
  };

  orderPerformance: {
    averageLeadTime: number;
    orderAccuracy: number;
    onTimeDelivery: number;
    supplierPerformance: Array<{
      supplierId: string;
      supplierName: string;
      avgLeadTime: number;
      accuracy: number;
      onTimeRate: number;
      totalOrders: number;
    }>;
  };

  inventoryEfficiency: {
    stockoutRate: number;
    overstockRate: number;
    carryingCostPercentage: number;
    inventoryAccuracy: number;
    writeOffRate: number;
  };

  costAnalysis: {
    totalCarryingCost: number;
    totalOrderingCost: number;
    totalStockoutCost: number;
    costPerTransaction: number;
    costEfficiencyTrend: "improving" | "declining" | "stable";
  };
}

// =====================
// Consumption Statistics
// =====================

export interface ConsumptionStatistics {
  period: STATISTICS_PERIOD;
  groupBy: STATISTICS_GROUP_BY;
  metric: STATISTICS_METRIC;

  totalConsumption: {
    quantity: number;
    value: number;
    transactionCount: number;
    avgTransactionSize: number;
  };

  topConsumers: Array<{
    id: string;
    name: string;
    type: "user" | "sector" | "category" | "item";
    consumption: {
      quantity: number;
      value: number;
      percentage: number;
    };
    efficiency?: number;
    trend?: "increasing" | "decreasing" | "stable";
  }>;

  consumptionPatterns: {
    hourly: Array<{
      hour: number;
      avgConsumption: number;
      peakConsumption: number;
    }>;

    daily: Array<{
      dayOfWeek: string;
      avgConsumption: number;
      pattern: "high" | "medium" | "low";
    }>;

    monthly: Array<{
      month: string;
      totalConsumption: number;
      growthRate: number;
    }>;
  };

  insights: {
    mostActiveDay: string;
    mostActiveSector?: string;
    mostActiveUser?: string;
    peakHour: number;
    efficiency: {
      score: number;
      recommendations: string[];
    };
    trends: {
      direction: "up" | "down" | "stable";
      strength: number;
      confidence: number;
    };
  };
}

// =====================
// Response Types
// =====================

export interface ConsumptionChartResponse extends BaseGetUniqueResponse<ConsumptionChartData> {}

export interface ActivityAnalyticsResponse extends BaseGetUniqueResponse<ActivityAnalytics> {}

export interface StockMetricsResponse extends BaseGetUniqueResponse<StockMetrics> {}

export interface ForecastingMetricsResponse extends BaseGetUniqueResponse<ForecastingMetrics> {}

export interface PerformanceMetricsResponse extends BaseGetUniqueResponse<PerformanceMetrics> {}

export interface ConsumptionStatisticsResponse extends BaseGetUniqueResponse<ConsumptionStatistics> {}

// =====================
// Combined Analytics Dashboard
// =====================

export interface InventoryAnalyticsDashboard {
  overview: {
    totalItems: number;
    totalValue: number;
    healthScore: number;
    efficiencyScore: number;
    riskScore: number;
  };

  consumption: ConsumptionStatistics;
  activity: ActivityAnalytics;
  stock: StockMetrics;
  performance: PerformanceMetrics;
  forecasting: ForecastingMetrics;

  alerts: Array<{
    id: string;
    type: "critical" | "warning" | "info";
    title: string;
    description: string;
    actionRequired: boolean;
    relatedEntityId?: string;
    relatedEntityType?: string;
  }>;

  recommendations: Array<{
    id: string;
    priority: "high" | "medium" | "low";
    category: "stock" | "ordering" | "efficiency" | "cost";
    title: string;
    description: string;
    estimatedImpact?: string;
    estimatedCost?: number;
  }>;

  generatedAt: Date;
  filters: StatisticsFilter;
}

export interface InventoryAnalyticsDashboardResponse extends BaseGetUniqueResponse<InventoryAnalyticsDashboard> {}

// =====================
// Frontend-Specific Chart Types
// =====================

/**
 * Frontend chart options for visualization libraries (e.g., Recharts, Chart.js)
 */
export interface FrontendChartOptions {
  responsive: boolean;
  maintainAspectRatio: boolean;
  animation: {
    duration: number;
    easing: 'linear' | 'easeInQuad' | 'easeOutQuad' | 'easeInOutQuad';
  };
  plugins?: {
    legend?: {
      display: boolean;
      position: 'top' | 'bottom' | 'left' | 'right';
    };
    tooltip?: {
      enabled: boolean;
      mode: 'index' | 'dataset' | 'point' | 'nearest';
      intersect: boolean;
    };
  };
}

/**
 * Chart dimension configuration for responsive layouts
 */
export interface ChartDimensions {
  width: number | string;
  height: number | string;
  minWidth?: number;
  minHeight?: number;
  aspectRatio?: number;
}

/**
 * Time period selector options for statistics UI
 */
export interface TimePeriodSelector {
  value: STATISTICS_PERIOD;
  label: string;
  startDate?: Date;
  endDate?: Date;
  isCustom: boolean;
}

/**
 * Filter panel configuration for statistics UI
 */
export interface StatisticsFilterPanel {
  dateRange: {
    from: Date | null;
    to: Date | null;
  };
  period: STATISTICS_PERIOD;
  groupBy: STATISTICS_GROUP_BY | null;
  metric: STATISTICS_METRIC | null;
  chartType: CHART_TYPE;
  selectedCategories: string[];
  selectedBrands: string[];
  selectedSuppliers: string[];
  selectedUsers: string[];
  selectedSectors: string[];
  selectedItems: string[];
  activityReasons: ACTIVITY_REASON[];
  activityOperations: ACTIVITY_OPERATION[];
  minValue: number | null;
  maxValue: number | null;
}

/**
 * Statistics page state for UI management
 */
export interface StatisticsPageState {
  isLoading: boolean;
  error: string | null;
  filters: StatisticsFilterPanel;
  chartData: ConsumptionChartData | null;
  selectedView: 'chart' | 'table' | 'both';
  exportFormat: 'csv' | 'excel' | 'pdf' | 'png';
  lastUpdated: Date | null;
}

/**
 * Chart interaction events
 */
export interface ChartInteractionEvent {
  type: 'click' | 'hover' | 'zoom' | 'pan';
  dataPoint?: ConsumptionDataPoint;
  seriesIndex?: number;
  dataIndex?: number;
  value?: number;
  label?: string;
}

/**
 * Export configuration for charts and data
 */
export interface ExportConfiguration {
  format: 'csv' | 'excel' | 'pdf' | 'png' | 'svg' | 'json';
  includeCharts: boolean;
  includeData: boolean;
  includeFilters: boolean;
  includeSummary: boolean;
  fileName?: string;
  pageOrientation?: 'portrait' | 'landscape';
  pageSize?: 'a4' | 'letter' | 'legal';
}

/**
 * Dashboard widget configuration
 */
export interface DashboardWidget {
  id: string;
  type: 'chart' | 'metric' | 'table' | 'list';
  title: string;
  subtitle?: string;
  position: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
  config: {
    chartType?: CHART_TYPE;
    metric?: STATISTICS_METRIC;
    groupBy?: STATISTICS_GROUP_BY;
    period?: STATISTICS_PERIOD;
    refreshInterval?: number; // seconds
    showTrend?: boolean;
    showComparison?: boolean;
  };
  data?: any;
  isLoading?: boolean;
  error?: string | null;
}

/**
 * Real-time update subscription
 */
export interface StatisticsSubscription {
  id: string;
  entityType: string;
  filters: StatisticsFilter;
  onUpdate: (update: RealtimeStatisticsUpdate) => void;
  interval: number; // milliseconds
  isActive: boolean;
}

/**
 * Chart theme configuration
 */
export interface ChartTheme {
  name: string;
  colors: {
    primary: string[];
    secondary: string[];
    success: string;
    warning: string;
    danger: string;
    info: string;
  };
  fonts: {
    title: string;
    label: string;
    legend: string;
  };
  backgrounds: {
    chart: string;
    tooltip: string;
    legend: string;
  };
  borders: {
    color: string;
    width: number;
    radius: number;
  };
}

// =====================
// Utility Types for Frontend
// =====================

/**
 * Type guard for chart types
 */
export type ChartTypeGuard<T extends CHART_TYPE> = {
  is: (type: CHART_TYPE) => type is T;
};

/**
 * Mapped type for chart data by chart type
 */
export type ChartDataByType = {
  [CHART_TYPE.PIE]: { labels: string[]; values: number[]; colors?: string[] };
  [CHART_TYPE.DONUT]: { labels: string[]; values: number[]; colors?: string[]; innerRadius?: number };
  [CHART_TYPE.BAR]: { labels: string[]; datasets: Array<{ label: string; data: number[]; backgroundColor?: string }> };
  [CHART_TYPE.LINE]: { labels: string[]; datasets: Array<{ label: string; data: number[]; borderColor?: string }> };
  [CHART_TYPE.AREA]: { labels: string[]; datasets: Array<{ label: string; data: number[]; fill?: boolean }> };
  [CHART_TYPE.STACKED]: { labels: string[]; datasets: Array<{ label: string; data: number[]; stack?: string }> };
};

/**
 * Hook return type for statistics queries
 */
export interface UseStatisticsResult<T> {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  invalidate: () => void;
}

/**
 * Aggregated metric display
 */
export interface MetricCard {
  id: string;
  title: string;
  value: number | string;
  format: 'number' | 'currency' | 'percentage' | 'duration';
  trend?: {
    value: number;
    direction: 'up' | 'down' | 'stable';
    isPositive: boolean;
  };
  comparison?: {
    label: string;
    value: number;
    format: 'number' | 'currency' | 'percentage';
  };
  icon?: string;
  color?: string;
  onClick?: () => void;
}

/**
 * Data table configuration for statistics
 */
export interface StatisticsTableConfig {
  columns: Array<{
    key: string;
    label: string;
    type: 'text' | 'number' | 'currency' | 'percentage' | 'date';
    sortable: boolean;
    filterable: boolean;
    width?: number | string;
    format?: (value: any) => string;
  }>;
  data: any[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
  };
  sorting: {
    key: string;
    direction: 'asc' | 'desc';
  } | null;
  onSort?: (key: string) => void;
  onFilter?: (filters: Record<string, any>) => void;
  onPageChange?: (page: number) => void;
}

/**
 * Drill-down navigation for hierarchical data
 */
export interface DrillDownLevel {
  level: number;
  label: string;
  groupBy: STATISTICS_GROUP_BY;
  filters: Record<string, any>;
  data: ConsumptionDataPoint[];
}

/**
 * Comparison mode for period-over-period analysis
 */
export interface ComparisonMode {
  enabled: boolean;
  compareWith: 'previous-period' | 'previous-year' | 'custom';
  customPeriod?: {
    from: Date;
    to: Date;
  };
  showDifference: boolean;
  showPercentage: boolean;
}

/**
 * Alert/notification configuration for statistics thresholds
 */
export interface StatisticsAlert {
  id: string;
  name: string;
  description: string;
  metric: STATISTICS_METRIC;
  condition: 'above' | 'below' | 'equals' | 'between';
  threshold: number | [number, number];
  enabled: boolean;
  notificationChannels: ('email' | 'push' | 'sms')[];
  recipients: string[];
  frequency: 'immediate' | 'daily' | 'weekly';
}

/**
 * Saved report configuration
 */
export interface SavedReport {
  id: string;
  name: string;
  description?: string;
  type: 'chart' | 'table' | 'dashboard';
  filters: StatisticsFilter;
  chartConfig?: MultiSeriesChartConfig;
  schedule?: {
    enabled: boolean;
    frequency: 'daily' | 'weekly' | 'monthly';
    time: string; // HH:mm format
    recipients: string[];
  };
  createdBy: string;
  createdAt: Date;
  lastRun?: Date;
  isPublic: boolean;
  tags: string[];
}

// =====================
// Frontend Response Types
// =====================

/**
 * Response type for filtered statistics queries
 */
export interface FilteredStatisticsResponse<T> extends BaseGetUniqueResponse<T> {
  appliedFilters: StatisticsFilter;
  resultCount: number;
  executionTime: number; // milliseconds
}

/**
 * Response type for chart data with rendering hints
 */
export interface ChartDataResponse extends BaseGetUniqueResponse<ConsumptionChartData> {
  renderingHints?: {
    recommendedHeight: number;
    recommendedWidth: number;
    dataPointLimit: number;
    suggestedChartTypes: CHART_TYPE[];
  };
}