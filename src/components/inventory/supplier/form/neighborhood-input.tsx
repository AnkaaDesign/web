import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { IconMap } from "@tabler/icons-react";
import { useFormContext } from "react-hook-form";
import type { SupplierCreateFormData, SupplierUpdateFormData } from "../../../../schemas";

type FormData = SupplierCreateFormData | SupplierUpdateFormData;

interface NeighborhoodInputProps {
  disabled?: boolean;
}

export function NeighborhoodInput({ disabled }: NeighborhoodInputProps) {
  const form = useFormContext<FormData>();

  return (
    <FormField
      control={form.control}
      name="neighborhood"
      render={({ field }) => (
        <FormItem>
          <FormLabel className="flex items-center gap-2">
            <IconMap className="h-4 w-4" />
            Bairro
          </FormLabel>
          <FormControl>
            <Input
              {...field}
              value={field.value || ""}
              onChange={(e) => field.onChange(e.target.value || null)}
              placeholder="Ex: Centro"
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
