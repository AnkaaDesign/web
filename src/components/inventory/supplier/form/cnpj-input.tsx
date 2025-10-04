import { FormCNPJInput } from "@/components/ui/form-cnpj-input";
import type { SupplierCreateFormData, SupplierUpdateFormData } from "../../../../schemas";

interface CNPJInputProps {
  disabled?: boolean;
}

export function CNPJInput({ disabled }: CNPJInputProps) {
  return (
    <FormCNPJInput<SupplierCreateFormData | SupplierUpdateFormData>
      name="cnpj"
      disabled={disabled}
    />
  );
}
