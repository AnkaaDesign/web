import { useEffect } from "react";
import { FormField } from "@/components/ui/form";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { isAfter, isBefore, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { BorrowUpdateFormData } from "../../../../schemas";
import { toast } from "sonner";

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
      render={({ field, fieldState, formState }) => {
        // Real-time validation
        useEffect(() => {
          if (field.value) {
            const returnDate = new Date(field.value);

            // Validate return date is not in the future
            if (isAfter(returnDate, today)) {
              formState.setError("returnedAt", {
                type: "manual",
                message: "Data de devolução não pode ser no futuro",
              });
              toast.error("Data de devolução não pode ser no futuro");
            }
            // Validate return date is not before borrow date
            else if (borrowDate && isBefore(returnDate, borrowDate)) {
              formState.setError("returnedAt", {
                type: "manual",
                message: "Data de devolução não pode ser anterior à data do empréstimo",
              });
              toast.error("Data de devolução não pode ser anterior à data do empréstimo");
            }
            // Clear error if validation passes
            else if (fieldState.error?.type === "manual") {
              formState.clearErrors("returnedAt");
            }
          }
        }, [field.value, borrowDate, today, formState, fieldState.error]);

        return (
          <DateTimeInput
            field={field}
            context="return"
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
            description={
              <div className="space-y-1">
                <div>A data em que o item foi devolvido</div>
                {borrowDate && <div className="text-sm text-muted-foreground">Emprestado em: {format(borrowDate, "PPP", { locale: ptBR })}</div>}
                <div className="text-sm text-muted-foreground">Data máxima: {format(today, "PPP", { locale: ptBR })} (hoje)</div>
              </div>
            }
            onClear={() => field.onChange(null)}
          />
        );
      }}
    />
  );
}
