/**
 * Chart Configuration System
 *
 * Comprehensive type definitions and builders for configurable charts.
 * Supports multiple chart types, dynamic data sources, and advanced features.
 */

// ============================================================================
// Core Types
// ============================================================================

export type ChartType =
  | 'line'
  | 'bar'
  | 'pie'
  | 'area'
  | 'scatter'
  | 'heatmap'
  | 'funnel'
  | 'combo'
  | 'radar'
  | 'treemap'
  | 'gauge';

export type ChartLibrary = 'recharts' | 'echarts';

export type AggregationType = 'sum' | 'avg' | 'count' | 'min' | 'max' | 'median' | 'percentile';

export type DataSourceType = 'api' | 'static' | 'realtime' | 'computed';

export type FilterOperator =
  | 'equals'
  | 'notEquals'
  | 'contains'
  | 'notContains'
  | 'greaterThan'
  | 'lessThan'
  | 'between'
  | 'in'
  | 'notIn';

// ============================================================================
// Configuration Interfaces
// ============================================================================

export interface AxisConfig {
  label?: string;
  dataKey?: string;
  type?: 'number' | 'category' | 'time';
  domain?: [number | string | 'auto' | 'dataMin' | 'dataMax', number | string | 'auto' | 'dataMin' | 'dataMax'];
  tickFormatter?: (value: any) => string;
  scale?: 'auto' | 'linear' | 'pow' | 'sqrt' | 'log' | 'time';
  allowDecimals?: boolean;
  allowDataOverflow?: boolean;
  hide?: boolean;
  position?: 'left' | 'right' | 'top' | 'bottom';
  unit?: string;
  minTickGap?: number;
  reversed?: boolean;
}

export interface SeriesConfig {
  name: string;
  dataKey: string;
  type?: ChartType;
  color?: string;
  stackId?: string;
  yAxisId?: string;
  hide?: boolean;
  label?: {
    show?: boolean;
    position?: string;
    formatter?: (value: any) => string;
  };
  lineStyle?: {
    width?: number;
    type?: 'solid' | 'dashed' | 'dotted';
  };
  areaStyle?: {
    opacity?: number;
  };
  aggregation?: AggregationType;
  valueFormatter?: (value: any) => string;
}

export interface LegendConfig {
  show?: boolean;
  position?: 'top' | 'bottom' | 'left' | 'right';
  align?: 'start' | 'center' | 'end';
  layout?: 'horizontal' | 'vertical';
  interactive?: boolean;
  formatter?: (value: string) => string;
}

export interface TooltipConfig {
  show?: boolean;
  shared?: boolean;
  trigger?: 'item' | 'axis';
  formatter?: (data: any) => string | React.ReactNode;
  labelFormatter?: (label: any) => string;
  valueFormatter?: (value: any, name: string) => string;
}

export interface FilterConfig {
  field: string;
  label: string;
  operator: FilterOperator;
  value: any;
  type?: 'text' | 'number' | 'date' | 'select' | 'multiselect';
  options?: Array<{ label: string; value: any }>;
}

export interface GroupByConfig {
  field: string;
  aggregations: Array<{
    field: string;
    type: AggregationType;
    alias?: string;
  }>;
}

export interface DataSourceConfig {
  type: DataSourceType;
  endpoint?: string;
  params?: Record<string, any>;
  transform?: string;
  cache?: {
    enabled: boolean;
    ttl?: number; // Time to live in seconds
  };
}

export interface ExportConfig {
  enabled: boolean;
  formats: Array<'png' | 'svg' | 'pdf' | 'csv' | 'excel'>;
  filename?: string;
}

export interface InteractionConfig {
  zoom?: {
    enabled: boolean;
    type?: 'x' | 'y' | 'xy';
  };
  pan?: {
    enabled: boolean;
  };
  brush?: {
    enabled: boolean;
  };
  drillDown?: {
    enabled: boolean;
    targetConfig?: string; // Reference to another chart config
  };
}

export interface StyleConfig {
  colors?: string[];
  theme?: 'light' | 'dark' | 'auto';
  backgroundColor?: string;
  fontFamily?: string;
  grid?: {
    show?: boolean;
    left?: string | number;
    right?: string | number;
    top?: string | number;
    bottom?: string | number;
  };
  padding?: {
    top?: number;
    right?: number;
    bottom?: number;
    left?: number;
  };
}

// ============================================================================
// Main Configuration Interface
// ============================================================================

export interface ChartConfiguration {
  // Identification
  id: string;
  type: ChartType;
  library?: ChartLibrary;

  // Metadata
  title: string;
  description?: string;
  category?: string;
  tags?: string[];

  // Data
  dataSource: DataSourceConfig;

  // Axes
  xAxis?: AxisConfig;
  yAxis?: AxisConfig;
  secondaryYAxis?: AxisConfig;

  // Series
  series: SeriesConfig[];

  // Visual
  style?: StyleConfig;
  legend?: LegendConfig;
  tooltip?: TooltipConfig;

  // Data Processing
  filters?: FilterConfig[];
  groupBy?: GroupByConfig;

  // Features
  refreshInterval?: number; // in milliseconds
  export?: ExportConfig;
  interaction?: InteractionConfig;

  // Display Options
  responsive?: boolean;
  aspectRatio?: number;
  height?: number | string;
  width?: number | string;

  // States
  loading?: {
    message?: string;
  };
  empty?: {
    message?: string;
    action?: {
      label: string;
      onClick: () => void;
    };
  };
  error?: {
    message?: string;
    retry?: () => void;
  };
}

// ============================================================================
// Configuration Builders
// ============================================================================

export const createChartConfig = (options: Partial<ChartConfiguration> & Pick<ChartConfiguration, 'id' | 'type' | 'title' | 'dataSource'>): ChartConfiguration => {
  return {
    // Defaults
    library: options.type === 'heatmap' || options.type === 'funnel' || options.type === 'gauge' ? 'echarts' : 'recharts',
    series: [],
    responsive: true,
    aspectRatio: 16 / 9,
    legend: {
      show: true,
      position: 'bottom',
      align: 'center',
      layout: 'horizontal',
      interactive: true,
    },
    tooltip: {
      show: true,
      shared: true,
      trigger: 'axis',
    },
    export: {
      enabled: true,
      formats: ['png', 'csv'],
    },
    interaction: {
      zoom: { enabled: false },
      pan: { enabled: false },
      brush: { enabled: false },
      drillDown: { enabled: false },
    },
    style: {
      theme: 'auto',
      grid: {
        show: true,
        left: '3%',
        right: '4%',
        bottom: '3%',
        top: '10%',
      },
    },
    // Merge with provided options
    ...options,
  };
};

export const createSeriesConfig = (options: Omit<SeriesConfig, 'dataKey' | 'name'> & { name: string; dataKey: string }): SeriesConfig => {
  return {
    hide: false,
    label: {
      show: false,
    },
    ...options,
  };
};

export const createAxisConfig = (options: Partial<AxisConfig> = {}): AxisConfig => {
  return {
    type: 'category',
    allowDecimals: true,
    allowDataOverflow: false,
    hide: false,
    scale: 'auto',
    ...options,
  };
};

export const createFilterConfig = (
  field: string,
  operator: FilterOperator,
  value: any,
  options: Partial<Omit<FilterConfig, 'field' | 'operator' | 'value'>> = {}
): FilterConfig => {
  return {
    field,
    operator,
    value,
    label: options.label || field,
    type: options.type || 'text',
    ...options,
  };
};

export const createDataSourceConfig = (
  type: DataSourceType,
  options: Partial<Omit<DataSourceConfig, 'type'>> = {}
): DataSourceConfig => {
  return {
    type,
    cache: {
      enabled: true,
      ttl: 300, // 5 minutes default
    },
    ...options,
  };
};

// ============================================================================
// Utility Functions
// ============================================================================

export const serializeChartConfig = (config: ChartConfiguration): string => {
  return JSON.stringify(config, null, 2);
};

export const deserializeChartConfig = (json: string): ChartConfiguration => {
  return JSON.parse(json);
};

export const cloneChartConfig = (config: ChartConfiguration): ChartConfiguration => {
  return JSON.parse(JSON.stringify(config));
};

export const mergeChartConfigs = (base: ChartConfiguration, override: Partial<ChartConfiguration>): ChartConfiguration => {
  return {
    ...base,
    ...override,
    style: {
      ...base.style,
      ...override.style,
    },
    legend: {
      ...base.legend,
      ...override.legend,
    },
    tooltip: {
      ...base.tooltip,
      ...override.tooltip,
    },
    export: {
      ...base.export,
      ...override.export,
    },
    interaction: {
      ...base.interaction,
      ...override.interaction,
    },
  };
};

// ============================================================================
// Validation
// ============================================================================

export const validateChartConfig = (config: ChartConfiguration): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!config.id) {
    errors.push('Chart ID is required');
  }

  if (!config.type) {
    errors.push('Chart type is required');
  }

  if (!config.title) {
    errors.push('Chart title is required');
  }

  if (!config.dataSource) {
    errors.push('Data source is required');
  }

  if (!config.series || config.series.length === 0) {
    errors.push('At least one series is required');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

// ============================================================================
// Type Guards
// ============================================================================

export const isTimeSeriesChart = (type: ChartType): boolean => {
  return ['line', 'area'].includes(type);
};

export const isCategoricalChart = (type: ChartType): boolean => {
  return ['bar', 'pie', 'funnel'].includes(type);
};

export const supportsMultipleSeries = (type: ChartType): boolean => {
  return ['line', 'bar', 'area', 'scatter', 'combo', 'radar'].includes(type);
};

export const supportsStacking = (type: ChartType): boolean => {
  return ['bar', 'area'].includes(type);
};

export const requiresECharts = (type: ChartType): boolean => {
  return ['heatmap', 'funnel', 'treemap', 'gauge', 'radar'].includes(type);
};
