import { IconCalendar, IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
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
      <div className="h-10 px-3 min-w-[180px] flex items-center justify-center gap-1.5 rounded-md border border-border bg-transparent text-sm font-medium">
        <IconCalendar className="h-4 w-4 text-muted-foreground" />
        <span className="whitespace-nowrap">{periodLabel(period)}</span>
      </div>
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
