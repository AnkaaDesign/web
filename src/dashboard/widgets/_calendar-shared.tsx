// Shared primitives for the two monthly-calendar widgets (HR + Produção).
// Both widgets render the same 7-col grid scaffolding for the company payroll
// period (day 26 of previous month → day 25 of selected month). Centralising
// the period math, navigation header and grid skeleton keeps them visually
// identical and isolates the only Brazilian-payroll-specific logic.

import { useEffect } from "react";
import { format, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { IconChevronLeft, IconChevronRight, IconRefresh } from "@tabler/icons-react";
import { Button } from "../../components/ui/button";
import { cn } from "../../lib/utils";

// ============================================================
// Period math — Brazilian payroll period: day 26 → day 25
// ============================================================

/** Period spanned by the given anchor month: [day 26 of previous month, day 25 of anchor]. */
export function getPayrollPeriod(refMonth: Date): { start: Date; end: Date } {
  const start = new Date(refMonth.getFullYear(), refMonth.getMonth() - 1, 26);
  const end = new Date(refMonth.getFullYear(), refMonth.getMonth(), 25);
  return { start, end };
}

/** Anchor month whose payroll period contains today. */
export function defaultRefMonth(): Date {
  const today = new Date();
  return today.getDate() >= 26
    ? new Date(today.getFullYear(), today.getMonth() + 1, 1)
    : new Date(today.getFullYear(), today.getMonth(), 1);
}

/** Sunday-anchored start-of-week (no DST drift — pure date math). */
export function startOfWeekSunday(d: Date): Date {
  const day = d.getDay();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - day);
}

/** Saturday-anchored end-of-week. */
export function endOfWeekSaturday(d: Date): Date {
  const day = d.getDay();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + (6 - day));
}

/** YYYY-MM-DD in local time (not UTC) — Secullum and our tasks API are local. */
export function toIsoDay(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

// ============================================================
// Period grid — 6 weeks × 7 days = 42 cells, padded if shorter
// ============================================================

export interface PeriodGrid {
  /** Day-26 anchor (start of payroll period). */
  periodStart: Date;
  /** Day-25 anchor (end of payroll period). */
  periodEnd: Date;
  /** Sunday before periodStart — top-left of the grid. */
  gridStart: Date;
  /** Saturday after periodEnd — bottom-right of the grid. */
  gridEnd: Date;
  /** All 42 cells in row-major order (Sun..Sat × 6 weeks). */
  cells: Date[];
}

export function buildPeriodGrid(refMonth: Date): PeriodGrid {
  const { start, end } = getPayrollPeriod(refMonth);
  const gridStart = startOfWeekSunday(start);
  const gridEnd = endOfWeekSaturday(end);

  // Pad to 42 cells (6 weeks) so the grid height is constant — Fevereiro
  // would otherwise produce a shorter card and break the dashboard layout.
  const cells: Date[] = [];
  let cursor = new Date(gridStart);
  while (cells.length < 42) {
    cells.push(new Date(cursor));
    cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1);
    if (cursor > gridEnd && cells.length >= 35) break;
  }
  while (cells.length < 42) {
    const last = cells[cells.length - 1];
    cells.push(new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1));
  }
  return { periodStart: start, periodEnd: end, gridStart, gridEnd, cells };
}

// ============================================================
// Weekday labels (responsive — short for narrow widgets)
// ============================================================

export const WEEK_DAYS_FULL = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
] as const;

export const WEEK_DAYS_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;

export const WEEK_DAYS_MIN = ["D", "S", "T", "Q", "Q", "S", "S"] as const;

// ============================================================
// Period header — chevrons + label + "Hoje" + optional refresh
// ============================================================

interface PeriodHeaderProps {
  refMonth: Date;
  onChange: (next: Date) => void;
  onRefresh?: () => void;
  isFetching?: boolean;
  /** Adds keyboard shortcuts (← →) when mounted. */
  enableShortcuts?: boolean;
}

export function PeriodHeader({
  refMonth,
  onChange,
  onRefresh,
  isFetching,
  enableShortcuts = true,
}: PeriodHeaderProps) {
  const { start, end } = getPayrollPeriod(refMonth);
  const label = `${format(start, "dd/MM", { locale: ptBR })} – ${format(end, "dd/MM/yyyy", { locale: ptBR })}`;

  // Only listen when this header is mounted; suppressed inside form widgets so
  // the arrows don't fight with combobox / dialog focus.
  useEffect(() => {
    if (!enableShortcuts) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const tag = target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable) return;
      const role = target.getAttribute("role");
      if (role === "combobox" || role === "listbox" || role === "dialog") return;
      e.preventDefault();
      onChange(e.key === "ArrowLeft" ? subMonths(refMonth, 1) : addMonths(refMonth, 1));
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [refMonth, onChange, enableShortcuts]);

  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 px-2"
        onClick={() => onChange(subMonths(refMonth, 1))}
        title="Período anterior"
      >
        <IconChevronLeft className="h-3.5 w-3.5" />
      </Button>
      <span className="px-2 text-xs font-medium tabular-nums whitespace-nowrap">{label}</span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 px-2"
        onClick={() => onChange(addMonths(refMonth, 1))}
        title="Próximo período"
      >
        <IconChevronRight className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 px-2 text-xs"
        onClick={() => onChange(defaultRefMonth())}
        title="Período atual"
      >
        Hoje
      </Button>
      {onRefresh && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 px-2"
          onClick={onRefresh}
          disabled={isFetching}
          title="Atualizar"
        >
          <IconRefresh className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
        </Button>
      )}
    </div>
  );
}

// ============================================================
// Calendar grid scaffold — header row + 6-week body
// ============================================================

interface CalendarGridProps {
  grid: PeriodGrid;
  /** Render the body of one cell. Receives the date and whether it's inside the period. */
  renderCell: (ctx: {
    date: Date;
    isInPeriod: boolean;
    isToday: boolean;
    isWeekend: boolean;
    index: number;
  }) => React.ReactNode;
  /** Show the tooltip only when the cell is inside the period (default true). */
  className?: string;
  /** Use 3-letter weekday labels (default) or full names. */
  weekDayMode?: "short" | "full" | "min";
  /** Hide the Sunday column entirely. Defaults to true (visible). */
  showSunday?: boolean;
  /** Hide the Saturday column entirely. Defaults to true (visible). */
  showSaturday?: boolean;
}

export function CalendarGrid({
  grid,
  renderCell,
  className,
  weekDayMode = "short",
  showSunday = true,
  showSaturday = true,
}: CalendarGridProps) {
  const labels =
    weekDayMode === "full" ? WEEK_DAYS_FULL : weekDayMode === "min" ? WEEK_DAYS_MIN : WEEK_DAYS_SHORT;
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;

  // dow filter — Sunday=0, Saturday=6.
  const isVisibleDow = (dow: number) =>
    !((dow === 0 && !showSunday) || (dow === 6 && !showSaturday));

  // Visible labels (with their original dow index so styling like weekend
  // tint still keys off the real weekday, not the column position).
  const visibleLabels = labels
    .map((d, i) => ({ d, dow: i }))
    .filter(({ dow }) => isVisibleDow(dow));
  const colCount = visibleLabels.length;

  // Grid template — Tailwind doesn't have arbitrary `grid-cols-N` for non-
  // standard counts, so use inline style for consistency across 5/6/7 cols.
  const gridStyle = { gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))` };

  return (
    <div className={cn("flex-1 flex flex-col rounded-md border border-border bg-background overflow-hidden", className)}>
      <div className="grid bg-muted/40 border-b border-border" style={gridStyle}>
        {visibleLabels.map(({ d, dow }, i) => (
          <div
            key={`${d}-${dow}`}
            className={cn(
              "px-2 py-1.5 text-center font-bold text-[10px] uppercase tracking-wider text-foreground/70 border-r last:border-r-0 border-border",
              (dow === 0 || dow === 6) && "bg-muted/60",
              i === visibleLabels.length - 1 && "border-r-0",
            )}
          >
            {d}
          </div>
        ))}
      </div>
      <div className="flex-1 grid auto-rows-fr min-h-0" style={gridStyle}>
        {grid.cells
          .filter((date) => isVisibleDow(date.getDay()))
          .map((date, idx) => {
            const isInPeriod = date >= grid.periodStart && date <= grid.periodEnd;
            const dKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
            const isToday = dKey === todayKey;
            const dow = date.getDay();
            const isWeekend = dow === 0 || dow === 6;
            const isLastCol = (idx + 1) % colCount === 0;
            const isLastRow = idx >= grid.cells.filter((d) => isVisibleDow(d.getDay())).length - colCount;

            if (!isInPeriod) {
              return (
                <div
                  key={idx}
                  aria-hidden
                  className={cn(
                    "bg-muted/20 border-border min-h-[60px]",
                    !isLastCol && "border-r",
                    !isLastRow && "border-b",
                  )}
                />
              );
            }

            return (
              <div
                key={idx}
                className={cn(
                  "bg-background min-h-[60px] p-1 relative overflow-hidden border-border",
                  !isLastCol && "border-r",
                  !isLastRow && "border-b",
                  isWeekend && "bg-blue-50/40 dark:bg-blue-950/20",
                  isToday && "ring-2 ring-primary ring-inset z-10",
                )}
              >
                {renderCell({ date, isInPeriod, isToday, isWeekend, index: idx })}
              </div>
            );
          })}
      </div>
    </div>
  );
}

// ============================================================
// Day-cell helpers
// ============================================================

/** Date keyed as "yyyy-MM-dd" for fast Map/Set lookups. */
export function dayKey(d: Date): string {
  return toIsoDay(d);
}

/** Inclusive overlap test: does the [from, to] range cover the given day? */
export function rangeCoversDay(from: Date | string, to: Date | string, day: Date): boolean {
  const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  const f = typeof from === "string" ? new Date(from) : from;
  const t = typeof to === "string" ? new Date(to) : to;
  const fStart = new Date(f.getFullYear(), f.getMonth(), f.getDate());
  const tStart = new Date(t.getFullYear(), t.getMonth(), t.getDate());
  return dayStart >= fStart && dayStart <= tStart;
}
