import { FormInput } from "@/components/ui/form-input";

interface SalaryFloorInputProps {
  disabled?: boolean;
}

/**
 * Piso salarial da categoria/sindicato (Part F). NULL = usa o salário-mínimo
 * nacional. A remuneração é validada contra max(piso, salário-mínimo).
 */
export function SalaryFloorInput({ disabled }: SalaryFloorInputProps) {
  return (
    <FormInput
      name="salaryFloor"
      type="currency"
      label="Piso da Categoria"
      placeholder="R$ 0,00"
      description="Piso salarial do sindicato/categoria. Deixe em branco para usar o salário-mínimo nacional."
      disabled={disabled}
    />
  );
}
