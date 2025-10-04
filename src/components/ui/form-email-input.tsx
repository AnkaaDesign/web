import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { IconMail } from "@tabler/icons-react";
import { useFormContext } from "react-hook-form";

interface FormEmailInputProps {
  name: string;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}

export function FormEmailInput({
  name,
  label = "E-mail",
  placeholder = "contato@empresa.com.br",
  disabled = false,
  required = false,
  className,
}: FormEmailInputProps) {
  const form = useFormContext();

  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel className="flex items-center gap-2">
            <IconMail className="h-4 w-4 text-muted-foreground" />
            {label}
            {required && <span className="text-destructive">*</span>}
          </FormLabel>
          <FormControl>
            <Input
              {...field}
              value={field.value || ""}
              onChange={(e) => field.onChange(e.target.value || null)}
              type="email"
              placeholder={placeholder}
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