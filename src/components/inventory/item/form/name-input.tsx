import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { IconTag } from "@tabler/icons-react";
import { useFormContext } from "react-hook-form";
import type { ItemCreateFormData, ItemUpdateFormData } from "../../../../schemas";

type FormData = ItemCreateFormData | ItemUpdateFormData;

interface NameInputProps {
  disabled?: boolean;
  required?: boolean;
}

export function NameInput({ disabled, required }: NameInputProps) {
  const form = useFormContext<FormData>();

  return (
    <FormField
      control={form.control}
      name="name"
      render={({ field }) => (
        <FormItem>
          <FormLabel className="flex items-center gap-2">
            <IconTag className="h-4 w-4" />
            Nome do Item
            {required && <span className="text-destructive">*</span>}
          </FormLabel>
          <FormControl>
            <Input
              {...field}
              placeholder="Digite o nome do item"
              disabled={disabled}
              className="bg-transparent transition-all duration-200"
              typewriterPlaceholder={false}
              naturalTyping={false}
              typingSpeed={35}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
