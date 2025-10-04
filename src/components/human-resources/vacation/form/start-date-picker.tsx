import type { VacationCreateFormData, VacationUpdateFormData } from "../../../../schemas";
import { addDays } from "date-fns";

import { FormField } from "@/components/ui/form";
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
        <DateTimeInput
          field={field}
          label="Data de Início"
          mode="date"
          context="vacation"
          disabled={disabled}
          required={required}
          constraints={{
            minDate: new Date(), // Can't select past dates
            maxDate: endDate ? addDays(endDate, -1) : undefined,
          }}
          description={endDate ? "A data de início deve ser anterior à data de término" : "Selecione a data de início das férias"}
        />
      )}
    />
  );
}
