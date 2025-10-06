import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { IconHash } from "@tabler/icons-react";
import { useFormContext } from "react-hook-form";
import type { ItemCreateFormData, ItemUpdateFormData } from "../../../../schemas";

type FormData = ItemCreateFormData | ItemUpdateFormData;

interface UnicodeInputProps {
  disabled?: boolean;
}

export function UnicodeInput({ disabled }: UnicodeInputProps) {
  const form = useFormContext<FormData>();

  return (
    <FormField
      control={form.control}
      name="uniCode"
      render={({ field: { value, ...field } }) => (
        <FormItem>
          <FormLabel className="flex items-center gap-2">
            <IconHash className="h-4 w-4" />
            Código Universal
          </FormLabel>
          <FormControl>
            <Input
              {...field}
              value={value || ""}
              placeholder="Digite o código universal"
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
