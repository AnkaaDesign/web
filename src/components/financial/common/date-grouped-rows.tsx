/**
 * Shared date-grouping for the financial list pages (Extrato, Notas Fiscais,
 * Contas a Receber). Turns a flat array of leaf rows into an accordion-style
 * tree of day GROUP rows (each carrying its leaves as children) so the same
 * grouped DataTable renders consistently across all three pages.
 *
 * The group rows are consumed by DataTable's `isGroupRow` / `renderGroupRow`
 * (full-width banner) + `enableExpansion` + `getSubRows` (the day's children).
 */
import { cn } from "@/lib/utils";
import { toLocalDateKey, formatDayHeader } from "@/components/financial/reconciliation/date-utils";

/** Progress color by resolved fraction — mirrors the reconciliation accordions. */
function reconciliationTier(pct: number): string {
  if (pct >= 100) return "bg-green-600";
  if (pct >= 75) return "bg-green-500";
  if (pct >= 50) return "bg-yellow-500";
  if (pct >= 25) return "bg-orange-500";
  return "bg-red-500";
}

/** Date + weekday label for a group's leading (Data) column. */
export function GroupDateLabel<T>({ group }: { group: DateGroup<T> }) {
  const { dayLabel, weekday } = group.dateKey ? formatDayHeader(group.dateKey) : { dayLabel: "Sem data", weekday: "" };
  return (
    <span className="flex items-baseline gap-1.5 whitespace-nowrap">
      <span className="font-semibold tabular-nums">{dayLabel}</span>
      {weekday && <span className="text-sm font-normal text-muted-foreground">{weekday}</span>}
    </span>
  );
}

/**
 * Resolved/count progress bar for a day banner. The track fills whatever width
 * its column has (`flex-1`), so the bar grows/shrinks as the operator resizes
 * the Status/Situação column — the `resolved/count` label stays pinned at the end.
 */
export function GroupProgressBar({ resolved, count }: { resolved: number; count: number }) {
  const pct = count > 0 ? (resolved / count) * 100 : 0;
  return (
    <div className="flex w-full min-w-0 items-center gap-1.5" title={`${resolved} de ${count} resolvida(s)`}>
      <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted-foreground/20">
        <div className={cn("h-full rounded-full transition-all", reconciliationTier(pct))} style={{ width: `${pct}%` }} />
      </div>
      <span className="shrink-0 text-[11px] font-semibold tabular-nums text-muted-foreground">
        {resolved}/{count}
      </span>
    </div>
  );
}

/** A day banner row: the aggregate header the leaves collapse under. */
export interface DateGroup<T> {
  __group: true;
  /** Stable row id (`grp-<dateKey>`). */
  id: string;
  /** YYYY-MM-DD (or "" for undated rows). */
  dateKey: string;
  count: number;
  /** Green aggregate (entradas / recebido). */
  greenTotal: number;
  /** Red aggregate (saídas / a receber). */
  redTotal: number;
  /** How many of the day's rows are "resolved" (reconciled / linked / received). */
  resolvedCount: number;
  children: T[];
}

export type GroupedRow<T> = DateGroup<T> | T;

export function isDateGroup<T>(row: GroupedRow<T>): row is DateGroup<T> {
  return !!row && (row as DateGroup<T>).__group === true;
}

interface BuildDateGroupsOptions<T> {
  /** The date that buckets a leaf into a day (postedAt / issueDate / dueDate…). */
  getDate: (row: T) => Date | string | null | undefined;
  /** Amount counted into the green total for its day (default 0). */
  getGreen?: (row: T) => number;
  /** Amount counted into the red total for its day (default 0). */
  getRed?: (row: T) => number;
  /** Whether a row counts as "resolved" for the day's progress bar. */
  getResolved?: (row: T) => boolean;
  /** Day ordering — "desc" (newest first, matches the accordions) by default. */
  direction?: "desc" | "asc";
}

/**
 * Group `leaves` by local day. Leaves keep their incoming order within a day
 * (callers pre-sort). Days are ordered newest-first by default. Undated leaves
 * collapse under a single "Sem data" group sorted last.
 */
export function buildDateGroups<T>(leaves: T[], opts: BuildDateGroupsOptions<T>): DateGroup<T>[] {
  const { getDate, getGreen, getRed, getResolved, direction = "desc" } = opts;
  const byKey = new Map<string, DateGroup<T>>();
  for (const leaf of leaves) {
    const raw = getDate(leaf);
    const key = raw ? toLocalDateKey(raw) : "";
    let group = byKey.get(key);
    if (!group) {
      group = { __group: true, id: `grp-${key || "sem-data"}`, dateKey: key, count: 0, greenTotal: 0, redTotal: 0, resolvedCount: 0, children: [] };
      byKey.set(key, group);
    }
    group.children.push(leaf);
    group.count += 1;
    group.greenTotal += getGreen?.(leaf) ?? 0;
    group.redTotal += getRed?.(leaf) ?? 0;
    if (getResolved?.(leaf)) group.resolvedCount += 1;
  }
  const groups = [...byKey.values()];
  groups.sort((a, b) => {
    // Undated ("") always sinks to the bottom regardless of direction.
    if (!a.dateKey) return 1;
    if (!b.dateKey) return -1;
    return direction === "desc" ? b.dateKey.localeCompare(a.dateKey) : a.dateKey.localeCompare(b.dateKey);
  });
  return groups;
}

// The banner content is now rendered column-aligned via DataTable's `renderGroupCell` using the
// exported GroupDateLabel + GroupProgressBar (see the financial list pages). The old single-blob
// DateGroupBanner was intentionally removed.
