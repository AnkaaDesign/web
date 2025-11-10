import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { IconMapPin } from "@tabler/icons-react";
import { useFormContext } from "react-hook-form";

interface AddressInputProps {
  disabled?: boolean;
  required?: boolean;
  name?: string;
}

export function AddressInput({
  disabled,
  required = true,
  name = "address",
}: AddressInputProps) {
  const form = useFormContext();

  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel className="flex items-center gap-2">
            <IconMapPin className="h-4 w-4" />
            Endereço {required && "*"}
          </FormLabel>
          <FormControl>
            <Input
              {...field}
              value={field.value ?? ""}
              placeholder="Digite o endereço completo..."
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
