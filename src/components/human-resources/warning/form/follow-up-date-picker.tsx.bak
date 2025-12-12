import type { WarningCreateFormData, WarningUpdateFormData } from "../../../../schemas";

import { FormField } from "@/components/ui/form";
import { DateTimeInput } from "@/components/ui/date-time-input";

interface FollowUpDatePickerProps {
  control: any;
  disabled?: boolean;
  required?: boolean;
}

export function FollowUpDatePicker({ control, disabled, required }: FollowUpDatePickerProps) {
  return (
    <FormField
      control={control}
      name="followUpDate"
      render={({ field }) => (
        <DateTimeInput
          field={field}
          label="Data de Acompanhamento"
          mode="date"
          context="followUp"
          disabled={disabled}
          required={required}
          description="Data para revisão ou acompanhamento da advertência"
        />
      )}
    />
  );
}
