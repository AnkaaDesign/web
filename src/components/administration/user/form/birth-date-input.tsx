import { useFormContext } from "react-hook-form";
import { IconCake } from "@tabler/icons-react";
import { FormField } from "@/components/ui/form";
import { DateTimeInput } from "@/components/ui/date-time-input";
import type { UserCreateFormData, UserUpdateFormData } from "../../../../schemas";

interface BirthDateInputProps {
  disabled?: boolean;
}

export function BirthDateInput({ disabled }: BirthDateInputProps) {
  const form = useFormContext<UserCreateFormData | UserUpdateFormData>();

  return (
    <FormField
      control={form.control}
      name="birth"
      render={({ field }) => (
        <DateTimeInput
          field={field}
          label={
            <span className="flex items-center gap-1.5">
              <IconCake className="h-4 w-4" />
              Data de Nascimento
              <span className="text-destructive ml-0.5">*</span>
            </span>
          }
          context="birth"
          disabled={disabled}
          mode="date"
          required
        />
      )}
    />
  );
}
