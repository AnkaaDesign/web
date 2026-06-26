import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
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
          <FormLabel>Notas do RH</FormLabel>
          <FormControl>
            <Textarea
              value={field.value || ""}
              onChange={field.onChange}
              onBlur={field.onBlur}
              name={field.name}
              ref={field.ref}
              placeholder="Observações internas (opcional)..."
              disabled={disabled}
              rows={3}
              className="resize-none"
              maxLength={1000}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
