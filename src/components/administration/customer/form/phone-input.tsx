import type { Control, FieldValues, Path } from "react-hook-form";
import { PhoneInput as StandardizedPhoneInput } from "@/components/ui/phone-input";

interface PhoneInputProps<TFieldValues extends FieldValues = FieldValues> {
  control: Control<TFieldValues>;
  disabled?: boolean;
}

export function PhoneInput<TFieldValues extends FieldValues = FieldValues>({ control, disabled }: PhoneInputProps<TFieldValues>) {
  return (
    <StandardizedPhoneInput
      control={control}
      name={"phones" as Path<TFieldValues>}
      label="Telefones"
      disabled={disabled}
      multiple={true}
      maxPhones={5}
    />
  );
}