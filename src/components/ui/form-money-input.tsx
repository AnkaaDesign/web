import { FormInput } from "@/components/ui/form-input";

interface FormMoneyInputProps {
  name: string;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}

export function FormMoneyInput({
  name,
  label = "Valor",
  placeholder = "R$ 0,00",
  disabled = false,
  required = false,
  className,
}: FormMoneyInputProps) {
  return (
    <FormInput
      name={name}
      type="currency"
      label={label}
      placeholder={placeholder}
      disabled={disabled}
      required={required}
      className={className}
    />
  );
}