// Overtime Cost Calculator — pure math utilities.
//
// Brazilian payroll math (CLT Art. 64 + CCT metalúrgicos):
//   - `position.remunerations[current].value` (or `monetaryValues[current]`) is
//     the MONTHLY salary (e.g. R$ 2.850,26 for "Pleno I").
//   - Monthly divisor = workdayDecimal × 30 (includes paid weekly rest day).
//   - Hourly rate = monthlySalary / monthlyDivisor.
//   - Row cost   = hourlyRate × hoursDecimal × multiplier(dayType).
//
// Day-type multipliers are hardcoded in @/constants/overtime-multipliers.

import type { MonetaryValue, Position } from "@/types";
import {
  OVERTIME_MULTIPLIERS,
  STANDARD_DIVISOR_DAYS,
  type OvertimeDayType,
} from "@/constants/overtime-multipliers";

/**
 * Resolve the effective MONTHLY salary (R$/mês) for a position.
 *
 * Priority:
 *   1. `monetaryValues` array, pick `current === true`.
 *   2. Fallback to first `monetaryValues` entry if none flagged current.
 *   3. Legacy `remunerations` array, current entry; otherwise first.
 *   4. Otherwise null.
 */
export function getPositionMonthlySalary(
  position: Position | null | undefined,
): number | null {
  if (!position) return null;

  const monetary = (position.monetaryValues ?? []) as MonetaryValue[];
  if (monetary.length > 0) {
    const current = monetary.find((m) => m.current);
    if (current && typeof current.value === "number") return current.value;
    const first = monetary[0];
    if (first && typeof first.value === "number") return first.value;
  }

  const legacy = position.remunerations ?? [];
  if (legacy.length > 0) {
    const current = legacy.find((m) => (m as { current?: boolean }).current);
    if (current && typeof current.value === "number") return current.value;
    if (typeof legacy[0].value === "number") return legacy[0].value;
  }

  return null;
}

/**
 * Monthly divisor in hours = workdayDecimal × 30 (CLT Art. 64).
 * Returns 0 for non-positive workdays (caller should guard).
 */
export function getMonthlyDivisor(workdayDecimal: number): number {
  if (!Number.isFinite(workdayDecimal) || workdayDecimal <= 0) return 0;
  return workdayDecimal * STANDARD_DIVISOR_DAYS;
}

/**
 * Hourly rate = monthlySalary / monthlyDivisor.
 * Returns 0 for missing/invalid inputs.
 */
export function getHourlyRate(monthlySalary: number, workdayDecimal: number): number {
  const div = getMonthlyDivisor(workdayDecimal);
  if (div === 0) return 0;
  return monthlySalary / div;
}

/**
 * Compute the cost for a single overtime row.
 *
 * Returns null when the row is missing required inputs (so the UI can render
 * a placeholder and exclude it from the grand total).
 */
export function computeOvertimeRowCost(args: {
  monthlySalary: number | null;
  workdayDecimal: number;
  hoursDecimal: number;
  dayType: OvertimeDayType;
}): number | null {
  if (args.monthlySalary == null || args.monthlySalary <= 0) return null;
  if (!Number.isFinite(args.hoursDecimal) || args.hoursDecimal <= 0) return null;
  if (!Number.isFinite(args.workdayDecimal) || args.workdayDecimal <= 0) return null;

  const hourly = getHourlyRate(args.monthlySalary, args.workdayDecimal);
  const multiplier = OVERTIME_MULTIPLIERS[args.dayType];
  if (!Number.isFinite(multiplier) || multiplier <= 0) return null;

  return hourly * args.hoursDecimal * multiplier;
}

/**
 * Sum of all valid row costs.
 */
export function computeTotalOvertimeCost(rowCosts: Array<number | null>): number {
  return rowCosts.reduce<number>((acc, cost) => {
    if (cost === null || !Number.isFinite(cost)) return acc;
    return acc + cost;
  }, 0);
}

/**
 * Parse "HH:MM" or "H:MM" into a DECIMAL hours number.
 *   "08:45" -> 8.75
 *   "02:30" -> 2.5
 *   "00:00" -> 0
 *
 * Returns null if input is missing, empty, or malformed.
 */
export function parseWorkdayHHMM(input: string | null | undefined): number | null {
  if (!input) return null;
  const trimmed = String(input).trim();
  if (trimmed.length === 0) return null;
  const m = trimmed.match(/^(\d{1,2}):([0-5]\d)$/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (!Number.isFinite(h) || !Number.isFinite(min)) return null;
  return h + min / 60;
}
