import * as React from "react";
import { IconCalendar, IconClock, IconX } from "@tabler/icons-react";
import { format, isValid, parse, addDays, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import { FormControl, FormItem, FormLabel, FormMessage, useFormField } from "@/components/ui/form";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

// Types
export type DateTimeMode = "date" | "time" | "datetime" | "date-range";

export interface DateConstraints {
  minDate?: Date;
  maxDate?: Date;
  disabledDates?: (date: Date) => boolean;
  onlyBusinessDays?: boolean;
}

export interface DateTimeInputProps<TFieldValues extends FieldValues = FieldValues, TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>> {
  field?: {
    onChange: (value: Date | null) => void;
    onBlur: () => void;
    value: Date | null;
    name: TName;
  };
  control?: any;
  mode?: DateTimeMode;
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
  constraints?: DateConstraints;
  onChange?: (date: Date | null) => void;
  value?: Date | null;
  className?: string;
  label?: string;
  hideLabel?: boolean;
  error?: string;
  numberOfMonths?: number;
  onFocus?: () => void;
  onBlur?: () => void;
  onClear?: () => void;
  format24Hours?: boolean;
  showSeconds?: boolean;
  showClearButton?: boolean;
  buttonClassName?: string;
  hideIcon?: boolean;
}

// Format date for HTML input
const formatForHTMLInput = (date: Date | string | null, mode: DateTimeMode): string => {
  if (!date) return "";

  // Convert string to Date if needed
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  if (!isValid(dateObj)) return "";

  try {
    switch (mode) {
      case "date":
        return format(dateObj, "yyyy-MM-dd");
      case "datetime":
        return format(dateObj, "yyyy-MM-dd'T'HH:mm");
      case "time":
        return format(dateObj, "HH:mm");
      default:
        return "";
    }
  } catch {
    return "";
  }
};

// Parse from HTML input
const parseFromHTMLInput = (value: string, mode: DateTimeMode): Date | null => {
  if (!value) return null;

  try {
    switch (mode) {
      case "date":
        return parse(value, "yyyy-MM-dd", new Date());
      case "datetime":
        return parse(value, "yyyy-MM-dd'T'HH:mm", new Date());
      case "time":
        return parse(value, "HH:mm", new Date());
      default:
        return null;
    }
  } catch {
    return null;
  }
};

// Format date for display
const formatDateTime = (date: Date | string | null, mode: DateTimeMode): string => {
  if (!date) return "";

  // Convert string to Date if needed
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  if (!isValid(dateObj)) return "";

  try {
    switch (mode) {
      case "date":
        return format(dateObj, "dd/MM/yyyy", { locale: ptBR });
      case "time":
        return format(dateObj, "HH:mm", { locale: ptBR });
      case "datetime":
        return format(dateObj, "dd/MM/yyyy HH:mm", { locale: ptBR });
      case "date-range":
        return format(dateObj, "dd/MM/yyyy", { locale: ptBR });
      default:
        return "";
    }
  } catch {
    return "";
  }
};

// Main component
export const DateTimeInput = <TFieldValues extends FieldValues = FieldValues, TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>>({
  field,
  mode = "date",
  placeholder,
  disabled = false,
  readOnly = false,
  constraints,
  onChange,
  value,
  className,
  label,
  hideLabel = false,
  error,
  numberOfMonths = 1,
  onFocus,
  onBlur,
  onClear,
  format24Hours = true,
  showSeconds = false,
  showClearButton = true,
  buttonClassName,
  hideIcon = false,
}: DateTimeInputProps<TFieldValues, TName>) => {
  // State
  const [isOpen, setIsOpen] = React.useState(false);

  // Check if we're inside a form context - if field is provided, we assume we're in a form
  const isInFormContext = !!field;

  // Get current value and normalize to Date object if it's a string
  const rawValue = field?.value || value;
  const currentValue = React.useMemo(() => {
    if (!rawValue) return null;
    if (rawValue instanceof Date) return rawValue;
    if (typeof rawValue === 'string') {
      const parsed = new Date(rawValue);
      return isValid(parsed) ? parsed : null;
    }
    return rawValue;
  }, [rawValue]);

  // HTML input type mapping
  const getHTMLInputType = () => {
    switch (mode) {
      case "date":
        return "date";
      case "datetime":
        return "datetime-local";
      case "time":
        return "time";
      default:
        return "date";
    }
  };

  // Format current value for HTML input
  const htmlInputValue = formatForHTMLInput(currentValue, mode);

  // Handle HTML input changes
  const handleHTMLInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    const parsed = parseFromHTMLInput(inputValue, mode);

    const changeHandler = field?.onChange || onChange;
    if (changeHandler) {
      changeHandler(parsed);
    }
  };

  // Date constraint validation
  const isDateDisabled = React.useCallback(
    (date: Date) => {
      if (constraints?.minDate && date < startOfDay(constraints.minDate)) return true;
      if (constraints?.maxDate && date > endOfDay(constraints.maxDate)) return true;
      if (constraints?.disabledDates) return constraints.disabledDates(date);
      return false;
    },
    [constraints],
  );

  // Enhanced calendar from the original component
  const renderEnhancedCalendar = () => {
    const [showYearSelect, setShowYearSelect] = React.useState<false | 'left' | 'right'>(false);
    const [showMonthSelect, setShowMonthSelect] = React.useState<false | 'left' | 'right'>(false);

    // For date-range mode, we need two separate calendar months
    const [calendarMonth, setCalendarMonth] = React.useState<Date>(() => {
      if (mode === "date-range" && currentValue) {
        const range = currentValue as DateRange;
        return range?.from || new Date();
      }
      return currentValue || new Date();
    });

    // Second calendar month for date-range (one month ahead by default)
    const [calendarMonthRight, setCalendarMonthRight] = React.useState<Date>(() => {
      const baseMonth = calendarMonth || new Date();
      const nextMonth = new Date(baseMonth);
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      return nextMonth;
    });

    const [selectedHour, setSelectedHour] = React.useState(() => (currentValue instanceof Date ? currentValue.getHours() : 0));
    const [selectedMinute, setSelectedMinute] = React.useState(() => (currentValue instanceof Date ? currentValue.getMinutes() : 0));

    // Update selected time when currentValue changes
    React.useEffect(() => {
      if (currentValue instanceof Date) {
        setSelectedHour(currentValue.getHours());
        setSelectedMinute(currentValue.getMinutes());
      }
    }, [currentValue]);

    const currentYear = calendarMonth.getFullYear();
    const currentMonth = calendarMonth.getMonth();
    const currentYearRight = calendarMonthRight.getFullYear();
    const currentMonthRight = calendarMonthRight.getMonth();

    // Generate year range (current year ± 50 years)
    const yearRange = Array.from({ length: 101 }, (_, i) => new Date().getFullYear() - 50 + i);

    // Month names in Portuguese
    const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

    const handleDateSelect = (date: Date | undefined) => {
      if (date) {
        // For datetime mode, preserve time if already set
        if (mode === "datetime" && currentValue instanceof Date) {
          const newDate = new Date(date);
          newDate.setHours(currentValue.getHours(), currentValue.getMinutes(), 0, 0);
          date = newDate;
        }

        const changeHandler = field?.onChange || onChange;
        if (changeHandler) {
          changeHandler(date);
        }
      }
      setIsOpen(false);
    };

    const handleYearSelect = (year: number, calendar: 'left' | 'right' = 'left') => {
      if (mode === "date-range") {
        if (calendar === 'left') {
          const newDate = new Date(calendarMonth);
          newDate.setFullYear(year);
          setCalendarMonth(newDate);
        } else {
          const newDate = new Date(calendarMonthRight);
          newDate.setFullYear(year);
          setCalendarMonthRight(newDate);
        }
      } else {
        const newDate = currentValue ? new Date(currentValue) : new Date();
        newDate.setFullYear(year);
        setCalendarMonth(newDate);

        // Immediately update the value
        if (mode === "datetime") {
          newDate.setHours(selectedHour, selectedMinute, 0, 0);
        }
        const changeHandler = field?.onChange || onChange;
        if (changeHandler) {
          changeHandler(newDate);
        }
      }

      // Close the year selector after selection
      setShowYearSelect(false);
    };

    const handleMonthSelect = (monthIndex: number, calendar: 'left' | 'right' = 'left') => {
      if (mode === "date-range") {
        if (calendar === 'left') {
          const newDate = new Date(calendarMonth);
          newDate.setMonth(monthIndex);
          setCalendarMonth(newDate);
        } else {
          const newDate = new Date(calendarMonthRight);
          newDate.setMonth(monthIndex);
          setCalendarMonthRight(newDate);
        }
      } else {
        const newDate = currentValue ? new Date(currentValue) : new Date();
        newDate.setMonth(monthIndex);
        setCalendarMonth(newDate);

        // Immediately update the value
        if (mode === "datetime") {
          newDate.setHours(selectedHour, selectedMinute, 0, 0);
        }
        const changeHandler = field?.onChange || onChange;
        if (changeHandler) {
          changeHandler(newDate);
        }
      }

      // Close the month selector after selection
      setShowMonthSelect(false);
    };

    const handleMonthChange = (direction: "prev" | "next", calendar: 'left' | 'right' = 'left') => {
      if (mode === "date-range") {
        if (calendar === 'left') {
          const newDate = new Date(calendarMonth);
          if (direction === "prev") {
            newDate.setMonth(newDate.getMonth() - 1);
          } else {
            newDate.setMonth(newDate.getMonth() + 1);
          }
          setCalendarMonth(newDate);
        } else {
          const newDate = new Date(calendarMonthRight);
          if (direction === "prev") {
            newDate.setMonth(newDate.getMonth() - 1);
          } else {
            newDate.setMonth(newDate.getMonth() + 1);
          }
          setCalendarMonthRight(newDate);
        }
      } else {
        const newDate = new Date(calendarMonth);
        if (direction === "prev") {
          newDate.setMonth(newDate.getMonth() - 1);
        } else {
          newDate.setMonth(newDate.getMonth() + 1);
        }
        setCalendarMonth(newDate);
      }
    };

    const handleTimeChange = (hour: number, minute: number) => {
      if (mode === "datetime") {
        const newDate = currentValue ? new Date(currentValue) : new Date(calendarMonth);
        // Keep the current date but update the time
        newDate.setHours(hour, minute, 0, 0);
        const changeHandler = field?.onChange || onChange;
        if (changeHandler) {
          changeHandler(newDate);
        }
        setSelectedHour(hour);
        setSelectedMinute(minute);
        // Don't close anything - allow continuous selection
      }
    };

    return (
      <div className="overflow-hidden rounded-md border border-border bg-neutral-50 dark:bg-background">
        <div className="flex">
          {/* Main Calendar Container */}
          <div className="flex-1">
            {/* Calendar Header with navigation and clickable month/year */}
            {mode === "date-range" ? (
              // Date range mode - dual headers
              <div className="flex border-b border-border">
                {/* Left Calendar Header */}
                <div className="flex-1 flex items-center justify-between px-3 h-[43px]">
                  {/* Previous Month Arrow */}
                  <button
                    onClick={() => handleMonthChange("prev", "left")}
                    className="h-7 w-7 inline-flex items-center justify-center rounded-sm opacity-50 hover:opacity-100 hover:bg-accent transition-opacity"
                    type="button"
                    aria-label="Go to previous month"
                  >
                    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path
                        d="M8.84182 3.13514C9.04327 3.32401 9.05348 3.64042 8.86462 3.84188L5.43521 7.49991L8.86462 11.1579C9.05348 11.3594 9.04327 11.6758 8.84182 11.8647C8.64036 12.0535 8.32394 12.0433 8.13508 11.8419L4.38508 7.84188C4.20477 7.64955 4.20477 7.35027 4.38508 7.15794L8.13508 3.15794C8.32394 2.95648 8.64036 2.94628 8.84182 3.13514Z"
                        fill="currentColor"
                        fillRule="evenodd"
                        clipRule="evenodd"
                      ></path>
                    </svg>
                  </button>

                  {/* Month and Year Display */}
                  <div className="flex items-center gap-1 text-sm font-medium">
                    <button
                      onClick={() => {
                        setShowMonthSelect(showMonthSelect === 'left' ? false : 'left');
                        setShowYearSelect(false);
                      }}
                      className="px-3 py-1 hover:bg-accent hover:text-accent-foreground rounded-sm transition-colors"
                      type="button"
                    >
                      {months[currentMonth].toLowerCase()}
                    </button>
                    <button
                      onClick={() => {
                        setShowYearSelect(showYearSelect === 'left' ? false : 'left');
                        setShowMonthSelect(false);
                      }}
                      className="px-3 py-1 hover:bg-accent hover:text-accent-foreground rounded-sm transition-colors"
                      type="button"
                    >
                      {currentYear}
                    </button>
                  </div>

                  {/* Next Month Arrow */}
                  <button
                    onClick={() => handleMonthChange("next", "left")}
                    className="h-7 w-7 inline-flex items-center justify-center rounded-sm opacity-50 hover:opacity-100 hover:bg-accent transition-opacity"
                    type="button"
                    aria-label="Go to next month"
                  >
                    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path
                        d="M6.1584 3.13508C6.35985 2.94621 6.67627 2.95641 6.86514 3.15787L10.6151 7.15787C10.7954 7.3502 10.7954 7.64949 10.6151 7.84182L6.86514 11.8418C6.67627 12.0433 6.35985 12.0535 6.1584 11.8646C5.95694 11.6757 5.94673 11.3593 6.1356 11.1579L9.565 7.49985L6.1356 3.84182C5.94673 3.64036 5.95694 3.32394 6.1584 3.13508Z"
                        fill="currentColor"
                        fillRule="evenodd"
                        clipRule="evenodd"
                      ></path>
                    </svg>
                  </button>
                </div>

                {/* Separator */}
                <div className="w-px bg-border"></div>

                {/* Right Calendar Header */}
                <div className="flex-1 flex items-center justify-between px-3 h-[43px]">
                  {/* Previous Month Arrow */}
                  <button
                    onClick={() => handleMonthChange("prev", "right")}
                    className="h-7 w-7 inline-flex items-center justify-center rounded-sm opacity-50 hover:opacity-100 hover:bg-accent transition-opacity"
                    type="button"
                    aria-label="Go to previous month"
                  >
                    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path
                        d="M8.84182 3.13514C9.04327 3.32401 9.05348 3.64042 8.86462 3.84188L5.43521 7.49991L8.86462 11.1579C9.05348 11.3594 9.04327 11.6758 8.84182 11.8647C8.64036 12.0535 8.32394 12.0433 8.13508 11.8419L4.38508 7.84188C4.20477 7.64955 4.20477 7.35027 4.38508 7.15794L8.13508 3.15794C8.32394 2.95648 8.64036 2.94628 8.84182 3.13514Z"
                        fill="currentColor"
                        fillRule="evenodd"
                        clipRule="evenodd"
                      ></path>
                    </svg>
                  </button>

                  {/* Month and Year Display */}
                  <div className="flex items-center gap-1 text-sm font-medium">
                    <button
                      onClick={() => {
                        setShowMonthSelect(showMonthSelect === 'right' ? false : 'right');
                        setShowYearSelect(false);
                      }}
                      className="px-3 py-1 hover:bg-accent hover:text-accent-foreground rounded-sm transition-colors"
                      type="button"
                    >
                      {months[currentMonthRight].toLowerCase()}
                    </button>
                    <button
                      onClick={() => {
                        setShowYearSelect(showYearSelect === 'right' ? false : 'right');
                        setShowMonthSelect(false);
                      }}
                      className="px-3 py-1 hover:bg-accent hover:text-accent-foreground rounded-sm transition-colors"
                      type="button"
                    >
                      {currentYearRight}
                    </button>
                  </div>

                  {/* Next Month Arrow */}
                  <button
                    onClick={() => handleMonthChange("next", "right")}
                    className="h-7 w-7 inline-flex items-center justify-center rounded-sm opacity-50 hover:opacity-100 hover:bg-accent transition-opacity"
                    type="button"
                    aria-label="Go to next month"
                  >
                    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path
                        d="M6.1584 3.13508C6.35985 2.94621 6.67627 2.95641 6.86514 3.15787L10.6151 7.15787C10.7954 7.3502 10.7954 7.64949 10.6151 7.84182L6.86514 11.8418C6.67627 12.0433 6.35985 12.0535 6.1584 11.8646C5.95694 11.6757 5.94673 11.3593 6.1356 11.1579L9.565 7.49985L6.1356 3.84182C5.94673 3.64036 5.95694 3.32394 6.1584 3.13508Z"
                        fill="currentColor"
                        fillRule="evenodd"
                        clipRule="evenodd"
                      ></path>
                    </svg>
                  </button>
                </div>
              </div>
            ) : (
              // Single date mode - original header
              <div className="flex items-center justify-between px-3 h-[43px] border-b border-border">
                {/* Previous Month Arrow */}
                <button
                  onClick={() => handleMonthChange("prev")}
                  className="h-7 w-7 inline-flex items-center justify-center rounded-sm opacity-50 hover:opacity-100 hover:bg-accent transition-opacity"
                  type="button"
                  aria-label="Go to previous month"
                >
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                      d="M8.84182 3.13514C9.04327 3.32401 9.05348 3.64042 8.86462 3.84188L5.43521 7.49991L8.86462 11.1579C9.05348 11.3594 9.04327 11.6758 8.84182 11.8647C8.64036 12.0535 8.32394 12.0433 8.13508 11.8419L4.38508 7.84188C4.20477 7.64955 4.20477 7.35027 4.38508 7.15794L8.13508 3.15794C8.32394 2.95648 8.64036 2.94628 8.84182 3.13514Z"
                      fill="currentColor"
                      fillRule="evenodd"
                      clipRule="evenodd"
                    ></path>
                  </svg>
                </button>

                {/* Month and Year Display */}
                <div className="flex items-center gap-1 text-sm font-medium">
                  <button
                    onClick={() => {
                      setShowMonthSelect(!showMonthSelect ? 'left' : false);
                      setShowYearSelect(false);
                    }}
                    className="px-3 py-1 hover:bg-accent hover:text-accent-foreground rounded-sm transition-colors"
                    type="button"
                  >
                    {months[currentMonth].toLowerCase()}
                  </button>
                  <button
                    onClick={() => {
                      setShowYearSelect(!showYearSelect ? 'left' : false);
                      setShowMonthSelect(false);
                    }}
                    className="px-3 py-1 hover:bg-accent hover:text-accent-foreground rounded-sm transition-colors"
                    type="button"
                  >
                    {currentYear}
                  </button>
                </div>

                {/* Next Month Arrow */}
                <button
                  onClick={() => handleMonthChange("next")}
                  className="h-7 w-7 inline-flex items-center justify-center rounded-sm opacity-50 hover:opacity-100 hover:bg-accent transition-opacity"
                  type="button"
                  aria-label="Go to next month"
                >
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                      d="M6.1584 3.13508C6.35985 2.94621 6.67627 2.95641 6.86514 3.15787L10.6151 7.15787C10.7954 7.3502 10.7954 7.64949 10.6151 7.84182L6.86514 11.8418C6.67627 12.0433 6.35985 12.0535 6.1584 11.8646C5.95694 11.6757 5.94673 11.3593 6.1356 11.1579L9.565 7.49985L6.1356 3.84182C5.94673 3.64036 5.95694 3.32394 6.1584 3.13508Z"
                      fill="currentColor"
                      fillRule="evenodd"
                      clipRule="evenodd"
                    ></path>
                  </svg>
                </button>
              </div>
            )}

            {/* Calendar Component - Minimal top padding */}
            <div className="bg-neutral-50 dark:bg-background">
              {mode === "date-range" ? (
                // Date range mode - render two calendars side by side
                <div className="flex">
                  {/* Left Calendar */}
                  <div className="flex-1 px-3 pt-1 pb-3">
                    <Calendar
                      mode="range"
                      selected={currentValue as DateRange}
                      onSelect={handleDateSelect}
                      disabled={disabled || isDateDisabled}
                      initialFocus
                      locale={ptBR}
                      numberOfMonths={1}
                      month={calendarMonth}
                      onMonthChange={setCalendarMonth}
                      showOutsideDays={false}
                      className="p-0 w-full !bg-transparent [&>div]:!bg-transparent [&_.rdp-button_previous]:!hidden [&_.rdp-button_next]:!hidden [&_.rdp-nav]:!hidden"
                      classNames={{
                        months: "flex flex-col",
                        month: "space-y-0 w-full",
                        caption: "hidden",
                        caption_label: "hidden",
                        nav: "hidden",
                        nav_button: "hidden",
                        nav_button_previous: "hidden",
                        nav_button_next: "hidden",
                        table: "w-full border-collapse bg-transparent",
                        head_row: "flex w-full",
                        head_cell: "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem] flex-1 text-center",
                        row: "flex w-full mt-1",
                        cell: "text-sm p-0 relative flex-1 text-center",
                        day: cn(
                          "h-9 w-9 mx-auto p-0 font-normal aria-selected:opacity-100",
                          "inline-flex items-center justify-center rounded-md text-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
                        ),
                        day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                        day_today: "bg-accent text-accent-foreground",
                        day_outside: "text-muted-foreground opacity-50",
                        day_disabled: "text-muted-foreground opacity-50",
                        day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
                        day_hidden: "invisible",
                      }}
                    />
                  </div>

                  {/* Separator */}
                  <div className="w-px bg-border"></div>

                  {/* Right Calendar */}
                  <div className="flex-1 px-3 pt-1 pb-3">
                    <Calendar
                      mode="range"
                      selected={currentValue as DateRange}
                      onSelect={handleDateSelect}
                      disabled={disabled || isDateDisabled}
                      locale={ptBR}
                      numberOfMonths={1}
                      month={calendarMonthRight}
                      onMonthChange={setCalendarMonthRight}
                      showOutsideDays={false}
                      className="p-0 w-full !bg-transparent [&>div]:!bg-transparent [&_.rdp-button_previous]:!hidden [&_.rdp-button_next]:!hidden [&_.rdp-nav]:!hidden"
                      classNames={{
                        months: "flex flex-col",
                        month: "space-y-0 w-full",
                        caption: "hidden",
                        caption_label: "hidden",
                        nav: "hidden",
                        nav_button: "hidden",
                        nav_button_previous: "hidden",
                        nav_button_next: "hidden",
                        table: "w-full border-collapse bg-transparent",
                        head_row: "flex w-full",
                        head_cell: "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem] flex-1 text-center",
                        row: "flex w-full mt-1",
                        cell: "text-sm p-0 relative flex-1 text-center",
                        day: cn(
                          "h-9 w-9 mx-auto p-0 font-normal aria-selected:opacity-100",
                          "inline-flex items-center justify-center rounded-md text-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
                        ),
                        day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                        day_today: "bg-accent text-accent-foreground",
                        day_outside: "text-muted-foreground opacity-50",
                        day_disabled: "text-muted-foreground opacity-50",
                        day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
                        day_hidden: "invisible",
                      }}
                    />
                  </div>
                </div>
              ) : (
                // Single date mode
                <div className="px-3 pt-1 pb-3">
                  <Calendar
                    mode="single"
                    selected={currentValue as Date}
                    onSelect={handleDateSelect}
                    disabled={disabled || isDateDisabled}
                    initialFocus
                    locale={ptBR}
                    numberOfMonths={1}
                    month={calendarMonth}
                    onMonthChange={setCalendarMonth}
                    showOutsideDays={false}
                    className="p-0 w-full !bg-transparent [&>div]:!bg-transparent"
                    classNames={{
                      months: "flex flex-col",
                      month: "space-y-0 w-full",
                      caption: "hidden",
                      caption_label: "hidden",
                      nav: "hidden",
                      nav_button: "hidden",
                      nav_button_previous: "hidden",
                      nav_button_next: "hidden",
                      table: "w-full border-collapse bg-transparent",
                      head_row: "flex w-full",
                      head_cell: "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem] flex-1 text-center",
                      row: "flex w-full mt-1",
                      cell: "text-sm p-0 relative flex-1 text-center",
                      day: cn(
                        "h-9 w-9 mx-auto p-0 font-normal aria-selected:opacity-100",
                        "inline-flex items-center justify-center rounded-md text-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
                      ),
                      day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                      day_today: "bg-accent text-accent-foreground",
                      day_outside: "text-muted-foreground opacity-50",
                      day_disabled: "text-muted-foreground opacity-50",
                      day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
                      day_hidden: "invisible",
                    }}
                  />
                </div>
              )}
            </div>

            {/* Clear button */}
            {showClearButton && currentValue && (
              <div className="px-3 pb-3 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    handleClear();
                    setIsOpen(false);
                  }}
                >
                  Limpar
                </Button>
              </div>
            )}
          </div>

          {/* Year Selector Sidebar */}
          {showYearSelect && (
            <div className={cn(
              "w-[100px] border-l border-border bg-neutral-50 dark:bg-background",
              mode === "date-range" && showYearSelect === 'left' && "order-first border-l-0 border-r",
            )}>
              {/* Year Header */}
              <div className="flex items-center justify-center px-3 h-[43px] border-b border-border">
                <span className="text-sm font-medium">Ano</span>
              </div>
              <div
                className="h-[277px] overflow-y-auto overflow-x-hidden p-2"
                ref={(el) => {
                  if (el && showYearSelect) {
                    // Auto-scroll to current year
                    const targetYear = showYearSelect === 'right' ? currentYearRight : currentYear;
                    setTimeout(() => {
                      const currentYearElement = el.querySelector(`#year-${targetYear}`);
                      if (currentYearElement) {
                        currentYearElement.scrollIntoView({ block: "center", behavior: "auto" });
                      }
                    }, 0);
                  }
                }}
              >
                <div className="space-y-1">
                  {yearRange.map((year) => {
                    const isSelected = showYearSelect === 'right' ? year === currentYearRight : year === currentYear;
                    return (
                      <button
                        key={year}
                        id={`year-${year}`}
                        onClick={() => handleYearSelect(year, showYearSelect === 'right' ? 'right' : 'left')}
                        className={cn(
                          "w-full px-2 py-1 text-sm rounded-sm text-left transition-colors",
                          isSelected ? "bg-primary text-primary-foreground" : "hover:bg-accent hover:text-accent-foreground",
                        )}
                        type="button"
                      >
                        {year}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Month Selector Sidebar */}
          {showMonthSelect && (
            <div className={cn(
              "w-[100px] border-l border-border bg-neutral-50 dark:bg-background",
              mode === "date-range" && showMonthSelect === 'left' && "order-first border-l-0 border-r",
            )}>
              {/* Month Header */}
              <div className="flex items-center justify-center px-3 h-[43px] border-b border-border">
                <span className="text-sm font-medium">Mês</span>
              </div>
              <div className="h-[277px] overflow-y-auto overflow-x-hidden p-2">
                <div className="space-y-1">
                  {months.map((month, index) => {
                    const isSelected = showMonthSelect === 'right' ? index === currentMonthRight : index === currentMonth;
                    return (
                      <button
                        key={month}
                        onClick={() => handleMonthSelect(index, showMonthSelect === 'right' ? 'right' : 'left')}
                        className={cn(
                          "w-full px-2 py-1 text-sm rounded-sm text-left transition-colors",
                          isSelected ? "bg-primary text-primary-foreground" : "hover:bg-accent hover:text-accent-foreground",
                        )}
                        type="button"
                      >
                        {month.toLowerCase()}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Time Selector Sidebar for datetime mode - Always visible */}
          {mode === "datetime" && (
            <div className="border-l border-border bg-neutral-50 dark:bg-background">
              {/* Time Header matching calendar header style */}
              <div className="flex items-center px-3 h-[43px] border-b border-border">
                <div className="flex-1 text-center text-sm font-medium">Hora</div>
                <div className="w-px h-4 bg-neutral-300 dark:bg-neutral-700"></div>
                <div className="flex-1 text-center text-sm font-medium">Min</div>
              </div>
              <div className="flex">
                {/* Hours Column */}
                <div className="w-[60px]">
                  <div
                    className="h-[277px] overflow-y-auto overflow-x-hidden"
                    ref={(el) => {
                      if (el && mode === "datetime") {
                        setTimeout(() => {
                          const currentHourElement = el.querySelector(`#hour-${selectedHour}`);
                          if (currentHourElement) {
                            currentHourElement.scrollIntoView({ block: "center", behavior: "auto" });
                          }
                        }, 0);
                      }
                    }}
                  >
                    <div className="py-1">
                      {Array.from({ length: 24 }, (_, i) => (
                        <button
                          key={i}
                          id={`hour-${i}`}
                          onClick={() => {
                            handleTimeChange(i, selectedMinute);
                          }}
                          className={cn(
                            "w-full px-2 py-1 text-sm hover:bg-accent hover:text-accent-foreground transition-colors",
                            selectedHour === i && "bg-primary text-primary-foreground font-medium",
                          )}
                          type="button"
                        >
                          {String(i).padStart(2, "0")}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Minutes Column */}
                <div className="w-[60px] border-l border-border">
                  <div
                    className="h-[277px] overflow-y-auto overflow-x-hidden"
                    ref={(el) => {
                      if (el && mode === "datetime") {
                        setTimeout(() => {
                          const currentMinuteElement = el.querySelector(`#minute-${selectedMinute}`);
                          if (currentMinuteElement) {
                            currentMinuteElement.scrollIntoView({ block: "center", behavior: "auto" });
                          }
                        }, 0);
                      }
                    }}
                  >
                    <div className="py-1">
                      {Array.from({ length: 60 }, (_, i) => (
                        <button
                          key={i}
                          id={`minute-${i}`}
                          onClick={() => {
                            handleTimeChange(selectedHour, i);
                          }}
                          className={cn(
                            "w-full px-2 py-1 text-sm hover:bg-accent hover:text-accent-foreground transition-colors",
                            selectedMinute === i && "bg-primary text-primary-foreground font-medium",
                          )}
                          type="button"
                        >
                          {String(i).padStart(2, "0")}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Clear value
  const handleClear = () => {
    const changeHandler = field?.onChange || onChange;
    if (changeHandler) {
      changeHandler(null);
    }
    onClear?.();
  };

  // Get appropriate icon
  const getIcon = () => {
    if (mode === "time") return IconClock;
    return IconCalendar;
  };

  const Icon = getIcon();

  const inputContent = mode === "date-range" ? (
    <div className="relative">
      {/* Date range mode - two separate input fields */}
      <div className="flex items-center gap-2">
        {/* From date input */}
        <div
          className={cn(
            "flex h-10 flex-1 rounded-md border border-border bg-transparent transition-all duration-200 ease-in-out",
            disabled && "opacity-50 cursor-not-allowed",
            className,
          )}
        >
          <input
            type="date"
            value={currentValue && (currentValue as DateRange)?.from ? formatForHTMLInput((currentValue as DateRange).from, "date") : ""}
            onChange={(e) => {
              const inputValue = e.target.value;
              const parsed = parseFromHTMLInput(inputValue, "date");
              const range = currentValue as DateRange;
              const changeHandler = field?.onChange || onChange;
              if (changeHandler) {
                changeHandler({ from: parsed, to: range?.to } as DateRange);
              }
            }}
            onFocus={onFocus}
            onBlur={onBlur}
            placeholder="Data inicial"
            disabled={disabled}
            readOnly={readOnly}
            className="hide-date-picker flex-1 bg-transparent px-2 py-2 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus:outline-none disabled:cursor-not-allowed border-0 outline-none"
            style={{
              WebkitAppearance: "none",
              MozAppearance: "textfield",
              appearance: "none",
            }}
          />
        </div>

        {/* Separator */}
        <span className="text-muted-foreground">-</span>

        {/* To date input */}
        <div
          className={cn(
            "flex h-10 flex-1 rounded-md border border-border bg-transparent transition-all duration-200 ease-in-out",
            disabled && "opacity-50 cursor-not-allowed",
            className,
          )}
        >
          <input
            type="date"
            value={currentValue && (currentValue as DateRange)?.to ? formatForHTMLInput((currentValue as DateRange).to, "date") : ""}
            onChange={(e) => {
              const inputValue = e.target.value;
              const parsed = parseFromHTMLInput(inputValue, "date");
              const range = currentValue as DateRange;
              const changeHandler = field?.onChange || onChange;
              if (changeHandler) {
                changeHandler({ from: range?.from, to: parsed } as DateRange);
              }
            }}
            onFocus={onFocus}
            onBlur={onBlur}
            placeholder="Data final"
            disabled={disabled}
            readOnly={readOnly}
            className="hide-date-picker flex-1 bg-transparent px-2 py-2 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus:outline-none disabled:cursor-not-allowed border-0 outline-none"
            style={{
              WebkitAppearance: "none",
              MozAppearance: "textfield",
              appearance: "none",
            }}
          />
        </div>

        {/* Integrated calendar icon */}
        {!hideIcon && (
          <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
              <div className={cn("h-10 w-10 flex items-center justify-center cursor-pointer transition-colors border border-border rounded-md", disabled && "cursor-not-allowed opacity-50")}>
                <Icon className="h-4 w-4 text-muted-foreground hover:text-primary transition-colors" />
              </div>
            </PopoverTrigger>
            <PopoverContent className="w-auto min-w-[640px] p-0" align="end">
              {renderEnhancedCalendar()}
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  ) : (
    <div className="relative">
      {/* Single date/time mode - one input field */}
      <div
        className={cn(
          "flex h-10 w-full rounded-md border border-border bg-transparent transition-all duration-200 ease-in-out",
          disabled && "opacity-50 cursor-not-allowed",
          className,
        )}
      >
        {/* HTML input with hidden browser calendar/clock */}
        <input
          type={getHTMLInputType()}
          value={htmlInputValue}
          onChange={handleHTMLInputChange}
          onFocus={onFocus}
          onBlur={onBlur}
          placeholder={placeholder}
          disabled={disabled}
          readOnly={readOnly}
          className="hide-date-picker flex-1 bg-transparent px-2 py-2 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus:outline-none disabled:cursor-not-allowed border-0 outline-none"
          style={{
            // Comprehensive CSS to hide all browser date/time picker indicators
            WebkitAppearance: "none",
            MozAppearance: "textfield",
            appearance: "none",
          }}
        />

        {/* Integrated calendar/clock icon */}
        {!hideIcon && (
          <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
              <div className={cn("h-10 w-7 flex items-center justify-center cursor-pointer transition-colors -mt-0.5", disabled && "cursor-not-allowed opacity-50")}>
                <Icon className="h-4 w-4 text-muted-foreground hover:text-primary transition-colors" />
              </div>
            </PopoverTrigger>
            <PopoverContent className={cn("w-auto p-0", mode === "date-range" && "w-auto min-w-[640px]")} align="end">
              {mode === "time" ? (
                <div className="p-3">
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium">Hora:</label>
                    <input
                      type="time"
                      value={formatForHTMLInput(currentValue, "time")}
                      onChange={(e) => {
                        const parsed = parseFromHTMLInput(e.target.value, "time");
                        const changeHandler = field?.onChange || onChange;
                        if (changeHandler) {
                          changeHandler(parsed);
                        }
                      }}
                      className="rounded border px-2 py-1 text-sm"
                    />
                  </div>
                </div>
              ) : (
                renderEnhancedCalendar()
              )}
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  );

  // If we're in a form context, wrap with Form components
  if (isInFormContext) {
    return (
      <FormItem>
        {!hideLabel && label && <FormLabel>{label}</FormLabel>}
        <div className="relative">
          <FormControl>{inputContent}</FormControl>
        </div>
        {error && <FormMessage>{error}</FormMessage>}
      </FormItem>
    );
  }

  // Otherwise, render without Form components
  return (
    <div>
      {!hideLabel && label && <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">{label}</label>}
      {inputContent}
      {error && <p className="text-sm font-medium text-destructive">{error}</p>}
    </div>
  );
};

// TimeInput wrapper for backward compatibility
export const TimeInput = React.forwardRef<HTMLInputElement, Omit<DateTimeInputProps, "mode">>((props, ref) => {
  return <DateTimeInput {...props} mode="time" />;
});

TimeInput.displayName = "TimeInput";

export default DateTimeInput;
