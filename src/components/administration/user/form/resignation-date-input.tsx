import { useFormContext } from "react-hook-form";
import { FormField } from "@/components/ui/form";
import { DateTimeInput } from "@/components/ui/date-time-input";
import type { UserCreateFormData, UserUpdateFormData } from "../../../../schemas";

interface ResignationDateInputProps {
  disabled?: boolean;
}

export function ResignationDateInput({ disabled }: ResignationDateInputProps) {
  const form = useFormContext<UserCreateFormData | UserUpdateFormData>();

  // Watch exp1StartAt (admission date) to set minimum date for termination
  const exp1StartAt = form.watch("exp1StartAt");

  return (
    <FormField
      control={form.control}
      name="dismissal"
      render={({ field }) => (
        <DateTimeInput
          field={field}
          label="Data de Demissão"
          context="termination"
          disabled={disabled}
          mode="date"
          constraints={{
            minDate: exp1StartAt || undefined,
            maxDate: new Date(),
          }}
        />
      )}
    />
  );
}
