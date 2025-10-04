import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { IconBuildingCommunity } from "@tabler/icons-react";
import { useFormContext } from "react-hook-form";
import type { CustomerCreateFormData, CustomerUpdateFormData } from "../../../../schemas";

type FormData = CustomerCreateFormData | CustomerUpdateFormData;

interface CorporateNameInputProps {
  disabled?: boolean;
}

export function CorporateNameInput({ disabled }: CorporateNameInputProps) {
  const form = useFormContext<FormData>();

  return (
    <FormField
      control={form.control}
      name="corporateName"
      render={({ field: { value, ...field } }) => (
        <FormItem>
          <FormLabel className="flex items-center gap-2">
            <IconBuildingCommunity className="h-4 w-4" />
            Razão Social
          </FormLabel>
          <FormControl>
            <Input
              {...field}
              value={value || ""}
              placeholder="Ex: Cliente Comércio e Serviços Ltda"
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
