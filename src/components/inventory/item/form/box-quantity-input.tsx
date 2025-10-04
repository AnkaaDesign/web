import { FormQuantityInput } from "@/components/ui/form-quantity-input";

interface BoxQuantityInputProps {
  disabled?: boolean;
}

export function BoxQuantityInput({ disabled }: BoxQuantityInputProps) {
  return <FormQuantityInput name="boxQuantity" label="Quantidade por Caixa" placeholder="1" disabled={disabled} min={1} integer={true} transparent={false} />;
}
