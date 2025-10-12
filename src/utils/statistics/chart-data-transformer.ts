/**
 * Chart Data Transformer
 * Transforms API responses into chart-ready formats for various visualization libraries
 */

import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Chart.js format
export interface ChartJSData {
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    backgroundColor?: string | string[];
    borderColor?: string | string[];
    borderWidth?: number;
  }>;
}

// Recharts format
export interface RechartsData {
  name: string;
  [key: string]: string | number;
}[]

// Simple data point
export interface DataPoint {
  label: string;
  value: number;
  color?: string;
  metadata?: Record<string, any>;
}

/**
 * Transform array data to Chart.js format
 */
export const toChartJS = (
  dataPoints: Array<{ label: string; value: number }>,
  options: {
    datasetLabel?: string;
    backgroundColor?: string | string[];
    borderColor?: string | string[];
  } = {}
): ChartJSData => {
  return {
    labels: dataPoints.map((d) => d.label),
    datasets: [
      {
        label: options.datasetLabel || 'Dados',
        data: dataPoints.map((d) => d.value),
        backgroundColor: options.backgroundColor,
        borderColor: options.borderColor,
        borderWidth: 1,
      },
    ],
  };
};

/**
 * Transform to Recharts format
 */
export const toRecharts = (
  dataPoints: Array<{ label: string; value: number }>,
  valueKey: string = 'value'
): RechartsData => {
  return dataPoints.map((d) => ({
    name: d.label,
    [valueKey]: d.value,
  }));
};

/**
 * Transform time series data
 */
export const transformTimeSeries = (
  data: Array<{ date: string; [key: string]: any }>,
  dateFormat: string = 'dd/MM'
): RechartsData => {
  return data.map((item) => ({
    ...item,
    date: format(new Date(item.date), dateFormat, { locale: ptBR }),
  }));
};

/**
 * Calculate percentage distribution
 */
export const calculatePercentages = (
  data: Array<{ label: string; value: number }>
): Array<{ label: string; value: number; percentage: number }> => {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return data.map((item) => ({
    ...item,
    percentage: total > 0 ? (item.value / total) * 100 : 0,
  }));
};

/**
 * Group data by key
 */
export const groupBy = <T extends Record<string, any>>(
  data: T[],
  key: keyof T
): Record<string, T[]> => {
  return data.reduce((groups, item) => {
    const groupKey = String(item[key]);
    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    groups[groupKey].push(item);
    return groups;
  }, {} as Record<string, T[]>);
};

/**
 * Aggregate data by key with sum
 */
export const aggregateSum = (
  data: Array<Record<string, any>>,
  groupKey: string,
  valueKey: string
): Array<{ label: string; value: number }> => {
  const grouped = groupBy(data, groupKey);

  return Object.entries(grouped).map(([label, items]) => ({
    label,
    value: items.reduce((sum, item) => sum + (Number(item[valueKey]) || 0), 0),
  }));
};

/**
 * Top N items
 */
export const topN = <T extends { value: number }>(
  data: T[],
  n: number,
  includeOthers: boolean = true
): T[] => {
  const sorted = [...data].sort((a, b) => b.value - a.value);

  if (!includeOthers || sorted.length <= n) {
    return sorted.slice(0, n);
  }

  const topItems = sorted.slice(0, n);
  const others = sorted.slice(n);
  const othersSum = others.reduce((sum, item) => sum + item.value, 0);

  if (othersSum > 0) {
    return [
      ...topItems,
      {
        ...topItems[0],
        label: 'Outros',
        value: othersSum,
      } as T,
    ];
  }

  return topItems;
};

/**
 * Fill missing dates in time series
 */
export const fillMissingDates = (
  data: Array<{ date: string; value: number }>,
  dateRange: { from: Date; to: Date },
  defaultValue: number = 0
): Array<{ date: string; value: number }> => {
  const dataMap = new Map(data.map((item) => [item.date, item.value]));
  const result: Array<{ date: string; value: number }> = [];

  let currentDate = new Date(dateRange.from);
  const endDate = new Date(dateRange.to);

  while (currentDate <= endDate) {
    const dateStr = format(currentDate, 'yyyy-MM-dd');
    result.push({
      date: dateStr,
      value: dataMap.get(dateStr) || defaultValue,
    });
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return result;
};

/**
 * Calculate moving average
 */
export const calculateMovingAverage = (
  data: number[],
  windowSize: number
): number[] => {
  const result: number[] = [];

  for (let i = 0; i < data.length; i++) {
    const start = Math.max(0, i - windowSize + 1);
    const window = data.slice(start, i + 1);
    const average = window.reduce((sum, val) => sum + val, 0) / window.length;
    result.push(average);
  }

  return result;
};

/**
 * Calculate trend (simple linear regression)
 */
export const calculateTrend = (
  data: number[]
): { slope: number; intercept: number; direction: 'up' | 'down' | 'stable' } => {
  const n = data.length;
  if (n < 2) {
    return { slope: 0, intercept: 0, direction: 'stable' };
  }

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;

  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += data[i];
    sumXY += i * data[i];
    sumX2 += i * i;
  }

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  let direction: 'up' | 'down' | 'stable' = 'stable';
  if (Math.abs(slope) > 0.01) {
    direction = slope > 0 ? 'up' : 'down';
  }

  return { slope, intercept, direction };
};

/**
 * Normalize data to 0-100 scale
 */
export const normalizeData = (data: number[]): number[] => {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min;

  if (range === 0) {
    return data.map(() => 50);
  }

  return data.map((value) => ((value - min) / range) * 100);
};

/**
 * Format value for display
 */
export const formatValue = (
  value: number,
  type: 'number' | 'currency' | 'percentage' = 'number'
): string => {
  switch (type) {
    case 'currency':
      return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    case 'percentage':
      return `${value.toFixed(1)}%`;
    case 'number':
    default:
      return value.toLocaleString('pt-BR');
  }
};

/**
 * Generate color palette
 */
export const generateColorPalette = (count: number, baseHue: number = 210): string[] => {
  const colors: string[] = [];
  const saturation = 70;
  const lightness = 50;

  for (let i = 0; i < count; i++) {
    const hue = (baseHue + (i * 360) / count) % 360;
    colors.push(`hsl(${hue}, ${saturation}%, ${lightness}%)`);
  }

  return colors;
};

/**
 * Export data as CSV
 */
export const exportToCSV = (
  data: Array<Record<string, any>>,
  filename: string = 'data.csv'
): void => {
  if (data.length === 0) return;

  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map((row) => headers.map((header) => JSON.stringify(row[header] ?? '')).join(',')),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
};
