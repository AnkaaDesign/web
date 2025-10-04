import { useFormContext } from "react-hook-form";
import { FormField } from "@/components/ui/form";
import { DateTimeInput } from "@/components/ui/date-time-input";
import type { UserCreateFormData, UserUpdateFormData } from "../../../../schemas";

interface HireDateInputProps {
  disabled?: boolean;
}

export function HireDateInput({ disabled }: HireDateInputProps) {
  const form = useFormContext<UserCreateFormData | UserUpdateFormData>();

  return (
    <FormField
      control={form.control}
      name="hireDate"
      render={({ field }) => <DateTimeInput field={field} label="Data de Admissão" context="hire" disabled={disabled} required mode="date" />}
    />
  );
}
