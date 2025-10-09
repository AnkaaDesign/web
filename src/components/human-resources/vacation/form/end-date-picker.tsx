import { IconCalendar } from "@tabler/icons-react";
import { addDays } from "date-fns";
import type { VacationCreateFormData, VacationUpdateFormData } from "../../../../schemas";

import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "@/components/ui/form";
import { DateTimeInput } from "@/components/ui/date-time-input";

interface EndDatePickerProps {
  control: any;
  disabled?: boolean;
  required?: boolean;
  startDate?: Date;
}

export function EndDatePicker({ control, disabled, required, startDate }: EndDatePickerProps) {
  return (
    <FormField
      control={control}
      name="endAt"
      render={({ field, fieldState }) => {
        const hasError = fieldState.error;
        const minDate = startDate ? addDays(startDate, 1) : addDays(new Date(), 1);

        return (
          <FormItem>
            <FormLabel>
              <div className="flex items-center gap-2">
                <IconCalendar className="h-4 w-4" />
                Data de Término {required && <span className="text-destructive">*</span>}
              </div>
            </FormLabel>
            <FormControl>
              <DateTimeInput
                field={field}
                hideLabel={true}
                mode="date"
                context="vacation"
                disabled={disabled}
                constraints={{
                  minDate,
                  onlyBusinessDays: true,
                  onlyFuture: true,
                }}
              />
            </FormControl>
            <FormDescription>
              {startDate ? "A data de término deve ser posterior à data de início" : "Selecione a data de término das férias"}
            </FormDescription>
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}
