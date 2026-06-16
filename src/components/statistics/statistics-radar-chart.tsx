// Multi-series radar chart for skill-assessment comparisons.
//
// Sibling of statistics-chart.tsx — uses the same ECharts/echarts-for-react
// stack, the same CHART_COLORS palette, the same dark-mode detection, and
// the same color-picker / hide-on-click legend pattern. Radar is structurally
// different enough (polar coords, indicators array, no x/y axis) that it gets
// its own file rather than another branch inside the already-1100-line main
// chart.

import {
  useMemo,
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { CHART_COLORS } from '@/types/statistics-common';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export interface StatisticsRadarChartHandle {
  getOption: () => EChartsOption | null;
}

export interface RadarSeriesInput {
  /** Stable, unique id used for legend toggling and color overrides. */
  id: string;
  /** Display name in tooltip + legend. */
  name: string;
  /** Values aligned to the `indicators` prop, in order. nulls render as 0. */
  values: (number | null)[];
  /**
   * Optional explicit color. Falls back to CHART_COLORS by series index.
   */
  color?: string;
  /**
   * When true the series renders as a dashed outline only (no fill). Useful
   * for benchmark / reference lines like the company-average overlay.
   */
  isBenchmark?: boolean;
}

interface StatisticsRadarChartProps {
  /**
   * Axis labels around the radar (one per arm). Order must match the order of
   * `values` in every series. `max` controls the radial scale per indicator.
   */
  indicators: { name: string; max: number }[];
  series: RadarSeriesInput[];
  /** Chart container height. Defaults to 100% so callers can drive sizing. */
  height?: string | number;
  /** Number formatter for tooltip values. Defaults to 2-decimal pt-BR. */
  valueFormatter?: (value: number) => string;
  /** Visual variant of the radar grid. */
  shape?: 'polygon' | 'circle';
  /**
   * Fired when the user clicks an axis label (indicator name) around the
   * radar — e.g. a skill or topic name. Receives the clicked label and its
   * index in `indicators`. When provided, the labels render as a pointer.
   */
  onIndicatorClick?: (name: string, index: number, region: 'vertex' | 'label') => void;
  /**
   * Controlled hidden-series set, keyed by series NAME. When provided, the
   * component defers to the parent for legend toggle state (so it survives the
   * chart being remounted on a chart-type switch). Omit for internal state.
   */
  hiddenSeries?: Set<string> | string[];
  onToggleSeries?: (name: string) => void;
  /** Controlled per-series color overrides, keyed by series NAME. */
  seriesColors?: Record<string, string>;
  onSeriesColorChange?: (name: string, color: string) => void;
  /** Show the interactive legend (color swatches) below the radar. Default true. */
  showLegend?: boolean;
}

const defaultFormatter = (v: number) =>
  new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v);

// Greedy word-wrap for radar axis labels. The previous implementation broke on
// every whitespace character once a label crossed 18 chars, producing one word
// per line ("1.\nOrganização\ndo\nPosto…"). Instead, fill each line up to
// `maxCharsPerLine`, never split a word, and cap at `maxLines` (appending an
// ellipsis if anything was dropped). Tuned for the radar's outer label band:
// 18 chars × 3 lines comfortably fits topic names like
// "1. Organização do Posto de Trabalho".
function wrapAxisLabel(text: string, maxCharsPerLine = 18, maxLines = 3): string {
  if (!text) return '';
  if (text.length <= maxCharsPerLine) return text;
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (!current) { current = w; continue; }
    if ((current + ' ' + w).length <= maxCharsPerLine) {
      current += ' ' + w;
    } else {
      lines.push(current);
      current = w;
      if (lines.length === maxLines) {
        // Out of line budget — drop the in-progress word and mark truncation.
        current = '';
        lines[lines.length - 1] = lines[lines.length - 1].replace(/\s*$/, '') + '…';
        return lines.join('\n');
      }
    }
  }
  if (current) lines.push(current);
  return lines.join('\n');
}

export const StatisticsRadarChart = forwardRef<
  StatisticsRadarChartHandle,
  StatisticsRadarChartProps
>(function StatisticsRadarChart(
  {
    indicators,
    series,
    height = '100%',
    valueFormatter = defaultFormatter,
    shape = 'polygon',
    onIndicatorClick,
    hiddenSeries: hiddenSeriesProp,
    onToggleSeries,
    seriesColors: seriesColorsProp,
    onSeriesColorChange,
    showLegend = true,
  },
  externalRef,
) {
  const chartRef = useRef<any>(null);
  // Container for the DOM value-chip overlay (positioned over the canvas).
  const containerRef = useRef<HTMLDivElement>(null);
  const [overlaySize, setOverlaySize] = useState<{ w: number; h: number } | null>(null);
  // Which value chip (`${seriesName}:${indicatorIndex}`) is hovered → scaled up.
  const [hoverKey, setHoverKey] = useState<string | null>(null);

  useImperativeHandle(
    externalRef,
    () => ({
      getOption: () => {
        const inst = chartRef.current?.getEchartsInstance?.();
        return inst ? (inst.getOption() as EChartsOption) : null;
      },
    }),
    [],
  );

  const [isDark, setIsDark] = useState(() =>
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark'),
  );
  // Legend state is keyed by series NAME (stable across chart-type switches and
  // shared with the bar chart). Controlled by the parent when props are passed;
  // otherwise managed internally.
  const [colorsInternal, setColorsInternal] = useState<Record<string, string>>({});
  const [hiddenInternal, setHiddenInternal] = useState<Set<string>>(new Set());
  const [openPickerFor, setOpenPickerFor] = useState<string | null>(null);

  const hiddenSeries = useMemo<Set<string>>(() => {
    if (hiddenSeriesProp) return hiddenSeriesProp instanceof Set ? hiddenSeriesProp : new Set(hiddenSeriesProp);
    return hiddenInternal;
  }, [hiddenSeriesProp, hiddenInternal]);
  const seriesColors = seriesColorsProp ?? colorsInternal;

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
    return () => observer.disconnect();
  }, []);

  const colorOf = useCallback(
    (name: string, fallback: string) => seriesColors[name] ?? fallback,
    [seriesColors],
  );

  const toggleSeries = useCallback((name: string) => {
    if (onToggleSeries) { onToggleSeries(name); return; }
    setHiddenInternal(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, [onToggleSeries]);

  const setColor = useCallback((name: string, color: string) => {
    if (onSeriesColorChange) { onSeriesColorChange(name, color); return; }
    setColorsInternal(prev => ({ ...prev, [name]: color }));
  }, [onSeriesColorChange]);

  // Resolve per-series colors once so the legend and the chart agree.
  const resolvedSeries = useMemo(
    () =>
      series.map((s, i) => ({
        ...s,
        resolvedColor: colorOf(s.name, s.color ?? CHART_COLORS[i % CHART_COLORS.length]),
      })),
    [series, colorOf],
  );

  // Per-vertex value labels become noise once you stack many polygons:
  // 6 indicators × 5 series = 30 chips, and they start to overlap. Cap at
  // 4 visible polygons; above that, fall back to tooltip-only readout and
  // surface a tiny hint in the legend row.
  const visibleCount = resolvedSeries.reduce(
    (n, s) => (hiddenSeries.has(s.name) ? n : n + 1),
    0,
  );
  const labelsEnabled = visibleCount > 0 && visibleCount <= 4;

  // ── Shape- and axis-aware sizing ─────────────────────────────────────────
  // A circle radar needs the full 2·r vertically, but a polygon's vertical
  // extent depends on its vertices: a triangle (vertex up) only reaches
  // cy + 0.5·r at the bottom, so the SAME radius makes a circle overflow while
  // a triangle leaves a bottom gap. We size per shape + axis count so the drawn
  // shape fills the height without overflowing. (Radius % is of min(w,h)/2;
  // this page's chart area is always wider than tall, so we reason in height
  // fractions.) Shared by the ECharts option AND the DOM chip overlay below.
  const radarGeom = useMemo(() => {
    const nAx = indicators.length || 3;
    const startA = Math.PI / 2; // radar.startAngle = 90°, CCW
    let topFrac = 1;
    let botFrac = 1;
    if (shape === 'polygon' && nAx >= 3) {
      topFrac = 0;
      botFrac = 0;
      for (let i = 0; i < nAx; i++) {
        const s = Math.sin(startA + (2 * Math.PI * i) / nAx);
        topFrac = Math.max(topFrac, s);
        botFrac = Math.max(botFrac, -s);
      }
    }
    const MT = 0.10;
    const MB = 0.12;
    const rFrac = Math.min(0.5, (1 - MT - MB) / (topFrac + botFrac));
    const cyFrac = MT + topFrac * rFrac;
    return {
      startAngle: startA,
      radiusPct: Math.round(rFrac * 200),
      centerYPct: Math.round(cyFrac * 100),
    };
  }, [indicators.length, shape]);

  // Track the chart-area pixel size so the DOM value-chip overlay can position
  // chips exactly over the canvas vertices (same geometry as radarGeom).
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => setOverlaySize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Value chips, drawn as DOM elements (not ECharts labels) so we can place
  // them past the tips and scale just the hovered one. One per visible series ×
  // indicator; staggered outward per series so stacked tips don't collide.
  const valueChips = useMemo(() => {
    type Chip = { key: string; x: number; y: number; hw: number; hh: number; text: string; color: string };
    if (!overlaySize || !labelsEnabled) return [] as Chip[];
    const { w, h } = overlaySize;
    if (!w || !h) return [];
    const cx = w / 2;
    const cy = (radarGeom.centerYPct / 100) * h;
    const r = (radarGeom.radiusPct / 100) * (Math.min(w, h) / 2);
    const n = indicators.length;

    // Seed each chip just outside its tip (along the axis).
    const out: Chip[] = [];
    resolvedSeries.forEach(s => {
      if (hiddenSeries.has(s.name)) return;
      for (let i = 0; i < n; i++) {
        const v = s.values[i];
        if (typeof v !== 'number') continue;
        const max = indicators[i].max || 5;
        const th = radarGeom.startAngle + (2 * Math.PI * i) / n;
        const rad = Math.min(1, v / max) * r;
        const vx = cx + rad * Math.cos(th);
        const vy = cy - rad * Math.sin(th);
        const off = 16; // push outward, just past the tip
        const text = valueFormatter(v);
        out.push({
          key: `${s.name}:${i}`,
          x: vx + Math.cos(th) * off,
          y: vy - Math.sin(th) * off,
          hw: text.length * 3.4 + 9, // approx half-width of the chip
          hh: 10,                    // approx half-height
          text,
          color: s.resolvedColor,
        });
      }
    });

    // De-overlap: iteratively separate any two chips whose boxes intersect,
    // pushing along the axis of least penetration (a few passes converge for
    // the handful of chips we ever draw).
    const GAP = 3;
    for (let iter = 0; iter < 30; iter++) {
      let moved = false;
      for (let a = 0; a < out.length; a++) {
        for (let b = a + 1; b < out.length; b++) {
          const A = out[a];
          const B = out[b];
          let dx = B.x - A.x;
          let dy = B.y - A.y;
          const ox = A.hw + B.hw + GAP - Math.abs(dx);
          const oy = A.hh + B.hh + GAP - Math.abs(dy);
          if (ox > 0 && oy > 0) {
            if (dx === 0 && dy === 0) { dx = a - b; dy = 0; }
            if (ox < oy) {
              const push = (ox / 2) * (dx < 0 ? -1 : 1);
              A.x -= push; B.x += push;
            } else {
              const push = (oy / 2) * (dy < 0 ? -1 : 1);
              A.y -= push; B.y += push;
            }
            moved = true;
          }
        }
      }
      if (!moved) break;
    }
    return out;
  }, [overlaySize, labelsEnabled, radarGeom, indicators, resolvedSeries, hiddenSeries, valueFormatter]);

  const option = useMemo((): EChartsOption => {
    if (!indicators.length || !resolvedSeries.length) return {};

    const textColor = isDark ? '#f4f4f5' : '#3f3f46';
    const subTextColor = isDark ? '#a1a1aa' : '#71717a';
    const splitLineColor = isDark ? '#3f3f46' : '#d4d4d8';
    const splitAreaColors = isDark
      ? ['rgba(63,63,70,0.15)', 'rgba(63,63,70,0.05)']
      : ['rgba(244,244,245,0.6)', 'rgba(228,228,231,0.3)'];
    const tooltipBg = isDark ? 'rgba(24,24,27,0.95)' : 'rgba(255,255,255,0.97)';
    const tooltipBorder = isDark ? '#3f3f46' : '#e4e4e7';
    const radarRadius = `${radarGeom.radiusPct}%`;
    const radarCenterY = `${radarGeom.centerYPct}%`;

    return {
      tooltip: {
        trigger: 'item',
        backgroundColor: tooltipBg,
        borderColor: tooltipBorder,
        textStyle: { color: textColor, fontSize: 12 },
        extraCssText: 'box-shadow: 0 4px 12px rgba(0,0,0,0.15);',
        formatter: (params: any) => {
          const dot = `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${params.color};margin-right:6px;vertical-align:middle;"></span>`;
          let html = `${dot}<strong style="color:${textColor}">${params.name}</strong>`;
          if (Array.isArray(params.value)) {
            html += '<table style="margin-top:6px;border-collapse:collapse;">';
            params.value.forEach((v: number, i: number) => {
              const ind = indicators[i];
              if (!ind) return;
              html += `<tr><td style="padding:2px 8px 2px 0;color:${subTextColor}">${ind.name}</td><td style="padding:2px 0;font-weight:600;color:${textColor};text-align:right">${valueFormatter(v ?? 0)}</td></tr>`;
            });
            html += '</table>';
          }
          return html;
        },
      },
      legend: { show: false },
      radar: {
        shape,
        indicator: indicators.map(i => ({ name: i.name, max: i.max })),
        // Computed per shape + axis count (see above) so the polygon fills the
        // height without the circle overflowing.
        center: ['50%', radarCenterY],
        radius: radarRadius,
        // Explicit so the page-side click geometry (angle → indicator) matches
        // ECharts' layout exactly. 90° = first indicator at top, CCW order.
        startAngle: 90,
        splitNumber: 5,
        axisName: {
          color: textColor,
          fontSize: 13,
          lineHeight: 16,
          formatter: ((name: string) => wrapAxisLabel(name, 20, 3)) as any,
          // Enables 'click' events on the indicator labels so the page can
          // drill from a skill/topic name into its breakdown modal.
          triggerEvent: !!onIndicatorClick,
        },
        axisLine: { lineStyle: { color: splitLineColor } },
        splitLine: { lineStyle: { color: splitLineColor } },
        splitArea: {
          show: true,
          // ECharts accepts a string[] for alternating ring colors but its
          // type narrows to `Color | undefined`; cast to satisfy the union.
          areaStyle: { color: splitAreaColors as unknown as string },
        },
      } as any,
      series: [
        {
          type: 'radar',
          // Each data row = one series (rendered as a closed polygon).
          // Hidden series get rendered with empty array so the polygon vanishes
          // but the legend slot stays stable.
          data: resolvedSeries.map(s => {
            const hidden = hiddenSeries.has(s.name);
            return {
              name: s.name,
              value: hidden ? indicators.map(() => 0) : s.values.map(v => v ?? 0),
              symbol: 'circle',
              symbolSize: hidden ? 0 : 5,
              lineStyle: {
                color: s.resolvedColor,
                width: s.isBenchmark ? 2 : 2.5,
                type: s.isBenchmark ? 'dashed' : 'solid',
                opacity: hidden ? 0 : 1,
              },
              itemStyle: { color: s.resolvedColor, opacity: hidden ? 0 : 1 },
              areaStyle: s.isBenchmark
                ? undefined
                : { color: s.resolvedColor, opacity: hidden ? 0 : 0.18 },
              tooltip: { show: !hidden },
              // Value chips are drawn as a DOM overlay (see below) so we can
              // place them away from the tips and scale just the hovered one
              // without duplicating. ECharts' own labels stay off.
              label: { show: false },
              emphasis: { focus: 'none' as const, scale: false, label: { show: false } },
            };
          }),
        },
      ],
    };
  }, [indicators, resolvedSeries, hiddenSeries, isDark, shape, radarGeom, valueFormatter, onIndicatorClick]);

  // Axis-name (indicator label) clicks. With `triggerEvent` set above, ECharts
  // dispatches a 'click' whose componentType is 'radar' (series clicks come
  // through as 'series' and are ignored here).
  const chartEvents = useMemo(() => {
    if (!onIndicatorClick) return undefined;
    return {
      click: (params: any) => {
        const isAxisName =
          params?.componentType === 'radar' || params?.targetType === 'axisName';
        if (!isAxisName) return;
        const name: string = params?.name ?? params?.value;
        if (!name) return;
        const idx = indicators.findIndex(i => i.name === name);
        onIndicatorClick(name, idx, 'label');
      },
    };
  }, [onIndicatorClick, indicators]);

  // ── Vertex (data-point "tip") clicks ────────────────────────────────────
  // ECharts radar series clicks don't report which axis vertex was hit, so we
  // bind a low-level zrender click once and hit-test the cursor against each
  // rendered vertex via the radar coordinate system. Latest geometry/handler
  // live in refs so the listener (bound on mount) always sees current values.
  const indicatorsRef = useRef(indicators);
  const seriesRef = useRef(resolvedSeries);
  const hiddenRef = useRef(hiddenSeries);
  const onIndicatorClickRef = useRef(onIndicatorClick);
  const hoverKeyRef = useRef<string | null>(null);
  useEffect(() => { indicatorsRef.current = indicators; }, [indicators]);
  useEffect(() => { seriesRef.current = resolvedSeries; }, [resolvedSeries]);
  useEffect(() => { hiddenRef.current = hiddenSeries; }, [hiddenSeries]);
  useEffect(() => { onIndicatorClickRef.current = onIndicatorClick; }, [onIndicatorClick]);

  // ECharts 6 makes getModel()/coordinateSystem private, so we can't read the
  // rendered vertex pixels directly. Instead we reconstruct the radar geometry
  // from PUBLIC APIs (getDom() size + getOption() center/radius/startAngle) and
  // map the click to the nearest axis by angle (dot-product). This makes the
  // whole wedge — vertex tip, polygon edge, and axis label — drill into the
  // indicator, which is exactly the affordance the user wants.
  const handleChartReady = useCallback((inst: any) => {
    const zr = inst?.getZr?.();
    if (!zr) return;

    // Rebuild radar geometry from PUBLIC APIs + live values.
    const geom = (): { inds: any[]; n: number; cx: number; cy: number; r: number; theta: (i: number) => number } | null => {
      const inds = indicatorsRef.current;
      const n = inds.length;
      if (!n) return null;
      let dom: HTMLElement | null = null;
      let opt: any = null;
      try { dom = inst.getDom?.(); opt = inst.getOption?.(); } catch { return null; }
      if (!dom) return null;
      const w = dom.clientWidth;
      const h = dom.clientHeight;
      const radar = Array.isArray(opt?.radar) ? opt.radar[0] : opt?.radar;
      const pct = (v: any, base: number, fb: number) => {
        if (v == null) return fb;
        if (typeof v === 'number') return v;
        if (typeof v === 'string' && v.trim().endsWith('%')) return (parseFloat(v) / 100) * base;
        const num = parseFloat(v);
        return Number.isFinite(num) ? num : fb;
      };
      const cx = pct(radar?.center?.[0], w, w / 2);
      const cy = pct(radar?.center?.[1], h, h / 2);
      const r = pct(radar?.radius, Math.min(w, h) / 2, (Math.min(w, h) / 2) * 0.85);
      const startAngle = ((radar?.startAngle ?? 90) * Math.PI) / 180;
      return { inds, n, cx, cy, r, theta: (i: number) => startAngle + (2 * Math.PI * i) / n };
    };

    // Resolve a point to the nearest DATA TIP (vertex) or, failing that, the
    // axis-name LABEL. Only these two zones are interactive — the polygon body
    // and the empty circular corners are inert (no stray pointer / clicks).
    const resolve = (offsetX: number, offsetY: number) => {
      const g = geom();
      if (!g) return null;
      const { inds, n, cx, cy, r, theta } = g;
      const series = seriesRef.current.filter((s: any) => !hiddenRef.current.has(s.name));

      // Nearest data tip across all visible series.
      let bestI = -1;
      let bestD = 28; // px tolerance (covers the dot + its value chip)
      let seriesName = '';
      for (const s of series) {
        for (let i = 0; i < n; i++) {
          const val = s.values?.[i];
          if (typeof val !== 'number' || !(inds[i].max > 0)) continue;
          const rad = Math.min(1, val / inds[i].max) * r;
          const px = cx + rad * Math.cos(theta(i));
          const py = cy - rad * Math.sin(theta(i));
          const d = Math.hypot(px - offsetX, py - offsetY);
          if (d < bestD) { bestD = d; bestI = i; seriesName = s.name; }
        }
      }
      if (bestI >= 0) {
        return { index: bestI, name: inds[bestI].name, region: 'vertex' as const, seriesName };
      }

      // Axis label: just beyond the radius and angularly aligned to an axis.
      const dx = offsetX - cx;
      const dy = -(offsetY - cy);
      const dist = Math.hypot(dx, dy);
      if (dist >= r * 0.92 && dist <= r * 1.6) {
        let near = 0;
        let bestScore = -Infinity;
        for (let i = 0; i < n; i++) {
          const sc = dx * Math.cos(theta(i)) + dy * Math.sin(theta(i));
          if (sc > bestScore) { bestScore = sc; near = i; }
        }
        if (dist > 0 && bestScore / dist >= Math.cos((22 * Math.PI) / 180)) {
          return { index: near, name: inds[near].name, region: 'label' as const, seriesName: '' };
        }
      }
      return null;
    };

    zr.on('click', (e: any) => {
      if (!onIndicatorClickRef.current) return;
      const hit = resolve(e.offsetX, e.offsetY);
      if (hit) onIndicatorClickRef.current(hit.name, hit.index, hit.region);
    });

    // Hover feedback: cursor + tell the DOM overlay which value chip to scale
    // (keyed by series+indicator). zrender repaints the canvas cursor each
    // frame, so we set it imperatively.
    const setHover = (k: string | null) => { if (hoverKeyRef.current !== k) { hoverKeyRef.current = k; setHoverKey(k); } };
    zr.on('mousemove', (e: any) => {
      if (!onIndicatorClickRef.current) { zr.setCursorStyle('default'); setHover(null); return; }
      const hit = resolve(e.offsetX, e.offsetY);
      zr.setCursorStyle(hit ? 'pointer' : 'default');
      setHover(hit && hit.region === 'vertex' ? `${hit.seriesName}:${hit.index}` : null);
    });
    zr.on('mouseout', () => setHover(null));
  }, []);

  const resolvedHeight = typeof height === 'number' ? `${height}px` : height;

  return (
    <div
      className="flex flex-col"
      style={{ height: resolvedHeight, minHeight: 340 }}
    >
      <div ref={containerRef} className="relative flex-1 min-h-0">
        <ReactECharts
          ref={chartRef}
          key={`radar-${shape}-${resolvedSeries.length}`}
          option={option}
          notMerge
          style={{ height: '100%', width: '100%' }}
          opts={{ renderer: 'canvas' }}
          {...(chartEvents ? { onEvents: chartEvents } : {})}
          {...(onIndicatorClick ? { onChartReady: handleChartReady } : {})}
        />
        {/* Value chips drawn as a DOM overlay (placed past the tips). The chip
            under the cursor scales up — the existing value grows, no duplicate.
            pointer-events-none so hover/click pass through to the canvas. */}
        {valueChips.map(c => {
          const active = hoverKey === c.key;
          return (
            <div
              key={c.key}
              className="pointer-events-none absolute select-none"
              style={{
                left: c.x,
                top: c.y,
                transform: `translate(-50%, -50%) scale(${active ? 1.4 : 1})`,
                transformOrigin: 'center',
                transition: 'transform 120ms ease-out',
                zIndex: active ? 30 : 20,
              }}
            >
              <span
                className="inline-block rounded-md border bg-card/95 px-1.5 py-0.5 text-[11px] font-bold leading-none tabular-nums text-foreground shadow-sm"
                style={{ borderColor: c.color, boxShadow: active ? `0 0 0 1px ${c.color}` : undefined }}
              >
                {c.text}
              </span>
            </div>
          );
        })}
      </div>
      {showLegend && resolvedSeries.length > 0 && (
        <div className="shrink-0 pt-1">
          {!labelsEnabled && visibleCount > 4 && (
            <p className="text-center text-[10px] text-muted-foreground mb-1">
              Rótulos numéricos ocultos com mais de 4 séries visíveis — passe o mouse para ver os valores.
            </p>
          )}
          <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 px-2">
            {resolvedSeries.map(s => {
              const hidden = hiddenSeries.has(s.name);
              const alpha = hidden ? 0.35 : 1;
              return (
                <div
                  key={s.id}
                  className="flex items-center gap-1.5 bg-card/60 backdrop-blur-sm px-1.5 py-0.5 rounded"
                >
                  <Popover
                    open={openPickerFor === s.name}
                    onOpenChange={open => setOpenPickerFor(open ? s.name : null)}
                  >
                    <PopoverTrigger asChild>
                      <button
                        aria-label={`Cor da série ${s.name}`}
                        className="flex items-center justify-center transition-transform hover:scale-110 focus:outline-none"
                        style={{ opacity: alpha }}
                      >
                        {s.isBenchmark ? (
                          <svg width="22" height="12" viewBox="0 0 22 12">
                            <line
                              x1="0"
                              y1="6"
                              x2="22"
                              y2="6"
                              stroke={s.resolvedColor}
                              strokeWidth="2"
                              strokeDasharray="5 3"
                            />
                          </svg>
                        ) : (
                          <svg width="14" height="14" viewBox="0 0 14 14">
                            <polygon
                              points="7,1 13,5 11,13 3,13 1,5"
                              fill={s.resolvedColor}
                              fillOpacity="0.4"
                              stroke={s.resolvedColor}
                              strokeWidth="1.5"
                            />
                          </svg>
                        )}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="center" className="w-auto p-3">
                      <p className="text-xs font-medium mb-2 text-muted-foreground">
                        Cor da série
                      </p>
                      <div className="grid grid-cols-6 gap-1.5">
                        {CHART_COLORS.map(color => (
                          <button
                            key={color}
                            className="w-6 h-6 rounded-sm hover:scale-110 transition-transform"
                            style={{
                              background: color,
                              outline:
                                color === s.resolvedColor
                                  ? '2px solid currentColor'
                                  : '2px solid transparent',
                              outlineOffset: '2px',
                            }}
                            onClick={() => {
                              setColor(s.name, color);
                              setOpenPickerFor(null);
                            }}
                          />
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                  <button
                    onClick={() => toggleSeries(s.name)}
                    aria-pressed={!hidden}
                    className={cn(
                      'text-sm transition-colors cursor-pointer select-none',
                      hidden
                        ? 'text-muted-foreground line-through'
                        : 'text-foreground/85 hover:text-foreground',
                    )}
                  >
                    {s.name}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
});
