import React, { useState, useEffect, forwardRef } from "react";
import { Input } from "./input";
import { cn } from "@/lib/utils";

interface SizeInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value" | "type"> {
  value?: number | string | null;
  onChange?: (value: number | undefined) => void;
  suffix?: string;
  decimalPlaces?: number;
}

export const SizeInput = forwardRef<HTMLInputElement, SizeInputProps>(({ value, onChange, suffix = "m", decimalPlaces = 2, className, disabled, ...props }, ref) => {
  const [displayValue, setDisplayValue] = useState("");
  const [isFocused, setIsFocused] = useState(false);

  // Format number for display
  const formatValue = (val: number | string | null | undefined): string => {
    if (val === null || val === undefined || val === "") return "";

    const numValue = typeof val === "string" ? parseFloat(val) : val;
    if (isNaN(numValue)) return "";

    // Always format with comma for Brazilian locale
    return numValue.toFixed(decimalPlaces).replace(".", ",");
  };

  // Parse display value to number
  const parseValue = (val: string): number | undefined => {
    if (!val || val === "") return undefined;

    // Replace comma with dot for parsing
    const normalized = val.replace(",", ".");
    const parsed = parseFloat(normalized);

    return isNaN(parsed) ? undefined : parsed;
  };

  // Update display value when prop value changes
  useEffect(() => {
    if (!isFocused) {
      setDisplayValue(formatValue(value));
    }
  }, [value, isFocused]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;

    // Allow only numbers, comma, and dot
    if (!/^[0-9.,]*$/.test(inputValue)) return;

    // Check for multiple commas or dots
    const commaCount = (inputValue.match(/,/g) || []).length;
    const dotCount = (inputValue.match(/\./g) || []).length;
    if (commaCount + dotCount > 1) return;

    // Limit decimal places
    const parts = inputValue.split(/[,.]/);
    if (parts[1] && parts[1].length > decimalPlaces) return;

    setDisplayValue(inputValue);

    // Parse and call onChange with number value
    const numValue = parseValue(inputValue);
    onChange?.(numValue);
  };

  const handleFocus = () => {
    setIsFocused(true);
    // Keep the current display value as-is when focusing
    // Don't convert to raw number to preserve user's input format
  };

  const handleBlur = () => {
    setIsFocused(false);

    // Auto-format: if user types whole numbers like 841, convert to 8.41
    let numValue = parseValue(displayValue);

    if (numValue !== undefined && !displayValue.includes(",") && !displayValue.includes(".") && numValue >= 100) {
      numValue = numValue / 100;
      onChange?.(numValue);
    }

    setDisplayValue(formatValue(numValue));
  };

  return (
    <div className="relative">
      <Input
        ref={ref}
        type="text"
        inputMode="decimal"
        value={displayValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className={cn("pr-10", className)}
        disabled={disabled}
        {...props}
      />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">{suffix}</span>
    </div>
  );
});

SizeInput.displayName = "SizeInput";
