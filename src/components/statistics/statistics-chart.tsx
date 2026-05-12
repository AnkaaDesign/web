import { useMemo, useState, useEffect, useRef } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { CHART_COLORS, formatCurrency, type StatisticsChartType, type YAxisMode, type TrendLineType } from '@/types/statistics-common';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

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
  trendLine?: TrendLineType | null;
  goalLine?: { value: number; label?: string } | null;
  onDataPointClick?: (dataIndex: number, name: string, seriesName: string) => void;
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

function computeTrend(values: number[], type: TrendLineType): number[] {
  if (type === 'linear') {
    const n = values.length;
    if (n < 2) return [...values];
    const sx  = (n * (n - 1)) / 2;
    const sx2 = (n * (n - 1) * (2 * n - 1)) / 6;
    const sy  = values.reduce((a, v) => a + v, 0);
    const sxy = values.reduce((a, v, i) => a + i * v, 0);
    const d   = n * sx2 - sx * sx;
    if (d === 0) return [...values];
    const slope = (n * sxy - sx * sy) / d;
    const intercept = (sy - slope * sx) / n;
    return values.map((_, i) => Math.max(0, +(slope * i + intercept).toFixed(2)));
  }
  const w = type === 'sma3' ? 3 : type === 'sma6' ? 6 : 12;
  return values.map((_, i) => {
    const s = Math.max(0, i - w + 1);
    const slice = values.slice(s, i + 1);
    return +(slice.reduce((a, v) => a + v, 0) / slice.length).toFixed(2);
  });
}

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
  trendLine,
  goalLine,
  onDataPointClick,
}: StatisticsChartProps) {
  const smooth = chartType === 'line-smooth' || chartType === 'area-smooth';
  const baseChartType = chartType === 'line-smooth' ? 'line' : chartType === 'area-smooth' ? 'area' : chartType;

  const chartRef = useRef<any>(null);
  const onDataPointClickRef = useRef(onDataPointClick);
  useEffect(() => { onDataPointClickRef.current = onDataPointClick; }, [onDataPointClick]);
  // Tracks the currently hovered data point so clicking anywhere in the column opens the modal
  const hoveredRef = useRef<{ idx: number; name: string; series: string } | null>(null);

  const hasClickHandler = !!onDataPointClick;

  const [isDark, setIsDark] = useState(() =>
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  );
  const [seriesColor, setSeriesColor] = useState(CHART_COLORS[0]);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const option = useMemo((): EChartsOption => {
    if (!data || data.length === 0) return {};

    const textColor     = isDark ? '#f4f4f5' : '#3f3f46';
    const subTextColor  = isDark ? '#a1a1aa' : '#71717a';
    const gridLineColor = isDark ? '#27272a' : '#e4e4e7';
    const axisLineColor = isDark ? '#3f3f46' : '#d4d4d8';
    const tooltipBg     = isDark ? 'rgba(24,24,27,0.95)' : 'rgba(255,255,255,0.97)';
    const tooltipBorder = isDark ? '#3f3f46' : '#e4e4e7';

    const chartLimit = data.length;
    const needsScroll = chartLimit > 8;

    const xAxisData = data.map(item => item.name);

    const getItemValue = (item: ChartDataItem) => item.value ?? 0;
    const getComparisonValue = (comp: { value: number }) => comp.value ?? 0;

    const dataZoom = needsScroll
      ? [{
          type: 'slider' as const,
          bottom: 8, height: 30,
          borderRadius: 6,
          textStyle: { color: subTextColor },
          fillerColor: isDark ? 'rgba(63,63,70,0.4)' : 'rgba(212,212,216,0.4)',
        }]
      : [];

    const gridBottom = needsScroll ? '22%' : '12%';
    const baseGrid = { left: '3%', right: '4%', bottom: gridBottom, containLabel: true };

    const isLineLike = baseChartType === 'line' || baseChartType === 'line-stacked' || baseChartType === 'area';

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
      show: true, position: 'top' as const, fontSize: 14,
      color: CHART_COLORS[1],
      borderWidth: 0, backgroundColor: 'transparent',
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
        { ...base, type: 'value' as const, axisLabel: { ...base.axisLabel, formatter: (v: number) => secVF(v) }, splitLine: { show: false } },
      ];
    };

    const pointLabel = {
      show: true, position: 'top' as const, fontSize: 14,
      color: textColor, borderWidth: 0, backgroundColor: 'transparent',
      formatter: (params: any) => params.value > 0 ? valueFormatter(params.value, yAxisMode) : '',
    };

    const barLabel = {
      show: true, position: 'top' as const, fontSize: 14,
      color: textColor, borderWidth: 0, backgroundColor: 'transparent',
      formatter: (params: any) => params.value > 0 ? valueFormatter(params.value, yAxisMode) : '',
    };

    const tooltipBase = {
      backgroundColor: tooltipBg,
      borderColor: tooltipBorder,
      textStyle: { color: textColor, fontSize: 12 },
      extraCssText: 'box-shadow: 0 4px 12px rgba(0,0,0,0.15);',
    };

    const clickHint = '';
    const seriesHint = '';

    // ── YEAR BAND BACKGROUNDS ─────────────────────────────────────────────────
    const yearBandSeries: any[] = [];
    {
      const groups: { start: string; end: string; idx: number }[] = [];
      let cur: string | null = null, startName = '', gi = 0;
      xAxisData.forEach((name, i) => {
        const m = name.match(/\b\d{4}\b/);
        const yr = m ? m[0] : null;
        if (yr !== cur) {
          if (cur !== null) groups.push({ start: startName, end: xAxisData[i - 1], idx: gi++ });
          cur = yr; startName = name;
        }
        if (i === xAxisData.length - 1 && cur !== null)
          groups.push({ start: startName, end: name, idx: gi++ });
      });
      if (groups.length >= 2) {
        yearBandSeries.push({
          type: 'line', data: [], animation: false, silent: true, legendHoverLink: false,
          showSymbol: false, lineStyle: { opacity: 0 }, tooltip: { show: false },
          markArea: {
            silent: true,
            data: groups.map(g => [
              {
                xAxis: g.start,
                itemStyle: {
                  color: g.idx % 2 === 1
                    ? isDark ? 'rgba(255,255,255,0.055)' : 'rgba(0,0,0,0.04)'
                    : 'rgba(0,0,0,0)',
                },
              },
              { xAxis: g.end },
            ]),
          },
        });
      }
    }

    // ── GOAL LINE ─────────────────────────────────────────────────────────────
    const goalLineSeries: any[] = [];
    if (goalLine?.value != null) {
      const lbl = goalLine.label || 'Meta';
      goalLineSeries.push({
        type: 'line' as const, name: lbl, data: xAxisData.map(() => null),
        animation: false, silent: true, legendHoverLink: false,
        showSymbol: false, lineStyle: { opacity: 0 }, tooltip: { show: false },
        markLine: {
          silent: true,
          symbol: ['none', 'none'],
          data: [{ yAxis: goalLine.value, name: lbl }],
          lineStyle: { color: '#10b981', width: 2, type: 'dashed' as const },
          label: {
            formatter: `${lbl}: ${valueFormatter(goalLine.value, yAxisMode)}`,
            color: '#10b981', fontSize: 11,
            position: 'insideEndTop' as const,
            backgroundColor: 'transparent', borderWidth: 0,
          },
        },
      });
    }

    // ── TREND LINE ────────────────────────────────────────────────────────────
    // Only rendered in simple (non-comparison) mode
    const trendSeries: any[] = [];
    if (trendLine && !isComparisonMode && data.length >= 2) {
      const values = data.map(item => getItemValue(item));
      const trendData = computeTrend(values, trendLine);
      const trendLabels: Record<TrendLineType, string> = {
        linear: 'Tendência', sma3: 'Média 3m', sma6: 'Média 6m', sma12: 'Média 12m',
      };
      trendSeries.push({
        name: trendLabels[trendLine],
        type: 'line' as const,
        data: trendData,
        smooth: true,
        lineStyle: { type: 'dashed' as const, width: 2, color: '#f59e0b' },
        itemStyle: { color: '#f59e0b' },
        symbol: 'none',
        animation: false,
        legendHoverLink: false,
        z: 5,
      });
    }

    // ── PIE (simple only, no overlays) ─────────────────────────────────────────
    if (baseChartType === 'pie' && !isComparisonMode) {
      return {
        tooltip: {
          ...tooltipBase, trigger: 'item',
          formatter: (params: any) =>
            `<strong>${params.name}</strong><br/>${valueFormatter(params.value, yAxisMode)}<br/>${params.percent}%`,
        },
        legend: { bottom: 0, left: 'center', textStyle: { color: textColor } },
        color: CHART_COLORS,
        series: [{
          type: 'pie', radius: '60%',
          data: data.map(item => ({ name: item.name, value: getItemValue(item) })),
          emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.3)' } },
          label: { formatter: (params: any) => `${params.name}: ${valueFormatter(params.value, yAxisMode)}`, color: textColor },
        }],
      };
    }

    // ── BOTH MODE ─────────────────────────────────────────────────────────────
    if (yAxisMode === 'both') {
      const dualTooltip = { ...tooltipBase, trigger: 'axis' as const, axisPointer: { type: 'shadow' as const } };

      if (isComparisonMode && data.length > 0 && data[0].comparisons) {
        const entities = data[0].comparisons.map(c => c.entityName);
        const barSeries = entities.map((entity, index) => ({
          name: entity, type: 'bar' as const, yAxisIndex: 0,
          data: data.map(item => {
            const comp = item.comparisons?.find(c => c.entityName === entity);
            return comp ? getComparisonValue(comp) : 0;
          }),
          itemStyle: { color: CHART_COLORS[index % CHART_COLORS.length] },
          label: barLabel,
        }));
        const lineSeries = entities.map((entity, index) => ({
          name: `${entity} (Média)`, type: 'line' as const, yAxisIndex: 1,
          data: data.map(item => {
            const comp = item.comparisons?.find(c => c.entityName === entity);
            return comp?.secondaryValue ?? 0;
          }),
          itemStyle: { color: CHART_COLORS[index % CHART_COLORS.length] },
          lineStyle: { width: 2, type: 'dashed' as const },
          smooth, label: secondaryPointLabel,
        }));
        const allNames = [...entities, ...entities.map(e => `${e} (Média)`)];
        return {
          tooltip: dualTooltip,
          legend: { data: allNames, bottom: needsScroll ? 42 : 42, textStyle: { color: textColor } },
          grid: baseGrid, xAxis: xAxisBase, yAxis: buildDualYAxis(),
          color: CHART_COLORS, dataZoom,
          series: [...yearBandSeries, ...goalLineSeries, ...barSeries, ...lineSeries],
        };
      }

      // Simple both mode
      const simpleBothTooltip = {
        ...tooltipBase, trigger: 'axis' as const, axisPointer: { type: 'shadow' as const },
        formatter: (params: any) => {
          if (!Array.isArray(params) || !params.length) return '';
          const name = params[0].name;
          let html = `<strong style="color:${textColor}">${name}</strong><br/>`;
          params.forEach((p: any) => {
            const dot = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color};margin-right:4px;"></span>`;
            const val = p.seriesIndex === 0 ? valueFormatter(p.value, 'count' as any) : secVF(p.value);
            html += `${dot}${p.seriesName}: ${val}<br/>`;
          });
          return html;
        },
      };

      const gridBothBottom = needsScroll ? '22%' : '15%';
      const primaryIsLine = baseChartType === 'line-stacked';
      return {
        tooltip: simpleBothTooltip,
        legend: { data: [tooltipLabels.primary, tooltipLabels.secondary ?? 'Média/Usuário'], bottom: needsScroll ? 42 : 8, textStyle: { color: textColor } },
        grid: { left: '3%', right: '4%', bottom: gridBothBottom, containLabel: true },
        xAxis: xAxisBase, yAxis: buildDualYAxis(),
        color: CHART_COLORS, dataZoom,
        series: [
          ...yearBandSeries,
          ...goalLineSeries,
          {
            name: tooltipLabels.primary,
            type: primaryIsLine ? 'line' as const : 'bar' as const,
            yAxisIndex: 0,
            data: data.map(item => ({ ...item, value: getItemValue(item) })),
            itemStyle: { color: CHART_COLORS[0] },
            ...(primaryIsLine ? { smooth, lineStyle: { width: 2 }, label: pointLabel } : { label: barLabel }),
          },
          {
            name: tooltipLabels.secondary ?? 'Média/Usuário',
            type: 'line' as const, yAxisIndex: 1,
            data: data.map(item => item.secondaryValue ?? 0),
            itemStyle: { color: CHART_COLORS[1] },
            lineStyle: { width: 2, type: 'dashed' as const },
            smooth, label: secondaryPointLabel,
          },
        ],
      };
    }

    // ── COMPARISON MODE ────────────────────────────────────────────────────────
    if (isComparisonMode && data.length > 0 && data[0].comparisons) {
      const entities = data[0].comparisons.map(c => c.entityName);

      const buildSeries = (type: 'bar' | 'line', opts: Record<string, any> = {}) =>
        entities.map((entity, index) => ({
          name: entity, type,
          data: data.map(item => {
            const comp = item.comparisons?.find(c => c.entityName === entity);
            return comp ? getComparisonValue(comp) : 0;
          }),
          itemStyle: { color: CHART_COLORS[index % CHART_COLORS.length] },
          ...opts,
        }));

      let series: any[];
      if (baseChartType === 'line')
        series = buildSeries('line', { smooth, lineStyle: { width: 2 }, label: pointLabel });
      else if (baseChartType === 'area')
        series = buildSeries('line', { smooth, areaStyle: { opacity: 0.2 }, lineStyle: { width: 2 }, label: pointLabel });
      else if (baseChartType === 'line-stacked')
        series = buildSeries('line', { smooth, stack: 'total', lineStyle: { width: 2 }, label: pointLabel });
      else if (baseChartType === 'bar-stacked')
        series = buildSeries('bar', { stack: 'total' });
      else
        series = buildSeries('bar', { label: barLabel });

      const compTooltipFormatter = (params: any) => {
        if (!Array.isArray(params) || !params.length) return '';
        let html = `<strong style="color:${textColor}">${params[0].name}</strong><br/>`;
        params.forEach((p: any) => {
          if (p.value == null || !p.seriesName) return;
          const dot = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color};margin-right:5px;vertical-align:middle;"></span>`;
          html += `${dot}${p.seriesName}: ${valueFormatter(p.value, yAxisMode)}${seriesHint}<br/>`;
        });
        return html;
      };

      return {
        tooltip: { ...tooltipBase, trigger: 'axis', axisPointer: { type: baseChartType.includes('bar') ? 'shadow' : 'line' }, formatter: compTooltipFormatter },
        legend: { data: entities, bottom: needsScroll ? 42 : 42, textStyle: { color: textColor } },
        grid: baseGrid, xAxis: xAxisBase, yAxis: buildYAxis(),
        color: CHART_COLORS, dataZoom,
        series: [...yearBandSeries, ...goalLineSeries, ...series],
      };
    }

    // ── SIMPLE MODE ────────────────────────────────────────────────────────────
    const seriesData = data.map(item => ({ ...item, value: getItemValue(item) }));

    const simpleTooltip = {
      ...tooltipBase, trigger: 'axis' as const,
      axisPointer: { type: baseChartType === 'bar' ? 'shadow' as const : 'line' as const },
      formatter: (params: any) => {
        if (!Array.isArray(params) || params.length === 0) return '';
        const real = params.filter((p: any) => p.data != null && typeof p.data === 'object');
        const p = real[0] ?? params[0];
        let html = `<strong style="color:${textColor}">${p.name}</strong><br/>`;
        params.forEach((par: any) => {
          if (par.value == null) return;
          const dot = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${par.color};margin-right:4px;"></span>`;
          html += `${dot}${par.seriesName}: ${valueFormatter(par.value, yAxisMode)}<br/>`;
        });
        if (hasClickHandler && real.length > 0) {
          html += clickHint;
        }
        return html;
      },
    };

    const baseSeriesOptions = {
      name: yAxisLabel || tooltipLabels.primary,
      data: seriesData,
      itemStyle: { color: seriesColor },
    };

    let series: any;
    if (baseChartType === 'line' || baseChartType === 'line-stacked')
      series = [{ ...baseSeriesOptions, type: 'line', smooth, lineStyle: { width: 2 }, label: pointLabel }];
    else if (baseChartType === 'area')
      series = [{ ...baseSeriesOptions, type: 'line', smooth, areaStyle: { opacity: 0.45 }, lineStyle: { width: 2 }, label: pointLabel }];
    else
      series = [{ ...baseSeriesOptions, type: 'bar', label: barLabel }];

    return {
      tooltip: simpleTooltip,
      grid: baseGrid, xAxis: xAxisBase, yAxis: buildYAxis(),
      color: CHART_COLORS, dataZoom,
      series: [...yearBandSeries, ...goalLineSeries, ...trendSeries, ...series],
    };
  }, [data, chartType, yAxisMode, isComparisonMode, yAxisLabel, valueFormatter, tooltipLabels, secondaryValueFormatter, trendLine, goalLine, isDark, seriesColor, hasClickHandler]);

  const onEvents = useMemo(() => {
    if (!hasClickHandler) return {};
    return {
      // Track which data point the user is hovering so clicking anywhere
      // in the highlighted column (not just the bar) opens the modal
      mouseover: (params: any) => {
        if (params.componentType === 'series' && params.dataIndex != null) {
          hoveredRef.current = {
            idx: params.dataIndex,
            name: params.name ?? '',
            series: params.seriesName ?? '',
          };
        }
      },
      // Clear only when the mouse leaves the chart entirely
      globalout: () => {
        hoveredRef.current = null;
      },
    };
  }, [hasClickHandler]);

  const showSimpleLegend = !isComparisonMode && baseChartType !== 'pie';

  return (
    <div className="flex flex-col">
      <div
        style={{ cursor: hasClickHandler ? 'pointer' : 'default' }}
        onClick={() => {
          if (!hasClickHandler || !hoveredRef.current) return;
          const { idx, name, series } = hoveredRef.current;
          onDataPointClickRef.current?.(idx, name, series);
        }}
      >
        <ReactECharts
          ref={chartRef}
          key={`${isComparisonMode}-${yAxisMode}`}
          option={option}
          style={{ height, width: '100%' }}
          opts={{ renderer: 'canvas' }}
          onEvents={onEvents}
        />
      </div>
      {showSimpleLegend && (
        <div className="flex justify-center mt-2 pb-2">
          <Popover open={colorPickerOpen} onOpenChange={setColorPickerOpen}>
            <PopoverTrigger asChild>
              <button className="flex items-center gap-2 px-3 py-1.5 rounded hover:bg-muted/50 text-sm text-muted-foreground transition-colors cursor-pointer">
                <span className="w-4 h-4 rounded-sm flex-shrink-0" style={{ background: seriesColor }} />
                {yAxisLabel || tooltipLabels.primary}
              </button>
            </PopoverTrigger>
            <PopoverContent align="center" className="w-auto p-3">
              <p className="text-xs font-medium mb-2 text-muted-foreground">Cor da série</p>
              <div className="grid grid-cols-5 gap-1.5">
                {CHART_COLORS.map(color => (
                  <button
                    key={color}
                    className="w-6 h-6 rounded-sm hover:scale-110 transition-transform"
                    style={{
                      background: color,
                      outline: color === seriesColor ? '2px solid currentColor' : '2px solid transparent',
                      outlineOffset: '2px',
                    }}
                    onClick={() => { setSeriesColor(color); setColorPickerOpen(false); }}
                  />
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      )}
    </div>
  );
}
