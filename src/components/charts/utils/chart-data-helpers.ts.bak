/**
 * Chart Data Helpers
 * Provides utility functions for data transformation and calculations
 */

import { startOfDay, startOfWeek, startOfMonth, startOfYear, addDays, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export type Period = 'day' | 'week' | 'month' | 'quarter' | 'year';

export interface DataPoint {
  date?: Date | string;
  value: number;
  [key: string]: any;
}

export interface AggregatedData {
  period: string;
  value: number;
  count: number;
  [key: string]: any;
}

/**
 * Aggregate data by time period
 */
export function aggregateByPeriod(
  data: DataPoint[],
  period: Period,
  dateKey: string = 'date',
  valueKey: string = 'value',
  aggregation: 'sum' | 'average' | 'count' | 'min' | 'max' = 'sum'
): AggregatedData[] {
  const grouped = new Map<string, number[]>();

  data.forEach(item => {
    const date = new Date(item[dateKey]);
    let periodKey: string;

    switch (period) {
      case 'day':
        periodKey = format(startOfDay(date), 'yyyy-MM-dd');
        break;
      case 'week':
        periodKey = format(startOfWeek(date, { locale: ptBR }), 'yyyy-MM-dd');
        break;
      case 'month':
        periodKey = format(startOfMonth(date), 'yyyy-MM');
        break;
      case 'year':
        periodKey = format(startOfYear(date), 'yyyy');
        break;
      default:
        periodKey = format(date, 'yyyy-MM-dd');
    }

    if (!grouped.has(periodKey)) {
      grouped.set(periodKey, []);
    }
    grouped.get(periodKey)!.push(item[valueKey]);
  });

  return Array.from(grouped.entries()).map(([period, values]) => {
    let value: number;

    switch (aggregation) {
      case 'sum':
        value = values.reduce((sum, v) => sum + v, 0);
        break;
      case 'average':
        value = values.reduce((sum, v) => sum + v, 0) / values.length;
        break;
      case 'count':
        value = values.length;
        break;
      case 'min':
        value = Math.min(...values);
        break;
      case 'max':
        value = Math.max(...values);
        break;
      default:
        value = values.reduce((sum, v) => sum + v, 0);
    }

    return {
      period,
      value,
      count: values.length,
    };
  }).sort((a, b) => a.period.localeCompare(b.period));
}

/**
 * Calculate moving average
 */
export function calculateMovingAverage(
  data: DataPoint[],
  windowSize: number,
  valueKey: string = 'value'
): DataPoint[] {
  if (windowSize <= 0 || windowSize > data.length) {
    return data;
  }

  return data.map((item, index) => {
    const start = Math.max(0, index - windowSize + 1);
    const window = data.slice(start, index + 1);
    const average = window.reduce((sum, d) => sum + d[valueKey], 0) / window.length;

    return {
      ...item,
      movingAverage: average,
    };
  });
}

/**
 * Calculate percentage change
 */
export function calculatePercentChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

/**
 * Calculate trend direction
 */
export function calculateTrend(
  data: DataPoint[],
  valueKey: string = 'value'
): 'up' | 'down' | 'stable' {
  if (data.length < 2) return 'stable';

  const firstHalf = data.slice(0, Math.floor(data.length / 2));
  const secondHalf = data.slice(Math.floor(data.length / 2));

  const firstAvg = firstHalf.reduce((sum, d) => sum + d[valueKey], 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((sum, d) => sum + d[valueKey], 0) / secondHalf.length;

  const changePercent = calculatePercentChange(secondAvg, firstAvg);

  if (Math.abs(changePercent) < 5) return 'stable';
  return changePercent > 0 ? 'up' : 'down';
}

/**
 * Calculate linear regression for trend line
 */
export function calculateLinearRegression(
  data: DataPoint[],
  valueKey: string = 'value'
): { slope: number; intercept: number; predict: (x: number) => number } {
  const n = data.length;
  const sumX = data.reduce((sum, _, i) => sum + i, 0);
  const sumY = data.reduce((sum, d) => sum + d[valueKey], 0);
  const sumXY = data.reduce((sum, d, i) => sum + i * d[valueKey], 0);
  const sumX2 = data.reduce((sum, _, i) => sum + i * i, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  return {
    slope,
    intercept,
    predict: (x: number) => slope * x + intercept,
  };
}

/**
 * Fill missing dates in time series
 */
export function fillMissingDates(
  data: DataPoint[],
  dateKey: string = 'date',
  fillValue: number = 0
): DataPoint[] {
  if (data.length === 0) return [];

  const sorted = [...data].sort((a, b) =>
    new Date(a[dateKey]).getTime() - new Date(b[dateKey]).getTime()
  );

  const start = new Date(sorted[0][dateKey]);
  const end = new Date(sorted[sorted.length - 1][dateKey]);
  const existing = new Map(sorted.map(d => [
    format(new Date(d[dateKey]), 'yyyy-MM-dd'),
    d
  ]));

  const filled: DataPoint[] = [];
  let current = start;

  while (current <= end) {
    const key = format(current, 'yyyy-MM-dd');
    if (existing.has(key)) {
      filled.push(existing.get(key)!);
    } else {
      filled.push({
        [dateKey]: current,
        value: fillValue,
      });
    }
    current = addDays(current, 1);
  }

  return filled;
}

/**
 * Calculate cumulative sum
 */
export function calculateCumulativeSum(
  data: DataPoint[],
  valueKey: string = 'value'
): DataPoint[] {
  let cumSum = 0;

  return data.map(item => {
    cumSum += item[valueKey];
    return {
      ...item,
      cumulativeSum: cumSum,
    };
  });
}

/**
 * Normalize data to 0-100 scale
 */
export function normalizeData(
  data: DataPoint[],
  valueKey: string = 'value'
): DataPoint[] {
  const values = data.map(d => d[valueKey]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;

  if (range === 0) {
    return data.map(item => ({ ...item, normalized: 50 }));
  }

  return data.map(item => ({
    ...item,
    normalized: ((item[valueKey] - min) / range) * 100,
  }));
}

/**
 * Group data by category
 */
export function groupByCategory<T extends Record<string, any>>(
  data: T[],
  categoryKey: string,
  valueKey: string = 'value',
  aggregation: 'sum' | 'average' | 'count' = 'sum'
): { category: string; value: number; count: number; items: T[] }[] {
  const grouped = new Map<string, T[]>();

  data.forEach(item => {
    const category = String(item[categoryKey]);
    if (!grouped.has(category)) {
      grouped.set(category, []);
    }
    grouped.get(category)!.push(item);
  });

  return Array.from(grouped.entries()).map(([category, items]) => {
    const values = items.map(item => item[valueKey] || 0);
    let value: number;

    switch (aggregation) {
      case 'sum':
        value = values.reduce((sum, v) => sum + v, 0);
        break;
      case 'average':
        value = values.reduce((sum, v) => sum + v, 0) / values.length;
        break;
      case 'count':
        value = values.length;
        break;
      default:
        value = values.reduce((sum, v) => sum + v, 0);
    }

    return {
      category,
      value,
      count: items.length,
      items,
    };
  }).sort((a, b) => b.value - a.value);
}

/**
 * Calculate percentiles
 */
export function calculatePercentile(
  data: number[],
  percentile: number
): number {
  const sorted = [...data].sort((a, b) => a - b);
  const index = (percentile / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index % 1;

  if (lower === upper) {
    return sorted[lower];
  }

  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

/**
 * Calculate statistical summary
 */
export function calculateSummary(
  data: DataPoint[],
  valueKey: string = 'value'
): {
  count: number;
  sum: number;
  mean: number;
  median: number;
  min: number;
  max: number;
  stdDev: number;
  p25: number;
  p75: number;
} {
  const values = data.map(d => d[valueKey]);
  const count = values.length;
  const sum = values.reduce((s, v) => s + v, 0);
  const mean = sum / count;

  const sortedValues = [...values].sort((a, b) => a - b);
  const median = count % 2 === 0
    ? (sortedValues[count / 2 - 1] + sortedValues[count / 2]) / 2
    : sortedValues[Math.floor(count / 2)];

  const variance = values.reduce((v, val) => v + Math.pow(val - mean, 2), 0) / count;
  const stdDev = Math.sqrt(variance);

  return {
    count,
    sum,
    mean,
    median,
    min: Math.min(...values),
    max: Math.max(...values),
    stdDev,
    p25: calculatePercentile(values, 25),
    p75: calculatePercentile(values, 75),
  };
}

/**
 * Calculate year-over-year growth
 */
export function calculateYoYGrowth(
  currentPeriod: DataPoint[],
  previousPeriod: DataPoint[],
  valueKey: string = 'value'
): number {
  const currentSum = currentPeriod.reduce((sum, d) => sum + d[valueKey], 0);
  const previousSum = previousPeriod.reduce((sum, d) => sum + d[valueKey], 0);

  return calculatePercentChange(currentSum, previousSum);
}

/**
 * Top N items
 */
export function getTopN<T extends Record<string, any>>(
  data: T[],
  n: number,
  valueKey: string = 'value',
  includeOthers: boolean = true
): T[] {
  const sorted = [...data].sort((a, b) => b[valueKey] - a[valueKey]);
  const top = sorted.slice(0, n);

  if (includeOthers && sorted.length > n) {
    const others = sorted.slice(n);
    const othersSum = others.reduce((sum, item) => sum + item[valueKey], 0);

    return [
      ...top,
      {
        name: 'Outros',
        [valueKey]: othersSum,
        isOthers: true,
      } as T,
    ];
  }

  return top;
}

/**
 * Convert data to percentage of total
 */
export function convertToPercentage(
  data: DataPoint[],
  valueKey: string = 'value'
): DataPoint[] {
  const total = data.reduce((sum, d) => sum + d[valueKey], 0);

  if (total === 0) {
    return data.map(item => ({ ...item, percentage: 0 }));
  }

  return data.map(item => ({
    ...item,
    percentage: (item[valueKey] / total) * 100,
  }));
}
