/**
 * Count working days (Mon–Fri) between `from` and `to`, inclusive on both
 * ends. Saturdays and Sundays are excluded. Used when a chart's x-axis is
 * days and we need to spread a monthly target across actual work days only.
 *
 * Does not consider Brazilian public holidays — those are sparse enough to be
 * absorbed into the goal-line approximation. If precision matters later,
 * subtract holidays explicitly.
 */
export function countWorkingDays(from: Date, to: Date): number {
  if (!(from instanceof Date) || !(to instanceof Date)) return 0;
  if (from.getTime() > to.getTime()) return 0;
  let count = 0;
  const cursor = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  while (cursor.getTime() <= end.getTime()) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) count += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

/**
 * Get the next N days for the garage forecast view.
 * Always includes today (even if it's a weekend), then fills remaining
 * slots with the next business days (skipping weekends).
 */
export function getNextDaysForForecast(startDate: Date, count: number): Date[] {
  const days: Date[] = [];
  const current = new Date(startDate);
  current.setHours(0, 0, 0, 0);

  // Always include today as the first day
  days.push(new Date(current));
  current.setDate(current.getDate() + 1);

  // Fill remaining slots with business days
  while (days.length < count) {
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      days.push(new Date(current));
    }
    current.setDate(current.getDate() + 1);
  }

  return days;
}
