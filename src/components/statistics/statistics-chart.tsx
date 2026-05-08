import { useMemo, useState, useEffect, useRef } from 'react';
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
  yAxisLabel?: string;
  valueFormatter?: (value: number, mode: YAxisMode) => string;
  valueKey?: string;
  secondaryValueKey?: string;
  tooltipLabels?: { primary: string; secondary?: string };
  secondaryValueFormatter?: (value: number) => string;
  smooth?: boolean;
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
  secondaryValueFormatter,
  smooth = false,
}: StatisticsChartProps) {
  // Track dark mode via MutationObserver so chart re-colors when theme toggles
  const [isDark, setIsDark] = useState(() =>
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  );

  // After first render, stop writing start/end into dataZoom so user-adjusted zoom is preserved
  const zoomPersisted = useRef(false);
  useEffect(() => { zoomPersisted.current = true; }, []);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const option = useMemo((): EChartsOption => {
    if (!data || data.length === 0) return {};

    // Theme-aware colors
    const textColor      = isDark ? '#f4f4f5' : '#3f3f46';
    const subTextColor   = isDark ? '#a1a1aa' : '#71717a';
    const gridLineColor  = isDark ? '#27272a' : '#e4e4e7';
    const axisLineColor  = isDark ? '#3f3f46' : '#d4d4d8';
    const tooltipBg      = isDark ? 'rgba(24,24,27,0.95)' : 'rgba(255,255,255,0.97)';
    const tooltipBorder  = isDark ? '#3f3f46' : '#e4e4e7';

    const chartLimit = data.length;
    const needsScroll = chartLimit > 8;
    const zoomEnd = needsScroll ? (8 / chartLimit) * 100 : 100;

    const xAxisData = data.map(item => item.name);

    const getItemValue = (item: ChartDataItem) => item.value ?? 0;
    const getComparisonValue = (comp: { value: number }) => comp.value ?? 0;

    const dataZoom = needsScroll
      ? [{
          type: 'slider' as const,
          // Only set start/end on first render; afterwards let ECharts keep the user's position
          ...(zoomPersisted.current ? {} : { start: 100 - zoomEnd, end: 100 }),
          bottom: 10, height: 20,
          textStyle: { color: subTextColor },
          fillerColor: isDark ? 'rgba(63,63,70,0.4)' : 'rgba(212,212,216,0.4)',
        }]
      : [];

    const gridBottom = needsScroll ? '22%' : '12%';
    const baseGrid = { left: '3%', right: '4%', bottom: gridBottom, containLabel: true };

    const isLineLike = chartType === 'line' || chartType === 'line-stacked' || chartType === 'area';

    const xAxisBase = {
      type: 'category' as const,
      data: xAxisData,
      boundaryGap: !isLineLike,
      axisLabel: { color: subTextColor, rotate: 45, interval: 0, fontSize: 11 },
      axisLine: { lineStyle: { color: axisLineColor } },
      axisTick: { lineStyle: { color: axisLineColor } },
    };

    const buildYAxis = () => {
      const base = {
        axisLabel: { color: subTextColor, fontSize: 11 },
        axisLine: { show: false },
        splitLine: { lineStyle: { color: gridLineColor } },
      };
      if (yAxisMode === 'value')
        return { ...base, type: 'value' as const, axisLabel: { ...base.axisLabel, formatter: (v: number) => formatCurrency(v).replace('R$', '').trim() } };
      if (yAxisMode === 'percentage')
        return { ...base, type: 'value' as const, axisLabel: { ...base.axisLabel, formatter: (v: number) => `${v}%` } };
      if (yAxisMode === 'days')
        return { ...base, type: 'value' as const, axisLabel: { ...base.axisLabel, formatter: (v: number) => `${v}d` } };
      return { ...base, type: 'value' as const };
    };

    const secVF = secondaryValueFormatter ?? ((v: number) => v.toFixed(1));

    const secondaryPointLabel = {
      show: true, position: 'top' as const, fontSize: 12,
      color: CHART_COLORS[1],
      borderWidth: 0,
      backgroundColor: 'transparent',
      formatter: (params: any) => params.value > 0 ? secVF(params.value) : '',
    };

    const buildDualYAxis = () => {
      const base = {
        axisLabel: { color: subTextColor, fontSize: 11 },
        axisLine: { show: false },
        splitLine: { lineStyle: { color: gridLineColor } },
      };
      return [
        { ...base, type: 'value' as const },
        {
          ...base, type: 'value' as const,
          axisLabel: { ...base.axisLabel, formatter: (v: number) => secVF(v) },
          splitLine: { show: false },
        },
      ];
    };

    const pointLabel = {
      show: true, position: 'top' as const, fontSize: 12,
      color: textColor,
      borderWidth: 0,
      backgroundColor: 'transparent',
      formatter: (params: any) => params.value > 0 ? valueFormatter(params.value, yAxisMode) : '',
    };

    const barLabel = {
      show: true, position: 'top' as const, fontSize: 12,
      color: textColor,
      borderWidth: 0,
      backgroundColor: 'transparent',
      formatter: (params: any) => params.value > 0 ? valueFormatter(params.value, yAxisMode) : '',
    };

    const tooltipBase = {
      backgroundColor: tooltipBg,
      borderColor: tooltipBorder,
      textStyle: { color: textColor, fontSize: 12 },
      extraCssText: 'box-shadow: 0 4px 12px rgba(0,0,0,0.15);',
    };

    // ── PIE (simple only) ──────────────────────────────────────────────────────
    if (chartType === 'pie' && !isComparisonMode) {
      return {
        tooltip: {
          ...tooltipBase,
          trigger: 'item',
          formatter: (params: any) =>
            `<strong>${params.name}</strong><br/>${valueFormatter(params.value, yAxisMode)}<br/>${params.percent}%`,
        },
        legend: { bottom: 0, left: 'center', textStyle: { color: textColor } },
        color: CHART_COLORS,
        series: [{
          type: 'pie',
          radius: '60%',
          data: data.map(item => ({ name: item.name, value: getItemValue(item) })),
          emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.3)' } },
          label: { formatter: (params: any) => `${params.name}: ${valueFormatter(params.value, yAxisMode)}`, color: textColor },
        }],
      };
    }

    // ── BOTH MODE (dual Y: bars = primary/count left, line = secondary/avg right) ──
    if (yAxisMode === 'both') {
      const dualTooltip = {
        ...tooltipBase,
        trigger: 'axis' as const,
        axisPointer: { type: 'shadow' as const },
      };

      if (isComparisonMode && data.length > 0 && data[0].comparisons) {
        const entities = data[0].comparisons.map(c => c.entityName);
        const barSeries = entities.map((entity, index) => ({
          name: entity,
          type: 'bar' as const,
          yAxisIndex: 0,
          data: data.map(item => {
            const comp = item.comparisons?.find(c => c.entityName === entity);
            return comp ? getComparisonValue(comp) : 0;
          }),
          itemStyle: { color: CHART_COLORS[index % CHART_COLORS.length] },
          label: barLabel,
        }));
        const lineSeries = entities.map((entity, index) => ({
          name: `${entity} (Média)`,
          type: 'line' as const,
          yAxisIndex: 1,
          data: data.map(item => {
            const comp = item.comparisons?.find(c => c.entityName === entity);
            return comp?.secondaryValue ?? 0;
          }),
          itemStyle: { color: CHART_COLORS[index % CHART_COLORS.length] },
          lineStyle: { width: 2, type: 'dashed' as const },
          smooth,
          label: secondaryPointLabel,
        }));
        const allNames = [...entities, ...entities.map(e => `${e} (Média)`)];
        return {
          tooltip: dualTooltip,
          legend: { data: allNames, bottom: needsScroll ? 42 : 42, textStyle: { color: textColor } },
          grid: baseGrid,
          xAxis: xAxisBase,
          yAxis: buildDualYAxis(),
          color: CHART_COLORS,
          dataZoom,
          series: [...barSeries, ...lineSeries],
        };
      }

      // Simple both mode
      const simpleBothTooltip = {
        ...tooltipBase,
        trigger: 'axis' as const,
        axisPointer: { type: 'shadow' as const },
        formatter: (params: any) => {
          if (!Array.isArray(params) || !params.length) return '';
          const name = params[0].name;
          let html = `<strong style="color:${textColor}">${name}</strong><br/>`;
          params.forEach((p: any) => {
            const dot = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color};margin-right:4px;"></span>`;
            const val = p.seriesIndex === 0
              ? valueFormatter(p.value, 'count' as any)
              : secVF(p.value);
            html += `${dot}${p.seriesName}: ${val}<br/>`;
          });
          return html;
        },
      };

      const gridBothBottom = needsScroll ? '22%' : '15%';
      // bar-stacked → bar primary + dashed-line secondary; line-stacked → two lines
      const primaryIsLine = chartType === 'line-stacked';
      return {
        tooltip: simpleBothTooltip,
        legend: {
          data: [tooltipLabels.primary, tooltipLabels.secondary ?? 'Média/Usuário'],
          bottom: needsScroll ? 42 : 8,
          textStyle: { color: textColor },
        },
        grid: { left: '3%', right: '4%', bottom: gridBothBottom, containLabel: true },
        xAxis: xAxisBase,
        yAxis: buildDualYAxis(),
        color: CHART_COLORS,
        dataZoom,
        series: [
          {
            name: tooltipLabels.primary,
            type: primaryIsLine ? 'line' as const : 'bar' as const,
            yAxisIndex: 0,
            data: data.map(item => ({ ...item, value: getItemValue(item) })),
            itemStyle: { color: CHART_COLORS[0] },
            ...(primaryIsLine
              ? { smooth, lineStyle: { width: 2 }, label: pointLabel }
              : { label: barLabel }),
          },
          {
            name: tooltipLabels.secondary ?? 'Média/Usuário',
            type: 'line' as const,
            yAxisIndex: 1,
            data: data.map(item => item.secondaryValue ?? 0),
            itemStyle: { color: CHART_COLORS[1] },
            lineStyle: { width: 2, type: 'dashed' as const },
            smooth,
            label: secondaryPointLabel,
          },
        ],
      };
    }

    // ── COMPARISON MODE ────────────────────────────────────────────────────────
    if (isComparisonMode && data.length > 0 && data[0].comparisons) {
      const entities = data[0].comparisons.map(c => c.entityName);

      const buildSeries = (type: 'bar' | 'line', opts: Record<string, any> = {}) =>
        entities.map((entity, index) => ({
          name: entity,
          type,
          data: data.map(item => {
            const comp = item.comparisons?.find(c => c.entityName === entity);
            return comp ? getComparisonValue(comp) : 0;
          }),
          itemStyle: { color: CHART_COLORS[index % CHART_COLORS.length] },
          ...opts,
        }));

      let series: any[];
      if (chartType === 'line') {
        series = buildSeries('line', { smooth, lineStyle: { width: 2 }, label: pointLabel });
      } else if (chartType === 'area') {
        series = buildSeries('line', { smooth, areaStyle: { opacity: 0.2 }, lineStyle: { width: 2 }, label: pointLabel });
      } else if (chartType === 'line-stacked') {
        // Stacked lines: cumulative y-values, NO fill
        series = buildSeries('line', { smooth, stack: 'total', lineStyle: { width: 2 }, label: pointLabel });
      } else if (chartType === 'bar-stacked') {
        series = buildSeries('bar', { stack: 'total' });
      } else {
        // Grouped bar
        series = buildSeries('bar', { label: barLabel });
      }

      const legendBottom = needsScroll ? 42 : 42;
      return {
        tooltip: { ...tooltipBase, trigger: 'axis', axisPointer: { type: chartType.includes('bar') ? 'shadow' : 'line' } },
        legend: { data: entities, bottom: legendBottom, textStyle: { color: textColor } },
        grid: baseGrid,
        xAxis: xAxisBase,
        yAxis: buildYAxis(),
        color: CHART_COLORS,
        dataZoom,
        series,
      };
    }

    // ── SIMPLE MODE ────────────────────────────────────────────────────────────
    const seriesData = data.map(item => ({ ...item, value: getItemValue(item) }));

    const simpleTooltip = {
      ...tooltipBase,
      trigger: 'axis' as const,
      axisPointer: { type: chartType === 'bar' ? 'shadow' as const : 'line' as const },
      formatter: (params: any) => {
        if (!Array.isArray(params) || params.length === 0) return '';
        const p = params[0];
        return `<strong style="color:${textColor}">${p.name}</strong><br/>${tooltipLabels.primary}: ${valueFormatter(p.value, yAxisMode)}`;
      },
    };

    const baseSeriesOptions = {
      name: yAxisLabel || tooltipLabels.primary,
      data: seriesData,
      itemStyle: { color: CHART_COLORS[0] },
    };

    let series: any;
    if (chartType === 'line' || chartType === 'line-stacked') {
      // line-stacked in simple mode = regular line (stack has no effect with one series)
      series = [{ ...baseSeriesOptions, type: 'line', smooth, lineStyle: { width: 2 }, label: pointLabel }];
    } else if (chartType === 'area') {
      series = [{ ...baseSeriesOptions, type: 'line', smooth, areaStyle: { opacity: 0.45 }, lineStyle: { width: 2 }, label: pointLabel }];
    } else {
      // Bar
      series = [{ ...baseSeriesOptions, type: 'bar', label: barLabel }];
    }

    return {
      tooltip: simpleTooltip,
      grid: baseGrid,
      xAxis: xAxisBase,
      yAxis: buildYAxis(),
      color: CHART_COLORS,
      dataZoom,
      series,
    };
  }, [data, chartType, yAxisMode, isComparisonMode, yAxisLabel, valueFormatter, tooltipLabels, secondaryValueFormatter, smooth, isDark]);

  return (
    <ReactECharts
      key={`${isComparisonMode}-${yAxisMode}`}
      option={option}
      style={{ height, width: '100%' }}
      opts={{ renderer: 'canvas' }}
    />
  );
}
