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
            Nome da Tinta
            {required && <span className="text-destructive ml-1">*</span>}
          </FormLabel>
          <FormControl>
            <Input {...field} placeholder="Ex: Azul Metálico" disabled={disabled} typewriterPlaceholder={false} naturalTyping={false} typingSpeed={40} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
