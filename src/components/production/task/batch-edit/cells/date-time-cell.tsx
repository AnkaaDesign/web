// apps/web/src/components/production/task/batch-edit/cells/date-time-cell.tsx

import { FormField, FormItem, FormControl } from "@/components/ui/form";
import { DateTimeInput } from "@/components/ui/date-time-input";

interface DateTimeCellProps {
  control: any;
  name: string;
  placeholder?: string;
  defaultTime?: string; // Format: "HH:mm" e.g., "07:30"
}

export function DateTimeCell({ control, name, placeholder, defaultTime = "07:30" }: DateTimeCellProps) {
  // Parse default time
  const [defaultHour, defaultMinute] = defaultTime.split(":").map(Number);

  // Custom onChange that applies default time when selecting a new date
  const handleChange = (field: any) => (value: Date | null) => {
    if (value && !field.value) {
      // If setting a new date and there wasn't one before, apply default time
      const newDate = new Date(value);
      newDate.setHours(defaultHour, defaultMinute, 0, 0);
      field.onChange(newDate);
    } else {
      field.onChange(value);
    }
  };

  // Handler wrapper for DateTimeInput that supports DateRange
  const handleDateChange = (field: any) => (value: Date | import("react-day-picker").DateRange | null) => {
    // DateTimeInput can send DateRange for date-range mode, but this cell only uses datetime mode
    // Only process Date values, ignore DateRange
    if (value instanceof Date) {
      handleChange(field)(value);
    } else if (value === null) {
      handleChange(field)(null);
    }
  };

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormControl>
            <DateTimeInput
              value={field.value ?? null}
              onChange={handleDateChange(field)}
              placeholder={placeholder}
              mode="datetime"
            />
          </FormControl>
        </FormItem>
      )}
    />
  );
}
