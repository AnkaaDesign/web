/**
 * Chart Data Formatters
 * Provides consistent formatting for different data types
 */

import { format, parseISO, formatDistance } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getPricingVisible } from "@/utils/pricing-visibility";

/**
 * One decimal at most, in pt-BR, with no trailing zero.
 *
 * The compact/duration formats used `toFixed`, which ALWAYS emits a dot — so a Brazilian screen
 * showed "1.5K" and "1d 3.0h" right next to the "R$ 1.234,56" that `Intl.NumberFormat('pt-BR')`
 * produces three lines above. `maximumFractionDigits: 1` with `minimumFractionDigits: 0` also
 * drops the ".0" that `toFixed(1)` left on whole values.
 */
const compactDecimal = (value: number): string =>
  new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
    // No thousand separator: the K/M/B suffix IS the grouping, and 999_999 rounds up to 1000 in
    // the K branch — "1.000K" next to "1M" would read as a different magnitude entirely.
    useGrouping: false,
  }).format(value);

/**
 * Format currency values
 */
export function formatCurrency(value: number, options?: {
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  compact?: boolean;
}): string {
  if (!getPricingVisible()) return "R$ ••••••";
  const {
    minimumFractionDigits = 2,
    maximumFractionDigits = 2,
    compact = false,
  } = options || {};

  if (compact && Math.abs(value) >= 1000) {
    return formatCompactCurrency(value);
  }

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(value);
}

/**
 * Format compact currency (e.g., 1.5K, 2.3M)
 */
export function formatCompactCurrency(value: number): string {
  if (!getPricingVisible()) return "R$ ••••";
  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (absValue >= 1_000_000_000) {
    return `${sign}R$ ${compactDecimal(absValue / 1_000_000_000)}B`;
  }
  if (absValue >= 1_000_000) {
    return `${sign}R$ ${compactDecimal(absValue / 1_000_000)}M`;
  }
  if (absValue >= 1_000) {
    return `${sign}R$ ${compactDecimal(absValue / 1_000)}K`;
  }

  return formatCurrency(value);
}

/**
 * Format percentage values
 */
export function formatPercentage(value: number, options?: {
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  multiplier?: number;
}): string {
  const {
    minimumFractionDigits = 2,
    maximumFractionDigits = 2,
    multiplier = 100, // Use 100 if value is in decimal form (0.15 -> 15%)
  } = options || {};

  const displayValue = value * multiplier;

  return new Intl.NumberFormat('pt-BR', {
    style: 'percent',
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(displayValue / 100);
}

/**
 * Format number values
 */
export function formatNumber(value: number, optionsOrDecimals?: number | {
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  compact?: boolean;
  unit?: string;
}): string {
  // Handle legacy signature: formatNumber(value, decimals)
  let options: {
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
    compact?: boolean;
    unit?: string;
  } = {};

  if (typeof optionsOrDecimals === 'number') {
    options = {
      minimumFractionDigits: optionsOrDecimals,
      maximumFractionDigits: optionsOrDecimals,
    };
  } else if (optionsOrDecimals) {
    options = optionsOrDecimals;
  }

  const {
    minimumFractionDigits = 0,
    maximumFractionDigits = 2,
    compact = false,
    unit = '',
  } = options;

  if (compact && Math.abs(value) >= 1000) {
    return formatCompactNumber(value) + (unit ? ` ${unit}` : '');
  }

  const formatted = new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(value);

  return unit ? `${formatted} ${unit}` : formatted;
}

/**
 * Format compact numbers (e.g., 1.5K, 2.3M)
 */
export function formatCompactNumber(value: number): string {
  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (absValue >= 1_000_000_000) {
    return `${sign}${compactDecimal(absValue / 1_000_000_000)}B`;
  }
  if (absValue >= 1_000_000) {
    return `${sign}${compactDecimal(absValue / 1_000_000)}M`;
  }
  if (absValue >= 1_000) {
    return `${sign}${compactDecimal(absValue / 1_000)}K`;
  }

  return value.toString();
}

/**
 * Format date values
 */
export function formatDate(date: Date | string | number, pattern: string = 'dd/MM/yyyy'): string {
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : new Date(date);
    return format(dateObj, pattern, { locale: ptBR });
  } catch (error) {
    return 'Data inválida';
  }
}

/**
 * Format date for axis labels (shorter format)
 */
export function formatAxisDate(date: Date | string | number, granularity: 'day' | 'week' | 'month' | 'year' = 'day'): string {
  const patterns = {
    day: 'dd/MM',
    week: 'dd/MM',
    month: 'MMM/yy',
    year: 'yyyy',
  };

  return formatDate(date, patterns[granularity]);
}

/**
 * Format relative date (e.g., "2 days ago")
 */
export function formatRelativeDate(date: Date | string | number): string {
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : new Date(date);
    return formatDistance(dateObj, new Date(), { addSuffix: true, locale: ptBR });
  } catch (error) {
    return 'Data inválida';
  }
}

/**
 * Format time duration in hours
 */
export function formatDuration(hours: number): string {
  if (hours === 0) {
    return '0h';
  }
  if (hours < 1) {
    return `${Math.round(hours * 60)} min`;
  }
  if (hours < 24) {
    return `${compactDecimal(hours)}h`;
  }

  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;

  if (remainingHours === 0) {
    return `${days}d`;
  }

  return `${days}d ${compactDecimal(remainingHours)}h`;
}

/**
 * Format file size
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Format quantity with unit
 */
export function formatQuantity(value: number, unit: string, options?: {
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
}): string {
  const formatted = formatNumber(value, options);
  return `${formatted} ${unit}`;
}

/**
 * Format change value with sign
 */
export function formatChange(value: number, format: 'number' | 'percentage' | 'currency' = 'number'): string {
  const sign = value > 0 ? '+' : '';

  switch (format) {
    case 'currency':
      return sign + formatCurrency(value);
    case 'percentage':
      return sign + formatPercentage(value);
    default:
      return sign + formatNumber(value);
  }
}

/**
 * Format large number with abbreviation
 */
export function formatLargeNumber(value: number): string {
  return formatCompactNumber(value);
}

/**
 * Format decimal to percentage
 */
export function formatDecimalAsPercentage(decimal: number, fractionDigits: number = 1): string {
  return formatPercentage(decimal, { multiplier: 100, maximumFractionDigits: fractionDigits });
}

/**
 * Format axis label based on value type
 */
export function formatAxisLabel(
  value: number | string,
  type: 'number' | 'currency' | 'percentage' | 'date' = 'number'
): string {
  if (typeof value === 'string') return value;

  switch (type) {
    case 'currency':
      return formatCompactCurrency(value);
    case 'percentage':
      return formatPercentage(value);
    case 'number':
      return formatCompactNumber(value);
    default:
      return value.toString();
  }
}

/**
 * Format tooltip value based on type
 */
export function formatTooltipValue(
  value: number,
  type: 'number' | 'currency' | 'percentage' | 'duration' = 'number',
  unit?: string
): string {
  switch (type) {
    case 'currency':
      return formatCurrency(value);
    case 'percentage':
      return formatPercentage(value);
    case 'duration':
      return formatDuration(value);
    case 'number':
      return formatNumber(value, { unit });
    default:
      return value.toString();
  }
}

/**
 * Create a custom formatter function
 */
export function createFormatter(
  type: 'number' | 'currency' | 'percentage' | 'date' | 'duration',
  options?: Record<string, any>
): (value: any) => string {
  return (value: any) => {
    switch (type) {
      case 'currency':
        return formatCurrency(value, options);
      case 'percentage':
        return formatPercentage(value, options);
      case 'date':
        return formatDate(value, options?.pattern);
      case 'duration':
        return formatDuration(value);
      case 'number':
        return formatNumber(value, options);
      default:
        return String(value);
    }
  };
}
