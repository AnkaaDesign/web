import React, { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import {
  IconInfoCircle,
  IconPhone,
  IconLock,
  IconUser,
  IconBuilding
} from '@tabler/icons-react';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Combobox } from '@/components/ui/combobox';
import { customerService } from '@/api-client/customer';
import type { Representative } from '@/types/representative';
import {
  REPRESENTATIVE_ROLE_LABELS,
  RepresentativeRole
} from '@/types/representative';
import { cn } from '@/lib/utils';

// Schema for representative form
const representativeSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  phone: z.string().min(1, 'Telefone é obrigatório'),
  email: z.string().email('E-mail inválido').optional().nullable().or(z.literal('')),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres').optional().nullable().or(z.literal('')),
  customerId: z.string().min(1, 'Cliente é obrigatório'),
  role: z.nativeEnum(RepresentativeRole),
  isActive: z.boolean().default(true),
  hasSystemAccess: z.boolean().default(false),
});

type RepresentativeFormData = z.infer<typeof representativeSchema>;

interface RepresentativeFormProps {
  mode: 'create' | 'edit';
  initialData?: Representative;
  onSubmit: (data: any) => void | Promise<void>;
  isSubmitting?: boolean;
  onFormStateChange?: (state: { isValid: boolean; isDirty: boolean }) => void;
}

export function RepresentativeForm({
  mode,
  initialData,
  onSubmit,
  isSubmitting = false,
  onFormStateChange,
}: RepresentativeFormProps) {
  // Fetch customers for combobox
  const { data: customersData } = useQuery({
    queryKey: ['customers', 'all'],
    queryFn: async () => {
      const response = await customerService.getAll({ limit: 1000 });
      return response.data;
    },
  });

  // Prepare customer options for combobox
  const customerOptions = useMemo(() => {
    if (!customersData) return [];
    return customersData.map(customer => ({
      value: customer.id,
      label: customer.fantasyName || customer.name || customer.corporateName || '',
    }));
  }, [customersData]);

  // Role options for combobox
  const roleOptions = useMemo(() => {
    return Object.entries(REPRESENTATIVE_ROLE_LABELS).map(([value, label]) => ({
      value,
      label,
    }));
  }, []);

  const form = useForm<RepresentativeFormData>({
    resolver: zodResolver(representativeSchema),
    defaultValues: {
      name: initialData?.name || '',
      phone: initialData?.phone || '',
      email: initialData?.email || '',
      password: '',
      customerId: initialData?.customerId || '',
      role: initialData?.role || RepresentativeRole.OPERATIONAL,
      isActive: initialData?.isActive ?? true,
      hasSystemAccess: !!(initialData?.email && initialData?.password),
    },
    mode: 'onBlur',
  });

  const hasSystemAccess = form.watch('hasSystemAccess');

  // Track form state changes
  useEffect(() => {
    if (onFormStateChange) {
      onFormStateChange({
        isValid: form.formState.isValid,
        isDirty: form.formState.isDirty,
      });
    }
  }, [form.formState.isValid, form.formState.isDirty, onFormStateChange]);

  // Handle system access toggle
  useEffect(() => {
    if (!hasSystemAccess) {
      form.setValue('email', '');
      form.setValue('password', '');
    }
  }, [hasSystemAccess, form]);

  const handleSubmit = async (data: RepresentativeFormData) => {
    // Clean up data before submitting
    const submitData: any = {
      ...data,
      email: hasSystemAccess ? data.email : null,
      password: hasSystemAccess ? data.password : null,
    };

    // Remove hasSystemAccess as it's not part of the API
    delete submitData.hasSystemAccess;

    // Remove password if editing and it's empty
    if (mode === 'edit' && !submitData.password) {
      delete submitData.password;
    }

    await onSubmit(submitData);
  };

  return (
    <Form {...form}>
      <form id="representative-form" onSubmit={form.handleSubmit(handleSubmit)} className="container mx-auto max-w-4xl">
        {/* Hidden submit button for programmatic form submission */}
        <button id="representative-form-submit" type="submit" className="hidden" disabled={isSubmitting}>
          Submit
        </button>

        <div className="space-y-4">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconInfoCircle className="h-5 w-5 text-muted-foreground" />
                Informações Básicas
              </CardTitle>
              <CardDescription>Dados fundamentais do representante</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Name and Phone in same row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome *</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <IconUser className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
                          <Input
                            {...field}
                            placeholder="Nome completo"
                            disabled={isSubmitting}
                            className="pl-10 bg-transparent"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefone *</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <IconPhone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
                          <Input
                            {...field}
                            placeholder="(00) 00000-0000"
                            disabled={isSubmitting}
                            className="pl-10 bg-transparent"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Customer and Role in same row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="customerId"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Cliente *</FormLabel>
                      <FormControl>
                        <Combobox
                          options={customerOptions}
                          value={field.value}
                          onValueChange={field.onChange}
                          placeholder="Selecione um cliente"
                          searchPlaceholder="Buscar cliente..."
                          emptyText="Nenhum cliente encontrado"
                          disabled={isSubmitting}
                          className="w-full"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Função *</FormLabel>
                      <FormControl>
                        <Combobox
                          options={roleOptions}
                          value={field.value}
                          onValueChange={field.onChange}
                          placeholder="Selecione uma função"
                          searchPlaceholder="Buscar função..."
                          emptyText="Nenhuma função encontrada"
                          disabled={isSubmitting}
                          className="w-full"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* System Access */}
          <Card className="border-border/40">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconLock className="h-5 w-5 text-muted-foreground" />
                Acesso ao Sistema
              </CardTitle>
              <CardDescription>Configure o acesso do representante ao sistema</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <FormField
                control={form.control}
                name="hasSystemAccess"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <FormLabel>Habilitar acesso ao sistema</FormLabel>
                        <p className="text-sm text-muted-foreground">
                          Permite que o representante faça login no sistema
                        </p>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          disabled={isSubmitting}
                        />
                      </FormControl>
                    </div>
                  </FormItem>
                )}
              />

              {hasSystemAccess && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>E-mail *</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="email"
                            placeholder="email@exemplo.com"
                            disabled={isSubmitting}
                            className="bg-transparent"
                            value={field.value || ''}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {mode === 'create' && (
                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Senha *</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="password"
                              placeholder="Mínimo 6 caracteres"
                              disabled={isSubmitting}
                              className="bg-transparent"
                              value={field.value || ''}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Status */}
          <Card className="border-border/40">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconBuilding className="h-5 w-5 text-muted-foreground" />
                Status
              </CardTitle>
              <CardDescription>Configure o status do representante</CardDescription>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <FormLabel>Ativo</FormLabel>
                        <p className="text-sm text-muted-foreground">
                          Define se o representante está ativo no sistema
                        </p>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          disabled={isSubmitting}
                        />
                      </FormControl>
                    </div>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
        </div>
      </form>
    </Form>
  );
}