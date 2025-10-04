import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { IconUser } from "@tabler/icons-react";
import { useFormContext } from "react-hook-form";
import type { PhysicalPersonCreateFormData, PhysicalPersonUpdateFormData } from "../../../../schemas";

type FormData = PhysicalPersonCreateFormData | PhysicalPersonUpdateFormData;

interface FullNameInputProps {
  disabled?: boolean;
}

export function FullNameInput({ disabled }: FullNameInputProps) {
  const form = useFormContext<FormData>();

  return (
    <FormField
      control={form.control}
      name="fantasyName"
      render={({ field }) => (
        <FormItem>
          <FormLabel className="flex items-center gap-2">
            <IconUser className="h-4 w-4" />
            Nome Completo *
          </FormLabel>
          <FormControl>
            <Input
              {...field}
              placeholder="Ex: João Silva Santos"
              disabled={disabled}
              className="transition-all duration-200"
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
