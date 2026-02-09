import { IconNotes } from "@tabler/icons-react";

import { FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";

interface HrNotesTextareaProps {
  control: any;
  disabled?: boolean;
}

export function HrNotesTextarea({ control, disabled }: HrNotesTextareaProps) {
  return (
    <FormField
      control={control}
      name="hrNotes"
      render={({ field }) => (
        <FormItem>
          <FormLabel>
            <div className="flex items-center gap-2">
              <IconNotes className="h-4 w-4" />
              Notas do RH
            </div>
          </FormLabel>
          <FormControl>
            <Textarea
              value={field.value || ""}
              onChange={field.onChange}
              onBlur={field.onBlur}
              name={field.name}
              ref={field.ref}
              placeholder="Observações internas do departamento de RH (opcional)..."
              disabled={disabled}
              rows={3}
              className="resize-none"
              maxLength={1000}
            />
          </FormControl>
          <FormDescription>Informações confidenciais para uso interno do RH</FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
