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

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormControl>
            <DateTimeInput
              value={field.value}
              onChange={handleChange(field)}
              placeholder={placeholder}
              mode="datetime"
            />
          </FormControl>
        </FormItem>
      )}
    />
  );
}
