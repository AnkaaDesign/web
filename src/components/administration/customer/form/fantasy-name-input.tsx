import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { IconBuilding } from "@tabler/icons-react";
import { useFormContext } from "react-hook-form";
import type { CustomerCreateFormData, CustomerUpdateFormData } from "../../../../schemas";

type FormData = CustomerCreateFormData | CustomerUpdateFormData;

interface FantasyNameInputProps {
  disabled?: boolean;
}

export function FantasyNameInput({ disabled }: FantasyNameInputProps) {
  const form = useFormContext<FormData>();

  return (
    <FormField
      control={form.control}
      name="fantasyName"
      render={({ field }) => (
        <FormItem>
          <FormLabel className="flex items-center gap-2">
            <IconBuilding className="h-4 w-4" />
            Nome Fantasia
            <span className="text-destructive">*</span>
          </FormLabel>
          <FormControl>
            <Input
              {...field}
              placeholder="Ex: Cliente ABC Ltda"
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
