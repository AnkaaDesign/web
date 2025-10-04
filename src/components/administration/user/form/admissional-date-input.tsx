import { useFormContext } from "react-hook-form";
import { IconBriefcase } from "@tabler/icons-react";
import { FormField } from "@/components/ui/form";
import { DateTimeInput } from "@/components/ui/date-time-input";
import type { UserCreateFormData, UserUpdateFormData } from "../../../../schemas";

interface AdmissionalDateInputProps {
  disabled?: boolean;
}

export function AdmissionalDateInput({ disabled }: AdmissionalDateInputProps) {
  const form = useFormContext<UserCreateFormData | UserUpdateFormData>();

  return (
    <FormField
      control={form.control}
      name="admissional"
      render={({ field }) => (
        <DateTimeInput
          field={field}
          label={
            <span className="flex items-center gap-1.5">
              <IconBriefcase className="h-4 w-4" />
              Data de Admissão
            </span>
          }
          context="hire"
          disabled={disabled}
          mode="date"
        />
      )}
    />
  );
}
