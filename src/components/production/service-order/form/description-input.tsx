import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import type { ServiceOrderCreateFormData, ServiceOrderUpdateFormData } from "../../../../schemas";

interface DescriptionInputProps {
  control: any;
  disabled?: boolean;
}

export function DescriptionInput({ control, disabled }: DescriptionInputProps) {
  return (
    <FormField
      control={control}
      name="description"
      render={({ field }) => (
        <FormItem>
          <FormLabel>
            Descrição
            <span className="text-destructive ml-1">*</span>
          </FormLabel>
          <FormControl>
            <Textarea
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              name={field.name}
              ref={field.ref}
              placeholder="Descreva detalhadamente o serviço a ser realizado..."
              className="min-h-[100px] resize-none"
              disabled={disabled}
              maxLength={400}
            />
          </FormControl>
          <div className="flex justify-between items-center">
            <FormMessage />
            <span className="text-xs text-muted-foreground">{field.value?.length || 0}/400 caracteres</span>
          </div>
        </FormItem>
      )}
    />
  );
}
