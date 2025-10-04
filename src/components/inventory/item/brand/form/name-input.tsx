import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import type { ItemBrandCreateFormData, ItemBrandUpdateFormData } from "../../../../../schemas";

interface NameInputProps {
  control: any;
  errors?: FieldErrors<ItemBrandCreateFormData | ItemBrandUpdateFormData>;
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
          <FormLabel>Nome da Marca {required && <span className="text-destructive">*</span>}</FormLabel>
          <FormControl>
            <Input {...field} placeholder="Digite o nome da marca" disabled={disabled} typewriterPlaceholder={false} naturalTyping={false} typingSpeed={40} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
