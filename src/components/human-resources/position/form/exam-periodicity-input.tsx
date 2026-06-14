import { FormInput } from "@/components/ui/form-input";

interface ExamPeriodicityInputProps {
  disabled?: boolean;
}

/**
 * Periodicidade padrão do exame médico periódico (meses). NULL = cadência legal
 * por idade/risco.
 */
export function ExamPeriodicityInput({ disabled }: ExamPeriodicityInputProps) {
  return (
    <FormInput
      name="examPeriodicityMonths"
      type="number"
      label="Periodicidade do Exame (meses)"
      placeholder="Ex: 12"
      description="Periodicidade do exame médico periódico. Deixe em branco para usar a cadência legal por idade/risco."
      disabled={disabled}
    />
  );
}
