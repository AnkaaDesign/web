import { useFormContext } from "react-hook-form";
import { IconUserX } from "@tabler/icons-react";
import { FormField } from "@/components/ui/form";
import { DateTimeInput } from "@/components/ui/date-time-input";
import type { UserCreateFormData, UserUpdateFormData } from "../../../../schemas";

interface DismissalDateInputProps {
  disabled?: boolean;
}

export function DismissalDateInput({ disabled }: DismissalDateInputProps) {
  const form = useFormContext<UserCreateFormData | UserUpdateFormData>();

  return (
    <FormField
      control={form.control}
      name="dismissedAt"
      render={({ field }) => (
        <DateTimeInput
          field={field}
          label={
            <span className="flex items-center gap-1.5">
              <IconUserX className="h-4 w-4" />
              Data de Demissão
            </span>
          }
          context="termination"
          disabled={disabled}
          required={false}
          mode="date"
        />
      )}
    />
  );
}
