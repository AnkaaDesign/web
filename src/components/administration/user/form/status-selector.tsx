import { FormCombobox } from "@/components/ui/form-combobox";
import { USER_STATUS, USER_STATUS_LABELS } from "../../../../constants";
import { USER_STATUS_TRANSITIONS } from "../../../../schemas";
import { IconToggleLeft } from "@tabler/icons-react";
import { useMemo } from "react";
import { useFormContext } from "react-hook-form";

interface StatusSelectorProps {
  disabled?: boolean;
  required?: boolean;
  currentStatus?: USER_STATUS;
}

export function UserStatusSelector({ disabled = false, required = true, currentStatus }: StatusSelectorProps) {
  const form = useFormContext();

  // Get current status from form if not provided as prop
  const effectiveCurrentStatus = currentStatus || form?.watch?.("currentStatus");

  const options = useMemo(() => {
    // If we have a current status, only show allowed transitions + current status
    if (effectiveCurrentStatus && USER_STATUS_TRANSITIONS[effectiveCurrentStatus]) {
      const allowedStatuses = [
        effectiveCurrentStatus, // Always allow keeping the same status
        ...USER_STATUS_TRANSITIONS[effectiveCurrentStatus],
      ];

      return allowedStatuses.map((value) => ({
        value,
        label: USER_STATUS_LABELS[value] || value,
      }));
    }

    // If no current status (create mode), show all options
    return Object.values(USER_STATUS).map((value) => ({
      value,
      label: USER_STATUS_LABELS[value] || value,
    }));
  }, [effectiveCurrentStatus]);

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
