import { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { CHART_COLORS, formatCurrency, type StatisticsChartType, type YAxisMode } from '@/types/statistics-common';

interface ChartDataItem {
  name: string;
  value: number;
  secondaryValue?: number;
  comparisons?: Array<{
    entityName: string;
    value: number;
    secondaryValue?: number;
  }>;
  [key: string]: any;
}

interface StatisticsChartProps {
  data: ChartDataItem[];
  chartType: StatisticsChartType;
  yAxisMode: YAxisMode;
  isComparisonMode: boolean;
  height?: string;
  /** Label for the Y-axis when in quantity mode */
  yAxisLabel?: string;
  /** Custom value formatter for tooltips */
  valueFormatter?: (value: number, mode: YAxisMode) => string;
  /** Custom value key to read from data items (defaults to 'value') */
  valueKey?: string;
  /** Secondary value key for tooltips */
  secondaryValueKey?: string;
  /** Labels for primary/secondary values in tooltips */
  tooltipLabels?: { primary: string; secondary?: string };
}

const defaultFormatter = (value: number, mode: YAxisMode): string => {
  switch (mode) {
    case 'value':
      return formatCurrency(value);
    case 'percentage':
      return `${value.toFixed(1)}%`;
    case 'days':
      return `${value.toFixed(1)} dias`;
    default:
      return Math.round(value).toString();
  }
};

export function StatisticsChart({
  data,
  chartType,
  yAxisMode,
  isComparisonMode,
  height = '600px',
  yAxisLabel,
  valueFormatter = defaultFormatter,
  tooltipLabels = { primary: 'Quantidade', secondary: 'Valor' },
}: StatisticsChartProps) {
  const option = useMemo((): EChartsOption => {
    if (!data || data.length === 0) return {};

    const chartLimit = data.length;
    const needsScroll = chartLimit > 8;
    const zoomEnd = needsScroll ? (8 / chartLimit) * 100 : 100;

    const xAxisData = data.map(item => item.name);

    const getItemValue = (item: ChartDataItem) => item.value ?? 0;
    const getComparisonValue = (comp: { value: number }) => comp.value ?? 0;

    const dataZoom = needsScroll
      ? [{ type: 'slider' as const, start: 0, end: zoomEnd, bottom: 10, height: 25 }]
      : [];

    const yAxisConfig = yAxisMode === 'value'
      ? {
          type: 'value' as const,
          axisLabel: { formatter: (v: number) => formatCurrency(v).replace('R$', '').trim() },
        }
      : yAxisMode === 'percentage'
        ? {
            type: 'value' as const,
            axisLabel: { formatter: (v: number) => `${v}%` },
          }
        : yAxisMode === 'days'
          ? {
              type: 'value' as const,
              axisLabel: { formatter: (v: number) => `${v}d` },
            }
          : { type: 'value' as const };

    const gridBottom = needsScroll ? '25%' : '12%';
    const baseGrid = { left: '3%', right: '4%', bottom: gridBottom, containLabel: true };

    // PIE CHART (simple mode only)
    if (chartType === 'pie' && !isComparisonMode) {
      return {
        tooltip: {
          trigger: 'item',
          formatter: (params: any) => {
            const formatted = valueFormatter(params.value, yAxisMode);
            return `<strong>${params.name}</strong><br/>${formatted}<br/>${params.percent}%`;
          },
        },
        legend: { bottom: 0, left: 'center' },
        color: CHART_COLORS,
        series: [{
          type: 'pie',
          radius: '60%',
          data: data.map(item => ({ name: item.name, value: getItemValue(item) })),
          emphasis: { itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0, 0, 0, 0.5)' } },
          label: {
            formatter: (params: any) => `${params.name}: ${valueFormatter(params.value, yAxisMode)}`,
          },
        }],
      };
    }

    // COMPARISON MODE: multiple series
    if (isComparisonMode && data.length > 0 && data[0].comparisons) {
      const entities = data[0].comparisons.map(c => c.entityName);

      const buildSeries = (type: 'bar' | 'line', options: Record<string, any> = {}) =>
        entities.map((entity, index) => ({
          name: entity,
          type,
          data: data.map(item => {
            const comp = item.comparisons?.find(c => c.entityName === entity);
            return comp ? getComparisonValue(comp) : 0;
          }),
          itemStyle: { color: CHART_COLORS[index % CHART_COLORS.length] },
          ...options,
        }));

      let series: any[];
      if (chartType === 'line') {
        series = buildSeries('line', { smooth: true });
      } else if (chartType === 'area') {
        series = buildSeries('line', { smooth: true, areaStyle: { opacity: 0.6 } });
      } else if (chartType === 'bar-stacked') {
        series = buildSeries('bar', { stack: 'total' });
      } else {
        // Grouped bar (default comparison)
        series = buildSeries('bar', {
          label: {
            show: true, position: 'top', fontSize: 9,
            formatter: (params: any) => params.value > 0 ? valueFormatter(params.value, yAxisMode) : '',
          },
        });
      }

      return {
        tooltip: { trigger: 'axis', axisPointer: { type: chartType.includes('bar') ? 'shadow' : 'line' } },
        legend: { data: entities, bottom: needsScroll ? 45 : 45 },
        grid: baseGrid,
        xAxis: { type: 'category', data: xAxisData, axisLabel: { rotate: 45, interval: 0 } },
        yAxis: yAxisConfig,
        color: CHART_COLORS,
        dataZoom,
        series,
      };
    }

    // SIMPLE MODE: single series
    const seriesData = data.map(item => ({
      ...item, // pass through for tooltip access
      value: getItemValue(item),
    }));

    const simpleTooltip = {
      trigger: 'axis' as const,
      axisPointer: { type: chartType === 'bar' ? 'shadow' as const : 'line' as const },
      formatter: (params: any) => {
        if (!Array.isArray(params) || params.length === 0) return '';
        const p = params[0];
        return `<strong>${p.name}</strong><br/>${tooltipLabels.primary}: ${valueFormatter(p.value, yAxisMode)}`;
      },
    };

    const baseSeriesOptions = {
      name: yAxisLabel || tooltipLabels.primary,
      data: seriesData,
      itemStyle: { color: CHART_COLORS[0] },
    };

    let series: any;
    if (chartType === 'line') {
      series = [{ ...baseSeriesOptions, type: 'line', smooth: true }];
    } else if (chartType === 'area') {
      series = [{ ...baseSeriesOptions, type: 'line', smooth: true, areaStyle: { opacity: 0.6 } }];
    } else {
      // Bar (default)
      series = [{
        ...baseSeriesOptions,
        type: 'bar',
        label: {
          show: true, position: 'top', fontSize: 9,
          formatter: (params: any) => params.value > 0 ? valueFormatter(params.value, yAxisMode) : '',
        },
      }];
    }

    return {
      tooltip: simpleTooltip,
      grid: baseGrid,
      xAxis: { type: 'category', data: xAxisData, axisLabel: { rotate: 45, interval: 0 } },
      yAxis: yAxisConfig,
      color: CHART_COLORS,
      dataZoom,
      series,
    };
  }, [data, chartType, yAxisMode, isComparisonMode, yAxisLabel, valueFormatter, tooltipLabels]);

  return <ReactECharts option={option} style={{ height, width: '100%' }} />;
}
