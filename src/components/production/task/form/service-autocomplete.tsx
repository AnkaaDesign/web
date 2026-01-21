import { useMemo } from "react";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { SERVICE_ORDER_TYPE } from "@/constants/enums";
import { getServiceDescriptionsByType } from "@/constants/service-descriptions";

interface ServiceAutocompleteProps {
  control: any;
  name: string;
  disabled?: boolean;
  label?: string;
  placeholder?: string;
  showLabel?: boolean;
  /** Filter descriptions by service order type */
  type?: SERVICE_ORDER_TYPE;
}

export function ServiceAutocomplete({
  control,
  name,
  disabled,
  label = "Serviço",
  placeholder = "Selecione o serviço...",
  showLabel = true,
  type = SERVICE_ORDER_TYPE.COMMERCIAL,
}: ServiceAutocompleteProps) {
  // Get descriptions for the selected type from enums
  const descriptions = useMemo(() => {
    return getServiceDescriptionsByType(type);
  }, [type]);

  // Convert descriptions to combobox options
  const options = useMemo(() => {
    return descriptions.map((description) => ({
      value: description,
      label: description,
    }));
  }, [descriptions]);

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          {showLabel && <FormLabel>{label}</FormLabel>}
          <FormControl>
            <Combobox
              value={field.value || ""}
              onValueChange={field.onChange}
              disabled={disabled}
              options={options}
              placeholder={placeholder}
              searchable={true}
              clearable={true}
              className="w-full"
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
