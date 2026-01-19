import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { IconBuildingCommunity } from "@tabler/icons-react";
import { useFormContext } from "react-hook-form";

interface CityInputProps {
  disabled?: boolean;
  name?: string;
  required?: boolean;
}

export function CityInput({ disabled, name = "city", required = true }: CityInputProps) {
  const form = useFormContext();

  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel className="flex items-center gap-2">
            <IconBuildingCommunity className="h-4 w-4" />
            Cidade {required && "*"}
          </FormLabel>
          <FormControl>
            <Input
              {...field}
              value={field.value ?? ""}
              onChange={(value: string) => {
                field.onChange(value === "" ? null : value);
              }}
              placeholder="Ex: São Paulo"
              disabled={disabled}
              transparent={true}
              className="transition-all duration-200"
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
