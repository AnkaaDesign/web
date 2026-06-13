import { IconCalendar, IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** First/last millisecond of the calendar month containing `month`. */
export function monthBounds(month: Date): { from: Date; to: Date } {
  return {
    from: new Date(month.getFullYear(), month.getMonth(), 1, 0, 0, 0, 0),
    to: new Date(month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59, 999),
  };
}

/** "YYYY-MM" key for URL state / the outflow-forecast `reference` param. */
export function monthKey(month: Date): string {
  return `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`;
}

/** Parses a "YYYY-MM" URL param back into a first-of-month Date (or null). */
export function parseMonthKey(raw: string | null): Date | null {
  if (!raw) return null;
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(raw.trim());
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, 1);
}

export function monthLabel(month: Date): string {
  const label = month.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

interface MonthNavProps {
  month: Date;
  onChange: (next: Date) => void;
  className?: string;
}

/**
 * Compact calendar-month navigator (chevrons + label chip) shared by the
 * Conciliação Bancária workflow pages (Extrato, Saídas, Entradas, Previsão).
 * Visually mirrors the Controle de Ponto PeriodControl without the range
 * calendar — these views always operate on a whole calendar month.
 */
export function MonthNav({ month, onChange, className }: MonthNavProps) {
  const step = (delta: number) =>
    onChange(new Date(month.getFullYear(), month.getMonth() + delta, 1));
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
      <div className="h-10 px-3 min-w-[170px] flex items-center justify-center gap-1.5 rounded-md border border-input bg-background text-sm font-medium">
        <IconCalendar className="h-4 w-4 text-muted-foreground" />
        <span className="whitespace-nowrap">{monthLabel(month)}</span>
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
