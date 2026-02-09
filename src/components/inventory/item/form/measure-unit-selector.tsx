import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { MEASURE_UNIT, MEASURE_UNIT_LABELS } from "../../../../constants";


interface MeasureUnitSelectorProps {
  control: any;
  disabled?: boolean;
}

export function MeasureUnitSelector({ control, disabled }: MeasureUnitSelectorProps) {
  const options = Object.values(MEASURE_UNIT).map((value) => ({
    value,
    label: MEASURE_UNIT_LABELS[value],
  }));

  return (
    <FormField
      control={control}
      name="measures.0.unit"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Unidade de Medida</FormLabel>
          <FormControl>
            <Combobox
              options={options}
              value={field.value || ""}
              onValueChange={field.onChange}
              placeholder="Selecione uma unidade"
              disabled={disabled}
              searchable={false}
              clearable={true}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
