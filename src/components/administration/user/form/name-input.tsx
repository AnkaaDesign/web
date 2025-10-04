import { useFormContext } from "react-hook-form";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { IconUser } from "@tabler/icons-react";
import type { UserCreateFormData, UserUpdateFormData } from "../../../../schemas";

interface NameInputProps {
  disabled?: boolean;
}

export function NameInput({ disabled }: NameInputProps) {
  const form = useFormContext<UserCreateFormData | UserUpdateFormData>();

  return (
    <FormField
      control={form.control}
      name="name"
      render={({ field }) => (
        <FormItem>
          <FormLabel className="flex items-center gap-2">
            <IconUser className="h-4 w-4 text-muted-foreground" />
            Nome
            <span className="text-destructive">*</span>
          </FormLabel>
          <FormControl>
            <Input
              {...field}
              placeholder="Digite o nome completo do colaborador"
              disabled={disabled}
              typewriterPlaceholder={false}
              naturalTyping={false}
              typingSpeed={40}
              transparent
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
