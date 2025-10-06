import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { IconShieldCheck } from "@tabler/icons-react";
import { PPE_TYPE, PPE_TYPE_LABELS } from "../../../../constants";

interface PpeTypeSelectorProps {
  control: any;
  name?: string;
  disabled?: boolean;
  required?: boolean;
}

export function PpeTypeSelector({ control, name = "ppeType", disabled, required }: PpeTypeSelectorProps) {
  const options = Object.values(PPE_TYPE).map((type) => ({
    value: type,
    label: PPE_TYPE_LABELS[type],
  }));

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel className="flex items-center gap-2">
            <IconShieldCheck className="h-4 w-4" />
            Tipo de EPI {required && <span className="text-destructive">*</span>}
          </FormLabel>
          <FormControl>
            <Combobox
              options={options}
              value={field.value}
              onValueChange={field.onChange}
              placeholder="Selecione o tipo de EPI"
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
