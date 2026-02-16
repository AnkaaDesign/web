import { useCallback } from "react";
import { Controller } from "react-hook-form";
import { DateTimeInput } from "../../../ui/date-time-input";
import { Button } from "../../../ui/button";
import { cn } from "@/lib/utils";
import { IconChevronLeft as ChevronLeft, IconChevronRight as ChevronRight } from "@tabler/icons-react";
import type { TimeCellProps, NavigationDirection } from "./cell-types";

export function TimeCell({ entryId, entryIndex, fieldName, label: _label, control, stateManager, onTimeChange, onNavigate, originalValue, disabled = false, className }: TimeCellProps) {
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
        render={({ field }) => {
          const timeValue = typeof field.value === "string" && field.value ? (() => {
            const [hours, minutes] = field.value.split(":").map(Number);
            if (!isNaN(hours) && !isNaN(minutes)) {
              const date = new Date();
              date.setHours(hours, minutes, 0, 0);
              return date;
            }
            return null;
          })() : null;

          return (
            <DateTimeInput
              value={timeValue}
              onChange={(value) => {
                const timeString = value instanceof Date
                  ? `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`
                  : null;
                field.onChange(timeString);
                handleTimeChange(timeString);
              }}
              placeholder="--:--"
              className={cn(
                "w-16 h-8 text-center text-sm border-0 bg-transparent focus:bg-white focus:border focus:border-blue-300",
                isModified && "font-medium text-blue-700",
                disabled && "opacity-50 cursor-not-allowed",
              )}
              disabled={disabled}
              mode="time"
            />
          );
        }}
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
