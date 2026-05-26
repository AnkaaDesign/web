import { useState } from "react";
import { IconCalendar, IconChevronLeft, IconChevronRight } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface PeriodControlProps {
  /** Primary line on the chip (e.g. "Junho 2026" or "26/05/2026"). */
  title: string;
  /** Muted second line (e.g. "26/05 a 25/06/2026" or the weekday). */
  subtitle?: string;
  /** Step the chip backward/forward (prev/next month or day). Omit to hide a chevron. */
  onPrev?: () => void;
  onNext?: () => void;
  /** "day" → single-date calendar; "range" → start/end range calendar. */
  variant: "day" | "range";
  // day
  date?: Date | null;
  onDateChange?: (date: Date) => void;
  // range
  startDate?: Date | null;
  endDate?: Date | null;
  onRangeChange?: (start: Date | null, end: Date | null) => void;
  className?: string;
  triggerClassName?: string;
}

/**
 * A compact period control used across the Controle de Ponto views: chevrons to
 * step prev/next, and a clickable two-line chip that opens a calendar popover —
 * a single-date picker ("day") or a start/end range picker ("range"). Replaces
 * the old inline date pickers so every mode reads the same and sits on the right.
 */
export function PeriodControl({
  title,
  subtitle,
  onPrev,
  onNext,
  variant,
  date,
  onDateChange,
  startDate,
  endDate,
  onRangeChange,
  className,
  triggerClassName,
}: PeriodControlProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {onPrev && (
        <Button type="button" variant="default" size="icon" onClick={onPrev} className="h-10 w-10 shrink-0">
          <IconChevronLeft className="h-4 w-4" />
        </Button>
      )}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className={cn(
              "group h-10 px-3 flex flex-col items-center justify-center gap-0 leading-none min-w-[170px]",
              "hover:bg-primary hover:text-primary-foreground hover:border-primary",
              triggerClassName,
            )}
          >
            <span className="flex items-center gap-1 text-sm font-medium">
              <IconCalendar className="h-4 w-4" />
              <span className="capitalize">{title}</span>
            </span>
            {subtitle && (
              <span className="mt-0.5 text-[11px] font-normal text-muted-foreground group-hover:text-primary-foreground">
                {subtitle}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-auto p-0">
          {variant === "day" ? (
            <Calendar
              mode="single"
              selected={date ?? undefined}
              defaultMonth={date ?? undefined}
              onSelect={
                ((d: Date | undefined) => {
                  if (d) {
                    onDateChange?.(d);
                    setOpen(false);
                  }
                }) as any
              }
              {...({} as any)}
            />
          ) : (
            <Calendar
              mode="range"
              numberOfMonths={2}
              selected={{ from: startDate ?? undefined, to: endDate ?? undefined } as any}
              defaultMonth={startDate ?? endDate ?? undefined}
              onSelect={
                ((range: { from?: Date; to?: Date } | undefined) =>
                  onRangeChange?.(range?.from ?? null, range?.to ?? null)) as any
              }
              {...({} as any)}
            />
          )}
        </PopoverContent>
      </Popover>

      {onNext && (
        <Button type="button" variant="default" size="icon" onClick={onNext} className="h-10 w-10 shrink-0">
          <IconChevronRight className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
