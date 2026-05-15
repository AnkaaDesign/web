import { GOAL_UNIT } from "@/constants";
import {
  formatCurrency,
  formatCurrencyCompact,
  formatNumber,
  formatNumberWithDecimals,
  formatPercentage,
} from "./number";

export interface FormatGoalOptions {
  /** When true, abbreviate large currency values (R$ 1.2M). */
  compactCurrency?: boolean;
  /** Override the default decimal places for the unit. */
  decimals?: number;
}

/**
 * Renders a goal targetValue in the unit's canonical Brazilian-Portuguese
 * format. Percentages are stored as 0-100 (matches existing formatPercentage).
 */
export function formatGoalValue(
  value: number | null | undefined,
  unit: GOAL_UNIT,
  options: FormatGoalOptions = {},
): string {
  if (value == null || Number.isNaN(value)) return "—";
  const { compactCurrency, decimals } = options;

  switch (unit) {
    case GOAL_UNIT.CURRENCY:
      return compactCurrency && Math.abs(value) >= 1000
        ? formatCurrencyCompact(value)
        : formatCurrency(value);
    case GOAL_UNIT.PERCENTAGE:
      return formatPercentage(value, decimals ?? 1);
    case GOAL_UNIT.DECIMAL:
      return formatNumberWithDecimals(value, decimals ?? 2);
    case GOAL_UNIT.MINUTES:
      return `${formatNumber(Math.round(value))} min`;
    case GOAL_UNIT.DAYS: {
      const fixed = formatNumberWithDecimals(value, decimals ?? 1);
      return `${fixed} ${value === 1 ? "dia" : "dias"}`;
    }
    case GOAL_UNIT.LITERS: {
      const fixed = formatNumberWithDecimals(value, decimals ?? 1);
      return `${fixed} L`;
    }
    case GOAL_UNIT.COUNT:
    default:
      return formatNumber(Math.round(value));
  }
}

/**
 * Short suffix to append to a y-axis label or KPI title so users see what
 * unit the goal is in (e.g. "Meta: 5%" instead of just "Meta: 5").
 */
export function unitSuffix(unit: GOAL_UNIT): string {
  switch (unit) {
    case GOAL_UNIT.PERCENTAGE:
      return "%";
    case GOAL_UNIT.MINUTES:
      return " min";
    case GOAL_UNIT.DAYS:
      return " dias";
    case GOAL_UNIT.LITERS:
      return " L";
    case GOAL_UNIT.CURRENCY:
    case GOAL_UNIT.COUNT:
    case GOAL_UNIT.DECIMAL:
    default:
      return "";
  }
}
