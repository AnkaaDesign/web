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
          field={field}
          mode="datetime"
          context="maintenance"
          label="Próxima Manutenção"
          disabled={disabled}
          required={required}
          description="Data e hora agendada para a próxima execução da manutenção"
          showClearButton={true}
          showTodayButton={true}
        />
      )}
    />
  );
}
