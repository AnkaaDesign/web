import { useMemo, useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { CHART_COLORS, formatCurrency, type StatisticsChartType, type YAxisMode, type TrendLineType } from '@/types/statistics-common';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

// Imperative handle exposed via forwardRef. PDF export reads `getOption()`
// then renders a print-friendly clone of that option off-screen, so the live
// chart's dataZoom/animation/interactive elements stay out of the snapshot.
export interface StatisticsChartHandle {
  getOption: () => EChartsOption | null;
}

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

// Two trend modes:
//   - Linear: a real trend line (linear regression on periods with data).
//     The regression formula y = slope·x + intercept is defined for any x,
//     so it extrapolates naturally across every period including empty
//     future months.
//   - SMA (sma3/sma6/sma12): backward-looking moving averages. There is no
//     true "future SMA" since the window needs real values, but for the
//     visualization the user wants the line to keep going. We project
//     forward using the slope between the last two SMA values, clamped at
//     0. Because SMA itself is already smoothed, this slope is typically
//     gentle — sharp final dips fade to the floor naturally.
// Fitting is always done on values where value > 0 so trailing zero/future
// periods don't pull the slope toward zero.
function computeTrend(values: number[], type: TrendLineType): (number | null)[] {
  let lastDataIdx = -1;
  for (let i = values.length - 1; i >= 0; i--) {
    if (values[i] > 0) { lastDataIdx = i; break; }
  }
  if (lastDataIdx < 1) return values.map(() => null);

  const slice = values.slice(0, lastDataIdx + 1);
  const total = values.length;

  if (type === 'linear') {
    const n = slice.length;
    const sx  = (n * (n - 1)) / 2;
    const sx2 = (n * (n - 1) * (2 * n - 1)) / 6;
    const sy  = slice.reduce((a, v) => a + v, 0);
    const sxy = slice.reduce((a, v, i) => a + i * v, 0);
    const d   = n * sx2 - sx * sx;
    if (d === 0) {
      const flat = sy / n;
      return Array.from({ length: total }, () => +flat.toFixed(2));
    }
    const slope = (n * sxy - sx * sy) / d;
    const intercept = (sy - slope * sx) / n;
    return Array.from({ length: total }, (_, i) =>
      Math.max(0, +(slope * i + intercept).toFixed(2))
    );
  }

  const w = type === 'sma3' ? 3 : type === 'sma6' ? 6 : 12;
  const trendSlice = slice.map((_, i) => {
    const s = Math.max(0, i - w + 1);
    const sub = slice.slice(s, i + 1);
    return +(sub.reduce((a, v) => a + v, 0) / sub.length).toFixed(2);
  });

  // Project forward across empty/future periods using slope of last 2 trend
  // values. Clamp at 0 — production can't go negative.
  const remaining = total - trendSlice.length;
  if (remaining <= 0) return trendSlice;
  const tail = trendSlice[trendSlice.length - 1] ?? 0;
  const prev = trendSlice.length >= 2 ? trendSlice[trendSlice.length - 2] : tail;
  const slope = tail - prev;
  const projected: number[] = [];
  for (let i = 1; i <= remaining; i++) {
    projected.push(Math.max(0, +(tail + slope * i).toFixed(2)));
  }
  return [...trendSlice, ...projected];
}

export const StatisticsChart = forwardRef<StatisticsChartHandle, StatisticsChartProps>(function StatisticsChart({
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
}, externalRef) {
  const smooth = chartType === 'line-smooth' || chartType === 'area-smooth';
  const baseChartType = chartType === 'line-smooth' ? 'line' : chartType === 'area-smooth' ? 'area' : chartType;

  const chartRef = useRef<any>(null);
  const onDataPointClickRef = useRef(onDataPointClick);
  useEffect(() => { onDataPointClickRef.current = onDataPointClick; }, [onDataPointClick]);
  // Tracks the currently hovered data point so clicking anywhere in the column opens the modal
  const hoveredRef = useRef<{ idx: number; name: string; series: string } | null>(null);

  useImperativeHandle(externalRef, () => ({
    getOption: () => {
      const inst = chartRef.current?.getEchartsInstance?.();
      return inst ? (inst.getOption() as EChartsOption) : null;
    },
  }), []);

  const hasClickHandler = !!onDataPointClick;

  const [isDark, setIsDark] = useState(() =>
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  );
  // Per-series color overrides — keyed by series name. Falls back to defaults.
  const [seriesColors, setSeriesColors] = useState<Record<string, string>>({});
  // Series the user toggled off via the legend.
  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set());
  const [openPickerFor, setOpenPickerFor] = useState<string | null>(null);

  const colorOf = useCallback(
    (name: string, fallback: string) => seriesColors[name] ?? fallback,
    [seriesColors],
  );

  const toggleSeries = useCallback((name: string) => {
    setHiddenSeries(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  }, []);

  const trendLabels: Record<TrendLineType, string> = useMemo(() => ({
    linear: 'Tendência', sma3: 'Média 3m', sma6: 'Média 6m', sma12: 'Média 12m',
  }), []);

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

    // Fixed-pixel bottom margin: leaves room for rotated x-axis labels (~40px),
    // the custom legend strip (~22px), the dataZoom slider when present
    // (8 + 30 = 38px), and equal gaps above and below the legend (~12px each).
    const gridBottom = needsScroll ? 124 : 80;
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

    // When a goal line is set above the visible data range, ECharts' auto
    // axis-scaling doesn't expand to include the markLine (it's attached to a
    // dummy null-data series), so the line gets clipped off-chart. Push the
    // axis max up to at least the goal value + ~10% headroom.
    const dataMaxRaw = Math.max(
      0,
      ...data.flatMap(d => [
        d.value ?? 0,
        d.secondaryValue ?? 0,
        ...(d.comparisons?.flatMap(c => [c.value ?? 0, c.secondaryValue ?? 0]) ?? []),
      ]),
    );
    const axisFloor = goalLine?.value != null
      ? Math.ceil(Math.max(dataMaxRaw, goalLine.value) * 1.08)
      : undefined;

    const buildYAxis = () => {
      const base = {
        axisLabel: { color: subTextColor, fontSize: 11 },
        axisLine: { show: true, lineStyle: { color: axisLineColor } },
        axisTick: { show: true, lineStyle: { color: axisLineColor } },
        splitLine: { lineStyle: { color: gridLineColor } },
      };
      const withFloor = <T extends object>(o: T) =>
        axisFloor != null ? { ...o, min: 0, max: axisFloor } : o;
      if (yAxisMode === 'value')
        return withFloor({ ...base, type: 'value' as const, axisLabel: { ...base.axisLabel, formatter: (v: number) => formatCurrency(v).replace('R$', '').trim() } });
      if (yAxisMode === 'percentage')
        return withFloor({ ...base, type: 'value' as const, axisLabel: { ...base.axisLabel, formatter: (v: number) => `${v}%` } });
      if (yAxisMode === 'days')
        return withFloor({ ...base, type: 'value' as const, axisLabel: { ...base.axisLabel, formatter: (v: number) => `${v}d` } });
      return withFloor({ ...base, type: 'value' as const });
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
        axisLine: { show: true, lineStyle: { color: axisLineColor } },
        axisTick: { show: true, lineStyle: { color: axisLineColor } },
        splitLine: { lineStyle: { color: gridLineColor } },
      };
      const primary: any = { ...base, type: 'value' as const };
      if (axisFloor != null) { primary.min = 0; primary.max = axisFloor; }
      return [
        primary,
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
    //
    // Implemented as a `custom` series instead of markArea: on a `boundaryGap:
    // true` category axis, markArea (with category names) anchors to slot
    // centers, and fractional xAxis values get rounded — both leave the band
    // cutting through January. A custom series exposes `api.coord([x, y])`,
    // which converts fractional data values to exact pixels and re-runs on
    // every dataZoom event, so the band stays aligned with slot edges at any
    // zoom level.
    const yearBandSeries: any[] = [];
    {
      const groups: { startIdx: number; endIdx: number; idx: number }[] = [];
      let cur: string | null = null;
      let groupStart = 0;
      let gi = 0;
      xAxisData.forEach((name, i) => {
        const m = name.match(/\b\d{4}\b/);
        const yr = m ? m[0] : null;
        if (yr !== cur) {
          if (cur !== null) groups.push({ startIdx: groupStart, endIdx: i - 1, idx: gi++ });
          cur = yr;
          groupStart = i;
        }
        if (i === xAxisData.length - 1 && cur !== null) {
          groups.push({ startIdx: groupStart, endIdx: i, idx: gi++ });
        }
      });

      // Only render bands when there's actually >1 year on the axis.
      const oddGroups = groups.filter(g => g.idx % 2 === 1);
      if (groups.length >= 2 && oddGroups.length > 0) {
        const bandColor = isDark ? 'rgba(255,255,255,0.055)' : 'rgba(0,0,0,0.04)';
        yearBandSeries.push({
          type: 'custom',
          silent: true,
          animation: false,
          legendHoverLink: false,
          tooltip: { show: false },
          z: -5,
          // ECharts invokes renderItem once per data point, so we use a single
          // dummy point and return a group containing every band rectangle.
          data: [[0, 0]],
          renderItem: (params: any, api: any) => {
            // `coordSys` is the chart's plot area rect (pixel-aligned and
            // already aware of dataZoom). Spanning rectangles from coordSys.y
            // to coordSys.y + coordSys.height covers the full vertical range
            // regardless of y-axis scale.
            const grid = params.coordSys ?? { x: 0, y: 0, width: 0, height: 0 };
            const yTop    = grid.y;
            const yHeight = grid.height;

            // Category axes use an OrdinalScale that rounds fractional indices
            // to the nearest integer — so `api.coord([11.5, …])` collapses to
            // slot 12's center, which is why every previous attempt put the
            // band edge in the middle of January. Instead we resolve the
            // integer slot center and shift by half the slot width (which
            // `api.size` reports correctly under dataZoom).
            const halfSlot = api.size([1, 0])[0] / 2;

            const children = oddGroups.map(g => {
              const startCenter = api.coord([g.startIdx, 0])[0];
              const endCenter   = api.coord([g.endIdx,   0])[0];
              const x1 = startCenter - halfSlot;
              const x2 = endCenter   + halfSlot;
              return {
                type: 'rect' as const,
                silent: true,
                shape: { x: x1, y: yTop, width: x2 - x1, height: yHeight },
                style: { fill: bandColor },
              };
            });

            return { type: 'group' as const, children };
          },
          // The 'rect' shape uses our own coords — clip prevents it bleeding
          // outside the grid when the user pans/zooms via the slider.
          clip: true,
        });
      }
    }

    // ── GOAL LINE ─────────────────────────────────────────────────────────────
    const goalLineSeries: any[] = [];
    if (goalLine?.value != null) {
      const lbl = goalLine.label || 'Meta';
      const goalColor = colorOf(lbl, '#10b981');
      goalLineSeries.push({
        type: 'line' as const, name: lbl, data: xAxisData.map(() => null),
        animation: false, silent: true, legendHoverLink: false,
        showSymbol: false, lineStyle: { opacity: 0 }, tooltip: { show: false },
        itemStyle: { color: goalColor },
        markLine: {
          silent: true,
          symbol: ['none', 'none'],
          data: [{ yAxis: goalLine.value, name: lbl }],
          lineStyle: { color: goalColor, width: 2, type: 'dashed' as const },
          label: {
            formatter: `${lbl}: ${valueFormatter(goalLine.value, yAxisMode)}`,
            color: goalColor, fontSize: 11,
            position: 'insideEndTop' as const,
            backgroundColor: 'transparent', borderWidth: 0,
          },
        },
      });
    }

    // ── TREND LINE ────────────────────────────────────────────────────────────
    // Simple mode: one trend over the single series.
    // Comparison mode: one trend per entity (e.g. one per year in year-over-year),
    // each colored to match its series so the user can tell which trend belongs
    // to which line. Trends are computed below per branch.
    const trendSeries: any[] = [];
    if (trendLine && !isComparisonMode && data.length >= 2) {
      const values = data.map(item => getItemValue(item));
      const trendData = computeTrend(values, trendLine);
      const trendName = trendLabels[trendLine];
      const trendColor = colorOf(trendName, '#f59e0b');
      trendSeries.push({
        name: trendName,
        type: 'line' as const,
        data: trendData,
        smooth: true,
        lineStyle: { type: 'dashed' as const, width: 2, color: trendColor },
        itemStyle: { color: trendColor },
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
        const barSeries = entities.map((entity, index) => {
          const color = colorOf(entity, CHART_COLORS[index % CHART_COLORS.length]);
          return {
            name: entity, type: 'bar' as const, yAxisIndex: 0,
            data: data.map(item => {
              const comp = item.comparisons?.find(c => c.entityName === entity);
              return comp ? getComparisonValue(comp) : 0;
            }),
            itemStyle: { color },
            label: barLabel,
          };
        });
        const lineSeries = entities.map((entity, index) => {
          const avgName = `${entity} (Média)`;
          const color = colorOf(avgName, CHART_COLORS[index % CHART_COLORS.length]);
          return {
            name: avgName, type: 'line' as const, yAxisIndex: 1,
            data: data.map(item => {
              const comp = item.comparisons?.find(c => c.entityName === entity);
              return comp?.secondaryValue ?? 0;
            }),
            itemStyle: { color },
            lineStyle: { width: 2, type: 'dashed' as const, color },
            smooth, label: secondaryPointLabel,
          };
        });
        return {
          tooltip: dualTooltip,
          legend: { show: false },
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

      const gridBothBottom = needsScroll ? 124 : 80;
      const primaryIsLine = baseChartType === 'line-stacked';
      const primaryName = tooltipLabels.primary;
      const secondaryName = tooltipLabels.secondary ?? 'Média/Usuário';
      const primaryColor = colorOf(primaryName, CHART_COLORS[0]);
      const secondaryColor = colorOf(secondaryName, CHART_COLORS[1]);
      return {
        tooltip: simpleBothTooltip,
        legend: { show: false },
        grid: { left: '3%', right: '4%', bottom: gridBothBottom, containLabel: true },
        xAxis: xAxisBase, yAxis: buildDualYAxis(),
        color: CHART_COLORS, dataZoom,
        series: [
          ...yearBandSeries,
          ...goalLineSeries,
          {
            name: primaryName,
            type: primaryIsLine ? 'line' as const : 'bar' as const,
            yAxisIndex: 0,
            data: data.map(item => ({ ...item, value: getItemValue(item) })),
            itemStyle: { color: primaryColor },
            ...(primaryIsLine
              ? { smooth, lineStyle: { width: 2, color: primaryColor }, label: pointLabel }
              : { label: barLabel }),
          },
          {
            name: secondaryName,
            type: 'line' as const, yAxisIndex: 1,
            data: data.map(item => item.secondaryValue ?? 0),
            itemStyle: { color: secondaryColor },
            lineStyle: { width: 2, type: 'dashed' as const, color: secondaryColor },
            smooth, label: secondaryPointLabel,
          },
        ],
      };
    }

    // ── COMPARISON MODE ────────────────────────────────────────────────────────
    if (isComparisonMode && data.length > 0 && data[0].comparisons) {
      const entities = data[0].comparisons.map(c => c.entityName);

      const buildSeries = (type: 'bar' | 'line', opts: Record<string, any> = {}) =>
        entities.map((entity, index) => {
          const color = colorOf(entity, CHART_COLORS[index % CHART_COLORS.length]);
          const extraLineStyle = type === 'line'
            ? { lineStyle: { ...(opts.lineStyle ?? {}), color } }
            : {};
          return {
            name: entity, type,
            data: data.map(item => {
              const comp = item.comparisons?.find(c => c.entityName === entity);
              return comp ? getComparisonValue(comp) : 0;
            }),
            itemStyle: { color },
            ...(type === 'line' && opts.areaStyle ? { areaStyle: { ...opts.areaStyle, color } } : {}),
            ...opts,
            ...extraLineStyle,
          };
        });

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

      // Per-entity trend lines — one per year / sector being compared, sharing
      // each series' color so the legend remains readable. Skipped for stacked
      // variants because the trend of a stacked slice has no useful meaning.
      const compTrendSeries: any[] = [];
      const isStacked = baseChartType === 'bar-stacked' || baseChartType === 'line-stacked';
      if (trendLine && !isStacked && data.length >= 2) {
        entities.forEach((entity, index) => {
          const values = data.map(item => {
            const comp = item.comparisons?.find(c => c.entityName === entity);
            return comp ? getComparisonValue(comp) : 0;
          });
          const trendData = computeTrend(values, trendLine);
          const trendName = `${entity} · ${trendLabels[trendLine]}`;
          const color = colorOf(trendName, CHART_COLORS[index % CHART_COLORS.length]);
          compTrendSeries.push({
            name: trendName,
            type: 'line' as const,
            data: trendData,
            smooth: true,
            lineStyle: { type: 'dashed' as const, width: 2, color },
            itemStyle: { color },
            symbol: 'none',
            animation: false,
            legendHoverLink: false,
            z: 5,
          });
        });
      }

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
        legend: { show: false },
        grid: baseGrid, xAxis: xAxisBase, yAxis: buildYAxis(),
        color: CHART_COLORS, dataZoom,
        series: [...yearBandSeries, ...goalLineSeries, ...series, ...compTrendSeries],
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

    const simpleName = yAxisLabel || tooltipLabels.primary;
    const simpleColor = colorOf(simpleName, CHART_COLORS[0]);
    const baseSeriesOptions = {
      name: simpleName,
      data: seriesData,
      itemStyle: { color: simpleColor },
    };

    let series: any;
    if (baseChartType === 'line' || baseChartType === 'line-stacked')
      series = [{ ...baseSeriesOptions, type: 'line', smooth, lineStyle: { width: 2, color: simpleColor }, label: pointLabel }];
    else if (baseChartType === 'area')
      series = [{ ...baseSeriesOptions, type: 'line', smooth, areaStyle: { opacity: 0.45, color: simpleColor }, lineStyle: { width: 2, color: simpleColor }, label: pointLabel }];
    else
      series = [{ ...baseSeriesOptions, type: 'bar', label: barLabel }];

    return {
      tooltip: simpleTooltip,
      legend: { show: false },
      grid: baseGrid, xAxis: xAxisBase, yAxis: buildYAxis(),
      color: CHART_COLORS, dataZoom,
      series: [...yearBandSeries, ...goalLineSeries, ...trendSeries, ...series],
    };
  }, [data, chartType, yAxisMode, isComparisonMode, yAxisLabel, valueFormatter, tooltipLabels, secondaryValueFormatter, trendLine, goalLine, isDark, seriesColors, hasClickHandler, trendLabels, colorOf]);

  const onEvents = useMemo((): Record<string, (params: any) => void> => {
    if (!hasClickHandler) return {};
    const categories = data.map(d => d.name);
    return {
      // updateAxisPointer fires whenever the axis pointer moves, including
      // when hovering over the empty shadow area above a short bar. This
      // lets the whole highlighted column open the modal, not just the bar.
      updateAxisPointer: (params: any) => {
        const info = Array.isArray(params?.axesInfo)
          ? params.axesInfo.find((a: any) => a?.axisDim === 'x') ?? params.axesInfo[0]
          : undefined;
        const val = info?.value;
        if (val == null || val === '') {
          hoveredRef.current = null;
          return;
        }
        const idx = typeof val === 'number' ? val : categories.indexOf(String(val));
        if (idx >= 0 && idx < categories.length) {
          hoveredRef.current = { idx, name: String(categories[idx] ?? ''), series: '' };
        } else {
          hoveredRef.current = null;
        }
      },
      mouseover: (params: any) => {
        if (params.componentType === 'series' && params.dataIndex != null) {
          hoveredRef.current = {
            idx: params.dataIndex,
            name: params.name ?? hoveredRef.current?.name ?? '',
            series: params.seriesName ?? '',
          };
        }
      },
      globalout: () => {
        hoveredRef.current = null;
      },
    };
  }, [hasClickHandler, data]);

  // Pie has its own built-in legend. Every other mode uses the unified custom
  // legend below — series name + color swatch (click → color picker) + label
  // click toggles visibility.
  const showCustomLegend = baseChartType !== 'pie';

  // Build the list of legend items mirroring the series the option actually
  // adds, in the same order they appear.
  const legendItems = useMemo(() => {
    if (!data?.length || baseChartType === 'pie') return [] as Array<{ name: string; color: string }>;
    const items: Array<{ name: string; color: string }> = [];
    const push = (name: string, fallback: string) => items.push({ name, color: colorOf(name, fallback) });

    if (yAxisMode === 'both') {
      if (isComparisonMode && data[0]?.comparisons) {
        data[0].comparisons.forEach((c, i) => push(c.entityName, CHART_COLORS[i % CHART_COLORS.length]));
        data[0].comparisons.forEach((c, i) => push(`${c.entityName} (Média)`, CHART_COLORS[i % CHART_COLORS.length]));
      } else {
        push(tooltipLabels.primary, CHART_COLORS[0]);
        push(tooltipLabels.secondary ?? 'Média/Usuário', CHART_COLORS[1]);
      }
    } else if (isComparisonMode && data[0]?.comparisons) {
      data[0].comparisons.forEach((c, i) => push(c.entityName, CHART_COLORS[i % CHART_COLORS.length]));
      if (trendLine && baseChartType !== 'bar-stacked' && baseChartType !== 'line-stacked') {
        data[0].comparisons.forEach((c, i) =>
          push(`${c.entityName} · ${trendLabels[trendLine]}`, CHART_COLORS[i % CHART_COLORS.length])
        );
      }
    } else {
      push(yAxisLabel || tooltipLabels.primary, CHART_COLORS[0]);
      if (trendLine) push(trendLabels[trendLine], '#f59e0b');
    }
    if (goalLine?.value != null) {
      push(goalLine.label || 'Meta', '#10b981');
    }
    return items;
  }, [data, baseChartType, yAxisMode, isComparisonMode, tooltipLabels, yAxisLabel, trendLine, trendLabels, goalLine, colorOf]);

  // Drop hidden entries that no longer exist (e.g. after switching modes)
  useEffect(() => {
    if (!hiddenSeries.size) return;
    const valid = new Set(legendItems.map(i => i.name));
    let changed = false;
    hiddenSeries.forEach(n => { if (!valid.has(n)) changed = true; });
    if (changed) {
      setHiddenSeries(prev => new Set([...prev].filter(n => valid.has(n))));
    }
  }, [legendItems, hiddenSeries]);

  // Apply hiddenSeries to ECharts via legendToggleSelect whenever it changes.
  // We use dispatchAction instead of legend.selected so notMerge=true (needed
  // to make removed series like the trend line vanish) doesn't wipe state.
  useEffect(() => {
    const inst = chartRef.current?.getEchartsInstance();
    if (!inst) return;
    legendItems.forEach(item => {
      inst.dispatchAction({
        type: hiddenSeries.has(item.name) ? 'legendUnSelect' : 'legendSelect',
        name: item.name,
      });
    });
  }, [legendItems, hiddenSeries, option]);

  // dataZoom: bottom:8, height:30 → top edge at 38px from chart bottom.
  // gridBottom is 124 with zoom → axis-label bottom at 124px from chart bottom.
  // Available gap-region between labels (124) and zoom top (38) = 86px.
  // Legend chip height ≈ 22px → two equal gaps of (86 − 22) / 2 = 32px each
  //   • gap above legend:  124 − 92 = 32  (92 = legend top)
  //   • gap below legend:  70 − 38 = 32   (70 = legend bottom)
  const hasZoom = (data?.length ?? 0) > 8;
  const legendBottomPx = hasZoom ? 70 : 8;

  return (
    <div className="flex flex-col">
      <div
        className={cn(
          'relative',
          hasClickHandler && '[&_canvas]:!cursor-pointer [&>div]:!cursor-pointer',
        )}
        style={{ cursor: hasClickHandler ? 'pointer' : 'default' }}
        onClick={() => {
          if (!hasClickHandler || !hoveredRef.current) return;
          const { idx, name, series } = hoveredRef.current;
          onDataPointClickRef.current?.(idx, name, series);
        }}
      >
        <ReactECharts
          ref={chartRef}
          key={`${chartType}-${isComparisonMode}-${yAxisMode}`}
          option={option}
          notMerge={true}
          // gridBottom (124) + legend (~22) + zoom (38) + axis labels (~40)
          // reserves ~225px below the plot. minHeight keeps the plot area
          // visible even at small viewport heights.
          style={{ height, minHeight: '380px', width: '100%', cursor: hasClickHandler ? 'pointer' : 'default' }}
          opts={{ renderer: 'canvas' }}
          onEvents={onEvents}
        />
        {showCustomLegend && legendItems.length > 0 && (
          <div
            className="pointer-events-none absolute left-0 right-0 flex flex-wrap justify-center gap-x-4 gap-y-1 px-2"
            style={{ bottom: legendBottomPx }}
          >
            {legendItems.map(item => {
            const hidden = hiddenSeries.has(item.name);
            return (
              <div key={item.name} className="pointer-events-auto flex items-center gap-1.5 bg-card/60 backdrop-blur-sm px-1.5 py-0.5 rounded">
                <Popover
                  open={openPickerFor === item.name}
                  onOpenChange={open => setOpenPickerFor(open ? item.name : null)}
                >
                  <PopoverTrigger asChild>
                    <button
                      aria-label={`Cor da série ${item.name}`}
                      className="w-4 h-4 rounded-sm transition-transform hover:scale-110 focus:outline-none"
                      style={{ background: item.color, opacity: hidden ? 0.35 : 1 }}
                    />
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
                            outline: color === item.color ? '2px solid currentColor' : '2px solid transparent',
                            outlineOffset: '2px',
                          }}
                          onClick={() => {
                            setSeriesColors(prev => ({ ...prev, [item.name]: color }));
                            setOpenPickerFor(null);
                          }}
                        />
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
                <button
                  onClick={() => toggleSeries(item.name)}
                  aria-pressed={!hidden}
                  className={cn(
                    'text-sm transition-colors cursor-pointer select-none',
                    hidden ? 'text-muted-foreground line-through' : 'text-foreground/85 hover:text-foreground',
                  )}
                >
                  {item.name}
                </button>
              </div>
            );
          })}
          </div>
        )}
      </div>
    </div>
  );
});
