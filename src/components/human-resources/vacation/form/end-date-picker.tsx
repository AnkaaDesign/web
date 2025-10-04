import { addDays } from "date-fns";
import type { VacationCreateFormData, VacationUpdateFormData } from "../../../../schemas";

import { FormField } from "@/components/ui/form";
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
          <DateTimeInput
            field={field}
            label="Data de Término"
            mode="date"
            context="vacation"
            disabled={disabled}
            required={required}
            constraints={{
              minDate,
              onlyBusinessDays: true,
              onlyFuture: true,
            }}
            description={hasError ? fieldState.error?.message : startDate ? "A data de término deve ser posterior à data de início" : "Selecione a data de término das férias"}
          />
        );
      }}
    />
  );
}
