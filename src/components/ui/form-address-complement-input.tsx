import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { IconNotes } from "@tabler/icons-react";
import { useFormContext, type Path } from "react-hook-form";

interface FormAddressComplementInputProps<T extends Record<string, any>> {
  name: Path<T>;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
}

export function FormAddressComplementInput<T extends Record<string, any>>({
  name,
  label = "Complemento",
  placeholder = "Apto, Bloco, etc.",
  disabled = false,
  required = false,
}: FormAddressComplementInputProps<T>) {
  const form = useFormContext<T>();

  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel className="flex items-center gap-2">
            <IconNotes className="h-4 w-4" />
            {label}
            {required && <span className="text-destructive">*</span>}
          </FormLabel>
          <FormControl>
            <Input
              type="text"
              value={field.value ?? ""}
              onChange={(value) => {
                field.onChange(value as any);
                form.setValue(name, value as any, { shouldDirty: true, shouldValidate: true });
              }}
              onBlur={field.onBlur}
              placeholder={placeholder}
              disabled={disabled}
              transparent={true}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
