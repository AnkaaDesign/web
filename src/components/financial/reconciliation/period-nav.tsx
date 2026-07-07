import { useState } from "react";
import { IconCalendar, IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/** A period is a single calendar year plus the set of selected months ("01".."12"). */
export interface Period {
  year: number;
  months: string[];
}

const MONTH_NAMES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

/** Short month labels for the grid chips (Jan..Dez). */
const MONTH_ABBR = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const ALL_MONTHS = MONTH_ABBR.map((_, i) => String(i + 1).padStart(2, "0"));

/** Current year + current month — the sensible default period. */
export function currentPeriod(): Period {
  const now = new Date();
  return { year: now.getFullYear(), months: [String(now.getMonth() + 1).padStart(2, "0")] };
}

/** Human label: a single month reads "Julho de 2026", a multi-month span "3 meses · 2026". */
export function periodLabel({ year, months }: Period): string {
  if (months.length === 1) {
    const idx = parseInt(months[0], 10) - 1;
    const name = MONTH_NAMES[idx] ?? "";
    return name ? `${name} de ${year}` : String(year);
  }
  if (months.length === 0) return `Ano de ${year}`;
  return `${months.length} meses · ${year}`;
}

interface PeriodNavProps {
  period: Period;
  onChange: (next: Period) => void;
  className?: string;
}

/**
 * Compact inline period stepper — chevrons + label chip — shared by the
 * Conciliação Bancária list pages (Extrato, Notas Fiscais). It mirrors the old
 * MonthNav for quick month-to-month browsing, but is period-aware: a multi-month
 * selection (chosen in the Filtros sheet) shows a summary label. The chevrons
 * always step by a SINGLE calendar month (crossing years at the boundary),
 * collapsing a multi-month selection to one month — deliberate: quick navigation
 * lives here, multi-month selection lives in the filter sheet.
 */
export function PeriodNav({ period, onChange, className }: PeriodNavProps) {
  // Anchor the step on the latest selected month (or the current month when the
  // selection is empty) so "next/prev" is predictable regardless of the set.
  const anchor = period.months.length
    ? Math.max(
        ...period.months.map(m => parseInt(m, 10)).filter(n => n >= 1 && n <= 12),
      )
    : new Date().getMonth() + 1;
  const step = (delta: number) => {
    const d = new Date(period.year, anchor - 1 + delta, 1);
    onChange({
      year: d.getFullYear(),
      months: [String(d.getMonth() + 1).padStart(2, "0")],
    });
  };
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Button
        type="button"
        variant="default"
        size="icon"
        onClick={() => step(-1)}
        className="h-10 w-10 shrink-0"
        aria-label="Mês anterior"
      >
        <IconChevronLeft className="h-4 w-4" />
      </Button>
      <MonthGridPopover period={period} onChange={onChange} />
      <Button
        type="button"
        variant="default"
        size="icon"
        onClick={() => step(1)}
        className="h-10 w-10 shrink-0"
        aria-label="Próximo mês"
      >
        <IconChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

interface MonthGridPopoverProps {
  period: Period;
  onChange: (next: Period) => void;
}

/**
 * The center chip of the period stepper, upgraded into a multi-month picker:
 * a popover with a ← year → stepper and a 3×4 grid of month chips. Tapping a
 * chip toggles it; at least one month always stays selected. "Ano todo" selects
 * all twelve, "Este mês" resets to the current calendar month.
 */
function MonthGridPopover({ period, onChange }: MonthGridPopoverProps) {
  const [open, setOpen] = useState(false);
  const selected = new Set(period.months);

  const setYear = (delta: number) => onChange({ ...period, year: period.year + delta });

  const toggleMonth = (m: string) => {
    const next = new Set(selected);
    if (next.has(m)) {
      // Never leave the selection empty — a period must cover at least one month.
      if (next.size === 1) return;
      next.delete(m);
    } else {
      next.add(m);
    }
    onChange({ ...period, months: ALL_MONTHS.filter((mm) => next.has(mm)) });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="h-10 px-3 min-w-[180px] flex items-center justify-center gap-1.5 rounded-md border border-border bg-transparent text-sm font-medium transition-colors hover:bg-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Selecionar meses"
        >
          <IconCalendar className="h-4 w-4 text-muted-foreground" />
          <span className="whitespace-nowrap">{periodLabel(period)}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="center">
        <div className="flex items-center justify-between mb-3">
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => setYear(-1)} aria-label="Ano anterior">
            <IconChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-semibold tabular-nums">{period.year}</span>
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => setYear(1)} aria-label="Próximo ano">
            <IconChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {MONTH_ABBR.map((label, i) => {
            const m = String(i + 1).padStart(2, "0");
            const isOn = selected.has(m);
            return (
              <button
                key={m}
                type="button"
                onClick={() => toggleMonth(m)}
                aria-pressed={isOn}
                className={cn(
                  "h-8 rounded-md text-xs font-medium transition-colors",
                  isOn
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/40 text-muted-foreground hover:bg-muted",
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/60">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => onChange({ ...period, months: [...ALL_MONTHS] })}
          >
            Ano todo
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => {
              const now = new Date();
              onChange({ year: now.getFullYear(), months: [String(now.getMonth() + 1).padStart(2, "0")] });
            }}
          >
            Este mês
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
