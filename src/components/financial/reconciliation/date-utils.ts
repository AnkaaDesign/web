/**
 * Shared date helpers for the reconciliation by-date views (transactions +
 * fiscal documents). Previously these were copy-pasted across the two list
 * pages and the two accordions; centralizing them keeps the server date range,
 * the client day grouping, and the day enumeration perfectly aligned.
 */

const WEEKDAYS_SHORT = ["Dom.", "Seg.", "Ter.", "Qua.", "Qui.", "Sex.", "Sáb."];

/**
 * Local-timezone YYYY-MM-DD key used to bucket a row into a day group. Must
 * match the day enumeration (buildDatesForPeriod) so edge-of-day rows don't
 * drift into a neighbouring (empty) group.
 */
export function toLocalDateKey(input: string | Date): string {
  const d = typeof input === "string" ? new Date(input) : input;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** Formats a YYYY-MM-DD key into a `dd/mm/yy` label + weekday abbreviation. */
export function formatDayHeader(dateStr: string): { dayLabel: string; weekday: string } {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const yy = String(y).slice(-2);
  const dayLabel = `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${yy}`;
  const weekday = WEEKDAYS_SHORT[date.getDay()];
  return { dayLabel, weekday };
}

/**
 * Build the inclusive list of YYYY-MM-DD strings for every day in every
 * selected month, newest-first. Days with no rows still appear (the accordion
 * renders them collapsed) so the period reads as a continuous calendar.
 *
 * For the current month, the list stops at today — future days carry no rows
 * and just create empty noise above the meaningful rows. Future months are
 * skipped entirely.
 */
export function buildDatesForPeriod(year: number, months: string[]): string[] {
  const dates: string[] = [];
  const today = new Date();
  const todayYear = today.getFullYear();
  const todayMonth = today.getMonth() + 1;
  const todayDay = today.getDate();
  const sortedMonths = [...months].sort();
  for (const m of sortedMonths) {
    const monthNum = parseInt(m, 10);
    if (!monthNum || monthNum < 1 || monthNum > 12) continue;
    // new Date(y, m, 0) = last day of month `m-1`. Used to enumerate days.
    let lastDay = new Date(year, monthNum, 0).getDate();
    if (year === todayYear && monthNum === todayMonth) {
      lastDay = Math.min(lastDay, todayDay);
    } else if (year > todayYear || (year === todayYear && monthNum > todayMonth)) {
      continue;
    }
    for (let d = 1; d <= lastDay; d++) {
      const dd = String(d).padStart(2, "0");
      const mm = String(monthNum).padStart(2, "0");
      dates.push(`${year}-${mm}-${dd}`);
    }
  }
  // Newest-first to match how the accordion has always rendered.
  return dates.reverse();
}

/**
 * Derive an inclusive [dateFrom, dateTo] timestamp range from the selected
 * year+months so the API can filter rows. dateFrom is the first millisecond and
 * dateTo the last millisecond of the span to avoid losing edge days.
 */
export function deriveDateRange(
  year: number,
  months: string[],
): { dateFrom: string; dateTo: string } | null {
  if (!months.length) return null;
  const sorted = [...months]
    .map((m) => parseInt(m, 10))
    .filter((n) => n >= 1 && n <= 12)
    .sort((a, b) => a - b);
  if (!sorted.length) return null;
  const firstMonth = sorted[0];
  const lastMonth = sorted[sorted.length - 1];
  const dateFrom = new Date(year, firstMonth - 1, 1, 0, 0, 0, 0).toISOString();
  // Day 0 of the next month = last day of `lastMonth`.
  const dateTo = new Date(year, lastMonth, 0, 23, 59, 59, 999).toISOString();
  return { dateFrom, dateTo };
}

/**
 * When a search/narrowing filter is active, the by-date views should collapse
 * to ONLY the days that actually contain a matching row instead of rendering
 * the full calendar of the period. This intersects the full period day list
 * with the set of day-keys present in the (already server-filtered) data.
 *
 * @param periodDates  full newest-first day list from buildDatesForPeriod
 * @param rowDateValues issueDate/postedAt values of the loaded rows
 * @param narrowing    true when a search (or other narrowing) is active
 */
export function effectivePeriodDates(
  periodDates: string[],
  rowDateValues: Array<string | Date>,
  narrowing: boolean,
): string[] {
  if (!narrowing) return periodDates;
  const present = new Set(rowDateValues.map(toLocalDateKey));
  return periodDates.filter((d) => present.has(d));
}
