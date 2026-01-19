import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { IconBuildingCommunity } from "@tabler/icons-react";
import { useFormContext } from "react-hook-form";
import type { SupplierCreateFormData, SupplierUpdateFormData } from "../../../../schemas";

type FormData = SupplierCreateFormData | SupplierUpdateFormData;

interface CityInputProps {
  disabled?: boolean;
}

export function CityInput({ disabled }: CityInputProps) {
  const form = useFormContext<FormData>();

  return (
    <FormField
      control={form.control}
      name="city"
      render={({ field }) => (
        <FormItem>
          <FormLabel className="flex items-center gap-2">
            <IconBuildingCommunity className="h-4 w-4" />
            Cidade
          </FormLabel>
          <FormControl>
            <Input
              {...field}
              value={field.value || ""}
              onChange={(value: string) => field.onChange(value || null)}
              placeholder="Ex: São Paulo"
              disabled={disabled}
              className="transition-all duration-200"
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
