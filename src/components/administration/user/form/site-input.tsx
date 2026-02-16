import { useFormContext } from "react-hook-form";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { IconWorld } from "@tabler/icons-react";
import type { UserCreateFormData, UserUpdateFormData } from "../../../../schemas";

interface SiteInputProps {
  disabled?: boolean;
}

export function SiteInput({ disabled }: SiteInputProps) {
  const form = useFormContext<UserCreateFormData | UserUpdateFormData>();

  return (
    <FormField
      control={form.control}
      name="site"
      render={({ field }) => (
        <FormItem>
          <FormLabel className="flex items-center gap-2">
            <IconWorld className="h-4 w-4" />
            Site/Website
          </FormLabel>
          <FormControl>
            <Input
              ref={field.ref}
              value={field.value || ""}
              onChange={(value: string | number | null) => {
                const trimmedValue = typeof value === 'string' ? value.trim() : null;
                field.onChange(trimmedValue || null);
              }}
              onBlur={field.onBlur}
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
