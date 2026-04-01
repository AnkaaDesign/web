// Shared types for all statistics pages

export type StatisticsChartType = 'bar' | 'line' | 'area' | 'pie' | 'bar-stacked';

export type YAxisMode = 'quantity' | 'value' | 'days' | 'percentage' | 'count';

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
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
  '#6366f1', // indigo
  '#14b8a6', // teal
  '#ef4444', // red
];

// Format currency helper
export const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

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
