import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { IconHome2 } from "@tabler/icons-react";
import { useFormContext } from "react-hook-form";

interface AddressComplementInputProps {
  disabled?: boolean;
  name?: string;
}

export function AddressComplementInput({ disabled, name = "addressComplement" }: AddressComplementInputProps) {
  const form = useFormContext();

  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel className="flex items-center gap-2">
            <IconHome2 className="h-4 w-4" />
            Complemento
          </FormLabel>
          <FormControl>
            <Input
              {...field}
              value={field.value ?? ""}
              onChange={(value: string) => {
                field.onChange(value === "" ? null : value);
              }}
              placeholder="Ex: Apto 101, Bloco A"
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
