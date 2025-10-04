import { FormEmailInput } from "@/components/ui/form-email-input";

interface EmailInputProps {
  disabled?: boolean;
}

export function EmailInput({ disabled }: EmailInputProps) {
  return (
    <FormEmailInput
      name="email"
      label="E-mail"
      placeholder="contato@fornecedor.com.br"
      disabled={disabled}
    />
  );
}
