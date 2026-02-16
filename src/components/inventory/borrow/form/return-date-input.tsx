import { FormField } from "@/components/ui/form";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { isAfter, isBefore } from "date-fns";

interface ReturnDateInputProps {
  control: any;
  disabled?: boolean;
  borrowCreatedAt?: string | Date;
}

export function ReturnDateInput({ control, disabled, borrowCreatedAt }: ReturnDateInputProps) {
  // Convert borrowCreatedAt to Date for comparison
  const borrowDate = borrowCreatedAt ? new Date(borrowCreatedAt) : null;
  const today = new Date();

  return (
    <FormField
      control={control}
      name="returnedAt"
      render={({ field }) => {
        return (
          <DateTimeInput
            field={field}
            context="general"
            label="Data de Devolução"
            disabled={disabled}
            constraints={{
              maxDate: today,
              minDate: borrowDate || new Date("1900-01-01"),
              disabledDates: (date) => {
                // Disable future dates
                if (isAfter(date, today)) return true;
                // Disable dates before borrow date
                if (borrowDate && isBefore(date, borrowDate)) return true;
                // Disable very old dates
                if (isBefore(date, new Date("1900-01-01"))) return true;
                return false;
              },
            }}
            onClear={() => field.onChange(null)}
          />
        );
      }}
    />
  );
}
