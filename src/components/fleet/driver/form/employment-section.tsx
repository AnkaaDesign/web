import { UseFormReturn } from "react-hook-form";
import type { DriverCreateFormData, DriverUpdateFormData } from "../../../../schemas";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { DateTimeInput } from "@/components/ui/date-time-input";

interface EmploymentSectionProps {
  form: UseFormReturn<DriverCreateFormData | DriverUpdateFormData>;
}

export function EmploymentSection({ form }: EmploymentSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Informações de Emprego</CardTitle>
        <CardDescription>Dados profissionais (se o motorista for funcionário)</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="employeeId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Matrícula</FormLabel>
                <FormControl>
                  <Input placeholder="Número da matrícula" {...field} value={field.value || ""} />
                </FormControl>
                <FormDescription>Número de matrícula do funcionário</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="hireDate"
            render={({ field }) => <DateTimeInput field={field} label="Data de Contratação" context="hire" description="Data de admissão na empresa" showTodayButton />}
          />
        </div>
      </CardContent>
    </Card>
  );
}
