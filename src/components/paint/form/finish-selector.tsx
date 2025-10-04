import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import type { PaintCreateFormData, PaintUpdateFormData } from "../../../schemas";
import { PAINT_FINISH, PAINT_FINISH_LABELS } from "../../../constants";

interface FinishSelectorProps {
  control: any;
  disabled?: boolean;
  required?: boolean;
}

export function FinishSelector({ control, disabled, required }: FinishSelectorProps) {
  const options: ComboboxOption[] = Object.values(PAINT_FINISH).map((finish) => ({
    value: finish,
    label: PAINT_FINISH_LABELS[finish],
  }));

  return (
    <FormField
      control={control}
      name="finish"
      render={({ field }) => (
        <FormItem>
          <FormLabel>
            Acabamento
            {required && <span className="text-destructive ml-1">*</span>}
          </FormLabel>
          <FormControl>
            <Combobox
              options={options}
              value={field.value}
              onValueChange={field.onChange}
              placeholder="Selecione o acabamento"
              disabled={disabled}
              searchable={false}
              clearable={!required}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
