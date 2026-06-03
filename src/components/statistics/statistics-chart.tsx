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
  /**
   * Per-period goal values aligned positionally with `data`. When provided,
   * renders a stepped line that follows the configured goal for each period
   * instead of a single flat reference line. Takes precedence over goalLine.
   */
  perPeriodGoalLine?: { values: (number | null)[]; label?: string } | null;
  /**
   * Goal line rendered on the right Y-axis (yAxisIndex: 1). Only shown when
   * yAxisMode === 'both'. Used to display a second metric's target alongside
   * the primary goal without cluttering the primary axis.
   */
  secondaryGoalLine?: { value: number; label?: string } | null;
  /**
   * Per-period goal values for the secondary (right-axis) series. When provided,
   * renders diamond markers with a dashed connecting line on yAxisIndex:1 instead
   * of the flat secondaryGoalLine markLine. Takes precedence over secondaryGoalLine.
   */
  perPeriodSecondaryGoalLine?: { values: (number | null)[]; label?: string } | null;
  /**
   * Individual chart type for the primary series when yAxisMode === 'both'.
   * Overrides the global chartType for the left-axis series only.
   */
  primaryChartType?: 'bar' | 'line' | 'line-smooth' | 'area' | 'area-smooth';
  /**
   * Individual chart type for the secondary series when yAxisMode === 'both'.
   * Overrides the default 'line' for the right-axis series.
   */
  secondaryChartType?: 'bar' | 'line' | 'line-smooth' | 'area' | 'area-smooth';
  onDataPointClick?: (dataIndex: number, name: string, seriesName: string, region?: 'plot' | 'label') => void;
  /**
   * Tooltip scope. 'axis' (default) shows every series at the hovered category
   * (with the shadow band); 'item' shows only the directly-hovered bar/point —
   * use it when each bar is an independent entity (e.g. one collaborator) and
   * the grouped-band tooltip is confusing.
   */
  tooltipTrigger?: 'axis' | 'item';
  /**
   * Draw alternating background bands behind every other x-category. Mirrors
   * the year-band separators on the productivity page, applied per-category so
   * grouped-bar sets (e.g. one group per skill) read as visually distinct.
   */
  categoryBands?: boolean;
  /**
   * Controlled legend state, keyed by series NAME. When provided the parent
   * owns hide/color so they survive the chart remounting on a type switch.
   */
  hiddenSeries?: Set<string> | string[];
  onToggleSeries?: (name: string) => void;
  seriesColors?: Record<string, string>;
  onSeriesColorChange?: (name: string, color: string) => void;
  /**
   * Per-value bar colour for the single-series view (e.g. colour each bar by
   * its 0–5 score band). When it returns undefined the series colour is used.
   */
  valueColor?: (value: number) => string | undefined;
  /**
   * Single-series only: give EACH bar (one per category) its own color and a
   * composite legend entry. Parallel to `data` by index. When set, it takes
   * precedence over `valueColor` and replaces the lone series legend with one
   * display-only entry per bar. Used by the skill-assessment page to render
   * "Média <Escopo> - <Categoria>" legends with distinct colors per bar.
   */
  categoryLegend?: Array<{ label: string; color: string }>;
  /**
   * Show the interactive custom legend (color swatches + color picker) below
   * the chart. Defaults to true; the parent can toggle it off to reclaim space.
   */
  showLegend?: boolean;
}

// Lighten a #rrggbb color toward white by `amt` (0..1). Used for the bar
// hover-emphasis tint so hovering a column gives a subtle, color-aware lift.
function lightenColor(color: string, amt = 0.22): string {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color);
  if (!m) return color;
  let hex = m[1];
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  const n = parseInt(hex, 16);
  const r = Math.round(((n >> 16) & 255) + (255 - ((n >> 16) & 255)) * amt);
  const g = Math.round(((n >> 8) & 255) + (255 - ((n >> 8) & 255)) * amt);
  const b = Math.round((n & 255) + (255 - (n & 255)) * amt);
  return `rgb(${r}, ${g}, ${b})`;
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
  perPeriodGoalLine,
  secondaryGoalLine,
  perPeriodSecondaryGoalLine,
  primaryChartType,
  secondaryChartType,
  onDataPointClick,
  tooltipTrigger = 'axis',
  categoryBands = false,
  hiddenSeries: hiddenSeriesProp,
  onToggleSeries,
  seriesColors: seriesColorsProp,
  onSeriesColorChange,
  valueColor,
  categoryLegend,
  showLegend = true,
}, externalRef) {
  const smooth = chartType === 'line-smooth' || chartType === 'area-smooth';
  const baseChartType = chartType === 'line-smooth' ? 'line' : chartType === 'area-smooth' ? 'area' : chartType;

  const chartRef = useRef<any>(null);
  const onDataPointClickRef = useRef(onDataPointClick);
  useEffect(() => { onDataPointClickRef.current = onDataPointClick; }, [onDataPointClick]);
  // Tracks the currently hovered data point so clicking anywhere in the column opens the modal
  const hoveredRef = useRef<{ idx: number; name: string; series: string } | null>(null);
  // Current category labels, available to the imperative zr click handler.
  const categoriesRef = useRef<string[]>([]);
  useEffect(() => { categoriesRef.current = (data ?? []).map(d => d.name); }, [data]);

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
  // Per-series color overrides + hidden set — keyed by series name. Controlled
  // by the parent when props are supplied (so state survives a chart-type
  // remount); otherwise managed internally.
  const [colorsInternal, setColorsInternal] = useState<Record<string, string>>({});
  const [hiddenInternal, setHiddenInternal] = useState<Set<string>>(new Set());
  const [openPickerFor, setOpenPickerFor] = useState<string | null>(null);

  const hiddenSeries = useMemo<Set<string>>(() => {
    if (hiddenSeriesProp) return hiddenSeriesProp instanceof Set ? hiddenSeriesProp : new Set(hiddenSeriesProp);
    return hiddenInternal;
  }, [hiddenSeriesProp, hiddenInternal]);
  const seriesColors = seriesColorsProp ?? colorsInternal;

  const colorOf = useCallback(
    (name: string, fallback: string) => seriesColors[name] ?? fallback,
    [seriesColors],
  );

  const toggleSeries = useCallback((name: string) => {
    if (onToggleSeries) { onToggleSeries(name); return; }
    setHiddenInternal(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  }, [onToggleSeries]);

  const setColor = useCallback((name: string, color: string) => {
    if (onSeriesColorChange) { onSeriesColorChange(name, color); return; }
    setColorsInternal(prev => ({ ...prev, [name]: color }));
  }, [onSeriesColorChange]);

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

  // Computed outside both useMemos so legendItems can reference them too.
  const usePerPeriod = !!(perPeriodGoalLine?.values && perPeriodGoalLine.values.some(v => v != null));
  const usePerPeriodSecondary = !!(perPeriodSecondaryGoalLine?.values?.some(v => v != null));

  // Legend overlay geometry (measured below). Declared here so the chart
  // option's grid.bottom can reserve vertical room for it above the dataZoom.
  const hasZoom = (data?.length ?? 0) > 8;
  const legendBottomPx = hasZoom ? 60 : 12;
  const legendRef = useRef<HTMLDivElement>(null);
  const [legendHeight, setLegendHeight] = useState(0);

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

    // Resolved upfront so goal-label colors and axis-rescaling both use the same name.
    const primarySeriesName = yAxisLabel || tooltipLabels.primary;
    const secondarySeriesName = tooltipLabels.secondary ?? 'Média/Usuário';

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

    // Bottom margin (below the rotated x-axis labels, which containLabel keeps
    // above it). It must clear the dataZoom slider (8 + 30 = 38px) and reserve
    // the measured legend overlay band [legendBottomPx, legendBottomPx + height]
    // so a tall, multi-row legend never overlaps the column labels.
    const legendReserve = legendHeight > 0 ? legendBottomPx + legendHeight + 20 : 0;
    const gridBottom = Math.max(needsScroll ? 78 : 36, legendReserve);
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

    // All configured per-period values (including future months with goals).
    // We show markers wherever a goal is configured, not just where bars exist.
    const filteredPerPeriodVals = usePerPeriod
      ? perPeriodGoalLine!.values
      : null;

    // When a goal line is set above the visible data range, ECharts' auto
    // axis-scaling doesn't expand to include the markLine (it's attached to a
    // dummy null-data series), so the line gets clipped off-chart. Push the
    // axis max up to at least the goal value + ~10% headroom.
    // Exclude hidden series from axis max so the chart rescales when a series is toggled off.
    // Secondary values go on the right axis (handled in buildDualYAxis), so they don't
    // contribute to the left-axis floor here regardless of visibility.
    const dataMaxRaw = (() => {
      if (isComparisonMode && data[0]?.comparisons) {
        return Math.max(0, ...data.flatMap(d =>
          (d.comparisons ?? []).flatMap(c =>
            hiddenSeries.has(c.entityName) ? [] : [c.value ?? 0]
          )
        ));
      }
      if (hiddenSeries.has(primarySeriesName)) return 0;
      return Math.max(0, ...data.map(d => d.value ?? 0));
    })();
    const goalSeriesName = usePerPeriod
      ? (perPeriodGoalLine!.label || 'Meta')
      : (goalLine?.label || 'Meta');
    const goalIsHidden = hiddenSeries.has(goalSeriesName);
    const perPeriodGoalMax = (filteredPerPeriodVals && !goalIsHidden)
      ? Math.max(0, ...filteredPerPeriodVals.filter((v): v is number => v != null))
      : 0;
    const effectiveGoalMax = goalIsHidden ? 0 : Math.max(goalLine?.value ?? 0, perPeriodGoalMax);
    const axisFloor = effectiveGoalMax > 0
      ? Math.ceil(Math.max(dataMaxRaw, effectiveGoalMax) * 1.08)
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

      const secIsHidden = hiddenSeries.has(secondarySeriesName);
      const secDataMax = secIsHidden ? 0 : Math.max(0, ...data.map(d => d.secondaryValue ?? 0));
      const secGoalSeriesName = usePerPeriodSecondary
        ? (perPeriodSecondaryGoalLine!.label || 'Meta Média')
        : (secondaryGoalLine?.label || 'Meta Média');
      const secGoalIsHidden = hiddenSeries.has(secGoalSeriesName);
      const secFlatGoalMax = (!secGoalIsHidden && secondaryGoalLine?.value != null) ? secondaryGoalLine.value : 0;
      const secPerPeriodMax = (!secGoalIsHidden && perPeriodSecondaryGoalLine?.values)
        ? Math.max(0, ...perPeriodSecondaryGoalLine.values.filter((v): v is number => v != null))
        : 0;
      const secGoalMax = Math.max(secFlatGoalMax, secPerPeriodMax);
      const secMax = Math.max(secDataMax, secGoalMax);
      const secondary: any = { ...base, type: 'value' as const, axisLabel: { ...base.axisLabel, formatter: (v: number) => secVF(v) }, splitLine: { show: false } };
      if (secMax > 0) { secondary.min = 0; secondary.max = Math.ceil(secMax * 1.12); }
      return [primary, secondary];
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

    // ── CATEGORY BANDS ────────────────────────────────────────────────────────
    // Opt-in alternating background bands, one per x-category. Same renderItem
    // technique as the year bands, but the "group" is a single category — so
    // grouped-bar sets (e.g. one group of collaborator bars per skill) read as
    // visually separated blocks, the way years are separated on productivity.
    const categoryBandSeries: any[] = [];
    if (categoryBands && xAxisData.length > 1) {
      const bandColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.035)';
      categoryBandSeries.push({
        type: 'custom',
        silent: true,
        animation: false,
        legendHoverLink: false,
        tooltip: { show: false },
        z: -6,
        data: [[0, 0]],
        renderItem: (params: any, api: any) => {
          const grid = params.coordSys ?? { x: 0, y: 0, width: 0, height: 0 };
          const yTop = grid.y;
          const yHeight = grid.height;
          const halfSlot = api.size([1, 0])[0] / 2;
          const children: any[] = [];
          for (let i = 1; i < xAxisData.length; i += 2) {
            const c = api.coord([i, 0])[0];
            children.push({
              type: 'rect' as const,
              silent: true,
              shape: { x: c - halfSlot, y: yTop, width: halfSlot * 2, height: yHeight },
              style: { fill: bandColor },
            });
          }
          return { type: 'group' as const, children };
        },
        clip: true,
      });
    }

    // ── GOAL LINE ─────────────────────────────────────────────────────────────
    // perPeriodGoalLine takes precedence: renders a stepped line that follows
    // the configured goal for each period. Falls back to flat goalLine.
    const goalLineSeries: any[] = [];
    if (usePerPeriod) {
      const lbl = perPeriodGoalLine!.label || 'Meta';
      const goalColor = colorOf(lbl, '#10b981');
      // filteredPerPeriodVals was pre-computed above (only non-zero data positions).
      const vals = filteredPerPeriodVals!;
      goalLineSeries.push({
        type: 'line' as const, name: lbl,
        data: vals,
        symbol: 'diamond',
        symbolSize: 12,
        showSymbol: true,
        connectNulls: false,
        animation: false,
        silent: true,
        legendHoverLink: false,
        tooltip: { show: false },
        // Dashed line connecting adjacent markers.
        lineStyle: { color: goalColor, width: 2, type: 'dashed' as const },
        itemStyle: { color: goalColor },
        label: {
          show: true,
          position: 'top' as const,
          formatter: (params: any) => params.value == null ? '' : valueFormatter(params.value, yAxisMode),
          color: textColor, fontSize: 10,
          backgroundColor: 'transparent', borderWidth: 0,
        },
      });
    } else if (goalLine?.value != null) {
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

    // ── SECONDARY PER-PERIOD GOAL LINE (right axis, both-mode only) ──────────
    const perPeriodSecondaryGoalSeries: any[] = [];
    if (yAxisMode === 'both' && usePerPeriodSecondary) {
      const lbl3 = perPeriodSecondaryGoalLine!.label || 'Meta Média';
      const goalColor3 = colorOf(lbl3, '#f59e0b');
      const vals3 = perPeriodSecondaryGoalLine!.values;
      perPeriodSecondaryGoalSeries.push({
        type: 'line' as const, name: lbl3, data: vals3,
        symbol: 'diamond', symbolSize: 12, showSymbol: true,
        connectNulls: false, animation: false, silent: true,
        lineStyle: { color: goalColor3, width: 2, type: 'dashed' as const },
        itemStyle: { color: goalColor3 },
        yAxisIndex: 1,
        label: {
          show: true, position: 'top' as const,
          formatter: (params: any) => params.value == null ? '' : secVF(params.value),
          color: textColor, fontSize: 10,
        },
      });
    }

    // ── SECONDARY GOAL LINE (right axis, both-mode only) ──────────────────────
    const secondaryGoalSeries: any[] = [];
    if (yAxisMode === 'both' && !usePerPeriodSecondary && secondaryGoalLine?.value != null) {
      const lbl2 = secondaryGoalLine.label || 'Meta Média';
      const goalColor2 = colorOf(lbl2, '#f59e0b');
      secondaryGoalSeries.push({
        type: 'line' as const, name: lbl2, data: xAxisData.map(() => null),
        animation: false, silent: true, legendHoverLink: false,
        showSymbol: false, lineStyle: { opacity: 0 }, tooltip: { show: false },
        itemStyle: { color: goalColor2 },
        yAxisIndex: 1,
        markLine: {
          silent: true,
          symbol: ['none', 'none'],
          data: [{ yAxis: secondaryGoalLine.value, name: lbl2 }],
          lineStyle: { color: goalColor2, width: 2, type: 'dashed' as const },
          label: {
            formatter: `${lbl2}: ${secVF(secondaryGoalLine.value)}`,
            color: goalColor2, fontSize: 11,
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
          // Per-slice color via colorOf so callers can pin a palette (e.g. the
          // 0–5 score-band colors for a distribution pie); falls back to the
          // default rotating palette, matching prior behaviour when unset.
          data: data.map((item, i) => ({
            name: item.name,
            value: getItemValue(item),
            itemStyle: { color: colorOf(item.name, CHART_COLORS[i % CHART_COLORS.length]) },
          })),
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
            emphasis: { focus: 'none', itemStyle: { color: lightenColor(color) } },
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
          series: [...categoryBandSeries, ...yearBandSeries, ...goalLineSeries, ...secondaryGoalSeries, ...perPeriodSecondaryGoalSeries, ...barSeries, ...lineSeries],
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
            if (p.value == null) return;
            const dot = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color};margin-right:4px;"></span>`;
            const val = (p.yAxisIndex ?? 0) === 1 ? secVF(p.value) : valueFormatter(p.value, 'count' as any);
            html += `${dot}${p.seriesName}: ${val}<br/>`;
          });
          return html;
        },
      };

      const gridBothBottom = needsScroll ? 124 : 80;
      // Determine primary/secondary rendering types. `primaryChartType` prop
      // overrides the global chartType for the primary series; `secondaryChartType`
      // overrides the default 'line' for the secondary series.
      const effPrimary = primaryChartType ?? (baseChartType === 'line-stacked' ? 'line' : 'bar');
      const effSecondary = secondaryChartType ?? 'line';
      const primaryIsLine = effPrimary !== 'bar';
      const primarySmooth = effPrimary === 'line-smooth' || effPrimary === 'area-smooth';
      const primaryIsArea = effPrimary === 'area' || effPrimary === 'area-smooth';
      const secondaryIsBar = effSecondary === 'bar';
      const secondaryIsArea = effSecondary === 'area' || effSecondary === 'area-smooth';
      const secondarySmooth = effSecondary === 'line-smooth' || effSecondary === 'area-smooth';
      const primaryName = tooltipLabels.primary;
      const secondaryName = tooltipLabels.secondary ?? 'Média/Usuário';
      const primaryColor = colorOf(primaryName, CHART_COLORS[0]);
      const secondaryColor = colorOf(secondaryName, CHART_COLORS[1]);
      // Keep the secondary series consistent with the primary: if the primary
      // plots a 0 for an empty / future period, the secondary plots 0 too —
      // otherwise the blue line continues across the x-axis while the red one
      // suddenly stops, which looks like a bug to the user (see the Jun-Dez
      // gap in the both-mode chart). Use the raw secondary value with a 0
      // fallback so both series cover the same x-range identically.
      const secondaryData = data.map(item => item.secondaryValue ?? 0);
      return {
        tooltip: simpleBothTooltip,
        legend: { show: false },
        grid: { left: '3%', right: '4%', bottom: gridBothBottom, containLabel: true },
        xAxis: xAxisBase, yAxis: buildDualYAxis(),
        color: CHART_COLORS, dataZoom,
        series: [
          ...categoryBandSeries,
          ...yearBandSeries,
          ...goalLineSeries,
          {
            name: primaryName,
            type: primaryIsLine ? 'line' as const : 'bar' as const,
            yAxisIndex: 0,
            data: data.map(item => ({ ...item, value: getItemValue(item) })),
            itemStyle: { color: primaryColor },
            ...(primaryIsLine
              ? {
                  smooth: primarySmooth,
                  lineStyle: { width: 2, color: primaryColor },
                  ...(primaryIsArea ? { areaStyle: { opacity: 0.3, color: primaryColor } } : {}),
                  label: pointLabel,
                }
              : { label: barLabel, emphasis: { focus: 'none', itemStyle: { color: lightenColor(primaryColor) } } }),
          },
          {
            name: secondaryName,
            type: secondaryIsBar ? 'bar' as const : 'line' as const,
            yAxisIndex: 1,
            data: secondaryIsBar
              ? data.map(item => item.secondaryValue ?? 0)
              : secondaryData,
            itemStyle: { color: secondaryColor },
            ...(secondaryIsBar
              ? { label: barLabel }
              : {
                  lineStyle: { width: 2.5, type: 'solid' as const, color: secondaryColor },
                  symbol: 'circle',
                  symbolSize: 7,
                  smooth: secondarySmooth,
                  connectNulls: false,
                  ...(secondaryIsArea ? { areaStyle: { opacity: 0.3, color: secondaryColor } } : {}),
                  label: secondaryPointLabel,
                }),
          },
          ...secondaryGoalSeries,
          ...perPeriodSecondaryGoalSeries,
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
            ...(type === 'bar' ? { emphasis: { focus: 'none', itemStyle: { color: lightenColor(color) } } } : {}),
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
        const list = Array.isArray(params) ? params : params ? [params] : [];
        if (!list.length) return '';
        let html = `<strong style="color:${textColor}">${list[0].name}</strong><br/>`;
        list.forEach((p: any) => {
          if (p.value == null || !p.seriesName) return;
          const dot = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color};margin-right:5px;vertical-align:middle;"></span>`;
          html += `${dot}${p.seriesName}: ${valueFormatter(p.value, yAxisMode)}${seriesHint}<br/>`;
        });
        return html;
      };

      return {
        tooltip: {
          ...tooltipBase,
          trigger: tooltipTrigger === 'item' ? 'item' : 'axis',
          axisPointer: { type: tooltipTrigger === 'item' ? 'none' : (baseChartType.includes('bar') ? 'shadow' : 'line') },
          formatter: compTooltipFormatter,
        },
        legend: { show: false },
        grid: baseGrid, xAxis: xAxisBase, yAxis: buildYAxis(),
        color: CHART_COLORS, dataZoom,
        series: [...categoryBandSeries, ...yearBandSeries, ...goalLineSeries, ...series, ...compTrendSeries],
      };
    }

    // ── SIMPLE MODE ────────────────────────────────────────────────────────────
    const seriesData = data.map(item => ({ ...item, value: getItemValue(item) }));

    const simpleTooltip = {
      ...tooltipBase,
      trigger: (tooltipTrigger === 'item' ? 'item' : 'axis') as const,
      axisPointer: { type: (tooltipTrigger === 'item' ? 'none' : (baseChartType.startsWith('bar') ? 'shadow' : 'line')) as const },
      formatter: (params: any) => {
        const list = Array.isArray(params) ? params : params ? [params] : [];
        if (list.length === 0) return '';
        const real = list.filter((p: any) => p.data != null && typeof p.data === 'object');
        const p = real[0] ?? list[0];
        let html = `<strong style="color:${textColor}">${p.name}</strong><br/>`;
        list.forEach((par: any) => {
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
    else if (categoryLegend) {
      // One distinct color per bar (one bar = one category). colorOf lets the
      // legend's color picker override per bar; hiding a legend entry blanks its
      // bar (value → null) just like toggling a series elsewhere.
      const barData = seriesData.map((it: any, i: number) => {
        const entry = categoryLegend[i];
        const label = entry?.label ?? '';
        const c = colorOf(label, entry?.color ?? simpleColor);
        const hidden = hiddenSeries.has(label);
        return {
          ...it,
          value: hidden ? null : it.value,
          itemStyle: { color: c },
          emphasis: { itemStyle: { color: lightenColor(c) } },
        };
      });
      series = [{ ...baseSeriesOptions, data: barData, type: 'bar', label: barLabel, emphasis: { focus: 'none' } }];
    } else if (valueColor) {
      // Colour each bar by its own value (e.g. 0–5 score band); each bar
      // lightens its OWN colour on hover.
      const barData = seriesData.map((it: any) => {
        const c = valueColor(it.value) ?? simpleColor;
        return { ...it, itemStyle: { color: c }, emphasis: { itemStyle: { color: lightenColor(c) } } };
      });
      series = [{ ...baseSeriesOptions, data: barData, type: 'bar', label: barLabel, emphasis: { focus: 'none' } }];
    } else
      series = [{ ...baseSeriesOptions, type: 'bar', label: barLabel, emphasis: { focus: 'none', itemStyle: { color: lightenColor(simpleColor) } } }];

    return {
      tooltip: simpleTooltip,
      legend: { show: false },
      grid: baseGrid, xAxis: xAxisBase, yAxis: buildYAxis(),
      color: CHART_COLORS, dataZoom,
      series: [...categoryBandSeries, ...yearBandSeries, ...goalLineSeries, ...trendSeries, ...series],
    };
  }, [data, chartType, yAxisMode, isComparisonMode, yAxisLabel, valueFormatter, tooltipLabels, secondaryValueFormatter, trendLine, goalLine, perPeriodGoalLine, secondaryGoalLine, perPeriodSecondaryGoalLine, usePerPeriod, usePerPeriodSecondary, isDark, seriesColors, hiddenSeries, hasClickHandler, trendLabels, colorOf, primaryChartType, secondaryChartType, tooltipTrigger, categoryBands, valueColor, categoryLegend, legendHeight, legendBottomPx]);

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
          // Preserve the series set by `mouseover` while the pointer stays in
          // the SAME category — otherwise the constant axis-pointer updates wipe
          // it and a click on a specific grouped bar collapses to category-level
          // (which broke per-series drill-downs, e.g. clicking one collaborator's
          // column). Series is reset only when the category changes.
          const prev = hoveredRef.current;
          hoveredRef.current = {
            idx,
            name: String(categories[idx] ?? ''),
            series: prev && prev.idx === idx ? prev.series : '',
          };
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
      // Leaving a specific bar drops back to category-level (so the empty band /
      // axis label opens the broad modal), while staying inside the bar keeps the
      // series for a precise drill-down.
      mouseout: (params: any) => {
        if (params.componentType === 'series' && hoveredRef.current) {
          hoveredRef.current = { ...hoveredRef.current, series: '' };
        }
      },
      // Pie has no cartesian axis, so the zrender pixel→category resolver can't
      // fire for it — wire a direct series click so a slice opens its drill-down.
      click: (params: any) => {
        if (params.componentType === 'series' && params.seriesType === 'pie') {
          onDataPointClickRef.current?.(params.dataIndex ?? 0, String(params.name ?? ''), String(params.name ?? ''), 'plot');
          return;
        }
        // For grouped bars/lines, ECharts' series click fires just BEFORE the
        // zrender click below — record the exact clicked series so the drill-down
        // resolves the right one (e.g. WHICH campaign in a 2-campaign comparison),
        // instead of collapsing to the category.
        if (params.componentType === 'series' && typeof params.dataIndex === 'number') {
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
  // Category-legend mode: one entry per bar (single series only). It flows
  // through the SAME interactive legend below (color picker + visibility toggle).
  const useCategoryLegend = !!categoryLegend && !isComparisonMode && baseChartType !== 'pie';
  const showCustomLegend = showLegend && baseChartType !== 'pie';

  // Build the list of legend items mirroring the series the option actually
  // adds, in the same order they appear.
  const legendItems = useMemo(() => {
    if (!data?.length || baseChartType === 'pie') return [] as Array<{ name: string; color: string; seriesType: 'bar' | 'line' | 'dashed' }>;
    if (useCategoryLegend && categoryLegend) {
      // One entry per bar; colorOf lets the picker override the default color.
      return categoryLegend.map(it => ({ name: it.label, color: colorOf(it.label, it.color), seriesType: 'bar' as const }));
    }
    const items: Array<{ name: string; color: string; seriesType: 'bar' | 'line' | 'dashed' }> = [];
    const push = (name: string, fallback: string, seriesType: 'bar' | 'line' | 'dashed' = 'bar') =>
      items.push({ name, color: colorOf(name, fallback), seriesType });
    // Primary series type based on current chart
    const primaryType: 'bar' | 'line' = (baseChartType === 'bar' || baseChartType === 'bar-stacked') ? 'bar' : 'line';

    if (yAxisMode === 'both') {
      if (isComparisonMode && data[0]?.comparisons) {
        data[0].comparisons.forEach((c, i) => push(c.entityName, CHART_COLORS[i % CHART_COLORS.length], 'bar'));
        data[0].comparisons.forEach((c, i) => push(`${c.entityName} (Média)`, CHART_COLORS[i % CHART_COLORS.length], 'line'));
      } else {
        const effPrim = primaryChartType ?? primaryType;
        const effSec = secondaryChartType ?? 'line';
        const primLegendType: 'bar' | 'line' = (effPrim === 'bar') ? 'bar' : 'line';
        const secLegendType: 'bar' | 'line' = (effSec === 'bar') ? 'bar' : 'line';
        push(tooltipLabels.primary, CHART_COLORS[0], primLegendType);
        push(tooltipLabels.secondary ?? 'Média/Usuário', CHART_COLORS[1], secLegendType);
      }
      if (usePerPeriodSecondary) {
        push(perPeriodSecondaryGoalLine!.label || 'Meta Média', '#f59e0b', 'dashed');
      } else if (secondaryGoalLine?.value != null) {
        push(secondaryGoalLine.label || 'Meta Média', '#f59e0b', 'dashed');
      }
    } else if (isComparisonMode && data[0]?.comparisons) {
      data[0].comparisons.forEach((c, i) => push(c.entityName, CHART_COLORS[i % CHART_COLORS.length], primaryType));
      if (trendLine && baseChartType !== 'bar-stacked' && baseChartType !== 'line-stacked') {
        data[0].comparisons.forEach((c, i) =>
          push(`${c.entityName} · ${trendLabels[trendLine]}`, CHART_COLORS[i % CHART_COLORS.length], 'dashed')
        );
      }
    } else {
      push(yAxisLabel || tooltipLabels.primary, CHART_COLORS[0], primaryType);
      if (trendLine) push(trendLabels[trendLine], '#f59e0b', 'dashed');
    }
    const effectiveGoalLabel = usePerPeriod
      ? (perPeriodGoalLine?.label || 'Meta')
      : (goalLine?.label || 'Meta');
    if (usePerPeriod || goalLine?.value != null) {
      push(effectiveGoalLabel, '#10b981', 'dashed');
    }
    return items;
  }, [data, baseChartType, yAxisMode, isComparisonMode, tooltipLabels, yAxisLabel, trendLine, trendLabels, goalLine, perPeriodGoalLine, secondaryGoalLine, perPeriodSecondaryGoalLine, colorOf, usePerPeriod, usePerPeriodSecondary, primaryChartType, secondaryChartType, useCategoryLegend, categoryLegend]);

  // Drop hidden entries that no longer exist (e.g. after switching modes).
  // Only for internal state — when the parent controls hiddenSeries it owns the
  // lifecycle (and stale names are harmless: they just match no series).
  useEffect(() => {
    if (hiddenSeriesProp) return;
    if (!hiddenInternal.size) return;
    const valid = new Set(legendItems.map(i => i.name));
    let changed = false;
    hiddenInternal.forEach(n => { if (!valid.has(n)) changed = true; });
    if (changed) {
      setHiddenInternal(prev => new Set([...prev].filter(n => valid.has(n))));
    }
  }, [legendItems, hiddenInternal, hiddenSeriesProp]);

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
  // Robust click → drill-down. ECharts' axisLabel triggerEvent is unreliable
  // across chart types, so we bind a low-level zrender click and map the cursor
  // x back to a category via the PUBLIC convertFromPixel API. This makes the
  // column body, the empty space above a short bar, AND the rotated axis label
  // all open the drill-down. We still prefer the hovered series (set by
  // mouseover) so a click on a specific grouped bar narrows to that series.
  const handleChartReady = useCallback((inst: any) => {
    const zr = inst?.getZr?.();
    if (!zr) return;
    // Resolve a pixel to a clickable category, or null. `region` is 'label'
    // when the click is below the axis line (on the rotated x-axis label text)
    // vs 'plot' on the bar/plot area. Excludes the dataZoom slider far below.
    const resolveHit = (x: number, y: number): { idx: number; region: 'plot' | 'label' } | null => {
      let axisY: number | undefined;
      try { axisY = inst.convertToPixel({ yAxisIndex: 0 }, 0); } catch { /* noop */ }
      if (typeof axisY === 'number' && Number.isFinite(axisY) && y > axisY + 64) return null;
      let dataX: any;
      try { dataX = inst.convertFromPixel({ xAxisIndex: 0 }, x); } catch { return null; }
      if (dataX == null || !Number.isFinite(dataX)) return null;
      const idx = Math.round(dataX);
      if (idx < 0 || idx >= categoriesRef.current.length) return null;
      const region: 'plot' | 'label' =
        typeof axisY === 'number' && Number.isFinite(axisY) && y > axisY ? 'label' : 'plot';
      return { idx, region };
    };
    zr.on('click', (e: any) => {
      if (!onDataPointClickRef.current) return;
      const hit = resolveHit(e.offsetX, e.offsetY);
      if (!hit) return;
      const cats = categoriesRef.current;
      const h = hoveredRef.current;
      const series = (h && h.idx === hit.idx) ? (h.series || '') : '';
      onDataPointClickRef.current(hit.idx, String(cats[hit.idx] ?? ''), series, hit.region);
    });
    // zrender resets the canvas cursor each frame from the hovered graphic, so
    // CSS !cursor-pointer doesn't stick over labels / empty plot area. Set it
    // imperatively so the whole clickable column band shows a pointer.
    zr.on('mousemove', (e: any) => {
      if (!onDataPointClickRef.current) return;
      zr.setCursorStyle(resolveHit(e.offsetX, e.offsetY) ? 'pointer' : 'default');
    });
  }, []);

  // Measuring effect for the legend overlay height (declared near the legend
  // render below). grid.bottom reserves room for it above the zoom slider.
  useEffect(() => {
    const el = legendRef.current;
    if (!showCustomLegend || legendItems.length === 0 || !el) {
      setLegendHeight(0);
      return;
    }
    const measure = () => setLegendHeight(el.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [showCustomLegend, legendItems]);

  // `height` from the page can be a fixed CSS string ('600px'), '100%' to fill
  // the parent (most common — see collection/revenue-quotes/nfse pages), or a
  // number meant as px. We forward it to the outer wrapper so the *flex
  // container* is the one that owns the height, and let ReactECharts fill it
  // at 100%. Without this, '100%' on the chart collapses because the
  // intermediate `flex-col` had no height of its own and the chart fell back
  // to its minHeight (380px) — that's the "empty space below the chart" bug.
  const resolvedHeight = typeof height === 'number' ? `${height}px` : height;

  return (
    <div className="flex flex-col" style={{ height: resolvedHeight, minHeight: 380 }}>
      <div
        className={cn(
          'relative flex-1 min-h-0',
          hasClickHandler && '[&_canvas]:!cursor-pointer [&>div]:!cursor-pointer',
        )}
        style={{ cursor: hasClickHandler ? 'pointer' : 'default' }}
      >
        <ReactECharts
          ref={chartRef}
          key={`${chartType}-${isComparisonMode}-${yAxisMode}`}
          option={option}
          notMerge={true}
          style={{ height: '100%', width: '100%', cursor: hasClickHandler ? 'pointer' : 'default' }}
          opts={{ renderer: 'canvas' }}
          onEvents={onEvents}
          onChartReady={handleChartReady}
        />
        {/* Legend overlay sits in the band above the dataZoom slider. Its
            measured height feeds grid.bottom so the rotated x-axis labels are
            pushed up clear of it (no overlap), however many rows it wraps to. */}
        {showCustomLegend && legendItems.length > 0 && (
          <div
            ref={legendRef}
            className="pointer-events-none absolute left-0 right-0 flex flex-wrap justify-center gap-x-4 gap-y-1 px-2"
            style={{ bottom: legendBottomPx }}
          >
            {legendItems.map(item => {
            const hidden = hiddenSeries.has(item.name);
            const alpha = hidden ? 0.35 : 1;
            return (
              <div key={item.name} className="pointer-events-auto flex items-center gap-1.5 bg-card/60 backdrop-blur-sm px-1.5 py-0.5 rounded">
                <Popover
                  open={openPickerFor === item.name}
                  onOpenChange={open => setOpenPickerFor(open ? item.name : null)}
                >
                  <PopoverTrigger asChild>
                    <button
                      aria-label={`Cor da série ${item.name}`}
                      className="flex items-center justify-center transition-transform hover:scale-110 focus:outline-none"
                      style={{ opacity: alpha }}
                    >
                      {item.seriesType === 'bar' ? (
                        <svg width="14" height="14" viewBox="0 0 14 14" className="block">
                          <rect x="1" y="1" width="12" height="12" rx="2" fill={item.color} />
                        </svg>
                      ) : item.seriesType === 'line' ? (
                        <svg width="22" height="12" viewBox="0 0 22 12" className="block">
                          <line x1="0" y1="6" x2="22" y2="6" stroke={item.color} strokeWidth="2" />
                          <circle cx="11" cy="6" r="3.5" fill={item.color} />
                        </svg>
                      ) : (
                        <svg width="22" height="12" viewBox="0 0 22 12" className="block">
                          <line x1="0" y1="6" x2="22" y2="6" stroke={item.color} strokeWidth="2" strokeDasharray="5 3" />
                        </svg>
                      )}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="center" className="w-auto p-3">
                    <p className="text-xs font-medium mb-2 text-muted-foreground">Cor da série</p>
                    <div className="grid grid-cols-6 gap-1.5">
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
                            setColor(item.name, color);
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
