import { format } from "date-fns";

import { FormField } from "@/components/ui/form";
import { DateTimeInput } from "@/components/ui/date-time-input";

interface DateInputProps {
  control: any;
  disabled?: boolean;
  required?: boolean;
}

export function DateInput({ control, disabled, required }: DateInputProps) {
  return (
    <FormField
      control={control}
      name="Data"
      render={({ field }) => (
        <DateTimeInput
          field={{
            ...field,
            value: field.value
              ? (() => {
                  try {
                    const date = new Date(field.value);
                    return isNaN(date.getTime()) ? null : date;
                  } catch {
                    return null;
                  }
                })()
              : null,
            onChange: (date) => {
              if (date instanceof Date) {
                field.onChange(format(date, "yyyy-MM-dd"));
              } else {
                field.onChange("");
              }
            },
          }}
          mode="date"
          context="holiday"
          label="Data"
          disabled={disabled}
          required={required}
          constraints={{
            minDate: new Date(),
            maxDate: (() => {
              const maxDate = new Date();
              maxDate.setFullYear(maxDate.getFullYear() + 10);
              return maxDate;
            })(),
          }}
          showClearButton={true}
          allowManualInput={true}
        />
      )}
    />
  );
}
