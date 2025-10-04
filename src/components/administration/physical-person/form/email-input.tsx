import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { IconMail } from "@tabler/icons-react";
import { useFormContext } from "react-hook-form";
import type { PhysicalPersonCreateFormData, PhysicalPersonUpdateFormData } from "../../../../schemas";

type FormData = PhysicalPersonCreateFormData | PhysicalPersonUpdateFormData;

interface EmailInputProps {
  disabled?: boolean;
}

export function EmailInput({ disabled }: EmailInputProps) {
  const form = useFormContext<FormData>();

  return (
    <FormField
      control={form.control}
      name="email"
      render={({ field: { value, onChange, ...field } }) => (
        <FormItem>
          <FormLabel className="flex items-center gap-2">
            <IconMail className="h-4 w-4" />
            E-mail
          </FormLabel>
          <FormControl>
            <Input
              {...field}
              type="email"
              value={value || ""}
              onChange={(e) => {
                const newValue = e.target.value;
                onChange(newValue === "" ? null : newValue);
              }}
              placeholder="exemplo@email.com"
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