import { FormCNPJInput } from "@/components/ui/form-cnpj-input";

export function CnpjInput() {
  return (
    <FormCNPJInput
      name="cnpj"
      label="CNPJ"
      placeholder="00.000.000/0000-00"
      required={true}
    />
  );
}