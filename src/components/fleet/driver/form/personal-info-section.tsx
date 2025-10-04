import { UseFormReturn } from "react-hook-form";
import type { DriverCreateFormData, DriverUpdateFormData } from "../../../../schemas";
import { DRIVER_STATUS } from "../../../../constants";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { FormInput } from "@/components/ui/form-input";
import { DateTimeInput } from "@/components/ui/date-time-input";

interface PersonalInfoSectionProps {
  form: UseFormReturn<DriverCreateFormData | DriverUpdateFormData>;
}

export function PersonalInfoSection({ form }: PersonalInfoSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Informações Pessoais</CardTitle>
        <CardDescription>Dados pessoais básicos do motorista</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Name */}
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nome Completo *</FormLabel>
                <FormControl>
                  <Input placeholder="Digite o nome completo" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Status */}
          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status *</FormLabel>
                <FormControl>
                  <Combobox
                    value={field.value}
                    onValueChange={field.onChange}
                    options={[
                      { value: DRIVER_STATUS.ACTIVE, label: "Ativo" },
                      { value: DRIVER_STATUS.INACTIVE, label: "Inativo" },
                      { value: DRIVER_STATUS.SUSPENDED, label: "Suspenso" },
                      { value: DRIVER_STATUS.LICENSE_EXPIRED, label: "CNH Vencida" },
                    ]}
                    placeholder="Selecione o status"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* CPF */}
          <FormField
            control={form.control}
            name="cpf"
            render={({ field }) => (
              <FormItem>
                <FormLabel>CPF *</FormLabel>
                <FormControl>
                  <FormInput type="cpf" placeholder="000.000.000-00" {...field} />
                </FormControl>
                <FormDescription>CPF do motorista para identificação oficial</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* RG */}
          <FormField
            control={form.control}
            name="rg"
            render={({ field }) => (
              <FormItem>
                <FormLabel>RG</FormLabel>
                <FormControl>
                  <Input type="rg" {...field} value={field.value} onChange={field.onChange} />
                </FormControl>
                <FormDescription>Registro Geral (documento de identidade)</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Birth Date */}
          <FormField
            control={form.control}
            name="birthDate"
            render={({ field }) => (
              <DateTimeInput field={field} label="Data de Nascimento" context="birth" description="Necessário para verificação de idade mínima (18 anos)" showTodayButton />
            )}
          />

          {/* Phone */}
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Telefone</FormLabel>
                <FormControl>
                  <Input placeholder="(11) 99999-9999" {...field} value={field.value || ""} />
                </FormControl>
                <FormDescription>Telefone de contato do motorista</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 gap-6">
          {/* Email */}
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>E-mail</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="motorista@exemplo.com" {...field} value={field.value || ""} />
                </FormControl>
                <FormDescription>E-mail para comunicações e notificações</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </CardContent>
    </Card>
  );
}
