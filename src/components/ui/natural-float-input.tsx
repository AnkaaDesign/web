import React, { useState, useCallback, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface NaturalFloatInputProps {
  value: number | undefined;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  onBlur?: () => void;
  onFocus?: () => void;
}

export const NaturalFloatInput = React.forwardRef<HTMLInputElement, NaturalFloatInputProps>(
  ({ value: valueProp, onChange, min = 0.01, max = 999999, step = 0.01, placeholder, disabled, className, onBlur, onFocus }, ref) => {
    // Ensure value is always a valid number
    const value = typeof valueProp === 'number' && !isNaN(valueProp) ? valueProp : min;
    const [displayValue, setDisplayValue] = useState("");
    const [isFocused, setIsFocused] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    // Update display value when external value changes
    useEffect(() => {
      if (!isFocused) {
        setDisplayValue(value.toString().replace(".", ","));
      }
    }, [value, isFocused]);

    // Initialize display value
    useEffect(() => {
      setDisplayValue(value.toString().replace(".", ","));
    }, []); // Only run on mount

    const handleChange = useCallback(
      (value: string | number | null) => {
        // The Input component passes the value directly, not an event object
        let inputValue = String(value || '');

        // Replace dots with commas for natural typing
        inputValue = inputValue.replace(/\./g, ",");

        setDisplayValue(inputValue);

        // Convert to number for validation and callback
        const normalizedValue = inputValue.replace(",", ".");
        const numericValue = parseFloat(normalizedValue);

        if (inputValue === "" || inputValue === ",") {
          // Allow empty or just comma temporarily
          return;
        }

        if (!isNaN(numericValue)) {
          // Apply constraints
          let constrainedValue = numericValue;
          if (min !== undefined && constrainedValue < min) {
            constrainedValue = min;
          }
          if (max !== undefined && constrainedValue > max) {
            constrainedValue = max;
          }

          onChange(constrainedValue);
        }
      },
      [onChange, min, max],
    );

    const handleFocus = useCallback(() => {
      setIsFocused(true);
      onFocus?.();
    }, [onFocus]);

    const handleBlur = useCallback(() => {
      setIsFocused(false);

      // Clean up display value on blur
      const normalizedValue = displayValue.replace(",", ".");
      const numericValue = parseFloat(normalizedValue);

      if (isNaN(numericValue) || displayValue === "" || displayValue === ",") {
        // Reset to minimum value if invalid
        setDisplayValue(min.toString().replace(".", ","));
        onChange(min);
      } else {
        // Apply constraints and update display
        let constrainedValue = numericValue;
        if (min !== undefined && constrainedValue < min) {
          constrainedValue = min;
        }
        if (max !== undefined && constrainedValue > max) {
          constrainedValue = max;
        }

        setDisplayValue(constrainedValue.toString().replace(".", ","));
        onChange(constrainedValue);
      }

      onBlur?.();
    }, [displayValue, onChange, min, max, onBlur]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
      // Allow: backspace, delete, tab, escape, enter
      if ([8, 9, 27, 13, 46].indexOf(e.keyCode) !== -1 ||
        // Allow: Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X, Ctrl+Z
        (e.keyCode === 65 && e.ctrlKey === true) ||
        (e.keyCode === 67 && e.ctrlKey === true) ||
        (e.keyCode === 86 && e.ctrlKey === true) ||
        (e.keyCode === 88 && e.ctrlKey === true) ||
        (e.keyCode === 90 && e.ctrlKey === true) ||
        // Allow: home, end, left, right
        (e.keyCode >= 35 && e.keyCode <= 39)) {
        return;
      }

      // Allow: numbers, period, comma
      if ((e.shiftKey || (e.keyCode < 48 || e.keyCode > 57)) &&
          (e.keyCode < 96 || e.keyCode > 105) &&
          e.keyCode !== 190 && // period
          e.keyCode !== 188) { // comma
        e.preventDefault();
      }

      // Only allow one decimal separator
      if ((e.keyCode === 190 || e.keyCode === 188) && displayValue.includes(",")) {
        e.preventDefault();
      }
    }, [displayValue]);

    return (
      <Input
        ref={ref || inputRef}
        type="text"
        inputMode="decimal"
        value={displayValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className={cn("w-full", className)}
      />
    );
  },
);

NaturalFloatInput.displayName = "NaturalFloatInput";