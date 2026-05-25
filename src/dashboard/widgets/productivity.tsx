// Productivity widget — compact task-production stats on the home dashboard.
//
// Mirrors the productivity page (`/pages/production/statistics/productivity.tsx`)
// but trades absolute year/month pickers for a rolling `periodPreset` so the
// tile stays meaningful day-to-day without user maintenance. Shares the same
// data source (`useTaskProductionStats`) and chart component (`StatisticsChart`)
// so a number on this widget matches the full page exactly.

import { useMemo } from "react";
import { z } from "zod";
import {
  IconAdjustments,
  IconChartBar,
  IconChartLine,
  IconChartArea,
  IconFilter,
  IconTarget,
  IconTrendingUp,
  IconCalendarStats,
  IconEye,
} from "@tabler/icons-react";

import { GOAL_METRIC, SECTOR_PRIVILEGES } from "../../constants";
import { useSectors } from "../../hooks/administration/use-sector";
import { useTaskProductionStats } from "../../hooks/production/use-production-analytics";
import { useDefaultGoal } from "../../hooks/administration/use-default-goal";
import { countWorkingDays } from "../../utils/business-days";
import { getBusinessPeriodsInRange } from "../../utils/bonus";
import type {
  TaskProductionXAxisMode,
  TaskProductionYAxisMode,
  TaskProductionItem,
} from "../../types/production-analytics";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import type { TrendLineType } from "../../types/statistics-common";
import { formatNumber } from "../../types/statistics-common";

import { Combobox } from "../../components/ui/combobox";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../../components/ui/tabs";

import { WidgetCard } from "../components/widget-card";
import {
  AccentPicker,
  makeAccentSchema,
  resolveAccent,
} from "../components/widget-accent";
import type {
  WidgetAccentColor,
  WidgetAccentIcon,
  WidgetAccentShade,
} from "../components/widget-accent";

import type {
  WidgetConfigProps,
  WidgetDefinition,
  WidgetRenderProps,
} from "../types";
import { Section, SectionGroup, ToggleRow } from "./_shared";

// ============================================================
// Period presets — rolling windows resolved at render time so the widget
// stays current without the user having to re-pick months/years.
// ============================================================

const PERIOD_PRESETS = [
  "current-month",
  "last-3-months",
  "last-6-months",
  "current-year",
  "last-12-months",
  "last-3-years",
] as const;
type PeriodPreset = (typeof PERIOD_PRESETS)[number];

const PERIOD_PRESET_OPTIONS: Array<{ value: PeriodPreset; label: string }> = [
  { value: "current-month", label: "Mês atual (26 → 25)" },
  { value: "last-3-months", label: "Últimos 3 meses" },
  { value: "last-6-months", label: "Últimos 6 meses" },
  { value: "current-year", label: "Ano atual" },
  { value: "last-12-months", label: "Últimos 12 meses" },
  { value: "last-3-years", label: "Últimos 3 anos" },
];

// Business month for `date` (day 26 → 25 convention). Returned as { year, month }
// where month is 1-indexed. Dec 26+ rolls over to the next year, month=1.
function businessMonthOf(date: Date): { year: number; month: number } {
  let y = date.getFullYear();
  let m = date.getMonth() + 1;
  if (date.getDate() > 25) {
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return { year: y, month: m };
}

function businessPeriodStart(year: number, month: number): Date {
  if (month === 1) return new Date(year - 1, 11, 26, 0, 0, 0, 0);
  return new Date(year, month - 2, 26, 0, 0, 0, 0);
}
function businessPeriodEnd(year: number, month: number): Date {
  return new Date(year, month - 1, 25, 23, 59, 59, 999);
}

function resolvePeriodRange(preset: PeriodPreset, now: Date): { startDate: Date; endDate: Date } {
  const { year: ny, month: nm } = businessMonthOf(now);
  // Walk back N business months from (ny, nm) keeping the month 1..12 wrap.
  const back = (months: number): { year: number; month: number } => {
    let y = ny;
    let m = nm - months;
    while (m < 1) { m += 12; y--; }
    return { year: y, month: m };
  };

  switch (preset) {
    case "current-month":
      return {
        startDate: businessPeriodStart(ny, nm),
        endDate:   businessPeriodEnd(ny, nm),
      };
    case "last-3-months": {
      const s = back(2);
      return {
        startDate: businessPeriodStart(s.year, s.month),
        endDate:   businessPeriodEnd(ny, nm),
      };
    }
    case "last-6-months": {
      const s = back(5);
      return {
        startDate: businessPeriodStart(s.year, s.month),
        endDate:   businessPeriodEnd(ny, nm),
      };
    }
    case "current-year":
      return {
        startDate: businessPeriodStart(ny, 1),
        endDate:   businessPeriodEnd(ny, 12),
      };
    case "last-12-months": {
      const s = back(11);
      return {
        startDate: businessPeriodStart(s.year, s.month),
        endDate:   businessPeriodEnd(ny, nm),
      };
    }
    case "last-3-years":
      return {
        startDate: businessPeriodStart(ny - 2, 1),
        endDate:   businessPeriodEnd(ny, 12),
      };
  }
}

// ============================================================
// Config option vocabularies — mirror the productivity page's filter sheet.
// ============================================================

const X_AXIS_OPTIONS: Array<{ value: TaskProductionXAxisMode; label: string }> = [
  { value: "day",   label: "Dias" },
  { value: "month", label: "Meses" },
  { value: "year",  label: "Anos" },
];

const Y_AXIS_OPTIONS: Array<{ value: TaskProductionYAxisMode; label: string }> = [
  { value: "count",      label: "Quantidade de Tarefas" },
  { value: "avgPerUser", label: "Média por Colaborador Ativo" },
  { value: "both",       label: "Ambos (Total + Média)" },
];

// Widget chart types — restricted single-series flavors. "bar", smooth/non-smooth
// lines, and area variants. The widget never enters comparison/stacked modes.
type WidgetChartType = "bar" | "line" | "line-smooth" | "area" | "area-smooth";
const CHART_TYPE_OPTIONS: Array<{
  value: WidgetChartType;
  label: string;
  icon: typeof IconChartBar;
}> = [
  { value: "bar",         label: "Colunas",     icon: IconChartBar },
  { value: "line",        label: "Linha Reta",  icon: IconChartLine },
  { value: "line-smooth", label: "Linha Suave", icon: IconChartLine },
  { value: "area",        label: "Área Reta",   icon: IconChartArea },
  { value: "area-smooth", label: "Área Suave",  icon: IconChartArea },
];

const TREND_OPTIONS: Array<{ value: TrendLineType | "none"; label: string }> = [
  { value: "none",   label: "Desativada" },
  { value: "linear", label: "Linear" },
  { value: "sma3",   label: "Média Móvel 3" },
  { value: "sma6",   label: "Média Móvel 6" },
  { value: "sma12",  label: "Média Móvel 12" },
];

// ============================================================
// Config schema
// ============================================================

const productivityConfigSchema = z.object({
  title: z.string().min(1).max(80).default("Produtividade"),
  accent: makeAccentSchema({
    color: "blue",
    icon: "ChartBar",
  }),
  display: z
    .object({
      showHeader: z.boolean().default(true),
      showSummary: z.boolean().default(true),
      showLegend: z.boolean().default(true),
      showZoom: z.boolean().default(true),
    })
    .default({
      showHeader: true,
      showSummary: true,
      showLegend: true,
      showZoom: true,
    }),
  period: z
    .object({
      preset: z.enum(PERIOD_PRESETS).default("last-6-months"),
      xAxisMode: z.enum(["day", "month", "year"]).default("month"),
    })
    .default({ preset: "last-6-months", xAxisMode: "month" }),
  metric: z
    .object({
      yAxisMode: z.enum(["count", "avgPerUser", "both"]).default("count"),
    })
    .default({ yAxisMode: "count" }),
  chart: z
    .object({
      type: z
        .enum(["bar", "line", "line-smooth", "area", "area-smooth"])
        .default("bar"),
      trendLine: z.enum(["none", "linear", "sma3", "sma6", "sma12"]).default("none"),
    })
    .default({ type: "bar", trendLine: "none" }),
  goal: z
    .object({
      enabled: z.boolean().default(true),
      override: z.number().nullable().default(null),
    })
    .default({ enabled: true, override: null }),
  filters: z
    .object({
      sectorIds: z.array(z.string().uuid()).default([]),
      // Same vocabulary as the productivity page. Only takes effect when
      // sectorIds.length >= 2 — single-sector / no-filter falls back to
      // 'combined' regardless.
      compareMode: z
        .enum(["combined", "separated", "separatedWithTotal"])
        .default("combined"),
    })
    .default({ sectorIds: [], compareMode: "combined" }),
});
type ProductivityConfig = z.infer<typeof productivityConfigSchema>;

const DEFAULT_CONFIG: ProductivityConfig = {
  title: "Produtividade",
  accent: { color: "blue", icon: "ChartBar" },
  display: {
    showHeader: true,
    showSummary: true,
    showLegend: true,
    showZoom: true,
  },
  period: { preset: "last-6-months", xAxisMode: "month" },
  metric: { yAxisMode: "count" },
  chart: { type: "bar", trendLine: "none" },
  goal: { enabled: true, override: null },
  filters: { sectorIds: [], compareMode: "combined" },
};

const COMPARE_MODE_OPTIONS: Array<{ value: "combined" | "separated" | "separatedWithTotal"; label: string }> = [
  { value: "combined",            label: "Combinado (uma série)" },
  { value: "separated",           label: "Separado (por setor)" },
  { value: "separatedWithTotal",  label: "Separado + Ambos (Total)" },
];

// ============================================================
// Render
// ============================================================

function ProductivityRender({
  config,
  size,
}: WidgetRenderProps<ProductivityConfig>) {
  void size;
  // The summary toggle is the single source of truth — do NOT auto-hide it
  // at smaller sizes. The user explicitly asked for the toggle to control it.
  const showSummary = config.display.showSummary;

  const accent = useMemo(
    () =>
      resolveAccent({
        color: config.accent?.color as WidgetAccentColor,
        icon: config.accent?.icon as WidgetAccentIcon,
        shade: config.accent?.shade as WidgetAccentShade | undefined,
      }),
    [config.accent?.color, config.accent?.icon, config.accent?.shade],
  );
  const AccentIcon = accent.Icon;

  // Resolve rolling window. Memoised on the preset literal — `new Date()` only
  // changes between renders, which is exactly what we want (auto-refresh as
  // the calendar rolls over a business-period boundary).
  const { startDate, endDate } = useMemo(
    () => resolvePeriodRange(config.period.preset, new Date()),
    [config.period.preset],
  );

  const xAxisMode = config.period.xAxisMode;
  const yAxisMode = config.metric.yAxisMode;
  const sectorIds = config.filters.sectorIds.length > 0
    ? config.filters.sectorIds
    : undefined;

  // compareMode only takes effect with 2+ sectors — single-sector / no-filter
  // collapses to 'combined' (matches the productivity page's `canCompare` rule).
  const canCompare = (sectorIds?.length ?? 0) >= 2;
  const effectiveCompareMode = canCompare
    ? config.filters.compareMode
    : "combined";
  const isComparisonMode =
    effectiveCompareMode === "separated" ||
    effectiveCompareMode === "separatedWithTotal";

  // The API expects `xAxisMode` as either 'day' or 'month'. Year is derived
  // client-side from monthly buckets (matches the productivity page's logic).
  const apiXAxisMode: "day" | "month" = xAxisMode === "day" ? "day" : "month";

  const { data, isLoading, isError } = useTaskProductionStats({
    startDate,
    endDate,
    sectorIds,
    xAxisMode: apiXAxisMode,
    yAxisMode,
    compareMode: effectiveCompareMode,
  });

  const rawItems: TaskProductionItem[] = data?.data?.items ?? [];
  const summary = data?.data?.summary;

  // Year aggregation — same math as the productivity page (sum counts, mean
  // headcount, derive avgPerUser from aggregates so the trio stays
  // self-consistent). Comparisons (per-sector) roll up via aggregateComparisons.
  const items = useMemo<TaskProductionItem[]>(() => {
    if (xAxisMode !== "year") return rawItems;
    const groups = new Map<string, TaskProductionItem[]>();
    for (const item of rawItems) {
      const yearPart = item.period.split("-")[0];
      if (!groups.has(yearPart)) groups.set(yearPart, []);
      groups.get(yearPart)!.push(item);
    }
    return Array.from(groups.entries())
      .map(([year, monthItems]) => {
        const totalCount = monthItems.reduce((s, i) => s + i.totalCount, 0);
        const activeUsers = monthItems.length
          ? Math.round(
              monthItems.reduce((s, i) => s + i.activeUsers, 0) /
                monthItems.length,
            )
          : 0;
        return {
          period: year,
          periodLabel: year,
          totalCount,
          activeUsers,
          avgPerUser:
            activeUsers > 0 ? +(totalCount / activeUsers).toFixed(2) : 0,
          comparisons: aggregateComparisons(monthItems),
        };
      })
      .sort((a, b) => a.period.localeCompare(b.period));
  }, [rawItems, xAxisMode]);

  const isBothMode = yAxisMode === "both";
  const useAvg     = yAxisMode === "avgPerUser";
  const includeAmbos =
    isComparisonMode && effectiveCompareMode === "separatedWithTotal";

  // Sectors that have at least one non-zero value across the displayed
  // periods — others get dropped from the legend so the chart isn't padded
  // with empty series.
  const activeSectorIds = useMemo(() => {
    const ids = new Set<string>();
    if (!isComparisonMode) return ids;
    items.forEach((item) => {
      item.comparisons?.forEach((c) => {
        if ((useAvg ? c.avgPerUser : c.count) > 0) ids.add(c.sectorId);
      });
    });
    return ids;
  }, [items, isComparisonMode, useAvg]);

  // Series — the X labels and one series per visible "thing" (single combined
  // line/bar, OR one per sector ± Ambos).
  const xLabels = useMemo(
    () => items.map((i) => abbreviateMonthLabel(i.periodLabel)),
    [items],
  );

  type WidgetSeries = { name: string; values: number[] };
  const seriesList = useMemo<WidgetSeries[]>(() => {
    if (!items.length) return [];
    if (!isComparisonMode) {
      const primary: WidgetSeries = {
        name: useAvg ? "Média/Colaborador" : "Tarefas",
        values: items.map((i) => (useAvg ? i.avgPerUser : i.totalCount)),
      };
      if (!isBothMode) return [primary];
      // "both" mode adds a secondary series on the same chart.
      return [
        { name: "Total", values: items.map((i) => i.totalCount) },
        { name: "Média/Colaborador", values: items.map((i) => i.avgPerUser) },
      ];
    }
    // Comparison mode — one series per active sector.
    const comps = items[0]?.comparisons ?? [];
    const list: WidgetSeries[] = comps
      .filter((c) => activeSectorIds.has(c.sectorId))
      .map((c) => ({
        name: c.sectorName,
        values: items.map((it) => {
          const m = it.comparisons?.find((x) => x.sectorId === c.sectorId);
          return m ? (useAvg ? m.avgPerUser : m.count) : 0;
        }),
      }));
    if (includeAmbos) {
      list.push({
        name: "Ambos",
        values: items.map((i) => (useAvg ? i.avgPerUser : i.totalCount)),
      });
    }
    return list;
  }, [items, isComparisonMode, isBothMode, includeAmbos, useAvg, activeSectorIds]);

  // Goal line — mirrors the productivity page's logic so the widget's line
  // matches the page's line for the same filters. Key bits:
  //   - aggregation = AVERAGE_PER_USER (avgPerUser) / TOTAL (year) /
  //     AVERAGE_PER_PERIOD (month, day);
  //   - in day mode the monthly target is spread across the working days of
  //     the bonus period via `scaleBy = { numerator: 1, denominator: dpp }`.
  const periodAggregation = useAvg
    ? "AVERAGE_PER_USER"
    : xAxisMode === "year"
      ? "TOTAL"
      : "AVERAGE_PER_PERIOD";

  const workingDaysInRange = useMemo(() => {
    const n = countWorkingDays(startDate, endDate);
    return n > 0 ? n : 22;
  }, [startDate, endDate]);

  const periodCount = useMemo(
    () => Math.max(1, getBusinessPeriodsInRange(startDate, endDate).length),
    [startDate, endDate],
  );
  const workingDaysPerPeriod = workingDaysInRange / periodCount;

  const scaleBy = useMemo(() => {
    if (xAxisMode !== "day") return null;
    return { numerator: 1, denominator: workingDaysPerPeriod };
  }, [xAxisMode, workingDaysPerPeriod]);

  const defaultGoalRaw = useDefaultGoal({
    metric: GOAL_METRIC.TASKS_COMPLETED,
    period: { from: startDate, to: endDate },
    aggregation: periodAggregation,
    activeUserCount: useAvg ? summary?.totalActiveUsers ?? null : null,
    scaleBy,
    enabled: config.goal.enabled,
  });

  // Snap the count-mode day goal to an integer — daily task counts can't be
  // fractional and the y-axis renders at integer ticks. avgPerUser stays
  // decimal because per-user values are intrinsically so.
  const defaultGoal = useMemo(() => {
    if (defaultGoalRaw.value == null) return defaultGoalRaw;
    if (xAxisMode === "day" && !useAvg) {
      return { ...defaultGoalRaw, value: Math.round(defaultGoalRaw.value) };
    }
    return defaultGoalRaw;
  }, [defaultGoalRaw, xAxisMode, useAvg]);

  // In separated comparison mode each bar represents ONE sector, so a
  // company-wide goal (say 65 tasks/period) needs to be divided across the
  // sectors being compared (65 / 2 = 32.5 per sector) — otherwise every
  // single-sector bar would look like it's catastrophically under-performing.
  // avgPerUser stays as-is: it's already a per-user rate, no split needed.
  const goalSectorSplit = useMemo(() => {
    if (!isComparisonMode || useAvg) return 1;
    const n = sectorIds?.length ?? 0;
    return n > 0 ? n : 1;
  }, [isComparisonMode, useAvg, sectorIds]);

  const goalValue = useMemo(() => {
    const raw = config.goal.override ?? defaultGoal.value;
    if (raw == null) return null;
    if (goalSectorSplit <= 1) return raw;
    const split = raw / goalSectorSplit;
    return xAxisMode === "day" && !useAvg ? Math.round(split) : split;
  }, [config.goal.override, defaultGoal.value, goalSectorSplit, xAxisMode, useAvg]);

  // Per-period goal values aligned to the chart bars — mirrors the productivity
  // page (statistics/productivity.tsx). Each month can have a different target,
  // so the goal line must FOLLOW the bars (stepped line through per-period
  // points) rather than render as a single flat reference line. Only applies
  // when there's no manual flat override (an override is a flat scalar). See
  // WIDGET_CONFIG_SPEC — the widget should match the statistics page's goal line.
  const perPeriodGoalValues = useMemo<(number | null)[] | null>(() => {
    if (config.goal.override != null || !defaultGoalRaw.perPeriodValues) return null;
    return items.map((item) => {
      let rawSum: number | null;
      if (xAxisMode === "year") {
        // item.period = "2026" → aggregate the 12 months' targets for that year.
        let total = 0;
        let hasAny = false;
        for (let m = 1; m <= 12; m++) {
          const key = `${item.period}-${String(m).padStart(2, "0")}`;
          const v = defaultGoalRaw.perPeriodValues!.get(key);
          if (v != null) {
            total += v;
            hasAny = true;
          }
        }
        rawSum = hasAny ? total : null;
      } else {
        rawSum = defaultGoalRaw.perPeriodValues!.get(item.period) ?? null;
      }
      if (rawSum == null) return null;
      let val = rawSum;
      if (scaleBy?.numerator != null && scaleBy.denominator != null && scaleBy.denominator > 0) {
        val = val * (scaleBy.numerator / scaleBy.denominator);
      }
      if (goalSectorSplit > 1) val = val / goalSectorSplit;
      if (useAvg) {
        const activeUsers = item.activeUsers ?? 0;
        if (activeUsers <= 0) return null;
        val = val / activeUsers;
      }
      if (xAxisMode === "day" && !useAvg) val = Math.round(val);
      return val;
    });
  }, [
    config.goal.override,
    defaultGoalRaw.perPeriodValues,
    items,
    scaleBy,
    goalSectorSplit,
    xAxisMode,
    useAvg,
  ]);

  const hasPerPeriodGoal = useMemo(
    () => !!perPeriodGoalValues?.some((v) => v != null),
    [perPeriodGoalValues],
  );

  const trendLine: TrendLineType | null =
    config.chart.trendLine === "none" ? null : config.chart.trendLine;

  // Summary strip values (mirrors the productivity page's stat cards but
  // condensed to fit in a widget).
  const periodsWithData = useMemo(
    () => items.filter((i) => (i.totalCount ?? 0) > 0),
    [items],
  );
  const avgPerDisplayPeriod = periodsWithData.length
    ? periodsWithData.reduce((s, i) => s + i.totalCount, 0) /
      periodsWithData.length
    : 0;
  const peakCount = items.length ? Math.max(...items.map((i) => i.totalCount)) : 0;

  // ----------- Render branches -----------

  const headerExtra = isLoading ? (
    <span className="text-[10px] italic text-muted-foreground">Carregando…</span>
  ) : null;

  if (isError) {
    return (
      <WidgetCard
        title={<span className={accent.classes.text}>{config.title}</span>}
        icon={<AccentIcon className={`h-4 w-4 ${accent.classes.icon}`} />}
        showHeader={config.display.showHeader}
        accentColor={config.accent?.color as WidgetAccentColor}
        accentShade={config.accent?.shade as WidgetAccentShade | undefined}
      >
        <div className="h-full flex items-center justify-center text-sm text-destructive">
          Erro ao carregar dados
        </div>
      </WidgetCard>
    );
  }

  return (
    <WidgetCard
      title={<span className={accent.classes.text}>{config.title}</span>}
      icon={<AccentIcon className={`h-4 w-4 ${accent.classes.icon}`} />}
      headerExtra={headerExtra}
      showHeader={config.display.showHeader}
      accentColor={config.accent?.color as WidgetAccentColor}
      accentShade={config.accent?.shade as WidgetAccentShade | undefined}
    >
      <div className="h-full flex flex-col min-h-0 p-2 gap-2">
        {showSummary && summary && (
          <div className="grid grid-cols-3 gap-1.5 flex-shrink-0 pb-1 border-b border-border/40">
            <SummaryTile
              label="Total"
              value={formatNumber(summary.totalCompleted)}
            />
            <SummaryTile
              label={
                xAxisMode === "year"
                  ? "Média/Ano"
                  : xAxisMode === "day"
                    ? "Média/Dia"
                    : "Média/Mês"
              }
              value={formatNumber(avgPerDisplayPeriod, 1)}
            />
            <SummaryTile
              label={useAvg ? "Média/Colab." : "Pico"}
              value={
                useAvg
                  ? (summary.avgPerUser ?? 0).toFixed(2)
                  : formatNumber(peakCount)
              }
            />
          </div>
        )}

        <div className="flex-1 min-h-0 relative">
          {seriesList.length === 0 && !isLoading ? (
            <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
              Nenhum dado no período
            </div>
          ) : (
            <CompactProductivityChart
              xLabels={xLabels}
              series={seriesList}
              chartType={config.chart.type}
              trendLine={trendLine}
              goalValue={goalValue}
              perPeriodGoalValues={hasPerPeriodGoal ? perPeriodGoalValues : null}
              valueDecimals={useAvg ? 2 : xAxisMode === "day" ? 1 : 0}
              // User toggle in the config sheet wins, but suppress the legend
              // entirely when there's nothing to label (single series, no
              // goal, no trend) — empty strip would just steal vertical room.
              showLegend={
                config.display.showLegend &&
                (seriesList.length > 1 ||
                  goalValue != null ||
                  hasPerPeriodGoal ||
                  trendLine != null)
              }
              showZoom={config.display.showZoom}
            />
          )}
        </div>
      </div>
    </WidgetCard>
  );
}

// ============================================================
// CompactProductivityChart — direct echarts, tight padding, no dataZoom
// or internal legend strip. Designed for the widget body so it doesn't
// inherit StatisticsChart's 380px minHeight or its full-page chrome.
// ============================================================

const TREND_LABELS_PT: Record<TrendLineType, string> = {
  linear: "Tendência (Linear)",
  sma3: "Média móvel 3",
  sma6: "Média móvel 6",
  sma12: "Média móvel 12",
};

function CompactProductivityChart({
  xLabels,
  series,
  chartType,
  trendLine,
  goalValue,
  perPeriodGoalValues,
  valueDecimals,
  showLegend,
  showZoom,
}: {
  xLabels: string[];
  series: Array<{ name: string; values: number[] }>;
  chartType: "bar" | "line" | "line-smooth" | "area" | "area-smooth";
  trendLine: TrendLineType | null;
  goalValue: number | null;
  /** Per-period goal values aligned to `xLabels`. When present (and any value
   *  is non-null) the goal renders as a dashed line FOLLOWING each period's
   *  goal — matching the statistics page — instead of the flat markLine. */
  perPeriodGoalValues: (number | null)[] | null;
  valueDecimals: number;
  showLegend: boolean;
  showZoom: boolean;
}) {
  const usePerPeriod = !!perPeriodGoalValues?.some((v) => v != null);
  const option = useMemo<EChartsOption>(() => {
    const smooth = chartType === "line-smooth" || chartType === "area-smooth";
    const baseType: "bar" | "line" =
      chartType === "bar" ? "bar" : "line";
    const isArea = chartType === "area" || chartType === "area-smooth";

    // Hide value-labels on zero bars/points to avoid axis-cluttering with "0".
    // Tight charts can still get crowded — echarts will auto-hide overlapping
    // labels if they don't all fit.
    const valueLabelFormatter = (params: any) => {
      const v = params?.value;
      if (typeof v !== "number" || !Number.isFinite(v) || v === 0) return "";
      return v.toFixed(valueDecimals);
    };

    const echartsSeries: any[] = series.map((s, i) => ({
      name: s.name,
      type: baseType,
      data: s.values,
      smooth,
      itemStyle: { color: SERIES_COLORS[i % SERIES_COLORS.length], borderRadius: 2 },
      lineStyle: { width: 2 },
      symbol: baseType === "line" ? "circle" : undefined,
      symbolSize: 6,
      label: {
        show: true,
        position: "top",
        fontSize: 10,
        color: "rgb(148,163,184)",
        formatter: valueLabelFormatter,
      },
      ...(isArea
        ? {
            areaStyle: {
              color: SERIES_COLORS[i % SERIES_COLORS.length],
              opacity: 0.18,
            },
          }
        : {}),
      // Flat goal marker (attached to the first series so it renders once) —
      // ONLY when there's no per-period goal schedule. A flat line is correct
      // for a manual override or a single constant target; a per-period DB goal
      // is drawn as its own following line below.
      ...(i === 0 && !usePerPeriod && goalValue != null
        ? {
            markLine: {
              silent: true,
              symbol: ["none", "none"],
              lineStyle: { type: "dashed", color: GOAL_COLOR, width: 1.5 },
              label: {
                position: "insideEndTop",
                formatter: `Meta: ${
                  goalValue.toFixed(valueDecimals === 0 ? 0 : valueDecimals)
                }`,
                color: GOAL_COLOR,
                fontSize: 10,
              },
              data: [{ yAxis: goalValue }],
            },
          }
        : {}),
    }));

    // Per-period goal line — a dashed line with diamond markers that FOLLOWS
    // each period's configured target (mirrors statistics-chart.tsx). Each
    // month can have a different goal, so the line steps with the bars instead
    // of sitting flat. Rendered as its own series so it spans all bars.
    if (usePerPeriod) {
      echartsSeries.push({
        name: "Meta",
        type: "line",
        data: perPeriodGoalValues,
        symbol: "diamond",
        symbolSize: 7,
        showSymbol: true,
        connectNulls: false,
        silent: true,
        z: 5,
        lineStyle: { color: GOAL_COLOR, width: 1.5, type: "dashed" },
        itemStyle: { color: GOAL_COLOR },
        label: { show: false },
      });
    }

    // Trend line — only meaningful for the primary series in single-series mode.
    if (trendLine && series.length === 1) {
      const trend = computeTrendValues(series[0].values, trendLine);
      echartsSeries.push({
        name: "Tendência",
        type: "line",
        data: trend,
        smooth: true,
        symbol: "none",
        lineStyle: { color: TREND_COLOR, type: "dashed", width: 2 },
      });
    }

    // Compute Y-max. Only OVERRIDE echarts' auto-max when the goal line sits
    // above the data range — otherwise echarts picks "nice" ticks (e.g. 0,2,4,6)
    // that we'd ruin by forcing max=7. When we do override, snap to a
    // splitNumber-divisible value so the y-axis stays evenly spaced.
    const dataMax = Math.max(
      0,
      ...series.flatMap((s) => s.values.filter((v): v is number => v != null)),
    );
    // The goal (flat OR the tallest per-period point) must stay on-chart.
    const goalMax = usePerPeriod
      ? Math.max(0, ...perPeriodGoalValues!.filter((v): v is number => v != null))
      : goalValue ?? 0;
    const yMax = goalMax > dataMax ? niceMaxFor(goalMax * 1.05, 4) : undefined;

    // Show a dataZoom slider only when the user has it enabled AND the bar
    // count actually justifies one (≥ 12 — fewer bars fit comfortably without
    // the slider's extra ~26px of vertical chrome).
    const needsZoom = showZoom && xLabels.length > 12;

    return {
      animation: false,
      // Tight grid — leaves just enough bottom room for rotated x-axis labels
      // (~30px) and a dataZoom slider (~26px) when present, plus 4px above
      // for any value-label badges. No built-in echarts legend — the legend
      // is a custom strip below the chart.
      grid: {
        left: 6,
        right: 8,
        top: 18,
        bottom: needsZoom ? 60 : 34,
        containLabel: true,
      },
      dataZoom: needsZoom
        ? [
            {
              type: "slider" as const,
              bottom: 6,
              height: 18,
              borderRadius: 4,
              showDetail: false,
              brushSelect: false,
              fillerColor: "rgba(100,116,139,0.25)",
              borderColor: "rgba(148,163,184,0.25)",
              handleStyle: { color: "rgba(148,163,184,0.7)" },
              moveHandleStyle: { color: "rgba(148,163,184,0.5)" },
              textStyle: { color: "rgb(148,163,184)", fontSize: 9 },
            },
          ]
        : undefined,
      tooltip: {
        trigger: "axis",
        backgroundColor: "rgba(20,20,20,0.92)",
        borderWidth: 0,
        textStyle: { color: "#fff", fontSize: 11 },
        valueFormatter: (v: any) =>
          typeof v === "number" ? v.toFixed(valueDecimals) : String(v ?? ""),
      },
      xAxis: {
        type: "category",
        data: xLabels,
        axisLabel: {
          color: "rgb(148,163,184)",
          fontSize: 10,
          rotate: xLabels.length > 8 ? 45 : 0,
          interval: 0,
          margin: 6,
        },
        axisTick: { show: false },
        axisLine: { lineStyle: { color: "rgba(148,163,184,0.25)" } },
      },
      yAxis: {
        type: "value",
        max: yMax,
        splitNumber: 4,
        axisLabel: { color: "rgb(148,163,184)", fontSize: 10 },
        splitLine: { lineStyle: { color: "rgba(148,163,184,0.12)" } },
      },
      series: echartsSeries,
    };
  }, [xLabels, series, chartType, trendLine, goalValue, perPeriodGoalValues, usePerPeriod, valueDecimals, showZoom]);

  return (
    <div className="h-full w-full flex flex-col">
      <div className="flex-1 min-h-0">
        <ReactECharts
          option={option}
          style={{ width: "100%", height: "100%" }}
          notMerge={true}
          opts={{ renderer: "canvas" }}
        />
      </div>
      {showLegend && (
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-2 pt-1.5 pb-0.5 text-[11px] text-foreground/80 shrink-0">
          {series.map((s, i) => (
            <div key={s.name} className="flex items-center gap-1.5">
              <span
                className="inline-block h-2.5 w-2.5 rounded-sm shrink-0"
                style={{ background: SERIES_COLORS[i % SERIES_COLORS.length] }}
                aria-hidden
              />
              <span className="truncate max-w-[140px]">{s.name}</span>
            </div>
          ))}
          {trendLine != null && (
            <div className="flex items-center gap-1.5">
              <span
                className="inline-block h-0.5 w-4 rounded-full shrink-0"
                style={{
                  backgroundImage: `repeating-linear-gradient(to right, ${TREND_COLOR} 0 4px, transparent 4px 7px)`,
                }}
                aria-hidden
              />
              <span>{TREND_LABELS_PT[trendLine]}</span>
            </div>
          )}
          {(goalValue != null || usePerPeriod) && (
            <div className="flex items-center gap-1.5">
              <span
                className="inline-block h-0.5 w-4 rounded-full shrink-0"
                style={{
                  backgroundImage: `repeating-linear-gradient(to right, ${GOAL_COLOR} 0 4px, transparent 4px 7px)`,
                }}
                aria-hidden
              />
              <span>Meta</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-border bg-muted/40 px-2 py-1 min-w-0">
      <div className="text-[9px] uppercase tracking-wide text-muted-foreground font-medium leading-none truncate">
        {label}
      </div>
      <div className="text-sm font-bold tabular-nums leading-tight truncate">{value}</div>
    </div>
  );
}

// Strips a trailing 4-digit year + whitespace from a period label
// ("Janeiro 2026" → "Janeiro"). Idempotent if no year present.
function stripYear(label: string): string {
  return label.replace(/\s+\d{4}\s*$/, "").trim();
}

// Round `n` up to a value that's evenly divisible by `splits` so the y-axis
// produces uniform ticks. Example: n=6.6, splits=4 → 8 (not 7).
function niceMaxFor(n: number, splits: number): number {
  if (!Number.isFinite(n) || n <= 0) return splits;
  // Pick a step matching the magnitude of `n / splits`, snapped to 1/2/5×10^k
  const targetStep = n / splits;
  const exp = Math.floor(Math.log10(targetStep));
  const base = Math.pow(10, exp);
  const ratio = targetStep / base;
  const step = ratio <= 1 ? 1 : ratio <= 2 ? 2 : ratio <= 5 ? 5 : 10;
  const snapped = step * base;
  return Math.ceil(n / snapped) * snapped * 1; // multiplier kept explicit for clarity
}

// Series palette — mirrors the productivity page's CHART_COLORS so a
// "Produção 1" bar looks the same here as on the full page.
const SERIES_COLORS = [
  "#2563eb", // blue-600
  "#10b981", // emerald-500
  "#f59e0b", // amber-500
  "#a855f7", // purple-500
  "#ef4444", // red-500
  "#06b6d4", // cyan-500
  "#84cc16", // lime-500
  "#ec4899", // pink-500
];
const GOAL_COLOR = "#10b981";
const TREND_COLOR = "#f59e0b";

// Linear-regression trend (matches the page's `computeTrend` for `linear`).
// SMA variants are stubbed via a sliding mean window. Output length matches
// input; gaps in input bleed into NaN'd outputs (rendered as gaps).
function computeTrendValues(values: number[], type: TrendLineType): (number | null)[] {
  if (values.length < 2) return values.map(() => null);
  if (type === "linear") {
    const n = values.length;
    const sx = (n * (n - 1)) / 2;
    const sx2 = (n * (n - 1) * (2 * n - 1)) / 6;
    const sy = values.reduce((a, v) => a + v, 0);
    const sxy = values.reduce((a, v, i) => a + i * v, 0);
    const d = n * sx2 - sx * sx;
    if (d === 0) {
      const flat = sy / n;
      return values.map(() => +flat.toFixed(2));
    }
    const slope = (n * sxy - sx * sy) / d;
    const intercept = (sy - slope * sx) / n;
    return values.map((_, i) => Math.max(0, +(slope * i + intercept).toFixed(2)));
  }
  const w = type === "sma3" ? 3 : type === "sma6" ? 6 : 12;
  return values.map((_, i) => {
    const start = Math.max(0, i - w + 1);
    const sub = values.slice(start, i + 1);
    return +(sub.reduce((a, v) => a + v, 0) / sub.length).toFixed(2);
  });
}

// Aggregate per-sector comparisons across monthly items → yearly buckets.
// Mirrors `aggregateComparisons` in the productivity page so the widget's
// year mode shows the same sector totals as the page.
function aggregateComparisons(
  monthItems: TaskProductionItem[],
): TaskProductionItem["comparisons"] {
  if (!monthItems.length || !monthItems[0]?.comparisons) return undefined;
  const map = new Map<
    string,
    { name: string; counts: number[]; activeUsersList: number[] }
  >();
  monthItems.forEach((item) => {
    item.comparisons?.forEach((comp) => {
      if (!map.has(comp.sectorId)) {
        map.set(comp.sectorId, {
          name: comp.sectorName,
          counts: [],
          activeUsersList: [],
        });
      }
      const s = map.get(comp.sectorId)!;
      s.counts.push(comp.count);
      s.activeUsersList.push(comp.activeUsers);
    });
  });
  return Array.from(map.entries()).map(([sectorId, s]) => {
    const count = s.counts.reduce((a, b) => a + b, 0);
    const activeUsers = s.activeUsersList.length
      ? Math.round(
          s.activeUsersList.reduce((a, b) => a + b, 0) /
            s.activeUsersList.length,
        )
      : 0;
    return {
      sectorId,
      sectorName: s.name,
      count,
      activeUsers,
      avgPerUser: activeUsers > 0 ? +(count / activeUsers).toFixed(2) : 0,
    };
  });
}

// Compact month names for the widget x-axis. The full names ("Dezembro")
// rotate badly in a 2-col widget; the 3-letter abbreviations match the
// productivity page's PT short labels and stay readable upright.
const MONTH_NAME_SHORT: Record<string, string> = {
  Janeiro: "Jan",
  Fevereiro: "Fev",
  Março: "Mar",
  Abril: "Abr",
  Maio: "Mai",
  Junho: "Jun",
  Julho: "Jul",
  Agosto: "Ago",
  Setembro: "Set",
  Outubro: "Out",
  Novembro: "Nov",
  Dezembro: "Dez",
};
function abbreviateMonthLabel(label: string): string {
  // "Janeiro 2026"  → "Jan/26"
  // "Janeiro"       → "Jan"
  // "14 Mai 2026"   → "14/05" (best-effort: leaves day-mode labels short already)
  // "2026"          → "2026" (year mode untouched)
  // Anything else   → unchanged
  const stripped = stripYear(label);
  const yearMatch = label.match(/(\d{4})\s*$/);
  const yy = yearMatch ? yearMatch[1].slice(2) : null;
  const short = MONTH_NAME_SHORT[stripped];
  if (short) return yy ? `${short}/${yy}` : short;
  return stripped;
}

// ============================================================
// Config component
// ============================================================

function ProductivityConfigComponent({
  config,
  onChange,
}: WidgetConfigProps<ProductivityConfig>) {
  const set = <K extends keyof ProductivityConfig>(
    key: K,
    value: ProductivityConfig[K],
  ) => onChange({ ...config, [key]: value });

  const setPeriod = <K extends keyof ProductivityConfig["period"]>(
    key: K,
    value: ProductivityConfig["period"][K],
  ) => onChange({ ...config, period: { ...config.period, [key]: value } });

  const setChart = <K extends keyof ProductivityConfig["chart"]>(
    key: K,
    value: ProductivityConfig["chart"][K],
  ) => onChange({ ...config, chart: { ...config.chart, [key]: value } });

  const setGoal = <K extends keyof ProductivityConfig["goal"]>(
    key: K,
    value: ProductivityConfig["goal"][K],
  ) => onChange({ ...config, goal: { ...config.goal, [key]: value } });

  const setFilters = <K extends keyof ProductivityConfig["filters"]>(
    key: K,
    value: ProductivityConfig["filters"][K],
  ) => onChange({ ...config, filters: { ...config.filters, [key]: value } });

  const setDisplay = <K extends keyof ProductivityConfig["display"]>(
    key: K,
    value: ProductivityConfig["display"][K],
  ) => onChange({ ...config, display: { ...config.display, [key]: value } });

  const accentColor = (config.accent?.color ?? "blue") as WidgetAccentColor;
  const accentIcon  = (config.accent?.icon ?? "ChartBar") as WidgetAccentIcon;
  const accentShade = (config.accent?.shade ?? "500") as WidgetAccentShade;

  const { data: sectorsData } = useSectors({ orderBy: { name: "asc" } } as any);
  const sectorOptions = useMemo(
    () =>
      (sectorsData?.data ?? []).map((s: any) => ({ value: s.id, label: s.name })),
    [sectorsData?.data],
  );

  return (
    <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1 -mr-1">
      <div className="space-y-1.5">
        <Label className="text-sm">Título</Label>
        <Input
          value={config.title}
          onChange={(v) => set("title", typeof v === "string" ? v : "")}
          placeholder="Produtividade"
        />
      </div>

      <Tabs defaultValue="appearance" className="flex flex-col gap-2">
        <TabsList className="self-start">
          <TabsTrigger value="appearance" className="gap-1">
            <IconAdjustments className="h-3.5 w-3.5" /> Aparência
          </TabsTrigger>
          <TabsTrigger value="display" className="gap-1">
            <IconEye className="h-3.5 w-3.5" /> Exibição
          </TabsTrigger>
          <TabsTrigger value="filters" className="gap-1">
            <IconFilter className="h-3.5 w-3.5" /> Filtros
          </TabsTrigger>
        </TabsList>

        <TabsContent value="appearance" className="space-y-3 mt-0">
          <SectionGroup defaultOpenId={null}>
            <Section
              title="Acento (cor e ícone)"
              icon={<IconAdjustments className="h-3.5 w-3.5" />}
              defaultOpen
            >
              <AccentPicker
                value={{ color: accentColor, icon: accentIcon, shade: accentShade }}
                onChange={(next) =>
                  set("accent", {
                    ...config.accent,
                    color: next.color,
                    icon: next.icon,
                    shade: next.shade,
                  })
                }
              />
            </Section>
            <Section
              title="Elementos visíveis"
              icon={<IconEye className="h-3.5 w-3.5" />}
            >
              <ToggleRow
                label="Cabeçalho do widget"
                checked={config.display.showHeader}
                onCheckedChange={(v) => setDisplay("showHeader", v)}
              />
              <ToggleRow
                label="Cartões de resumo (Total / Média / Pico)"
                hint="Exibidos acima do gráfico quando ativado."
                checked={config.display.showSummary}
                onCheckedChange={(v) => setDisplay("showSummary", v)}
              />
              <ToggleRow
                label="Legenda do gráfico"
                hint="Identifica séries, linha de meta e tendência."
                checked={config.display.showLegend}
                onCheckedChange={(v) => setDisplay("showLegend", v)}
              />
              <ToggleRow
                label="Barra de zoom"
                hint="Ativada automaticamente quando há mais de 12 períodos."
                checked={config.display.showZoom}
                onCheckedChange={(v) => setDisplay("showZoom", v)}
              />
            </Section>
          </SectionGroup>
        </TabsContent>

        <TabsContent value="display" className="space-y-3 mt-0">
          <SectionGroup defaultOpenId={null}>
            <Section
              title="Período"
              icon={<IconCalendarStats className="h-3.5 w-3.5" />}
              defaultOpen
            >
              <div className="space-y-1.5">
                <Label className="text-xs">Janela de tempo</Label>
                <Combobox
                  value={config.period.preset}
                  onValueChange={(v) =>
                    setPeriod("preset", (v as PeriodPreset) ?? "last-6-months")
                  }
                  options={PERIOD_PRESET_OPTIONS}
                  searchable={false}
                  clearable={false}
                />
                <p className="text-[11px] text-muted-foreground">
                  Janela móvel — recalculada a cada renderização.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Agrupamento (eixo X)</Label>
                <Combobox
                  value={config.period.xAxisMode}
                  onValueChange={(v) =>
                    setPeriod("xAxisMode", (v as TaskProductionXAxisMode) ?? "month")
                  }
                  options={X_AXIS_OPTIONS}
                  searchable={false}
                  clearable={false}
                />
              </div>
            </Section>

            <Section title="Métrica" icon={<IconChartBar className="h-3.5 w-3.5" />}>
              <div className="space-y-1.5">
                <Label className="text-xs">Métrica do eixo Y</Label>
                <Combobox
                  value={config.metric.yAxisMode}
                  onValueChange={(v) =>
                    onChange({
                      ...config,
                      metric: {
                        yAxisMode: (v as TaskProductionYAxisMode) ?? "count",
                      },
                    })
                  }
                  options={Y_AXIS_OPTIONS}
                  searchable={false}
                  clearable={false}
                />
              </div>
            </Section>

            <Section title="Gráfico" icon={<IconChartLine className="h-3.5 w-3.5" />}>
              <div className="space-y-1.5">
                <Label className="text-xs">Tipo de gráfico</Label>
                <Combobox
                  value={config.chart.type}
                  onValueChange={(v) =>
                    setChart(
                      "type",
                      (v as ProductivityConfig["chart"]["type"]) ?? "bar",
                    )
                  }
                  options={CHART_TYPE_OPTIONS.map((o) => ({
                    value: o.value,
                    label: o.label,
                  }))}
                  searchable={false}
                  clearable={false}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1">
                  <IconTrendingUp className="h-3 w-3" /> Linha de tendência
                </Label>
                <Combobox
                  value={config.chart.trendLine}
                  onValueChange={(v) =>
                    setChart(
                      "trendLine",
                      (v as ProductivityConfig["chart"]["trendLine"]) ?? "none",
                    )
                  }
                  options={TREND_OPTIONS}
                  searchable={false}
                  clearable={false}
                />
              </div>
            </Section>

            <Section title="Meta" icon={<IconTarget className="h-3.5 w-3.5" />}>
              <ToggleRow
                label="Linha de meta padrão"
                hint="Usa a meta configurada em Administração › Metas. Desativada no modo Dias."
                checked={config.goal.enabled}
                onCheckedChange={(v) => setGoal("enabled", v)}
              />
              <div className="space-y-1.5">
                <Label className="text-xs">Sobrescrever meta (opcional)</Label>
                <Input
                  type="number"
                  min={0}
                  value={config.goal.override ?? ""}
                  onChange={(v) => {
                    const n = typeof v === "number" ? v : Number(v);
                    setGoal("override", Number.isFinite(n) && n > 0 ? n : null);
                  }}
                  placeholder="Deixe vazio para usar o padrão"
                />
              </div>
            </Section>
          </SectionGroup>
        </TabsContent>

        <TabsContent value="filters" className="space-y-3 mt-0">
          <SectionGroup defaultOpenId={null}>
            <Section
              title="Setores"
              icon={<IconFilter className="h-3.5 w-3.5" />}
              defaultOpen
            >
              <div className="space-y-1.5">
                <Label className="text-xs">Setores incluídos</Label>
                <Combobox
                  mode="multiple"
                  value={config.filters.sectorIds}
                  onValueChange={(v) =>
                    setFilters(
                      "sectorIds",
                      Array.isArray(v) ? v : v ? [v] : [],
                    )
                  }
                  options={sectorOptions}
                  placeholder="Todos os setores"
                  searchPlaceholder="Buscar setor..."
                  emptyText="Nenhum setor encontrado"
                />
                <p className="text-[11px] text-muted-foreground">
                  Vazio = todos os setores de produção. Selecione 2+ para habilitar
                  comparação.
                </p>
              </div>

              {/* Compare mode — only meaningful with 2+ sectors. Hidden otherwise
                  to avoid a dead control. */}
              {config.filters.sectorIds.length >= 2 && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Modo de comparação</Label>
                  <Combobox
                    value={config.filters.compareMode}
                    onValueChange={(v) =>
                      setFilters(
                        "compareMode",
                        (v as ProductivityConfig["filters"]["compareMode"]) ??
                          "combined",
                      )
                    }
                    options={COMPARE_MODE_OPTIONS}
                    searchable={false}
                    clearable={false}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    {config.filters.compareMode === "separated"
                      ? "Exibe uma série por setor, sem total combinado."
                      : config.filters.compareMode === "separatedWithTotal"
                        ? `Exibe ${config.filters.sectorIds.length} séries (uma por setor) + "Ambos" (total).`
                        : "Soma todos os setores selecionados em uma única série."}
                  </p>
                </div>
              )}
            </Section>
          </SectionGroup>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================
// Widget definition
// ============================================================

export const productivityWidget: WidgetDefinition<ProductivityConfig> = {
  id: "production.productivity",
  name: "Produtividade",
  description:
    "Produção de tarefas por período (dia / mês / ano) com tendência e meta — mesma fonte da página de Produtividade.",
  icon: IconChartBar,
  category: "production",
  allowedSectors: [
    SECTOR_PRIVILEGES.ADMIN,
    SECTOR_PRIVILEGES.PRODUCTION,
    SECTOR_PRIVILEGES.PRODUCTION_MANAGER,
    SECTOR_PRIVILEGES.HUMAN_RESOURCES,
    SECTOR_PRIVILEGES.FINANCIAL,
  ],
  defaultSize: { cols: 2, rows: 2 },
  minSize: { cols: 2, rows: 2 },
  maxSize: { cols: 4, rows: 4 },
  configSchema: productivityConfigSchema,
  defaultConfig: DEFAULT_CONFIG,
  RenderComponent: ProductivityRender,
  ConfigComponent: ProductivityConfigComponent,
};
