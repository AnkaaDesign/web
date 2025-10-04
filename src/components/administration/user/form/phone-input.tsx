import { useFormContext } from "react-hook-form";
import { PhoneInput as StandardizedPhoneInput } from "@/components/ui/phone-input";
import type { UserCreateFormData, UserUpdateFormData } from "../../../../schemas";

interface PhoneInputProps {
  disabled?: boolean;
}

export function PhoneInput({ disabled }: PhoneInputProps) {
  const form = useFormContext<UserCreateFormData | UserUpdateFormData>();
  const emailValue = form.watch("email");

  // Show as required if email is not provided
  const isRequired = !emailValue;

  return (
    <StandardizedPhoneInput
      control={form.control}
      name="phone"
      label={isRequired ? "Telefone *" : "Telefone"}
      placeholder="Digite o telefone do colaborador"
      disabled={disabled}
      multiple={false}
    />
  );
}