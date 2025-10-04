import type { WarningCreateFormData, WarningUpdateFormData } from "../../../../schemas";

import { FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";

interface DescriptionTextareaProps {
  control: any;
  disabled?: boolean;
}

export function DescriptionTextarea({ control, disabled }: DescriptionTextareaProps) {
  return (
    <FormField
      control={control}
      name="description"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Descrição Detalhada</FormLabel>
          <FormControl>
            <Textarea
              value={field.value || ""}
              onChange={field.onChange}
              onBlur={field.onBlur}
              name={field.name}
              ref={field.ref}
              placeholder="Forneça detalhes adicionais sobre o incidente (opcional)..."
              disabled={disabled}
              rows={4}
              className="resize-none"
              maxLength={1000}
            />
          </FormControl>
          <FormDescription>Inclua informações relevantes sobre o contexto, circunstâncias e impacto do incidente.</FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
