import { IconCertificate } from "@tabler/icons-react";
import { FormCombobox } from "@/components/ui/form-combobox";
import { REGISTRATION_STATUS_OPTIONS } from "@/constants/enums";

export function SituacaoCadastralSelect() {
  return (
    <FormCombobox
      name="registrationStatus"
      label="Situação Cadastral"
      icon={<IconCertificate className="h-4 w-4" />}
      placeholder="Selecione a situação cadastral"
      options={[...REGISTRATION_STATUS_OPTIONS]}
      searchable
    />
  );
}
