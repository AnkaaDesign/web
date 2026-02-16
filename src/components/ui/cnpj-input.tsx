import { Input } from "@/components/ui/input";

interface CnpjInputProps {
  value?: string | null;
  onChange?: (value: string | null) => void;
  onBlur?: () => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function CnpjInput({
  value,
  onChange,
  onBlur,
  placeholder = "00.000.000/0000-00",
  disabled = false,
  className,
}: CnpjInputProps) {
  return (
    <Input
      type="cnpj"
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
