import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { IconRuler } from "@tabler/icons-react";
import { PPE_SIZE, PPE_SIZE_LABELS, PPE_TYPE } from "../../../../constants";

interface PpeSizeSelectorProps {
  control: any;
  name?: string;
  ppeType?: PPE_TYPE;
  disabled?: boolean;
  required?: boolean;
  label?: string;
  // Controlled mode props
  value?: string | null;
  onValueChange?: (value: string | null) => void;
}

// Map PPE types to their corresponding sizes
const PPE_TYPE_SIZE_MAP: Record<PPE_TYPE, PPE_SIZE[]> = {
  [PPE_TYPE.SHIRT]: [PPE_SIZE.P, PPE_SIZE.M, PPE_SIZE.G, PPE_SIZE.GG, PPE_SIZE.XG],
  [PPE_TYPE.PANTS]: [
    PPE_SIZE.SIZE_35,
    PPE_SIZE.SIZE_36,
    PPE_SIZE.SIZE_37,
    PPE_SIZE.SIZE_38,
    PPE_SIZE.SIZE_39,
    PPE_SIZE.SIZE_40,
    PPE_SIZE.SIZE_41,
    PPE_SIZE.SIZE_42,
    PPE_SIZE.SIZE_43,
    PPE_SIZE.SIZE_44,
    PPE_SIZE.SIZE_45,
    PPE_SIZE.SIZE_46,
    PPE_SIZE.SIZE_47,
    PPE_SIZE.SIZE_48,
    PPE_SIZE.SIZE_50,
  ],
  [PPE_TYPE.SHORT]: [
    PPE_SIZE.SIZE_35,
    PPE_SIZE.SIZE_36,
    PPE_SIZE.SIZE_37,
    PPE_SIZE.SIZE_38,
    PPE_SIZE.SIZE_39,
    PPE_SIZE.SIZE_40,
    PPE_SIZE.SIZE_41,
    PPE_SIZE.SIZE_42,
    PPE_SIZE.SIZE_43,
    PPE_SIZE.SIZE_44,
    PPE_SIZE.SIZE_45,
    PPE_SIZE.SIZE_46,
    PPE_SIZE.SIZE_47,
    PPE_SIZE.SIZE_48,
    PPE_SIZE.SIZE_50,
  ],
  [PPE_TYPE.BOOTS]: [
    PPE_SIZE.SIZE_35,
    PPE_SIZE.SIZE_36,
    PPE_SIZE.SIZE_37,
    PPE_SIZE.SIZE_38,
    PPE_SIZE.SIZE_39,
    PPE_SIZE.SIZE_40,
    PPE_SIZE.SIZE_41,
    PPE_SIZE.SIZE_42,
    PPE_SIZE.SIZE_43,
    PPE_SIZE.SIZE_44,
    PPE_SIZE.SIZE_45,
    PPE_SIZE.SIZE_46,
    PPE_SIZE.SIZE_47,
    PPE_SIZE.SIZE_48,
  ],
  [PPE_TYPE.SLEEVES]: [PPE_SIZE.P, PPE_SIZE.M, PPE_SIZE.G, PPE_SIZE.GG, PPE_SIZE.XG],
  [PPE_TYPE.MASK]: [PPE_SIZE.P, PPE_SIZE.M],
  [PPE_TYPE.GLOVES]: [PPE_SIZE.P, PPE_SIZE.M, PPE_SIZE.G],
  [PPE_TYPE.RAIN_BOOTS]: [
    PPE_SIZE.SIZE_35,
    PPE_SIZE.SIZE_36,
    PPE_SIZE.SIZE_37,
    PPE_SIZE.SIZE_38,
    PPE_SIZE.SIZE_39,
    PPE_SIZE.SIZE_40,
    PPE_SIZE.SIZE_41,
    PPE_SIZE.SIZE_42,
    PPE_SIZE.SIZE_43,
    PPE_SIZE.SIZE_44,
    PPE_SIZE.SIZE_45,
    PPE_SIZE.SIZE_46,
    PPE_SIZE.SIZE_47,
    PPE_SIZE.SIZE_48,
  ],
  [PPE_TYPE.OTHERS]: [], // OTHERS type doesn't require specific sizes
};

export function PpeSizeSelector({
  control,
  name = "size",
  ppeType,
  disabled,
  required,
  label = "Tamanho",
  value: controlledValue,
  onValueChange: controlledOnChange,
}: PpeSizeSelectorProps) {
  // Get available sizes based on PPE type or all sizes
  const availableSizes = ppeType ? PPE_TYPE_SIZE_MAP[ppeType] : Object.values(PPE_SIZE);

  // Create options for combobox
  const options = availableSizes.map((size) => ({
    value: size,
    label: PPE_SIZE_LABELS[size],
  }));

  // Add a "None" option in controlled mode
  const controlledOptions = [{ value: "_none", label: "Nenhum" }, ...options];

  // Use controlled mode if value and onValueChange are provided
  if (controlledValue !== undefined && controlledOnChange) {
    return (
      <FormControl>
        <Combobox
          options={controlledOptions}
          value={controlledValue || "_none"}
          onValueChange={(newValue) => controlledOnChange(newValue === "_none" ? null : newValue)}
          placeholder={ppeType ? "Selecione o tamanho" : "Selecione o tipo de EPI primeiro"}
          disabled={disabled}
          searchable={false}
          clearable={false}
        />
      </FormControl>
    );
  }

  // Use form field mode
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel className="flex items-center gap-2">
            <IconRuler className="h-4 w-4" />
            {label}
            {required && <span className="text-destructive ml-1">*</span>}
          </FormLabel>
          <FormControl>
            <Combobox
              options={options}
              value={field.value || ""}
              onValueChange={field.onChange}
              placeholder={ppeType ? "Selecione o tamanho" : "Selecione o tipo de EPI primeiro"}
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
