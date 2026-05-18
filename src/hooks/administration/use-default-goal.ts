import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";

import { getGoals } from "@/api-client";
import {
  GOAL_DIRECTION,
  GOAL_METRIC,
  GOAL_METRIC_DIRECTION,
  GOAL_METRIC_LABELS,
  GOAL_METRIC_UNIT,
  GOAL_UNIT,
} from "@/constants";
import { goalKeys } from "@/hooks/common/query-keys";
import type { Goal } from "@/types";
import {
  getBusinessPeriodsInRange,
  getCalendarMonthsInRange,
} from "@/utils/bonus";

export type GoalAggregation =
  | "TOTAL" // sum across the periods in the range
  | "AVERAGE_PER_PERIOD" // arithmetic mean of monthly targets (for rates/percentages)
  | "AVERAGE_PER_USER"; // per-period average divided by activeUserCount

export type GoalSource = "goal" | "none";

/**
 * Whether the page's chart bars line up with bonus periods (day 26 → day 25)
 * or natural calendar months. Production / HR pages tied to bônus use
 * 'business'; inventory / orders / paint use 'calendar'.
 */
export type GoalPeriodMode = "business" | "calendar";

export interface UseDefaultGoalParams {
  metric: GOAL_METRIC;
  /** Calendar range the page is currently displaying. */
  period: { from: Date; to: Date } | null | undefined;
  /**
   * Filter goal lookup to specific sectors. Only applies to sector-scoped
   * metrics; ignored for company-wide ones. Pass an empty array or omit to
   * sum across all sectors.
   */
  sectorIds?: string[];
  /**
   * How to combine multiple matching goal rows into a single default. For
   * COUNT/CURRENCY metrics, prefer TOTAL. For PERCENTAGE/DAYS/MINUTES metrics,
   * prefer AVERAGE_PER_PERIOD (you can't sum rates meaningfully).
   */
  aggregation?: GoalAggregation;
  /**
   * Denominator for AVERAGE_PER_USER. Typically the live active-user count.
   * Required when aggregation === 'AVERAGE_PER_USER'.
   */
  activeUserCount?: number | null;
  /**
   * Optional fraction to scale the resolved goal value by. Use this when the
   * chart is filtered to a subset of an entity (e.g. one sector) but the
   * underlying goal is company-wide — passing { numerator: filteredUsers,
   * denominator: totalUsers } rescales the company target to the filtered
   * slice. Skipped when either is null/undefined or denominator <= 0.
   */
  scaleBy?: { numerator: number | null | undefined; denominator: number | null | undefined } | null;
  /**
   * Which period rhythm the chart bars use. 'business' = bonus periods
   * (26→25); 'calendar' = natural calendar months. Default 'business' to
   * preserve historical behaviour for production/HR pages.
   */
  periodMode?: GoalPeriodMode;
  /** Disable the lookup entirely (returns value=null). */
  enabled?: boolean;
}

export interface UseDefaultGoalResult {
  /** The aggregated default value, or null if no goal is configured. */
  value: number | null;
  /**
   * Per-period goal sums keyed by "YYYY-MM" (zero-padded month, matching
   * TaskProductionItem.period). Use this to render a per-period stepped goal
   * line instead of the flat average. Null when enabled=false or no goals.
   */
  perPeriodValues: Map<string, number> | null;
  /** Where the value came from. */
  source: GoalSource;
  /** Unit of measure — useful for chart axes and input masks. */
  unit: GOAL_UNIT;
  /** Direction — chart can paint the goal-line accordingly. */
  direction: GOAL_DIRECTION;
  /** Default chart label, e.g. "Meta: 200" — callers can override. */
  label: string;
  /** Underlying matching Goal rows (mostly for deep-linking to admin). */
  goals: Goal[];
  /** Whether the underlying useGoals queries are still loading. */
  isLoading: boolean;
}

/**
 * Resolve the default goal value for a statistics page. Centralises the
 * lookup so every page reads the admin-configured target the same way.
 *
 * The hook fetches all goals for the metric across every year that the
 * displayed range touches (one query per year via useQueries), filters by
 * the relevant (year, month) periods, and aggregates client-side.
 */
export function useDefaultGoal(params: UseDefaultGoalParams): UseDefaultGoalResult {
  const {
    metric,
    period,
    sectorIds,
    aggregation = "TOTAL",
    activeUserCount,
    scaleBy,
    periodMode = "business",
    enabled = true,
  } = params;

  const unit = GOAL_METRIC_UNIT[metric];
  const direction = GOAL_METRIC_DIRECTION[metric];
  const metricLabel = GOAL_METRIC_LABELS[metric];

  const periodsInRange = useMemo(() => {
    if (!period?.from || !period?.to) return [];
    return periodMode === "calendar"
      ? getCalendarMonthsInRange(period.from, period.to)
      : getBusinessPeriodsInRange(period.from, period.to);
  }, [period?.from, period?.to, periodMode]);

  const years = useMemo(() => {
    const set = new Set<number>();
    for (const p of periodsInRange) set.add(p.year);
    return Array.from(set).sort((a, b) => a - b);
  }, [periodsInRange]);

  const enabledForQuery = enabled && periodsInRange.length > 0;

  // Fan out one query per year touched by the range. Stable hook count for a
  // given years array — React Query keys handle deduplication if the same
  // year appears across re-renders. Empty years array → empty queries array.
  const yearQueries = useQueries({
    queries: enabledForQuery
      ? years.map(y => {
          const queryParams = {
            metric,
            year: y,
            include: { sector: true },
            limit: 500,
          };
          return {
            queryKey: goalKeys.list(queryParams),
            queryFn: () => getGoals(queryParams),
            staleTime: 1000 * 60 * 5,
          };
        })
      : [],
  });

  return useMemo<UseDefaultGoalResult>(() => {
    const baseResult = {
      unit,
      direction,
      label: `Meta: ${metricLabel}`,
    };

    if (!enabledForQuery) {
      return { ...baseResult, value: null, perPeriodValues: null, source: "none", goals: [], isLoading: false };
    }

    const allGoals: Goal[] = [];
    let anyLoading = false;
    for (const q of yearQueries) {
      if (q.isLoading) anyLoading = true;
      const rows = q.data?.data ?? [];
      for (const g of rows) allGoals.push(g);
    }

    const periodSet = new Set(periodsInRange.map(p => `${p.year}-${p.month}`));
    const sectorFilterActive = (sectorIds?.length ?? 0) > 0;

    const matching = allGoals.filter(g => {
      if (g.metric !== metric) return false;
      if (!periodSet.has(`${g.year}-${g.month}`)) return false;
      if (sectorFilterActive && g.sectorId && !sectorIds!.includes(g.sectorId)) {
        return false;
      }
      return true;
    });

    if (matching.length === 0) {
      return { ...baseResult, value: null, perPeriodValues: null, source: "none", goals: [], isLoading: anyLoading };
    }

    // For sector-scoped metrics, multiple goal rows can share the same
    // (year, month) — one per sector. The "value for this period" is the SUM
    // across sectors; the per-period average then averages those sums across
    // months, not across (sector, month) cells.
    const perPeriodSums = new Map<string, number>();
    for (const g of matching) {
      const key = `${g.year}-${g.month}`;
      perPeriodSums.set(key, (perPeriodSums.get(key) ?? 0) + Number(g.targetValue ?? 0));
    }
    const periodSums = Array.from(perPeriodSums.values());
    const total = periodSums.reduce((sum, v) => sum + v, 0);
    const perPeriodAvg = periodSums.length > 0 ? total / periodSums.length : null;

    let aggregated: number | null;
    switch (aggregation) {
      case "AVERAGE_PER_PERIOD":
        aggregated = perPeriodAvg;
        break;
      case "AVERAGE_PER_USER":
        // Per-period average ÷ user count — so a chart whose bars are monthly
        // values compares each bar to "expected tasks per user per month",
        // not "expected tasks per user for the whole range".
        aggregated =
          perPeriodAvg != null && activeUserCount && activeUserCount > 0
            ? perPeriodAvg / activeUserCount
            : null;
        break;
      case "TOTAL":
      default:
        aggregated = total;
        break;
    }

    // Optional scaleBy — rescales a company-wide goal to a filtered slice.
    let value: number | null = aggregated;
    if (
      value != null &&
      scaleBy &&
      scaleBy.numerator != null &&
      scaleBy.denominator != null &&
      scaleBy.denominator > 0
    ) {
      value = value * (scaleBy.numerator / scaleBy.denominator);
    }

    // Build per-period map keyed by "YYYY-MM" (zero-padded to match
    // TaskProductionItem.period format from the API).
    const perPeriodValues = new Map<string, number>();
    for (const [k, v] of perPeriodSums.entries()) {
      const [year, month] = k.split('-');
      perPeriodValues.set(`${year}-${month.padStart(2, '0')}`, v);
    }

    return {
      ...baseResult,
      value,
      perPeriodValues: perPeriodValues.size > 0 ? perPeriodValues : null,
      source: value == null ? "none" : "goal",
      goals: matching,
      isLoading: anyLoading,
    };
  }, [
    enabledForQuery,
    yearQueries,
    periodsInRange,
    sectorIds,
    metric,
    aggregation,
    activeUserCount,
    scaleBy?.numerator,
    scaleBy?.denominator,
    unit,
    direction,
    metricLabel,
  ]);
}
