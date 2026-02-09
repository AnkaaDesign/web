import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

interface NameInputProps {
  control: any;
  disabled?: boolean;
  required?: boolean;
}

export function NameInput({ control, disabled, required }: NameInputProps) {
  return (
    <FormField
      control={control}
      name="name"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Nome do Cargo {required && <span className="text-destructive">*</span>}</FormLabel>
          <FormControl>
            <Input
              {...field}
              placeholder="Ex: Gerente de Vendas"
              disabled={disabled}
              transparent={true}
              maxLength={100}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
