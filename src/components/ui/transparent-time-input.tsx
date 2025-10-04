import * as React from "react";
import { cn } from "@/lib/utils";

export interface TransparentTimeInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  value?: string | null;
  onChange?: (value: string | null) => void;
}

const TransparentTimeInput = React.forwardRef<HTMLInputElement, TransparentTimeInputProps>(({ className, value, onChange, onBlur, onFocus, ...props }, ref) => {
  const [internalValue, setInternalValue] = React.useState(value || "");
  const [isFocused, setIsFocused] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const cursorPositionRef = React.useRef<number | null>(null);

  // Merge refs
  React.useImperativeHandle(ref, () => inputRef.current!);

  React.useEffect(() => {
    if (!isFocused) {
      setInternalValue(value || "");
    }
  }, [value, isFocused]);

  // Restore cursor position after state update
  React.useEffect(() => {
    if (cursorPositionRef.current !== null && inputRef.current) {
      inputRef.current.setSelectionRange(cursorPositionRef.current, cursorPositionRef.current);
      cursorPositionRef.current = null;
    }
  }, [internalValue]);

  const formatTimeValue = (input: string, cursorPos: number): { formatted: string; newCursorPos: number } => {
    // Remove all non-numeric characters
    const numbers = input.replace(/\D/g, "");

    // Calculate how many digits are before cursor
    let digitsBeforeCursor = 0;
    for (let i = 0; i < cursorPos; i++) {
      if (input[i] >= "0" && input[i] <= "9") {
        digitsBeforeCursor++;
      }
    }

    // Format as HH:MM
    let formatted = "";
    let newCursorPos = cursorPos;

    if (numbers.length === 0) {
      return { formatted: "", newCursorPos: 0 };
    }

    if (numbers.length <= 2) {
      formatted = numbers;
      newCursorPos = digitsBeforeCursor;
    } else {
      const hours = numbers.slice(0, 2);
      const minutes = numbers.slice(2, 4);
      formatted = `${hours}:${minutes}`;

      // Adjust cursor position based on where digits were
      if (digitsBeforeCursor <= 2) {
        newCursorPos = digitsBeforeCursor;
      } else {
        // Add 1 for the colon
        newCursorPos = digitsBeforeCursor + 1;
      }
    }

    return { formatted, newCursorPos };
  };

  const validateAndCorrectTime = (timeStr: string): string | null => {
    if (!timeStr || timeStr === "") return null;

    const parts = timeStr.split(":");
    if (parts.length !== 2) return null;

    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);

    if (isNaN(hours) || isNaN(minutes)) return null;

    // Validate hours (0-23) and minutes (0-59)
    const validHours = Math.min(Math.max(hours, 0), 23);
    const validMinutes = Math.min(Math.max(minutes, 0), 59);

    // Format with leading zeros
    const formattedHours = String(validHours).padStart(2, "0");
    const formattedMinutes = String(validMinutes).padStart(2, "0");

    return `${formattedHours}:${formattedMinutes}`;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cursorPos = e.target.selectionStart || 0;
    const { formatted, newCursorPos } = formatTimeValue(e.target.value, cursorPos);

    setInternalValue(formatted);
    cursorPositionRef.current = newCursorPos;

    // Only send valid times to parent
    if (formatted.length === 5) {
      const validated = validateAndCorrectTime(formatted);
      if (validated && onChange) {
        onChange(validated);
      }
    } else if (formatted === "" && onChange) {
      onChange(null);
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(false);

    // Validate and correct on blur
    if (internalValue) {
      const validated = validateAndCorrectTime(internalValue);
      if (validated) {
        setInternalValue(validated);
        if (onChange) {
          onChange(validated);
        }
      } else {
        // Clear invalid input
        setInternalValue("");
        if (onChange) {
          onChange(null);
        }
      }
    }

    if (onBlur) {
      onBlur(e);
    }
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    if (onFocus) {
      onFocus(e);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Allow navigation keys
    const allowedKeys = ["Backspace", "Delete", "Tab", "Escape", "Enter", "ArrowLeft", "ArrowRight", "Home", "End"];

    // Allow numbers
    if (e.key >= "0" && e.key <= "9") {
      return;
    }

    // Allow allowed keys
    if (allowedKeys.includes(e.key)) {
      return;
    }

    // Allow Ctrl/Cmd combinations
    if (e.ctrlKey || e.metaKey) {
      return;
    }

    // Prevent all other keys
    e.preventDefault();
  };

  return (
    <input
      type="text"
      ref={inputRef}
      className={cn(
        "flex h-10 w-full rounded-md border-0 bg-transparent px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground placeholder:text-xs focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      value={internalValue}
      onChange={handleChange}
      onBlur={handleBlur}
      onFocus={handleFocus}
      onKeyDown={handleKeyDown}
      placeholder={isFocused && !internalValue ? "HH:MM" : ""}
      {...props}
    />
  );
});

TransparentTimeInput.displayName = "TransparentTimeInput";

export { TransparentTimeInput };
