import { useCallback } from "react";
import { DateTimeInput } from "../../../ui/date-time-input";
import { Button } from "../../../ui/button";
import { cn } from "@/lib/utils";
import { IconChevronLeft as ChevronLeft, IconChevronRight as ChevronRight } from "@tabler/icons-react";
import type { TimeCellProps, NavigationDirection } from "./cell-types";

export function TimeCell({ entryId, entryIndex, fieldName, label, control, stateManager, onTimeChange, onNavigate, originalValue, disabled = false, className }: TimeCellProps) {
  const isModified = stateManager.actions.isFieldModified(entryId, fieldName);

  const handleNavigate = useCallback(
    (direction: NavigationDirection) => {
      if (onNavigate) {
        onNavigate(direction, entryId, fieldName);
      }
    },
    [onNavigate, entryId, fieldName],
  );

  const handleTimeChange = useCallback(
    (value: string | null) => {
      onTimeChange(entryId, fieldName, value, originalValue);
    },
    [onTimeChange, entryId, fieldName, originalValue],
  );

  return (
    <div className={cn("relative flex items-center gap-1 p-1 rounded transition-colors", isModified && "bg-blue-50 border border-blue-200", className)}>
      {/* Left navigation button */}
      <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0 opacity-60 hover:opacity-100" onClick={() => handleNavigate("left")} disabled={disabled} tabIndex={-1}>
        <ChevronLeft className="h-3 w-3" />
      </Button>

      {/* Time input */}
      <Controller
        name={`entries.${entryIndex}.${fieldName}`}
        control={control}
        render={({ field }) => (
          <DateTimeInput
            value={typeof field.value === "string" ? field.value : ""}
            onChange={(value) => {
              field.onChange(value);
              handleTimeChange(typeof value === "string" ? value : null);
            }}
            placeholder="--:--"
            className={cn(
              "w-16 h-8 text-center text-sm border-0 bg-transparent focus:bg-white focus:border focus:border-blue-300",
              isModified && "font-medium text-blue-700",
              disabled && "opacity-50 cursor-not-allowed",
            )}
            disabled={disabled}
            mode="time"
            allowManualInput={true}
          />
        )}
      />

      {/* Right navigation button */}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-6 w-6 p-0 opacity-60 hover:opacity-100"
        onClick={() => handleNavigate("right")}
        disabled={disabled}
        tabIndex={-1}
      >
        <ChevronRight className="h-3 w-3" />
      </Button>

      {/* Modified indicator */}
      {isModified && <div className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full" />}
    </div>
  );
}
