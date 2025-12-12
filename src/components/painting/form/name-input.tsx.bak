import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { IconPalette } from "@tabler/icons-react";

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
          <FormLabel className="flex items-center gap-2">
            <IconPalette className="h-4 w-4" />
            Nome da Tinta
            {required && <span className="text-destructive ml-1">*</span>}
          </FormLabel>
          <FormControl>
            <Input {...field} placeholder="Ex: Azul Metálico" disabled={disabled} typewriterPlaceholder={false} naturalTyping={false} typingSpeed={40} className="bg-transparent" />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
