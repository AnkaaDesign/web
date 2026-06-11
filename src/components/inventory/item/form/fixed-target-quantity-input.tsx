import { FormQuantityInput } from "@/components/ui/form-quantity-input";

interface FixedTargetQuantityInputProps {
  disabled?: boolean;
}

// Target on-hand quantity for FIXED_TARGET items (engine falls back to 1 when
// empty). Only rendered when "Modelo de estoque" = Alvo fixo.
export function FixedTargetQuantityInput({ disabled }: FixedTargetQuantityInputProps) {
  return (
    <FormQuantityInput
      name="fixedTargetQuantity"
      label="Quantidade Alvo"
      placeholder="1"
      disabled={disabled}
      min={0.01}
      integer={false}
      transparent={true}
    />
  );
}
