import { FormField } from "@/components/ui/form";
import { DateTimeInput } from "@/components/ui/date-time-input";
import type { ServiceOrderCreateFormData, ServiceOrderUpdateFormData } from "../../../../schemas";

interface StartedAtPickerProps {
  control: any;
  disabled?: boolean;
}

export function StartedAtPicker({ control, disabled }: StartedAtPickerProps) {
  return (
    <FormField
      control={control}
      name="startedAt"
      render={({ field }) => (
        <DateTimeInput
          field={field}
          mode="datetime"
          context="start"
          label="Data de Início"
          disabled={disabled}
          constraints={{
            maxDate: new Date(), // Cannot start in the future
            minDate: new Date("1900-01-01"), // Minimum date constraint
          }}
          showClearButton={true}
          allowManualInput={true}
        />
      )}
    />
  );
}
