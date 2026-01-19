import { FormCombobox } from "@/components/ui/form-combobox";
import { USER_STATUS, USER_STATUS_LABELS } from "../../../../constants";
import { IconToggleLeft } from "@tabler/icons-react";
import { useMemo } from "react";

interface StatusSelectorProps {
  disabled?: boolean;
  required?: boolean;
  currentStatus?: USER_STATUS;
}

export function UserStatusSelector({ disabled = false, required = true }: StatusSelectorProps) {
  // Always show all status options - backend validates transitions
  const options = useMemo(() => {
    return Object.values(USER_STATUS).map((value) => ({
      value,
      label: USER_STATUS_LABELS[value] || value,
    }));
  }, []);

  return (
    <FormCombobox
      name="status"
      label="Status"
      icon={<IconToggleLeft className="h-4 w-4" />}
      options={options}
      disabled={disabled}
      required={required}
      placeholder="Selecione o status"
    />
  );
}
