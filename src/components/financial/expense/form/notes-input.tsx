import { Control } from "react-hook-form";
import { ExpenseCreateFormData, ExpenseUpdateFormData } from "../../../../schemas";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";

interface NotesInputProps {
  control: Control<ExpenseCreateFormData | ExpenseUpdateFormData>;
}

export function NotesInput({ control }: NotesInputProps) {
  return (
    <FormField
      control={control}
      name="notes"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Observações</FormLabel>
          <FormControl>
            <Textarea
              placeholder="Informações adicionais sobre a despesa..."
              className="resize-none"
              rows={3}
              {...field}
              maxLength={1000}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}