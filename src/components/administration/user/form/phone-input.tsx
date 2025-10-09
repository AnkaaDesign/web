import { useFormContext } from "react-hook-form";
import { PhoneInput as StandardizedPhoneInput } from "@/components/ui/phone-input";
import type { UserCreateFormData, UserUpdateFormData } from "../../../../schemas";

interface PhoneInputProps {
  disabled?: boolean;
}

export function PhoneInput({ disabled }: PhoneInputProps) {
  const form = useFormContext<UserCreateFormData | UserUpdateFormData>();

  // Note: Either phone OR email is required, but we don't show asterisk
  // because the validation is handled at the form level via refinement
  return (
    <StandardizedPhoneInput
      control={form.control}
      name="phone"
      label="Telefone"
      placeholder="Digite o telefone do colaborador"
      disabled={disabled}
      multiple={false}
    />
  );
}