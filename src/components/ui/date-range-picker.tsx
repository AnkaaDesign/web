import * as React from "react";
import { CalendarIcon } from "lucide-react";
import { type DateRange } from "react-day-picker";
import { format } from "date-fns";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface DateRangePickerProps {
  dateRange?: DateRange;
  onDateRangeChange: (range: DateRange | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  from?: Date;
  to?: Date;
  onSelect?: (range: DateRange | undefined) => void;
}

export function DateRangePicker({
  dateRange,
  onDateRangeChange,
  placeholder = "Selecionar período",
  disabled,
  className,
  from,
  to,
  onSelect,
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false);

  // Normalize the props - support both dateRange prop and from/to props
  const range = dateRange || (from || to ? { from, to } : undefined);
  const handleSelect = onSelect || onDateRangeChange;

  const handleDateSelect = (selectedRange: DateRange | undefined) => {
    handleSelect(selectedRange);

    // Only close the popover if both dates are selected
    if (selectedRange?.from && selectedRange?.to) {
      setOpen(false);
    }
  };

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal",
              !range && "text-muted-foreground"
            )}
            disabled={disabled}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {range?.from ? (
              range.to ? (
                <>
                  {format(range.from, "dd/MM/yyyy")} -{" "}
                  {format(range.to, "dd/MM/yyyy")}
                </>
              ) : (
                format(range.from, "dd/MM/yyyy")
              )
            ) : (
              <span>{placeholder}</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            defaultMonth={range?.from}
            selected={range}
            onSelect={handleDateSelect as any}
            numberOfMonths={2}
            initialFocus={true}
            {...({} as any)}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}