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
