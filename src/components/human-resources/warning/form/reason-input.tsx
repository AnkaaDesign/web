import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";

interface ReasonInputProps {
  control: any;
  disabled?: boolean;
  required?: boolean;
}

export function ReasonInput({ control, disabled, required }: ReasonInputProps) {
  return (
    <FormField
      control={control}
      name="reason"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Motivo {required && <span className="text-destructive">*</span>}</FormLabel>
          <FormControl>
            <Textarea
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              name={field.name}
              ref={field.ref}
              placeholder="Descreva o motivo da advertência..."
              disabled={disabled}
              rows={3}
              className="resize-none"
              maxLength={500}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
