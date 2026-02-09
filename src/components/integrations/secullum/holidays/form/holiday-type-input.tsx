import { HOLIDAY_TYPE, HOLIDAY_TYPE_LABELS } from "../../../../../constants";

import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";

interface HolidayTypeInputProps {
  control: any;
  disabled?: boolean;
  required?: boolean;
}

export function HolidayTypeInput({ control, disabled, required }: HolidayTypeInputProps) {
  const holidayTypes = Object.values(HOLIDAY_TYPE);

  return (
    <FormField
      control={control}
      name="Tipo"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Tipo de Feriado {required && <span className="text-destructive">*</span>}</FormLabel>
          <FormControl>
            <Combobox
              value={field.value || HOLIDAY_TYPE.NATIONAL}
              onValueChange={field.onChange}
              disabled={disabled}
              options={holidayTypes.map((type) => ({
                value: type,
                label: HOLIDAY_TYPE_LABELS[type],
              }))}
              placeholder="Selecione o tipo de feriado"
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
