import { UseFormReturn } from "react-hook-form";
import type { DriverCreateFormData, DriverUpdateFormData } from "../../../../schemas";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";

interface NotesSectionProps {
  form: UseFormReturn<DriverCreateFormData | DriverUpdateFormData>;
}

export function NotesSection({ form }: NotesSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Observações</CardTitle>
        <CardDescription>Informações adicionais sobre o motorista</CardDescription>
      </CardHeader>
      <CardContent>
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Observações Gerais</FormLabel>
              <FormControl>
                <Textarea placeholder="Informações adicionais, observações especiais, restrições, etc." className="resize-none" rows={4} {...field} value={field.value || ""} />
              </FormControl>
              <FormDescription>Campo livre para anotações importantes sobre o motorista</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </CardContent>
    </Card>
  );
}
