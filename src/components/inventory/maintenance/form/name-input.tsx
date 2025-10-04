import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

interface NameInputProps {
  control: any;
  disabled?: boolean;
  required?: boolean;
}

export function NameInput({ control, disabled = false, required = false }: NameInputProps) {
  return (
    <FormField
      control={control}
      name="name"
      render={({ field }) => (
        <FormItem>
          <FormLabel className={required ? "after:content-['*'] after:ml-0.5 after:text-red-500" : ""}>Nome da Manutenção</FormLabel>
          <FormControl>
            <Input
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              name={field.name}
              ref={field.ref}
              placeholder="Ex: Troca de óleo do caminhão"
              disabled={disabled}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
