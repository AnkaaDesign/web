import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { IconHash } from "@tabler/icons-react";
import { useFormContext } from "react-hook-form";

interface AddressNumberInputProps {
  disabled?: boolean;
  name?: string;
}

export function AddressNumberInput({ disabled, name = "addressNumber" }: AddressNumberInputProps) {
  const form = useFormContext();

  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel className="flex items-center gap-2">
            <IconHash className="h-4 w-4" />
            Número
          </FormLabel>
          <FormControl>
            <Input
              ref={field.ref}
              value={field.value ?? ""}
              onChange={(val) => {
                // Input component passes value directly, not an event
                field.onChange(val === "" ? null : val);
              }}
              onBlur={field.onBlur}
              placeholder="Ex: 123"
              disabled={disabled}
              transparent={true}
              className="transition-all duration-200"
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
