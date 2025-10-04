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

const NaturalDateTimeInput = React.forwardRef<HTMLInputElement, NaturalDateTimeInputProps>(
  ({ className, value, onChange, mode = "datetime", transparent = false, format24Hours = true, showSeconds = false, disabled, placeholder, ...props }, ref) => {
    // Initialize segments from value
    const getInitialSegments = (): SegmentedValue => {
      if (value instanceof Date && !isNaN(value.getTime())) {
        return {
          day: value.getDate().toString().padStart(2, "0"),
          month: (value.getMonth() + 1).toString().padStart(2, "0"),
          year: value.getFullYear().toString(),
          hour: value.getHours().toString().padStart(2, "0"),
          minute: value.getMinutes().toString().padStart(2, "0"),
          second: value.getSeconds().toString().padStart(2, "0"),
        };
      }
      return {
        day: "",
        month: "",
        year: "",
        hour: "",
        minute: "",
        second: "",
      };
    };

    const [segments, setSegments] = React.useState<SegmentedValue>(getInitialSegments);
    const [currentSegment, setCurrentSegment] = React.useState<Segment>("day");
    const [isFocused, setIsFocused] = React.useState(false);
    const inputRef = React.useRef<HTMLInputElement>(null);

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

    // Update segments when value changes externally
    React.useEffect(() => {
      if (!isFocused) {
        setSegments(getInitialSegments());
      }
    }, [value, isFocused]);

    // Define segment order based on mode
    const getSegmentOrder = (): Segment[] => {
      if (mode === "date") return ["day", "month", "year"];
      if (mode === "time") {
        return showSeconds ? ["hour", "minute", "second"] : ["hour", "minute"];
      }
      // datetime mode
      return showSeconds ? ["day", "month", "year", "hour", "minute", "second"] : ["day", "month", "year", "hour", "minute"];
    };

    const segmentOrder = getSegmentOrder();

    // Get segment position in the display string
    const getSegmentPosition = (segment: Segment): [number, number] => {
      const positions: Record<Segment, [number, number]> = {
        day: [0, 2],
        month: [3, 5],
        year: [6, 10],
        hour: mode === "date" ? [-1, -1] : mode === "time" ? [0, 2] : [11, 13],
        minute: mode === "date" ? [-1, -1] : mode === "time" ? [3, 5] : [14, 16],
        second: mode === "date" ? [-1, -1] : mode === "time" ? [6, 8] : [17, 19],
      };
      return positions[segment];
    };

    // Format display value
    const getDisplayValue = (): string => {
      if (mode === "date") {
        const d = segments.day || "dd";
        const m = segments.month || "mm";
        const y = segments.year || "aaaa";
        return `${d.padStart(2, "d")}/${m.padStart(2, "m")}/${y.padEnd(4, "a")}`;
      }

      if (mode === "time") {
        const h = segments.hour || "hh";
        const m = segments.minute || "mm";
        const s = segments.second || "ss";
        const timeStr = showSeconds ? `${h.padStart(2, "h")}:${m.padStart(2, "m")}:${s.padStart(2, "s")}` : `${h.padStart(2, "h")}:${m.padStart(2, "m")}`;
        return timeStr;
      }

      // datetime mode
      const d = segments.day || "dd";
      const mo = segments.month || "mm";
      const y = segments.year || "aaaa";
      const h = segments.hour || "hh";
      const mi = segments.minute || "mm";
      const s = segments.second || "ss";

      const dateStr = `${d.padStart(2, "d")}/${mo.padStart(2, "m")}/${y.padEnd(4, "a")}`;
      const timeStr = showSeconds ? `${h.padStart(2, "h")}:${mi.padStart(2, "m")}:${s.padStart(2, "s")}` : `${h.padStart(2, "h")}:${mi.padStart(2, "m")}`;

      return `${dateStr} ${timeStr}`;
    };

    // Validate segment value
    const validateSegment = (segment: Segment, value: string): string => {
      const num = parseInt(value, 10);

      switch (segment) {
        case "day":
          if (isNaN(num) || num < 1) return "";
          if (num > 31) return "31";
          return num.toString();

        case "month":
          if (isNaN(num) || num < 1) return "";
          if (num > 12) return "12";
          return num.toString();

        case "year":
          if (isNaN(num)) return "";
          if (value.length === 4) {
            if (num < 1900) return "1900";
            if (num > 2100) return "2100";
          }
          return num.toString();

        case "hour":
          if (isNaN(num) || num < 0) return "";
          if (format24Hours && num > 23) return "23";
          if (!format24Hours && num > 12) return "12";
          return num.toString();

        case "minute":
        case "second":
          if (isNaN(num) || num < 0) return "";
          if (num > 59) return "59";
          return num.toString();

        default:
          return value;
      }
    };

    // Get max length for segment
    const getSegmentMaxLength = (segment: Segment): number => {
      if (segment === "year") return 4;
      return 2;
    };

    // Handle keyboard navigation
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      const currentIndex = segmentOrder.indexOf(currentSegment);

      // Tab navigation
      if (e.key === "Tab") {
        e.preventDefault();
        if (e.shiftKey) {
          // Move to previous segment
          if (currentIndex > 0) {
            const prevSegment = segmentOrder[currentIndex - 1];
            setCurrentSegment(prevSegment);
            selectSegment(prevSegment);
          }
        } else {
          // Move to next segment
          if (currentIndex < segmentOrder.length - 1) {
            const nextSegment = segmentOrder[currentIndex + 1];
            setCurrentSegment(nextSegment);
            selectSegment(nextSegment);
          }
        }
        return;
      }

      // Arrow key navigation
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

      // Arrow up/down to increment/decrement
      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        const currentValue = segments[currentSegment];
        const num = parseInt(currentValue, 10) || 0;
        const delta = e.key === "ArrowUp" ? 1 : -1;
        const newValue = validateSegment(currentSegment, (num + delta).toString());

        if (newValue) {
          setSegments((prev) => ({
            ...prev,
            [currentSegment]: newValue.padStart(currentSegment === "year" ? 4 : 2, "0"),
          }));
          updateDate();
        }
        return;
      }

      // Number input
      if (e.key >= "0" && e.key <= "9") {
        e.preventDefault();
        const currentValue = segments[currentSegment];
        const maxLength = getSegmentMaxLength(currentSegment);

        // If segment is already at max length, replace it
        let newValue: string;
        if (currentValue.length >= maxLength) {
          newValue = e.key;
        } else {
          newValue = currentValue + e.key;
        }

        // Validate the new value
        const validated = validateSegment(currentSegment, newValue);
        if (validated) {
          const shouldAutoAdvance = (currentSegment !== "year" && validated.length === 2) || (currentSegment === "year" && validated.length === 4);

          // Special case: auto-pad single digit day/month if value > threshold
          if ((currentSegment === "day" || currentSegment === "month") && validated.length === 1) {
            const num = parseInt(validated, 10);
            if ((currentSegment === "day" && num > 3) || (currentSegment === "month" && num > 1)) {
              setSegments((prev) => ({
                ...prev,
                [currentSegment]: validated.padStart(2, "0"),
              }));
              // Auto-advance
              if (currentIndex < segmentOrder.length - 1) {
                setTimeout(() => {
                  const nextSegment = segmentOrder[currentIndex + 1];
                  setCurrentSegment(nextSegment);
                  selectSegment(nextSegment);
                }, 50);
              }
            } else {
              setSegments((prev) => ({
                ...prev,
                [currentSegment]: validated,
              }));
            }
          } else {
            setSegments((prev) => ({
              ...prev,
              [currentSegment]: validated,
            }));

            // Auto-advance if complete
            if (shouldAutoAdvance && currentIndex < segmentOrder.length - 1) {
              setTimeout(() => {
                const nextSegment = segmentOrder[currentIndex + 1];
                setCurrentSegment(nextSegment);
                selectSegment(nextSegment);
              }, 50);
            }
          }

          updateDate();
        }
        return;
      }

      // Backspace/Delete
      if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        setSegments((prev) => ({
          ...prev,
          [currentSegment]: "",
        }));
        updateDate();
        return;
      }

      // Prevent other keys
      e.preventDefault();
    };

    // Select a segment in the input
    const selectSegment = (segment: Segment) => {
      if (!inputRef.current) return;

      const [start, end] = getSegmentPosition(segment);
      if (start >= 0 && end >= 0) {
        setTimeout(() => {
          inputRef.current?.setSelectionRange(start, end);
        }, 10);
      }
    };

    // Handle click to select segment
    const handleClick = (e: React.MouseEvent<HTMLInputElement>) => {
      const input = e.currentTarget;
      const clickPos = input.selectionStart || 0;

      // Determine which segment was clicked based on position
      let targetSegment = segmentOrder[0];
      for (const segment of segmentOrder) {
        const [start, end] = getSegmentPosition(segment);
        if (clickPos >= start && clickPos <= end) {
          targetSegment = segment;
          break;
        }
      }

      setCurrentSegment(targetSegment);
      selectSegment(targetSegment);
    };

    // Update the Date value when segments change
    const updateDate = React.useCallback(() => {
      const d = parseInt(segments.day, 10);
      const m = parseInt(segments.month, 10);
      const y = parseInt(segments.year, 10);
      const h = parseInt(segments.hour, 10);
      const mi = parseInt(segments.minute, 10);
      const s = parseInt(segments.second, 10);

      // Check if we have enough data to create a date
      const hasDate = mode !== "time" && !isNaN(d) && !isNaN(m) && !isNaN(y) && y >= 1900;
      const hasTime = mode !== "date" && !isNaN(h) && !isNaN(mi);

      if ((mode === "date" && hasDate) || (mode === "time" && hasTime) || (mode === "datetime" && hasDate && hasTime)) {
        const date = new Date();

        if (hasDate) {
          date.setFullYear(y, m - 1, d);
        }
        if (hasTime) {
          date.setHours(h, mi, showSeconds && !isNaN(s) ? s : 0, 0);
        }

        if (onChange) {
          onChange(date);
        }
      }
    }, [segments, mode, showSeconds, onChange]);

    // Handle focus
    const handleFocus = () => {
      setIsFocused(true);
      // Select first segment
      const firstSegment = segmentOrder[0];
      setCurrentSegment(firstSegment);
      selectSegment(firstSegment);
    };

    // Handle blur
    const handleBlur = () => {
      setIsFocused(false);

      // Auto-complete year if only 2 digits
      if (segments.year.length === 2) {
        const shortYear = parseInt(segments.year, 10);
        const fullYear = shortYear < 50 ? 2000 + shortYear : 1900 + shortYear;
        setSegments((prev) => ({
          ...prev,
          year: fullYear.toString(),
        }));
      }

      // Pad all segments with leading zeros on blur
      setSegments((prev) => ({
        ...prev,
        day: prev.day ? prev.day.padStart(2, "0") : prev.day,
        month: prev.month ? prev.month.padStart(2, "0") : prev.month,
        hour: prev.hour ? prev.hour.padStart(2, "0") : prev.hour,
        minute: prev.minute ? prev.minute.padStart(2, "0") : prev.minute,
        second: prev.second ? prev.second.padStart(2, "0") : prev.second,
      }));

      updateDate();
    };

    // Prevent default onChange since we handle everything via keyboard
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      e.preventDefault();
    };

    return (
      <input
        ref={combinedRef}
        type="text"
        className={cn(
          "flex h-10 w-full rounded-lg border border-border px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus:outline-none disabled:cursor-not-allowed disabled:opacity-[var(--disabled-opacity)] transition-all duration-200 ease-in-out",
          transparent ? "bg-transparent" : "bg-input",
          "font-mono tracking-wider", // Monospace for better alignment
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
        {...props}
      />
    );
  },
);

NaturalDateTimeInput.displayName = "NaturalDateTimeInput";

export { NaturalDateTimeInput };
