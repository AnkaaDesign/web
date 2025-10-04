import { type Control } from "react-hook-form";
import { PhoneInput as StandardizedPhoneInput } from "@/components/ui/phone-input";

interface PhoneInputProps {
  control: Control<any>;
  disabled?: boolean;
}

export function PhoneInput({ control, disabled }: PhoneInputProps) {
  return (
    <StandardizedPhoneInput
      control={control}
      name="phones"
      label="Telefones"
      disabled={disabled}
      multiple={true}
      maxPhones={5}
    />
  );
}
