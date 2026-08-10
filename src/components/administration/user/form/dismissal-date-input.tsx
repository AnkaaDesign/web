import { useFormContext } from "react-hook-form";
import { IconUserX } from "@tabler/icons-react";
import { FormField } from "@/components/ui/form";
import { DateTimeInput } from "@/components/ui/date-time-input";
import type { UserCreateFormData, UserUpdateFormData } from "../../../../schemas";

interface DismissalDateInputProps {
  disabled?: boolean;
}

/**
 * Termination date of the current vínculo (EmploymentContract.terminationDate).
 *
 * Rendered whenever the situação do vínculo is (or is being set to) TERMINATED —
 * both to register a desligamento and to correct the date of an old one. The
 * legal nature of the rescisão is the sibling <TerminationTypeSelector />.
 *
 * The clear button is hidden because a TERMINATED contract with no termination
 * date is an inconsistent state — but that is presentation only: the segmented
 * input still accepts an erased value, so the real guard is the userUpdateSchema
 * refine ("um vínculo desligado precisa de uma data de demissão"), which surfaces
 * the error on this field.
 */
export function DismissalDateInput({ disabled }: DismissalDateInputProps) {
  const form = useFormContext<UserCreateFormData | UserUpdateFormData>();

  // The dismissal can never predate the admission of the vínculo being edited.
  const admissionDate = form.watch("exp1StartAt") ?? form.watch("admissionDate");

  return (
    <FormField
      control={form.control}
      name="terminationDate"
      render={({ field }) => (
        <DateTimeInput
          field={{
            ...field,
            value: field.value as Date | null,
            onChange: (value) => field.onChange(value as Date | null),
          }}
          label={
            <span className="flex items-center gap-1.5">
              <IconUserX className="h-4 w-4" />
              Data de Demissão
            </span>
          }
          context="general"
          disabled={disabled}
          required
          mode="date"
          showClearButton={false}
          constraints={{ minDate: (admissionDate as Date | null) || undefined }}
        />
      )}
    />
  );
}
