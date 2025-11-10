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
          <FormLabel>
            Nome do Tipo
            {required && <span className="text-destructive ml-1">*</span>}
          </FormLabel>
          <FormControl>
            <Input
              {...field}
              value={field.value || ""}
              placeholder="Ex: Poliéster Premium"
              disabled={disabled}
              autoComplete="off"
              transparent
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
