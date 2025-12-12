import React, { forwardRef } from "react";
import { Input } from "./input";
import { IconSearch, IconX } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

interface TableSearchInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange"> {
  /** Current search value */
  value: string;
  /** Callback when search value changes */
  onChange: (value: string) => void;
  /** Show clear button when there's text */
  showClear?: boolean;
  /** Custom icon */
  icon?: React.ReactNode;
  /** Loading state */
  isLoading?: boolean;
  /** Debounce indicator */
  isPending?: boolean;
  /** Content to display on the right side of the input */
  suffix?: React.ReactNode;
}

/**
 * Reusable search input component for table filtering
 * Handles search icon, clear button, and loading states
 */
export const TableSearchInput = forwardRef<HTMLInputElement, TableSearchInputProps>(
  ({ value, onChange, showClear = true, icon, isLoading = false, isPending = false, placeholder = "Buscar...", className, disabled, suffix, ...props }, ref) => {
    const handleClear = () => {
      onChange("");
      // Focus the input after clearing
      if (ref && typeof ref === "object" && ref.current) {
        ref.current.focus();
      }
    };

    const searchIcon = icon || <IconSearch className="h-4 w-4" />;

    return (
      <div className="relative flex-1">
        {/* Search icon or loading indicator */}
        <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">
          {isLoading ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : searchIcon}
        </div>

        {/* Search input */}
        <Input
          {...props}
          ref={ref}
          type="text"
          value={value}
          onChange={(newValue) => {
            console.log("[TableSearchInput] onChange value:", newValue);
            // The Input component already gives us the cleaned value
            onChange(typeof newValue === "string" ? newValue : "");
          }}
          placeholder={placeholder}
          disabled={disabled}
          transparent={true}
          className={cn(
            "pl-9",
            suffix ? "pr-32" : "pr-9",
            isPending && "ring-1 ring-primary/20",
            className
          )}
        />

        {/* Suffix content */}
        {suffix && (
          <div className="absolute right-9 top-1/2 transform -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
            {suffix}
          </div>
        )}

        {/* Clear button or pending indicator */}
        {showClear && value && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Limpar busca"
          >
            {isPending ? <div className="h-4 w-4 animate-pulse rounded-full bg-primary/20" /> : <IconX className="h-4 w-4" />}
          </button>
        )}
      </div>
    );
  },
);

TableSearchInput.displayName = "TableSearchInput";
