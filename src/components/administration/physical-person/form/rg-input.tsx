import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { IconId } from "@tabler/icons-react";
import { useFormContext } from "react-hook-form";
import type { PhysicalPersonCreateFormData, PhysicalPersonUpdateFormData } from "../../../../schemas";

type FormData = PhysicalPersonCreateFormData | PhysicalPersonUpdateFormData;

interface RgInputProps {
  disabled?: boolean;
}

export function RgInput({ disabled }: RgInputProps) {
  const form = useFormContext<FormData>();

  return (
    <FormField
      control={form.control}
      name="rg"
      render={({ field: { value, onChange, ...field } }) => (
        <FormItem>
          <FormLabel className="flex items-center gap-2">
            <IconId className="h-4 w-4" />
            RG
          </FormLabel>
          <FormControl>
            <Input
              {...field}
              value={value || ""}
              onChange={(e) => {
                const newValue = e.target.value;
                onChange(newValue === "" ? null : newValue);
              }}
              placeholder="Ex: 12.345.678-9"
              disabled={disabled}
              className="transition-all duration-200 focus:ring-2 focus:ring-ring/20"
              maxLength={15}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}