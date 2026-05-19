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
  },
  externalRef,
) {
  const chartRef = useRef<any>(null);

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
  // id → color override (set via legend swatch click)
  const [seriesColors, setSeriesColors] = useState<Record<string, string>>({});
  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set());
  const [openPickerFor, setOpenPickerFor] = useState<string | null>(null);

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
    (id: string, fallback: string) => seriesColors[id] ?? fallback,
    [seriesColors],
  );

  const toggleSeries = useCallback((id: string) => {
    setHiddenSeries(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Resolve per-series colors once so the legend and the chart agree.
  const resolvedSeries = useMemo(
    () =>
      series.map((s, i) => ({
        ...s,
        resolvedColor: colorOf(s.id, s.color ?? CHART_COLORS[i % CHART_COLORS.length]),
      })),
    [series, colorOf],
  );

  // Per-vertex value labels become noise once you stack many polygons:
  // 6 indicators × 5 series = 30 chips, and they start to overlap. Cap at
  // 4 visible polygons; above that, fall back to tooltip-only readout and
  // surface a tiny hint in the legend row.
  const visibleCount = resolvedSeries.reduce(
    (n, s) => (hiddenSeries.has(s.id) ? n : n + 1),
    0,
  );
  const labelsEnabled = visibleCount > 0 && visibleCount <= 4;

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
    const chipBg = isDark ? 'rgba(24,24,27,0.85)' : 'rgba(255,255,255,0.92)';

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
        center: ['50%', '50%'],
        // Sized to fill the container while leaving room for wrapped 3-line
        // axis labels. Tested up to 5 axes with long topic names.
        radius: '82%',
        splitNumber: 5,
        axisName: {
          color: textColor,
          fontSize: 12,
          lineHeight: 14,
          formatter: ((name: string) => wrapAxisLabel(name, 18, 3)) as any,
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
          data: resolvedSeries.map((s, seriesIdx) => {
            const hidden = hiddenSeries.has(s.id);
            // Keep the original (possibly-null) values in closure so the per-
            // vertex label can render "—" for missing data — coercing nulls to
            // 0 here is only for polygon geometry, not for what we *show*.
            const originalValues = s.values;
            // When 2+ polygons share a vertex, ECharts stacks all chip labels
            // at the same anchor and they crowd. Stagger each series' label
            // distance and position so they fan out from the vertex instead.
            // Series 0 → 'top' (above the vertex), series 1 → 'bottom' (below),
            // 2 → 'top' farther out, 3 → 'bottom' farther out, etc.
            const labelPosition: 'top' | 'bottom' =
              seriesIdx % 2 === 0 ? 'top' : 'bottom';
            const labelDistance = 4 + Math.floor(seriesIdx / 2) * 10;
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
              // Inline value labels at each vertex. The chip background keeps
              // them readable when polygons overlap. We pull the *original*
              // value (not params.value, which is the null→0 coerced array) so
              // missing scores read as "—" rather than a misleading "0.00".
              label: {
                show: !hidden && labelsEnabled,
                position: labelPosition,
                distance: labelDistance,
                color: textColor,
                fontSize: 10,
                fontWeight: 600,
                backgroundColor: chipBg,
                borderColor: s.resolvedColor,
                borderWidth: 1,
                borderRadius: 3,
                padding: [1, 4],
                formatter: (params: any) => {
                  const di =
                    typeof params.dimensionIndex === 'number'
                      ? params.dimensionIndex
                      : typeof params.dataIndex === 'number'
                        ? params.dataIndex
                        : 0;
                  const original = originalValues[di];
                  return original == null ? '—' : valueFormatter(original);
                },
              },
              // Stable per-polygon emphasis so hover doesn't repaint the whole
              // chart and visually drop the label chips.
              emphasis: {
                focus: 'self' as const,
                label: { show: !hidden && labelsEnabled },
              },
            };
          }),
        },
      ],
    };
  }, [indicators, resolvedSeries, hiddenSeries, isDark, valueFormatter, shape, labelsEnabled]);

  const resolvedHeight = typeof height === 'number' ? `${height}px` : height;

  return (
    <div
      className="flex flex-col"
      style={{ height: resolvedHeight, minHeight: 380 }}
    >
      <div className="flex-1 min-h-0">
        <ReactECharts
          ref={chartRef}
          key={`radar-${shape}-${resolvedSeries.length}`}
          option={option}
          notMerge
          style={{ height: '100%', width: '100%' }}
          opts={{ renderer: 'canvas' }}
        />
      </div>
      {resolvedSeries.length > 0 && (
        <div className="shrink-0 pt-2 pb-1">
          {!labelsEnabled && visibleCount > 4 && (
            <p className="text-center text-[10px] text-muted-foreground mb-1">
              Rótulos numéricos ocultos com mais de 4 séries visíveis — passe o mouse para ver os valores.
            </p>
          )}
          <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 px-2">
            {resolvedSeries.map(s => {
              const hidden = hiddenSeries.has(s.id);
              const alpha = hidden ? 0.35 : 1;
              return (
                <div
                  key={s.id}
                  className="flex items-center gap-1.5 bg-card/60 backdrop-blur-sm px-1.5 py-0.5 rounded"
                >
                  <Popover
                    open={openPickerFor === s.id}
                    onOpenChange={open => setOpenPickerFor(open ? s.id : null)}
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
                              setSeriesColors(prev => ({ ...prev, [s.id]: color }));
                              setOpenPickerFor(null);
                            }}
                          />
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                  <button
                    onClick={() => toggleSeries(s.id)}
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
