import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { IconWorldWww } from "@tabler/icons-react";
import { useFormContext } from "react-hook-form";
import type { PhysicalPersonCreateFormData, PhysicalPersonUpdateFormData } from "../../../../schemas";

type FormData = PhysicalPersonCreateFormData | PhysicalPersonUpdateFormData;

interface WebsiteInputProps {
  disabled?: boolean;
}

export function WebsiteInput({ disabled }: WebsiteInputProps) {
  const form = useFormContext<FormData>();

  return (
    <FormField
      control={form.control}
      name="site"
      render={({ field: { value, onChange, ...field } }) => (
        <FormItem>
          <FormLabel className="flex items-center gap-2">
            <IconWorldWww className="h-4 w-4" />
            Website/Portfólio
          </FormLabel>
          <FormControl>
            <Input
              {...field}
              type="url"
              value={value || ""}
              onChange={(e) => {
                const newValue = e.target.value;
                onChange(newValue === "" ? null : newValue);
              }}
              placeholder="https://exemplo.com"
              disabled={disabled}
              className="transition-all duration-200 "
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
