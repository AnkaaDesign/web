import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { CPFInput } from "@/components/ui/cpf-input";
import { IconIdBadge2 } from "@tabler/icons-react";
import { useFormContext } from "react-hook-form";
import type { PhysicalPersonCreateFormData, PhysicalPersonUpdateFormData } from "../../../../schemas";

type FormData = PhysicalPersonCreateFormData | PhysicalPersonUpdateFormData;

interface CpfInputProps {
  disabled?: boolean;
}

export function CpfInput({ disabled }: CpfInputProps) {
  const form = useFormContext<FormData>();

  return (
    <FormField
      control={form.control}
      name="cpf"
      render={({ field: { value, onChange, ...field } }) => (
        <FormItem>
          <FormLabel className="flex items-center gap-2">
            <IconIdBadge2 className="h-4 w-4" />
            CPF *
          </FormLabel>
          <FormControl>
            <CPFInput
              {...field}
              value={value || ""}
              onChange={(newValue) => {
                onChange(newValue === "" || newValue === undefined ? null : newValue);
              }}
              placeholder="000.000.000-00"
              disabled={disabled}
              className="transition-all duration-200 focus:ring-2 focus:ring-ring/20"
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}