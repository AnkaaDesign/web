import { Input } from "./input";
import { cn } from "../../lib/utils";

interface AddressInputProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  error?: boolean;
  errorMessage?: string;
  required?: boolean;
}

export function AddressInput({
  value = "",
  onChange,
  placeholder = "Digite um endereço...",
  className,
  disabled = false,
  error = false,
  errorMessage,
  required = false,
}: AddressInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange?.(e.target.value);
  };

  return (
    <div className={cn("space-y-2", className)}>
      <Input
        type="text"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={disabled}
        className={error ? "border-red-500" : ""}
        required={required}
      />
      {error && errorMessage && (
        <p className="text-sm text-red-500">{errorMessage}</p>
      )}
    </div>
  );
}

// Simplified version for basic address input
export function SimpleAddressInput({
  value,
  onChange,
  placeholder = "Digite um endereço...",
  className,
  disabled = false,
  error = false,
  errorMessage,
}: Omit<AddressInputProps, "required">) {
  return (
    <AddressInput
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={className}
      disabled={disabled}
      error={error}
      errorMessage={errorMessage}
    />
  );
}
