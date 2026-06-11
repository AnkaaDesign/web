// packages/utils/src/bonus.ts
//
// Frontend bonus utilities — display, period helpers, eligibility.
// THE BONUS CALCULATION ALGORITHM IS NOT HERE. The web frontend NEVER
// computes bonus values client-side. All calculation goes through
// `bonusService.simulate(...)` (POST /bonus/simulate). This eliminates
// the drift risk of having two independent implementations of the formula.

// =====================
// Bonification Status Constants
// =====================
export const BONIFICATION_STATUS = {
  FULL_BONIFICATION: 'FULL_BONIFICATION',
  PARTIAL_BONIFICATION: 'PARTIAL_BONIFICATION',
  NO_BONIFICATION: 'NO_BONIFICATION',
} as const;

export type BonificationStatus = typeof BONIFICATION_STATUS[keyof typeof BONIFICATION_STATUS];

// =====================
// Task Computation Utilities (used for display/sorting)
// =====================

interface TaskWithBonification {
  bonification?: string;
  [key: string]: any;
}

/**
 * Calculate weighted task count (ponderedTasks) from tasks array
 * FULL_BONIFICATION = 1.0, PARTIAL_BONIFICATION = 0.5, NO_BONIFICATION = 0
 *
 * @param tasks Array of tasks with bonification status
 * @returns Weighted task count
 */
export function calculatePonderedTasks(tasks?: TaskWithBonification[]): number {
  if (!tasks || tasks.length === 0) return 0;

  return tasks.reduce((sum, task) => {
    if (task.bonification === BONIFICATION_STATUS.FULL_BONIFICATION) {
      return sum + 1.0;
    } else if (task.bonification === BONIFICATION_STATUS.PARTIAL_BONIFICATION) {
      return sum + 0.5;
    }
    return sum;
  }, 0);
}

/**
 * Get task count by bonification type
 * @param tasks Array of tasks with bonification status
 * @returns Object with counts for each bonification type
 */
export function getTaskCountByBonification(tasks?: TaskWithBonification[]): {
  full: number;
  partial: number;
  none: number;
  total: number;
  pondered: number;
} {
  if (!tasks || tasks.length === 0) {
    return { full: 0, partial: 0, none: 0, total: 0, pondered: 0 };
  }

  let full = 0;
  let partial = 0;
  let none = 0;

  for (const task of tasks) {
    if (task.bonification === BONIFICATION_STATUS.FULL_BONIFICATION) {
      full++;
    } else if (task.bonification === BONIFICATION_STATUS.PARTIAL_BONIFICATION) {
      partial++;
    } else {
      none++;
    }
  }

  return {
    full,
    partial,
    none,
    total: tasks.length,
    pondered: full + (partial * 0.5),
  };
}

/**
 * Compute bonus display data from raw bonus entity
 * Adds computed fields like ponderedTasks and period dates
 *
 * @param bonus Raw bonus entity from API
 * @returns Bonus with computed fields added
 */
export function enrichBonusWithComputed<T extends { year: number; month: number; tasks?: TaskWithBonification[] }>(
  bonus: T
): T & { _computed: { ponderedTaskCount: number; periodStart: Date; periodEnd: Date } } {
  return {
    ...bonus,
    _computed: {
      ponderedTaskCount: calculatePonderedTasks(bonus.tasks),
      periodStart: getBonusPeriodStart(bonus.year, bonus.month),
      periodEnd: getBonusPeriodEnd(bonus.year, bonus.month),
    },
  };
}

/**
 * Sort bonuses by pondered task count (computed from tasks array)
 * @param bonuses Array of bonuses
 * @param direction 'asc' or 'desc'
 * @returns Sorted array
 */
export function sortBonusesByPonderedTasks<T extends { tasks?: TaskWithBonification[] }>(
  bonuses: T[],
  direction: 'asc' | 'desc' = 'desc'
): T[] {
  return [...bonuses].sort((a, b) => {
    const aCount = calculatePonderedTasks(a.tasks);
    const bCount = calculatePonderedTasks(b.tasks);
    return direction === 'asc' ? aCount - bCount : bCount - aCount;
  });
}

// =====================
// Period Helpers (display only — no calculation logic)
// =====================

/**
 * Get the start date of a bonus/payroll period (day 26 of previous month)
 * Period runs from 26th of previous month to 25th of current month
 * @param year The year as number
 * @param month The month as number (1-12)
 * @returns Start date of the bonus period at 00:00:00.000
 */
export function getBonusPeriodStart(year: number, month: number): Date {
  if (month === 1) {
    return new Date(year - 1, 11, 26, 0, 0, 0, 0); // Dec 26 of previous year
  }
  return new Date(year, month - 2, 26, 0, 0, 0, 0); // Day 26 of previous month
}

/**
 * Get the end date of a bonus/payroll period (day 25 of current month)
 * Period runs from 26th of previous month to 25th of current month
 * @param year The year as number
 * @param month The month as number (1-12)
 * @returns End date of the bonus period at 23:59:59.999
 */
export function getBonusPeriodEnd(year: number, month: number): Date {
  return new Date(year, month - 1, 25, 23, 59, 59, 999); // Day 25 of current month
}

/**
 * Get the payroll period dates (same as bonus period: 26th to 25th)
 * @param year The year as number
 * @param month The month as number (1-12)
 * @returns Object with start and end dates
 */
export function getPayrollPeriod(year: number, month: number) {
  return {
    start: getBonusPeriodStart(year, month),
    end: getBonusPeriodEnd(year, month)
  };
}

/**
 * Calculate bonus/payroll period dates based on year and month
 * Period runs from day 26 of the previous month to day 25 of the current month
 * @param year The year as number
 * @param month The month as number (1-12)
 * @returns Object with startDate and endDate
 */
export function getBonusPeriod(year: number, month: number): { startDate: Date; endDate: Date } {
  return {
    startDate: getBonusPeriodStart(year, month),
    endDate: getBonusPeriodEnd(year, month),
  };
}

// Returns the business period (Y, M) that contains today. Convention: month is
// the month that *closes* the period (the one with day 25). Distinct from
// getCurrentPeriod() above, which has a 5th-day rule for payroll.
export function getCurrentBusinessPeriod(referenceDate?: Date): { year: number; month: number } {
  const now = referenceDate || new Date();
  let year = now.getFullYear();
  let month = now.getMonth() + 1;
  if (now.getDate() > 25) {
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return { year, month };
}

/**
 * Convert a calendar date into the (year, month) of the bonus period that
 * contains it. Period N covers day 26 of month (N-1) → day 25 of month N.
 */
export function getBusinessPeriodForDate(date: Date): { year: number; month: number } {
  return getCurrentBusinessPeriod(date);
}

/**
 * Enumerate every bonus period (Y, M) whose 26→25 window intersects the
 * inclusive [from, to] range. Used by lookups that need to sum monthly goal
 * targets across an arbitrary date range (e.g. when a stats page is filtered
 * to "Jan–Mar 2026").
 */
export function getBusinessPeriodsInRange(
  from: Date,
  to: Date,
): Array<{ year: number; month: number }> {
  const start = getBusinessPeriodForDate(from);
  const end = getBusinessPeriodForDate(to);
  const periods: Array<{ year: number; month: number }> = [];
  let y = start.year;
  let m = start.month;
  while (y < end.year || (y === end.year && m <= end.month)) {
    periods.push({ year: y, month: m });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return periods;
}

/**
 * Enumerate every calendar (year, month) tuple that intersects the inclusive
 * [from, to] range. Use this instead of `getBusinessPeriodsInRange` when the
 * range is composed of natural calendar months (e.g. inventory/order pages),
 * not bonus periods. Avoids the off-by-one where Dec 31 of year Y maps to a
 * business period in January of Y+1.
 */
export function getCalendarMonthsInRange(
  from: Date,
  to: Date,
): Array<{ year: number; month: number }> {
  const periods: Array<{ year: number; month: number }> = [];
  let y = from.getFullYear();
  let m = from.getMonth() + 1;
  const endY = to.getFullYear();
  const endM = to.getMonth() + 1;
  while (y < endY || (y === endY && m <= endM)) {
    periods.push({ year: y, month: m });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return periods;
}

/**
 * Check if a position is eligible for bonus based on its bonifiable flag
 * @param position Position object with bonifiable property
 * @returns true if eligible for bonus
 */
export function isPositionBonusEligible(position: { bonifiable?: boolean }): boolean {
  return position.bonifiable === true;
}

/**
 * Validate that performance level is in valid range
 * @param performanceLevel The performance level to validate
 * @returns true if valid (1-5), false otherwise
 */
export function isValidPerformanceLevel(performanceLevel: number): boolean {
  return performanceLevel >= 1 && performanceLevel <= 5 && Number.isInteger(performanceLevel);
}

/**
 * Count tasks from bonus tasks relation
 * @param tasks Array of tasks from bonus relation
 * @returns Number of tasks
 */
export function countBonusTasks(tasks?: any[]): number {
  return tasks?.length || 0;
}

// REMOVED: calculateBonusFromTasks function - depended on incorrect calculateBonusAmount

// =====================
// Discount & payroll calculation utilities REMOVED.
// The bonus value, the discount cascade (netBonus), and payroll totals are
// computed exclusively on the API (recalculateNetBonus / CompletePayrollCalculator).
// The web app displays server-provided baseBonus / netBonus and must never
// re-derive them on the client.
// =====================

// =====================
// Composite ID Utilities (for live calculations)
// =====================

/**
 * Parse a composite live ID into its components
 * Format: live-{userId}-{year}-{month}
 * @param id The composite ID to parse
 * @returns Object with userId, year, and month, or null if invalid
 */
export function parseLiveId(id: string): { userId: string; year: number; month: number } | null {
  if (!id || !id.startsWith('live-')) {
    return null;
  }

  const parts = id.replace('live-', '').split('-');
  if (parts.length < 7) {
    return null;
  }

  const month = parseInt(parts[parts.length - 1], 10);
  const year = parseInt(parts[parts.length - 2], 10);
  const userId = parts.slice(0, -2).join('-');

  if (isNaN(month) || isNaN(year) || month < 1 || month > 12 || year < 2000 || year > 2100) {
    return null;
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(userId)) {
    return null;
  }

  return { userId, year, month };
}

/**
 * Create a composite live ID from components
 * Format: live-{userId}-{year}-{month}
 * @param userId The user UUID
 * @param year The year
 * @param month The month
 * @returns The composite ID string
 */
export function createLiveId(userId: string, year: number, month: number): string {
  return `live-${userId}-${year}-${month}`;
}

/**
 * Check if an ID is a composite live ID
 * @param id The ID to check
 * @returns True if the ID is a live ID, false otherwise
 */
export function isLiveId(id: string): boolean {
  return id?.startsWith('live-') ?? false;
}