import { FormField } from "@/components/ui/form";
import { DateTimeInput } from "@/components/ui/date-time-input";
import type { ServiceOrderCreateFormData, ServiceOrderUpdateFormData } from "../../../../schemas";

interface FinishedAtPickerProps {
  control: any;
  disabled?: boolean;
  startedAt?: Date | null;
}

export function FinishedAtPicker({ control, disabled, startedAt }: FinishedAtPickerProps) {
  return (
    <FormField
      control={control}
      name="finishedAt"
      render={({ field }) => (
        <DateTimeInput
          field={field}
          mode="datetime"
          context="end"
          label="Data de Conclusão"
          disabled={disabled}
          constraints={{
            maxDate: new Date(), // Cannot finish in the future
            minDate: startedAt || new Date("1900-01-01"), // Cannot finish before it started
            disabledDates: startedAt ? (date) => date < new Date(startedAt) : undefined,
          }}
          showClearButton={true}
          allowManualInput={true}
        />
      )}
    />
  );
}
