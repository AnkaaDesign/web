// Shared types for all statistics pages
import { formatCurrency, formatCurrencyCompact } from "@/utils/number";
export { formatCurrency, formatCurrencyCompact };

export type StatisticsChartType = 'bar' | 'line' | 'line-smooth' | 'area' | 'area-smooth' | 'pie' | 'bar-stacked' | 'line-stacked';

export type TrendLineType = 'linear' | 'sma3' | 'sma6' | 'sma12';

export type YAxisMode = 'quantity' | 'value' | 'days' | 'percentage' | 'count' | 'both';

export type ComparisonType = 'simple' | 'sectors' | 'users' | 'periods' | 'customers' | 'garages' | 'paintTypes' | 'paintBrands';

export interface StatisticsSummaryCardData {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  trend?: 'up' | 'down' | 'stable';
  trendValue?: number;
  subtitle?: string;
}

export interface StatisticsFilterBase {
  startDate: Date;
  endDate: Date;
  periods?: StatisticsPeriod[];
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  limit: number;
}

export interface StatisticsPeriod {
  id: string;
  label: string;
  startDate: Date;
  endDate: Date;
}

export interface StatisticsChartTypeOption {
  value: StatisticsChartType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

export interface StatisticsDataItem {
  id: string;
  name: string;
  [key: string]: any;
}

export interface StatisticsComparison {
  entityId: string;
  entityName: string;
  value: number;
  secondaryValue?: number;
  percentage: number;
}

export interface StatisticsResponse<T = any> {
  success: boolean;
  message: string;
  data: {
    mode: string;
    items: T[];
    summary: Record<string, number>;
    pagination: {
      hasMore: boolean;
      offset: number;
      limit: number;
      total: number;
    };
  };
}

// Chart color palette (consistent across all statistics)
export const CHART_COLORS = [
  '#3b82f6', // blue-500
  '#ef4444', // red-500
  '#10b981', // emerald-500
  '#f59e0b', // amber-500
  '#8b5cf6', // violet-500
  '#06b6d4', // cyan-500
  '#f97316', // orange-500
  '#84cc16', // lime-500
  '#ec4899', // pink-500
  '#14b8a6', // teal-500
  '#6366f1', // indigo-500
  '#e879f9', // fuchsia-400
];

// Stable color for the Nth series/bar. Indexes into CHART_COLORS and, past the
// palette end, derives lighter/darker variants instead of wrapping into exact
// duplicates — so series 13+ remain distinguishable from series 1+.
export const chartColorAt = (index: number): string => {
  const base = CHART_COLORS[index % CHART_COLORS.length];
  const cycle = Math.floor(index / CHART_COLORS.length);
  if (cycle === 0) return base;
  const n = parseInt(base.slice(1), 16);
  const amt = Math.min(0.5, 0.28 * cycle);
  // Lighten on odd wrap cycles, darken on even ones.
  const ch = (v: number) =>
    cycle % 2 === 1 ? Math.round(v + (255 - v) * amt) : Math.round(v * (1 - amt));
  const r = ch((n >> 16) & 255);
  const g = ch((n >> 8) & 255);
  const b = ch(n & 255);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
};

// Funnel stage progression (indigo → red). Shared by every funnel chart so the
// invoice and quote funnels read with the same visual language.
export const FUNNEL_STAGE_COLORS = [
  '#6366f1', '#3b82f6', '#06b6d4', '#10b981', '#84cc16', '#eab308', '#f97316', '#ef4444',
];


// Format percentage
export const formatPercentage = (value: number, decimals = 1) => {
  return `${value.toFixed(decimals)}%`;
};

// Format number with locale
export const formatNumber = (value: number, decimals = 0) => {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
};

// Get available chart types based on comparison mode
export const getAvailableChartTypes = (isComparisonMode: boolean): StatisticsChartTypeOption[] => {
  // Note: icons will be passed by consumer since we can't import tabler icons in a types file
  // This returns the value/label/description without icons
  const baseTypes: Omit<StatisticsChartTypeOption, 'icon'>[] = [
    { value: 'bar', label: 'Barras', description: 'Gráfico de barras vertical' },
    { value: 'line', label: 'Linhas', description: 'Gráfico de linhas' },
    { value: 'area', label: 'Área', description: 'Gráfico de área' },
  ];

  if (isComparisonMode) {
    baseTypes.push({ value: 'bar-stacked', label: 'Barras Empilhadas', description: 'Barras empilhadas para comparação' });
  } else {
    baseTypes.push({ value: 'pie', label: 'Pizza', description: 'Gráfico de pizza' });
  }

  return baseTypes as StatisticsChartTypeOption[];
};

// Y-axis mode options factory
export const getYAxisOptions = (modes: YAxisMode[]): Array<{ value: YAxisMode; label: string }> => {
  const labels: Record<YAxisMode, string> = {
    quantity: 'Quantidade',
    value: 'Valor (R$)',
    days: 'Dias',
    percentage: 'Porcentagem (%)',
    count: 'Contagem',
    both: 'Ambos',
  };
  return modes.map(mode => ({ value: mode, label: labels[mode] }));
};

// Month options (for period comparison)
export const MONTH_OPTIONS = [
  { value: '01', label: 'Janeiro' },
  { value: '02', label: 'Fevereiro' },
  { value: '03', label: 'Março' },
  { value: '04', label: 'Abril' },
  { value: '05', label: 'Maio' },
  { value: '06', label: 'Junho' },
  { value: '07', label: 'Julho' },
  { value: '08', label: 'Agosto' },
  { value: '09', label: 'Setembro' },
  { value: '10', label: 'Outubro' },
  { value: '11', label: 'Novembro' },
  { value: '12', label: 'Dezembro' },
];

// Generate year options (current year and N years back)
export const generateYearOptions = (yearsBack = 3) => {
  const currentYear = new Date().getFullYear();
  return Array.from({ length: yearsBack + 1 }, (_, i) => {
    const year = currentYear - i;
    return { value: year.toString(), label: year.toString() };
  });
};
