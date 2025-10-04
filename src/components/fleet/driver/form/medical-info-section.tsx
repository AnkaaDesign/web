import { UseFormReturn } from "react-hook-form";
import type { DriverCreateFormData, DriverUpdateFormData } from "../../../../schemas";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DateTimeInput } from "@/components/ui/date-time-input";

interface MedicalInfoSectionProps {
  form: UseFormReturn<DriverCreateFormData | DriverUpdateFormData>;
}

export function MedicalInfoSection({ form }: MedicalInfoSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Informações Médicas</CardTitle>
        <CardDescription>Dados médicos relevantes para segurança</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="bloodType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tipo Sanguíneo</FormLabel>
                <FormControl>
                  <Input placeholder="A+, B-, AB+, O-, etc." {...field} value={field.value || ""} />
                </FormControl>
                <FormDescription>Formato: A+, B-, AB+, O-, etc.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="medicalCertificateExpiry"
            render={({ field }) => (
              <DateTimeInput
                field={field}
                label="Vencimento do Atestado Médico"
                context="due"
                description="Data de vencimento do atestado médico"
                constraints={{
                  minDate: new Date(),
                  onlyFuture: true,
                }}
              />
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="allergies"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Alergias</FormLabel>
              <FormControl>
                <Textarea placeholder="Descreva alergias conhecidas..." className="resize-none" {...field} value={field.value || ""} />
              </FormControl>
              <FormDescription>Liste alergias médicas conhecidas</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="medications"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Medicamentos em Uso</FormLabel>
              <FormControl>
                <Textarea placeholder="Liste medicamentos em uso..." className="resize-none" {...field} value={field.value || ""} />
              </FormControl>
              <FormDescription>Medicamentos de uso contínuo</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </CardContent>
    </Card>
  );
}
