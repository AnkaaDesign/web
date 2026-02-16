import { FormField } from "@/components/ui/form";
import { DateTimeInput } from "@/components/ui/date-time-input";

interface NextRunInputProps {
  control: any;
  disabled?: boolean;
  required?: boolean;
}

export function NextRunInput({ control, disabled = false, required = false }: NextRunInputProps) {
  return (
    <FormField
      control={control}
      name="nextRun"
      render={({ field }) => (
        <DateTimeInput
          field={field as any}
          mode="datetime"
          context="scheduled"
          label="Próxima Manutenção"
          disabled={disabled}
          required={required}
          showClearButton={true}
        />
      )}
    />
  );
}
