import * as React from "react";
import { cn } from "@/lib/utils";

export interface NaturalDateTimeInputProps extends Omit<React.ComponentProps<"input">, "onChange" | "value" | "type"> {
  value?: Date | string | null;
  onChange?: (value: Date | null) => void;
  mode?: "date" | "time" | "datetime";
  transparent?: boolean;
  format24Hours?: boolean;
  showSeconds?: boolean;
}

type DateSegment = "day" | "month" | "year";
type TimeSegment = "hour" | "minute" | "second";
type Segment = DateSegment | TimeSegment;

interface SegmentedValue {
  day: string;
  month: string;
  year: string;
  hour: string;
  minute: string;
  second: string;
}

const EMPTY_SEGMENTS: SegmentedValue = {
  day: "",
  month: "",
  year: "",
  hour: "",
  minute: "",
  second: "",
};

// Convert a Date to segments
const dateToSegments = (date: Date | string | null | undefined): SegmentedValue => {
  if (!date) return { ...EMPTY_SEGMENTS };

  const dateObj = typeof date === "string" ? new Date(date) : date;
  if (!(dateObj instanceof Date) || isNaN(dateObj.getTime())) {
    return { ...EMPTY_SEGMENTS };
  }

  return {
    day: dateObj.getDate().toString().padStart(2, "0"),
    month: (dateObj.getMonth() + 1).toString().padStart(2, "0"),
    year: dateObj.getFullYear().toString(),
    hour: dateObj.getHours().toString().padStart(2, "0"),
    minute: dateObj.getMinutes().toString().padStart(2, "0"),
    second: dateObj.getSeconds().toString().padStart(2, "0"),
  };
};

// Check if segments represent a complete, valid date
const isCompleteDate = (segs: SegmentedValue, mode: "date" | "time" | "datetime"): boolean => {
  const d = parseInt(segs.day, 10);
  const m = parseInt(segs.month, 10);
  const y = parseInt(segs.year, 10);
  const h = parseInt(segs.hour, 10);
  const mi = parseInt(segs.minute, 10);

  const hasValidDate = !isNaN(d) && d >= 1 && d <= 31 &&
                       !isNaN(m) && m >= 1 && m <= 12 &&
                       !isNaN(y) && y >= 1900 && y <= 2100;
  const hasValidTime = !isNaN(h) && h >= 0 && h <= 23 &&
                       !isNaN(mi) && mi >= 0 && mi <= 59;

  if (mode === "date") return hasValidDate;
  if (mode === "time") return hasValidTime;
  return hasValidDate && hasValidTime;
};

// Convert segments to Date
const segmentsToDate = (segs: SegmentedValue, mode: "date" | "time" | "datetime", showSeconds: boolean): Date | null => {
  if (!isCompleteDate(segs, mode)) return null;

  const date = new Date();

  if (mode !== "time") {
    const d = parseInt(segs.day, 10);
    const m = parseInt(segs.month, 10);
    const y = parseInt(segs.year, 10);
    date.setFullYear(y, m - 1, d);
  }

  if (mode !== "date") {
    const h = parseInt(segs.hour, 10);
    const mi = parseInt(segs.minute, 10);
    const s = showSeconds ? parseInt(segs.second, 10) || 0 : 0;
    date.setHours(h, mi, s, 0);
  } else {
    // For date-only mode, set a neutral time
    date.setHours(12, 0, 0, 0);
  }

  return date;
};

// Compare two dates for equality (ignoring milliseconds)
const datesEqual = (a: Date | null | undefined, b: Date | null | undefined): boolean => {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return Math.floor(a.getTime() / 1000) === Math.floor(b.getTime() / 1000);
};

const NaturalDateTimeInput = React.forwardRef<HTMLInputElement, NaturalDateTimeInputProps>(
  ({ className, value, onChange, mode = "datetime", transparent = false, format24Hours = true, showSeconds = false, disabled, placeholder, ...props }, ref) => {
    // Core state
    const [segments, setSegments] = React.useState<SegmentedValue>(() => dateToSegments(value));
    const [currentSegment, setCurrentSegment] = React.useState<Segment>(mode === "time" ? "hour" : "day");

    // Refs for tracking state
    const inputRef = React.useRef<HTMLInputElement>(null);
    const lastExternalValueRef = React.useRef<Date | null>(null);

    // Track if user has made edits since focusing (dirty state)
    // This is more reliable than just tracking focus because it persists through re-renders
    const isDirtyRef = React.useRef(false);

    // Track the segments at the time of last external sync
    // This helps us detect if user has made changes
    const lastSyncedSegmentsRef = React.useRef<SegmentedValue | null>(null);

    // Ref to always have current segments available in event handlers (avoids stale closures)
    const segmentsRef = React.useRef<SegmentedValue>(segments);
    segmentsRef.current = segments;

    // Combine refs
    const combinedRef = React.useCallback(
      (node: HTMLInputElement) => {
        inputRef.current = node;
        if (typeof ref === "function") {
          ref(node);
        } else if (ref) {
          ref.current = node;
        }
      },
      [ref],
    );

    // Check if input is currently focused (DOM-level check)
    const isInputFocused = React.useCallback(() => {
      return inputRef.current && document.activeElement === inputRef.current;
    }, []);

    // Sync from external value with multiple safeguards
    React.useEffect(() => {
      // GUARD 1: Don't sync if user has made edits (dirty)
      if (isDirtyRef.current) return;

      // GUARD 2: Don't sync if input is currently focused (DOM check)
      if (isInputFocused()) return;

      // Convert value to Date for comparison
      const externalDate = value
        ? (typeof value === "string" ? new Date(value) : value)
        : null;
      const validExternalDate = externalDate && !isNaN(externalDate.getTime()) ? externalDate : null;

      // GUARD 3: Only update if the external value actually changed
      if (datesEqual(validExternalDate, lastExternalValueRef.current)) return;

      // All guards passed - safe to sync
      lastExternalValueRef.current = validExternalDate;
      const newSegments = dateToSegments(validExternalDate);
      lastSyncedSegmentsRef.current = newSegments;
      setSegments(newSegments);
    }, [value, isInputFocused]);

    // Define segment order based on mode
    const segmentOrder = React.useMemo((): Segment[] => {
      if (mode === "date") return ["day", "month", "year"];
      if (mode === "time") {
        return showSeconds ? ["hour", "minute", "second"] : ["hour", "minute"];
      }
      return showSeconds
        ? ["day", "month", "year", "hour", "minute", "second"]
        : ["day", "month", "year", "hour", "minute"];
    }, [mode, showSeconds]);

    // Get segment position in the display string
    const getSegmentPosition = React.useCallback((segment: Segment): [number, number] => {
      if (mode === "date") {
        const positions: Record<string, [number, number]> = {
          day: [0, 2],
          month: [3, 5],
          year: [6, 10],
        };
        return positions[segment] || [-1, -1];
      }

      if (mode === "time") {
        const positions: Record<string, [number, number]> = {
          hour: [0, 2],
          minute: [3, 5],
          second: [6, 8],
        };
        return positions[segment] || [-1, -1];
      }

      // datetime mode
      const positions: Record<string, [number, number]> = {
        day: [0, 2],
        month: [3, 5],
        year: [6, 10],
        hour: [11, 13],
        minute: [14, 16],
        second: [17, 19],
      };
      return positions[segment] || [-1, -1];
    }, [mode]);

    // Format display value
    const getDisplayValue = React.useCallback((): string => {
      const formatSegment = (val: string, placeholder: string, length: number): string => {
        if (!val) return placeholder;
        return val.padStart(length, placeholder[0]);
      };

      if (mode === "date") {
        const d = formatSegment(segments.day, "dd", 2);
        const m = formatSegment(segments.month, "mm", 2);
        const y = segments.year || "aaaa";
        return `${d}/${m}/${y.padEnd(4, "a")}`;
      }

      if (mode === "time") {
        const h = formatSegment(segments.hour, "hh", 2);
        const m = formatSegment(segments.minute, "mm", 2);
        if (showSeconds) {
          const s = formatSegment(segments.second, "ss", 2);
          return `${h}:${m}:${s}`;
        }
        return `${h}:${m}`;
      }

      // datetime mode
      const d = formatSegment(segments.day, "dd", 2);
      const mo = formatSegment(segments.month, "mm", 2);
      const y = segments.year || "aaaa";
      const h = formatSegment(segments.hour, "hh", 2);
      const mi = formatSegment(segments.minute, "mm", 2);

      const dateStr = `${d}/${mo}/${y.padEnd(4, "a")}`;
      if (showSeconds) {
        const s = formatSegment(segments.second, "ss", 2);
        return `${dateStr} ${h}:${mi}:${s}`;
      }
      return `${dateStr} ${h}:${mi}`;
    }, [segments, mode, showSeconds]);

    // Validate and constrain segment value
    const validateSegment = React.useCallback((segment: Segment, val: string): string => {
      const num = parseInt(val, 10);
      if (isNaN(num)) return "";

      switch (segment) {
        case "day":
          if (num < 1) return "";
          if (num > 31) return "31";
          return num.toString();

        case "month":
          if (num < 1) return "";
          if (num > 12) return "12";
          return num.toString();

        case "year":
          // Allow partial input, only constrain when complete
          if (val.length === 4) {
            if (num < 1900) return "1900";
            if (num > 2100) return "2100";
          }
          return num.toString();

        case "hour":
          if (num < 0) return "";
          const maxHour = format24Hours ? 23 : 12;
          if (num > maxHour) return maxHour.toString();
          return num.toString();

        case "minute":
        case "second":
          if (num < 0) return "";
          if (num > 59) return "59";
          return num.toString();

        default:
          return val;
      }
    }, [format24Hours]);

    // Get max length for segment
    const getSegmentMaxLength = (segment: Segment): number => {
      return segment === "year" ? 4 : 2;
    };

    // Select a segment in the input
    const selectSegment = React.useCallback((segment: Segment) => {
      if (!inputRef.current) return;

      const [start, end] = getSegmentPosition(segment);
      if (start >= 0 && end >= 0) {
        // Use requestAnimationFrame for reliable selection after render
        requestAnimationFrame(() => {
          inputRef.current?.focus();
          inputRef.current?.setSelectionRange(start, end);
        });
      }
    }, [getSegmentPosition]);

    // Notify parent of value change (only when we have a complete valid date)
    const notifyChange = React.useCallback((segs: SegmentedValue) => {
      if (!onChange) return;

      const date = segmentsToDate(segs, mode, showSeconds);
      if (date && !datesEqual(date, lastExternalValueRef.current)) {
        lastExternalValueRef.current = date;
        onChange(date);
      }
    }, [onChange, mode, showSeconds]);

    // Update a segment and optionally auto-advance
    const updateSegment = React.useCallback((segment: Segment, newValue: string, autoAdvance: boolean = false) => {
      // Mark as dirty - user has made edits
      isDirtyRef.current = true;

      setSegments(prevSegments => {
        // Explicitly construct new object to ensure all fields are preserved
        const newSegments: SegmentedValue = {
          day: prevSegments.day,
          month: prevSegments.month,
          year: prevSegments.year,
          hour: prevSegments.hour,
          minute: prevSegments.minute,
          second: prevSegments.second,
        };
        // Update only the target segment
        newSegments[segment] = newValue;

        // Notify parent if we now have a complete date
        // Use setTimeout to avoid state update during render
        setTimeout(() => notifyChange(newSegments), 0);

        return newSegments;
      });

      if (autoAdvance) {
        const currentIndex = segmentOrder.indexOf(segment);
        if (currentIndex < segmentOrder.length - 1) {
          const nextSegment = segmentOrder[currentIndex + 1];
          setCurrentSegment(nextSegment);
          selectSegment(nextSegment);
        }
      }
    }, [segmentOrder, selectSegment, notifyChange]);

    // Handle keyboard navigation
    const handleKeyDown = React.useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
      const currentIndex = segmentOrder.indexOf(currentSegment);

      // Tab navigation - allow natural tab behavior at boundaries
      if (e.key === "Tab") {
        if (e.shiftKey && currentIndex > 0) {
          e.preventDefault();
          const prevSegment = segmentOrder[currentIndex - 1];
          setCurrentSegment(prevSegment);
          selectSegment(prevSegment);
        } else if (!e.shiftKey && currentIndex < segmentOrder.length - 1) {
          e.preventDefault();
          const nextSegment = segmentOrder[currentIndex + 1];
          setCurrentSegment(nextSegment);
          selectSegment(nextSegment);
        }
        // Let tab escape the input at boundaries
        return;
      }

      // Arrow key navigation between segments
      if (e.key === "ArrowRight") {
        e.preventDefault();
        if (currentIndex < segmentOrder.length - 1) {
          const nextSegment = segmentOrder[currentIndex + 1];
          setCurrentSegment(nextSegment);
          selectSegment(nextSegment);
        }
        return;
      }

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (currentIndex > 0) {
          const prevSegment = segmentOrder[currentIndex - 1];
          setCurrentSegment(prevSegment);
          selectSegment(prevSegment);
        }
        return;
      }

      // Arrow up/down to increment/decrement current segment
      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        const currentValue = segmentsRef.current[currentSegment];
        const num = parseInt(currentValue, 10) || 0;
        const delta = e.key === "ArrowUp" ? 1 : -1;
        let newNum = num + delta;

        // Wrap around for better UX
        const limits: Record<Segment, [number, number]> = {
          day: [1, 31],
          month: [1, 12],
          year: [1900, 2100],
          hour: [0, format24Hours ? 23 : 12],
          minute: [0, 59],
          second: [0, 59],
        };
        const [min, max] = limits[currentSegment];

        if (newNum < min) newNum = max;
        if (newNum > max) newNum = min;

        const padLength = currentSegment === "year" ? 4 : 2;
        updateSegment(currentSegment, newNum.toString().padStart(padLength, "0"));
        selectSegment(currentSegment);
        return;
      }

      // Number input
      if (e.key >= "0" && e.key <= "9") {
        e.preventDefault();
        const currentValue = segmentsRef.current[currentSegment];
        const maxLength = getSegmentMaxLength(currentSegment);

        // Build new value: append if not at max length, otherwise replace
        let newValue: string;
        if (currentValue.length >= maxLength) {
          newValue = e.key;
        } else {
          newValue = currentValue + e.key;
        }

        // Validate
        const validated = validateSegment(currentSegment, newValue);
        if (!validated) return;

        // Determine if we should auto-advance
        let shouldAutoAdvance = false;
        let finalValue = validated;

        if (currentSegment === "day" || currentSegment === "month") {
          const num = parseInt(validated, 10);
          // Auto-pad and advance if single digit > threshold
          if (validated.length === 1) {
            if ((currentSegment === "day" && num > 3) || (currentSegment === "month" && num > 1)) {
              finalValue = validated.padStart(2, "0");
              shouldAutoAdvance = true;
            }
          } else if (validated.length === 2) {
            finalValue = validated.padStart(2, "0");
            shouldAutoAdvance = true;
          }
        } else if (currentSegment === "hour" || currentSegment === "minute" || currentSegment === "second") {
          const num = parseInt(validated, 10);
          if (validated.length === 1) {
            // Auto-advance if typing a number that can't be followed by another digit
            const maxFirstDigit = currentSegment === "hour" ? (format24Hours ? 2 : 1) : 5;
            if (num > maxFirstDigit) {
              finalValue = validated.padStart(2, "0");
              shouldAutoAdvance = true;
            }
          } else if (validated.length === 2) {
            finalValue = validated.padStart(2, "0");
            shouldAutoAdvance = true;
          }
        } else if (currentSegment === "year") {
          // Only auto-advance when year is complete (4 digits)
          shouldAutoAdvance = validated.length === 4;
        }

        updateSegment(currentSegment, finalValue, shouldAutoAdvance);
        if (!shouldAutoAdvance) {
          selectSegment(currentSegment);
        }
        return;
      }

      // Backspace - clear current segment
      if (e.key === "Backspace") {
        e.preventDefault();
        const currentValue = segmentsRef.current[currentSegment];
        if (currentValue.length > 0) {
          // Remove last character
          const newValue = currentValue.slice(0, -1);
          updateSegment(currentSegment, newValue);
          selectSegment(currentSegment);
        } else if (currentIndex > 0) {
          // If empty, move to previous segment
          const prevSegment = segmentOrder[currentIndex - 1];
          setCurrentSegment(prevSegment);
          selectSegment(prevSegment);
        }
        return;
      }

      // Delete - clear entire segment
      if (e.key === "Delete") {
        e.preventDefault();
        updateSegment(currentSegment, "");
        selectSegment(currentSegment);
        return;
      }

      // Slash or colon - move to next segment (natural typing flow)
      if (e.key === "/" || e.key === ":" || e.key === "-" || e.key === " ") {
        e.preventDefault();
        if (currentIndex < segmentOrder.length - 1) {
          const nextSegment = segmentOrder[currentIndex + 1];
          setCurrentSegment(nextSegment);
          selectSegment(nextSegment);
        }
        return;
      }

      // Prevent other keys
      e.preventDefault();
    }, [currentSegment, segmentOrder, validateSegment, updateSegment, selectSegment, format24Hours]);

    // Handle click to select segment
    const handleClick = React.useCallback((e: React.MouseEvent<HTMLInputElement>) => {
      const input = e.currentTarget;
      const clickPos = input.selectionStart || 0;

      // Find which segment was clicked
      let targetSegment = segmentOrder[0];
      for (const segment of segmentOrder) {
        const [start, end] = getSegmentPosition(segment);
        if (clickPos >= start && clickPos <= end + 1) {
          targetSegment = segment;
          break;
        }
      }

      setCurrentSegment(targetSegment);
      selectSegment(targetSegment);
    }, [segmentOrder, getSegmentPosition, selectSegment]);

    // Handle focus
    const handleFocus = React.useCallback(() => {
      // Don't reset dirty here - if user clicks back in, they may still be editing
      // Dirty is only reset on blur after finalizing

      // Select the appropriate first segment
      const firstSegment = segmentOrder[0];
      setCurrentSegment(firstSegment);
      selectSegment(firstSegment);
    }, [segmentOrder, selectSegment]);

    // Handle blur - finalize editing
    const handleBlur = React.useCallback(() => {
      setSegments(prev => {
        const newSegments: SegmentedValue = {
          day: prev.day,
          month: prev.month,
          year: prev.year,
          hour: prev.hour,
          minute: prev.minute,
          second: prev.second,
        };

        // Auto-complete 2-digit year
        if (newSegments.year.length === 2) {
          const shortYear = parseInt(newSegments.year, 10);
          if (!isNaN(shortYear)) {
            newSegments.year = (shortYear < 50 ? 2000 + shortYear : 1900 + shortYear).toString();
          }
        }

        // Pad all non-empty segments with leading zeros
        if (newSegments.day) newSegments.day = newSegments.day.padStart(2, "0");
        if (newSegments.month) newSegments.month = newSegments.month.padStart(2, "0");
        if (newSegments.hour) newSegments.hour = newSegments.hour.padStart(2, "0");
        if (newSegments.minute) newSegments.minute = newSegments.minute.padStart(2, "0");
        if (newSegments.second) newSegments.second = newSegments.second.padStart(2, "0");

        // Notify parent with final value
        setTimeout(() => {
          notifyChange(newSegments);
          // Reset dirty AFTER notifying - this allows parent to update value
          // and we won't override user's work until they blur
          isDirtyRef.current = false;
        }, 0);

        return newSegments;
      });
    }, [notifyChange]);

    // Prevent default onChange since we handle everything via keyboard
    const handleChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
      e.preventDefault();
    }, []);

    return (
      <input
        ref={combinedRef}
        type="text"
        className={cn(
          "flex h-10 w-full rounded-lg border border-border px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus:outline-none disabled:cursor-not-allowed disabled:opacity-[var(--disabled-opacity)] transition-all duration-200 ease-in-out",
          transparent ? "bg-transparent" : "bg-input",
          className,
        )}
        value={getDisplayValue()}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onClick={handleClick}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder || (mode === "date" ? "dd/mm/aaaa" : mode === "time" ? "hh:mm" : "dd/mm/aaaa hh:mm")}
        disabled={disabled}
        autoComplete="off"
        inputMode="numeric"
        {...props}
      />
    );
  },
);

NaturalDateTimeInput.displayName = "NaturalDateTimeInput";

export { NaturalDateTimeInput };
