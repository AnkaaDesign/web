import { FormInput } from "@/components/ui/form-input";
import { useFormContext } from "react-hook-form";

interface PriceInputProps {
  name?: string;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  min?: number;
  max?: number;
  description?: string;
}

export function PriceInput({
  name = "price",
  label = "Preço",
  placeholder = "R$ 0,00",
  disabled = false,
  required = false,
  className,
  min = 0,
  max,
  description,
}: PriceInputProps) {
  const form = useFormContext();
  const watchedValue = form?.watch(name);

  // Validation description
  const getValidationDescription = () => {
    if (description) return description;

    const parts = [];
    if (min !== undefined) parts.push(`Mínimo: ${min.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`);
    if (max !== undefined) parts.push(`Máximo: ${max.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`);

    return parts.length > 0 ? parts.join(" • ") : undefined;
  };

  const validationDescription = getValidationDescription();
  const showZeroWarning = required && watchedValue === 0;

  const fullDescription = [validationDescription, showZeroWarning && "⚠️ Preço não pode ser zero"].filter(Boolean).join(" • ");

  return (
    <FormInput name={name} type="currency" label={label} placeholder={placeholder} disabled={disabled} required={required} className={className} description={fullDescription} />
  );
}
