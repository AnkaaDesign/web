import { IconCalendar } from "@tabler/icons-react";
import { addDays } from "date-fns";

import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "@/components/ui/form";
import { DateTimeInput } from "@/components/ui/date-time-input";

interface StartDatePickerProps {
  control: any;
  disabled?: boolean;
  required?: boolean;
  endDate?: Date;
}

export function StartDatePicker({ control, disabled, required, endDate }: StartDatePickerProps) {
  return (
    <FormField
      control={control}
      name="startAt"
      render={({ field }) => (
        <FormItem>
          <FormLabel>
            <div className="flex items-center gap-2">
              <IconCalendar className="h-4 w-4" />
              Data de Início {required && <span className="text-destructive">*</span>}
            </div>
          </FormLabel>
          <FormControl>
            <DateTimeInput
              field={field}
              hideLabel={true}
              mode="date"
              context="start"
              disabled={disabled}
              constraints={{
                minDate: new Date(), // Can't select past dates
                maxDate: endDate ? addDays(endDate, -1) : undefined,
              }}
            />
          </FormControl>
          <FormDescription>
            {endDate ? "A data de início deve ser anterior à data de término" : "Selecione a data de início das férias"}
          </FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
