import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { PPE_DELIVERY_MODE, DELIVERY_MODE_LABELS } from "../../../../constants";

interface PpeDeliveryModeSelectorProps {
  control: any;
  name?: string;
  disabled?: boolean;
  required?: boolean;
}

export function PpeDeliveryModeSelector({ control, name = "ppeConfig.deliveryMode", disabled, required = false }: PpeDeliveryModeSelectorProps) {
  const options = Object.values(PPE_DELIVERY_MODE).map((mode) => ({
    value: mode,
    label: DELIVERY_MODE_LABELS[mode],
  }));

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>
            Modo de Entrega do EPI
            {required && <span className="text-destructive ml-1">*</span>}
          </FormLabel>
          <FormControl>
            <Combobox
              options={options}
              value={field.value}
              onValueChange={field.onChange}
              placeholder="Selecione o modo de entrega"
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
