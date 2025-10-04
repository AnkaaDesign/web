import { FormQuantityInput } from "@/components/ui/form-quantity-input";

interface QuantityInputProps {
  disabled?: boolean;
  required?: boolean;
}

export function QuantityInput({ disabled, required }: QuantityInputProps) {
  return <FormQuantityInput name="quantity" label="Quantidade em Estoque" placeholder="0" disabled={disabled} required={required} min={0} integer={true} transparent={false} />;
}
