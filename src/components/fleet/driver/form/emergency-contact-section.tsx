import { UseFormReturn } from "react-hook-form";
import type { DriverCreateFormData, DriverUpdateFormData } from "../../../../schemas";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

interface EmergencyContactSectionProps {
  form: UseFormReturn<DriverCreateFormData | DriverUpdateFormData>;
}

export function EmergencyContactSection({ form }: EmergencyContactSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Contato de Emergência</CardTitle>
        <CardDescription>Pessoa para contatar em caso de emergência</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="emergencyContactName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nome</FormLabel>
                <FormControl>
                  <Input placeholder="Nome do contato" {...field} value={field.value || ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="emergencyContactPhone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Telefone</FormLabel>
                <FormControl>
                  <Input placeholder="(11) 99999-9999" {...field} value={field.value || ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="emergencyContactRelation"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Parentesco/Relação</FormLabel>
              <FormControl>
                <Input placeholder="Ex: Esposa, Pai, Irmão, etc." {...field} value={field.value || ""} />
              </FormControl>
              <FormDescription>Relação com o motorista</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </CardContent>
    </Card>
  );
}
