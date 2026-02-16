import { Input } from "@/components/ui/input";

interface CPFInputProps {
  value?: string | null;
  onChange?: (value: string | null) => void;
  onBlur?: () => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function CPFInput({
  value,
  onChange,
  onBlur,
  placeholder = "000.000.000-00",
  disabled = false,
  className,
}: CPFInputProps) {
  return (
    <Input
      type="cpf"
      value={value ?? ""}
      onChange={(newValue) => {
        // Convert empty string or undefined to null for consistent handling
        onChange?.(newValue === "" || newValue === undefined ? null : (newValue as string));
      }}
      onBlur={onBlur as any}
      placeholder={placeholder}
      disabled={disabled}
      className={className}
      transparent={true}
    />
  );
}
