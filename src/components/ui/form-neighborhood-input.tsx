import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { IconBuildingCommunity } from "@tabler/icons-react";
import { useFormContext, type Path } from "react-hook-form";

interface FormNeighborhoodInputProps<T extends Record<string, any>> {
  name: Path<T>;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
}

export function FormNeighborhoodInput<T extends Record<string, any>>({
  name,
  label = "Bairro",
  placeholder = "Digite o bairro",
  disabled = false,
  required = false,
}: FormNeighborhoodInputProps<T>) {
  const form = useFormContext<T>();

  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel className="flex items-center gap-2">
            <IconBuildingCommunity className="h-4 w-4" />
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
