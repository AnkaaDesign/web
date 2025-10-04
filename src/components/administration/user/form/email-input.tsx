import { FormEmailInput } from "@/components/ui/form-email-input";
import { useFormContext } from "react-hook-form";
import type { UserCreateFormData, UserUpdateFormData } from "../../../../schemas";

interface EmailInputProps {
  disabled?: boolean;
}

export function EmailInput({ disabled }: EmailInputProps) {
  const form = useFormContext<UserCreateFormData | UserUpdateFormData>();
  const phoneValue = form.watch("phone");

  // Show as required if phone is not provided
  const isRequired = !phoneValue;

  return (
    <FormEmailInput
      name="email"
      label="E-mail"
      placeholder="Digite o e-mail do colaborador"
      disabled={disabled}
      required={isRequired}
    />
  );
}