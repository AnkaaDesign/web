import { FormQuantityInput } from "@/components/ui/form-quantity-input";

interface MaxQuantityInputProps {
  disabled?: boolean;
}

export function MaxQuantityInput({ disabled }: MaxQuantityInputProps) {
  return <FormQuantityInput name="maxQuantity" label="Quantidade Máxima" placeholder="Quantidade máxima" disabled={disabled} min={0} integer={true} transparent={true} />;
}
