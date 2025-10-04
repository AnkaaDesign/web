import { useCallback } from "react";
import { Checkbox } from "../../../ui/checkbox";
import { cn } from "@/lib/utils";
import type { CheckboxCellProps } from "./cell-types";

export function CheckboxCell({ entryId, entryIndex, fieldName, label, control, stateManager, onValueChange, originalValue, disabled = false, className }: CheckboxCellProps) {
  const isModified = stateManager.actions.isFieldModified(entryId, String(fieldName));

  const handleValueChange = useCallback(
    (value: boolean) => {
      onValueChange(entryId, String(fieldName), value, originalValue);
    },
    [onValueChange, entryId, String(fieldName), originalValue],
  );

  return (
    <div className={cn("relative flex items-center justify-center p-2 rounded transition-colors", isModified && "bg-blue-50 border border-blue-200", className)}>
      <Controller
        name={`entries.${entryIndex}.${String(fieldName)}` as any}
        control={control}
        render={({ field }) => (
          <Checkbox
            checked={field.value === true}
            onCheckedChange={(checked) => {
              const value = checked === true;
              field.onChange(value);
              handleValueChange(value);
            }}
            disabled={disabled}
            className={cn(isModified && "border-blue-500 data-[state=checked]:bg-blue-600", disabled && "opacity-50 cursor-not-allowed")}
            aria-label={`${label} para entrada ${entryIndex + 1}`}
          />
        )}
      />

      {/* Modified indicator */}
      {isModified && <div className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full" />}
    </div>
  );
}
