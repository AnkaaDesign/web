import { FormQuantityInput } from "@/components/ui/form-quantity-input";

interface ReplenishmentTargetInputsProps {
  disabled?: boolean;
}

// Replenishment knobs for CONSUMPTION items. "Cobertura alvo" = days of usage
// the order should land with, on top of the reorder point's safety buffer;
// "Estoque mínimo" = hard floor, honored even for items with no usage history.
export function ReplenishmentTargetInputs({ disabled }: ReplenishmentTargetInputsProps) {
  return (
    <>
      <FormQuantityInput
        name="targetCoverageDays"
        label="Cobertura Alvo (dias)"
        placeholder="Automático"
        disabled={disabled}
        min={1}
        integer={true}
        transparent={true}
      />
      <FormQuantityInput
        name="minStockQuantity"
        label="Estoque Mínimo"
        placeholder="Sem mínimo"
        disabled={disabled}
        min={0}
        integer={false}
        transparent={true}
      />
    </>
  );
}
