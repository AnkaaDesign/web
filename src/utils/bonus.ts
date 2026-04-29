// packages/utils/src/bonus.ts
//
// Frontend bonus utilities — display, period helpers, eligibility.
// THE BONUS CALCULATION ALGORITHM IS NOT HERE. The web frontend NEVER
// computes bonus values client-side. All calculation goes through
// `bonusService.simulate(...)` (POST /bonus/simulate). This eliminates
// the drift risk of having two independent implementations of the formula.

// =====================
// Commission Status Constants
// =====================
export const COMMISSION_STATUS = {
  FULL_COMMISSION: 'FULL_COMMISSION',
  PARTIAL_COMMISSION: 'PARTIAL_COMMISSION',
  NO_COMMISSION: 'NO_COMMISSION',
} as const;

export type CommissionStatus = typeof COMMISSION_STATUS[keyof typeof COMMISSION_STATUS];

// =====================
// Task Computation Utilities (used for display/sorting)
// =====================

interface TaskWithCommission {
  commission?: string;
  [key: string]: any;
}

/**
 * Calculate weighted task count (ponderedTasks) from tasks array
 * FULL_COMMISSION = 1.0, PARTIAL_COMMISSION = 0.5, NO_COMMISSION = 0
 *
 * @param tasks Array of tasks with commission status
 * @returns Weighted task count
 */
export function calculatePonderedTasks(tasks?: TaskWithCommission[]): number {
  if (!tasks || tasks.length === 0) return 0;

  return tasks.reduce((sum, task) => {
    if (task.commission === COMMISSION_STATUS.FULL_COMMISSION) {
      return sum + 1.0;
    } else if (task.commission === COMMISSION_STATUS.PARTIAL_COMMISSION) {
      return sum + 0.5;
    }
    return sum;
  }, 0);
}

/**
 * Get task count by commission type
 * @param tasks Array of tasks with commission status
 * @returns Object with counts for each commission type
 */
export function getTaskCountByCommission(tasks?: TaskWithCommission[]): {
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
    if (task.commission === COMMISSION_STATUS.FULL_COMMISSION) {
      full++;
    } else if (task.commission === COMMISSION_STATUS.PARTIAL_COMMISSION) {
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
export function enrichBonusWithComputed<T extends { year: number; month: number; tasks?: TaskWithCommission[] }>(
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
export function sortBonusesByPonderedTasks<T extends { tasks?: TaskWithCommission[] }>(
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
// Discount Calculation Utilities
// =====================

export interface BonusDiscount {
  id: string;
  reference: string;
  percentage?: number;
  value?: number;
  calculationOrder: number;
}

/**
 * Apply percentage discount to a bonus value
 * @param value The original bonus value
 * @param percentage The discount percentage (0-100)
 * @returns The discounted value
 */
export function applyPercentageDiscount(value: number, percentage: number): number {
  if (percentage <= 0) return value;
  if (percentage >= 100) return 0;

  const discountAmount = value * (percentage / 100);
  return Math.round((value - discountAmount) * 100) / 100;
}

/**
 * Apply fixed value discount to a bonus value
 * @param value The original bonus value
 * @param fixedValue The fixed discount amount
 * @returns The discounted value
 */
export function applyFixedValueDiscount(value: number, fixedValue: number): number {
  if (fixedValue <= 0) return value;

  const discountedValue = value - fixedValue;
  return Math.max(0, Math.round(discountedValue * 100) / 100);
}

/**
 * Apply multiple discounts to a bonus value in the correct order
 * Order: Percentage discounts first (applied to original value), then fixed value discounts
 * @param originalValue The original bonus value
 * @param discounts Array of discounts to apply, sorted by order
 * @returns Object with final value and breakdown of applied discounts
 */
export function applyDiscounts(
  originalValue: number,
  discounts: BonusDiscount[]
): {
  finalValue: number;
  totalPercentageDiscount: number;
  totalFixedDiscount: number;
  appliedDiscounts: Array<{
    id: string;
    reference: string;
    type: 'percentage' | 'fixed';
    amount: number;
    valueAfterDiscount: number;
  }>;
} {
  if (!discounts || discounts.length === 0) {
    return {
      finalValue: originalValue,
      totalPercentageDiscount: 0,
      totalFixedDiscount: 0,
      appliedDiscounts: [],
    };
  }

  // Sort discounts by order
  const sortedDiscounts = [...discounts].sort((a, b) => a.calculationOrder - b.calculationOrder);

  // Separate percentage and fixed discounts
  const percentageDiscounts = sortedDiscounts.filter(d => d.percentage !== undefined && d.percentage > 0);
  const fixedDiscounts = sortedDiscounts.filter(d => d.value !== undefined && d.value > 0);

  let currentValue = originalValue;
  let totalPercentageDiscount = 0;
  let totalFixedDiscount = 0;
  const appliedDiscounts: Array<{
    id: string;
    reference: string;
    type: 'percentage' | 'fixed';
    amount: number;
    valueAfterDiscount: number;
  }> = [];

  // Apply percentage discounts first
  for (const discount of percentageDiscounts) {
    const percentage = discount.percentage!;
    const discountAmount = currentValue * (percentage / 100);
    currentValue = applyPercentageDiscount(currentValue, percentage);
    totalPercentageDiscount += percentage;

    appliedDiscounts.push({
      id: discount.id,
      reference: discount.reference,
      type: 'percentage',
      amount: discountAmount,
      valueAfterDiscount: currentValue,
    });
  }

  // Then apply fixed value discounts
  for (const discount of fixedDiscounts) {
    const fixedVal = discount.value!;
    const previousValue = currentValue;
    currentValue = applyFixedValueDiscount(currentValue, fixedVal);
    const actualDiscount = previousValue - currentValue;
    totalFixedDiscount += actualDiscount;

    appliedDiscounts.push({
      id: discount.id,
      reference: discount.reference,
      type: 'fixed',
      amount: actualDiscount,
      valueAfterDiscount: currentValue,
    });
  }

  return {
    finalValue: currentValue,
    totalPercentageDiscount,
    totalFixedDiscount,
    appliedDiscounts,
  };
}

/**
 * Calculate the total discount amount from discounts
 * @param originalValue The original bonus value
 * @param discounts Array of discounts
 * @returns The total discount amount
 */
export function calculateTotalDiscount(originalValue: number, discounts: BonusDiscount[]): number {
  const result = applyDiscounts(originalValue, discounts);
  return originalValue - result.finalValue;
}

/**
 * Calculate bonus value with discounts applied
 * @param baseValue The calculated bonus amount from matrix
 * @param discounts Array of discounts to apply
 * @returns The final bonus value after discounts
 */
export function calculateFinalBonusValue(
  baseValue: number,
  discounts?: BonusDiscount[]
): number {
  if (!discounts || discounts.length === 0) {
    return baseValue;
  }

  const result = applyDiscounts(baseValue, discounts);
  return result.finalValue;
}

/**
 * Get discount breakdown for display purposes
 * @param originalValue The original bonus value
 * @param discounts Array of discounts
 * @returns Formatted breakdown of discounts
 */
export function getDiscountBreakdown(
  originalValue: number,
  discounts: BonusDiscount[]
): {
  originalValue: number;
  finalValue: number;
  totalDiscountAmount: number;
  discounts: Array<{
    reference: string;
    type: 'percentage' | 'fixed';
    displayValue: string;
    discountAmount: number;
  }>;
} {
  const result = applyDiscounts(originalValue, discounts);

  return {
    originalValue,
    finalValue: result.finalValue,
    totalDiscountAmount: originalValue - result.finalValue,
    discounts: result.appliedDiscounts.map(d => ({
      reference: d.reference,
      type: d.type,
      displayValue: d.type === 'percentage'
        ? `${(d.amount / originalValue * 100).toFixed(2)}%`
        : `R$ ${d.amount.toFixed(2)}`,
      discountAmount: d.amount,
    })),
  };
}

/**
 * Validate discount configuration
 * @param discount The discount to validate
 * @returns Validation result
 */
export function validateDiscount(discount: Partial<BonusDiscount>): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!discount.reference || discount.reference.trim().length === 0) {
    errors.push('Motivo é obrigatório');
  }

  const hasPercentage = discount.percentage !== undefined && discount.percentage !== null;
  const hasFixedValue = discount.value !== undefined && discount.value !== null;

  if (!hasPercentage && !hasFixedValue) {
    errors.push('Deve ter percentual ou valor fixo');
  }

  if (hasPercentage && hasFixedValue) {
    errors.push('Não pode ter percentual e valor fixo ao mesmo tempo');
  }

  if (hasPercentage) {
    if (discount.percentage! < 0) {
      errors.push('Percentual não pode ser negativo');
    }
    if (discount.percentage! > 100) {
      errors.push('Percentual não pode ser maior que 100%');
    }
  }

  if (hasFixedValue && discount.value! < 0) {
    errors.push('Valor fixo não pode ser negativo');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

// =====================
// Payroll Calculation Utilities
// =====================

export interface PayrollDiscount {
  percentage?: number;
  value?: number;
  calculationOrder: number;
}

/**
 * Calculate payroll discounts applied to base remuneration
 * Discounts are applied in order, with each subsequent discount calculated on the remaining amount
 * @param baseRemuneration The base salary amount
 * @param discounts Array of discounts to apply, ordered by calculationOrder
 * @returns Total discount amount
 */
export function calculatePayrollDiscounts(
  baseRemuneration: number,
  discounts: PayrollDiscount[]
): number {
  if (!discounts || discounts.length === 0 || baseRemuneration <= 0) {
    return 0;
  }

  // Sort discounts by order
  const sorted = [...discounts].sort((a, b) => a.calculationOrder - b.calculationOrder);

  let totalDiscount = 0;
  let remaining = baseRemuneration;

  for (const discount of sorted) {
    if (remaining <= 0) break;

    let discountAmount = 0;

    if (discount.percentage && discount.percentage > 0) {
      discountAmount = remaining * (discount.percentage / 100);
    } else if (discount.value && discount.value > 0) {
      discountAmount = Math.min(discount.value, remaining);
    }

    totalDiscount += discountAmount;
    remaining -= discountAmount;
  }

  return Math.round(totalDiscount * 100) / 100;
}

/**
 * Calculate net salary after all discounts and bonuses
 * @param baseRemuneration The base salary amount
 * @param discounts Array of discounts to apply
 * @param bonus Optional bonus amount to add
 * @returns Net salary amount
 */
export function calculateNetSalary(
  baseRemuneration: number,
  discounts: PayrollDiscount[],
  bonus?: number
): number {
  if (baseRemuneration <= 0) {
    return 0;
  }

  const totalDiscounts = calculatePayrollDiscounts(baseRemuneration, discounts);
  const bonusAmount = bonus && bonus > 0 ? bonus : 0;

  const netSalary = baseRemuneration + bonusAmount - totalDiscounts;

  return Math.max(0, Math.round(netSalary * 100) / 100);
}

/**
 * Get detailed breakdown of payroll calculation
 * @param baseRemuneration The base salary amount
 * @param discounts Array of discounts to apply
 * @param bonus Optional bonus amount to add
 * @returns Detailed breakdown of the payroll calculation
 */
export function getPayrollCalculationBreakdown(
  baseRemuneration: number,
  discounts: PayrollDiscount[],
  bonus?: number
): {
  baseRemuneration: number;
  bonusAmount: number;
  grossAmount: number;
  totalDiscounts: number;
  netSalary: number;
  discountDetails: Array<{
    calculationOrder: number;
    type: 'percentage' | 'fixed';
    rate: number;
    amount: number;
    remainingAfterDiscount: number;
  }>;
} {
  const bonusAmount = bonus && bonus > 0 ? bonus : 0;
  const grossAmount = baseRemuneration + bonusAmount;

  // Calculate discounts with details
  const discountDetails: Array<{
    calculationOrder: number;
    type: 'percentage' | 'fixed';
    rate: number;
    amount: number;
    remainingAfterDiscount: number;
  }> = [];

  if (discounts && discounts.length > 0) {
    const sorted = [...discounts].sort((a, b) => a.calculationOrder - b.calculationOrder);
    let remaining = baseRemuneration;

    for (const discount of sorted) {
      if (remaining <= 0) break;

      let discountAmount = 0;
      let type: 'percentage' | 'fixed' = 'fixed';
      let rate = 0;

      if (discount.percentage && discount.percentage > 0) {
        type = 'percentage';
        rate = discount.percentage;
        discountAmount = remaining * (discount.percentage / 100);
      } else if (discount.value && discount.value > 0) {
        type = 'fixed';
        rate = discount.value;
        discountAmount = Math.min(discount.value, remaining);
      }

      remaining -= discountAmount;

      discountDetails.push({
        calculationOrder: discount.calculationOrder,
        type,
        rate,
        amount: Math.round(discountAmount * 100) / 100,
        remainingAfterDiscount: Math.round(remaining * 100) / 100,
      });
    }
  }

  const totalDiscounts = discountDetails.reduce((sum, detail) => sum + detail.amount, 0);
  const netSalary = calculateNetSalary(baseRemuneration, discounts, bonus);

  return {
    baseRemuneration: Math.round(baseRemuneration * 100) / 100,
    bonusAmount: Math.round(bonusAmount * 100) / 100,
    grossAmount: Math.round(grossAmount * 100) / 100,
    totalDiscounts: Math.round(totalDiscounts * 100) / 100,
    netSalary,
    discountDetails,
  };
}

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