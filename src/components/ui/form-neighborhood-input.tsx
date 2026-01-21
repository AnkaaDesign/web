import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { IconMap2 } from "@tabler/icons-react";
import { useFormContext } from "react-hook-form";

interface NeighborhoodInputProps {
  disabled?: boolean;
  name?: string;
}

export function NeighborhoodInput({ disabled, name = "neighborhood" }: NeighborhoodInputProps) {
  const form = useFormContext();

  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel className="flex items-center gap-2">
            <IconMap2 className="h-4 w-4" />
            Bairro
          </FormLabel>
          <FormControl>
            <Input
              ref={field.ref}
              value={field.value ?? ""}
              onChange={(value: string) => {
                field.onChange(value === "" ? null : value);
              }}
              onBlur={field.onBlur}
              placeholder="Ex: Centro"
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
