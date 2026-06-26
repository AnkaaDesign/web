import { FormInput } from "@/components/ui/form-input";

interface HierarchyInputProps {
  disabled?: boolean;
  required?: boolean;
}

export function HierarchyInput({ disabled, required }: HierarchyInputProps) {
  return (
    <FormInput
      name="hierarchy"
      type="number"
      label="Hierarquia"
      placeholder="Ex: 1, 2, 3..."
      description="Ordem de classificação do cargo (opcional, menor número = maior prioridade)"
      disabled={disabled}
      required={required}
    />
  );
}
