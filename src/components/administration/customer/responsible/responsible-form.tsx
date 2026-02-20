import React, { useEffect, useMemo, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  IconInfoCircle,
  IconLock,
  IconBuilding,
  IconUser
} from '@tabler/icons-react';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Combobox } from '@/components/ui/combobox';
import { getCustomers, quickCreateCustomer } from '@/api-client';
import type { Responsible } from '@/types/responsible';
import type { Customer } from '@/types/customer';
import {
  RESPONSIBLE_ROLE_LABELS,
  ResponsibleRole
} from '@/types/responsible';
import { CustomerLogoDisplay } from '@/components/ui/avatar-display';
import { formatCNPJ } from '@/utils';
import { useCnpjAutocomplete } from '@/hooks/common/use-cnpj-autocomplete';

// Schema for responsible form
const responsibleSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  phone: z.string().min(1, 'Telefone é obrigatório'),
  email: z.string().email('E-mail inválido').optional().nullable().or(z.literal('')),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres').optional().nullable().or(z.literal('')),
  companyId: z.string().optional().nullable().or(z.literal('')),
  role: z.nativeEnum(ResponsibleRole),
  isActive: z.boolean().default(true),
  hasSystemAccess: z.boolean().default(false),
});

type ResponsibleFormData = z.infer<typeof responsibleSchema>;

interface ResponsibleFormProps {
  mode: 'create' | 'edit';
  initialData?: Responsible;
  initialCustomer?: Customer; // Customer object for proper display in combobox
  onSubmit: (data: any) => void | Promise<void>;
  isSubmitting?: boolean;
  onFormStateChange?: (state: { isValid: boolean; isDirty: boolean }) => void;
}

export function ResponsibleForm({
  mode,
  initialData,
  initialCustomer,
  onSubmit,
  isSubmitting = false,
  onFormStateChange,
}: ResponsibleFormProps) {
  // Use initialCustomer from props, or fall back to initialData.company
  const effectiveInitialCustomer = initialCustomer || initialData?.company;

  // State for customer creation
  const [isCreatingCustomer, setIsCreatingCustomer] = React.useState(false);

  // CNPJ autocomplete integration
  const {
    isLookingUp,
    getCreateLabel,
    buildCustomerData,
    processInput,
    reset: resetCnpjState,
  } = useCnpjAutocomplete();

  // Memoize initialOptions to prevent infinite loop
  const initialCustomerOptions = useMemo(() =>
    effectiveInitialCustomer ? [effectiveInitialCustomer] : [],
    [effectiveInitialCustomer?.id]
  );

  // Memoize callbacks to prevent infinite loop
  const getCustomerOptionLabel = useCallback((customer: Customer) => customer.fantasyName, []);
  const getCustomerOptionValue = useCallback((customer: Customer) => customer.id, []);

  // Search function for Customer Combobox
  const searchCustomers = useCallback(async (
    search?: string,
    page: number = 1,
  ): Promise<{
    data: Customer[];
    hasMore: boolean;
  }> => {
    // Process input for CNPJ detection
    if (search) {
      processInput(search);
    }

    const params: any = {
      orderBy: { fantasyName: "asc" },
      page: page,
      take: 50,
      include: { logo: true },
    };

    // Only add search filter if there's a search term
    if (search && search.trim()) {
      params.searchingFor = search.trim();
    }

    try {
      const response = await getCustomers(params);
      const customers = response.data || [];
      const hasMore = response.meta?.hasNextPage || false;

      return {
        data: customers,
        hasMore: hasMore,
      };
    } catch (error) {
      return { data: [], hasMore: false };
    }
  }, [processInput]);

  // Handle customer creation with CNPJ data support
  const handleCreateCustomer = useCallback(async (searchText: string): Promise<Customer> => {
    setIsCreatingCustomer(true);
    try {
      const customerData = buildCustomerData(searchText);
      const result = await quickCreateCustomer(customerData);

      if (result.success && result.data) {
        resetCnpjState();
        return result.data;
      }
      throw new Error("Failed to create customer");
    } catch (error) {
      throw error;
    } finally {
      setIsCreatingCustomer(false);
    }
  }, [buildCustomerData, resetCnpjState]);

  // Dynamic create label based on CNPJ lookup state
  const dynamicCreateLabel = useCallback((value: string) => {
    return getCreateLabel(value);
  }, [getCreateLabel]);

  // Role options for combobox
  const roleOptions = useMemo(() => {
    return Object.entries(RESPONSIBLE_ROLE_LABELS).map(([value, label]) => ({
      value,
      label,
    }));
  }, []);

  const form = useForm<ResponsibleFormData>({
    resolver: zodResolver(responsibleSchema),
    defaultValues: {
      name: initialData?.name || '',
      phone: initialData?.phone || '',
      email: initialData?.email || '',
      password: '',
      companyId: initialData?.companyId || '',
      role: initialData?.role || ResponsibleRole.COMMERCIAL,
      isActive: initialData?.isActive ?? true,
      hasSystemAccess: !!(initialData?.email && initialData?.password),
    },
    mode: 'onBlur',
    reValidateMode: 'onChange',
  });

  // Trigger validation on mount for edit mode to enable submit button
  useEffect(() => {
    if (mode === 'edit' && initialData) {
      form.trigger();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, initialData?.id]);

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

  const handleSubmit = async (data: ResponsibleFormData) => {
    // Clean up data before submitting
    const submitData: any = {
      ...data,
      // Convert empty strings to null for optional fields
      email: hasSystemAccess && data.email ? data.email : null,
      password: hasSystemAccess && data.password ? data.password : null,
      companyId: data.companyId || null,
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
      <form id="responsible-form" onSubmit={form.handleSubmit(handleSubmit)} className="container mx-auto max-w-4xl">
        {/* Hidden submit button for programmatic form submission */}
        <button id="responsible-form-submit" type="submit" className="hidden" disabled={isSubmitting}>
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
              <CardDescription>Dados fundamentais do responsável</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Name and Phone in same row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome <span className="text-destructive">*</span></FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Nome completo"
                          disabled={isSubmitting}
                          className="bg-transparent"
                        />
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
                      <FormLabel>Telefone <span className="text-destructive">*</span></FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="phone"
                          placeholder="(00) 00000-0000"
                          disabled={isSubmitting}
                          className="bg-transparent"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Company and Role in same row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="companyId"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel className="flex items-center gap-2">
                        <IconUser className="h-4 w-4" />
                        Empresa
                      </FormLabel>
                      <FormControl>
                        <Combobox<Customer>
                          value={field.value || ""}
                          onValueChange={(value) => {
                            field.onChange(value);
                            if (value) {
                              resetCnpjState();
                            }
                          }}
                          placeholder="Selecione uma empresa"
                          emptyText={isLookingUp ? "Buscando CNPJ..." : "Nenhuma empresa encontrada"}
                          searchPlaceholder="Pesquisar por nome ou CNPJ..."
                          disabled={isSubmitting || isCreatingCustomer}
                          async={true}
                          allowCreate={true}
                          createLabel={dynamicCreateLabel}
                          onCreate={handleCreateCustomer}
                          isCreating={isCreatingCustomer || isLookingUp}
                          queryKey={["customers", "search", "responsible-form"]}
                          queryFn={searchCustomers}
                          initialOptions={initialCustomerOptions}
                          getOptionLabel={getCustomerOptionLabel}
                          getOptionValue={getCustomerOptionValue}
                          renderOption={(customer, _isSelected) => (
                            <div className="flex items-center gap-3">
                              <CustomerLogoDisplay
                                logo={customer.logo}
                                customerName={customer.fantasyName}
                                size="sm"
                                shape="rounded"
                                className="flex-shrink-0"
                              />
                              <div className="flex flex-col gap-1 min-w-0 flex-1">
                                <div className="font-medium truncate">{customer.fantasyName}</div>
                                <div className="flex items-center gap-2 text-sm truncate group-hover:text-white transition-colors">
                                  {customer.corporateName && <span className="truncate">{customer.corporateName}</span>}
                                  {customer.cnpj && (
                                    <>
                                      {customer.corporateName && <span>•</span>}
                                      <span>{formatCNPJ(customer.cnpj)}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                          minSearchLength={0}
                          pageSize={20}
                          debounceMs={500}
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
                      <FormLabel>Função <span className="text-destructive">*</span></FormLabel>
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
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconLock className="h-5 w-5 text-muted-foreground" />
                Acesso ao Sistema
              </CardTitle>
              <CardDescription>Configure o acesso do responsável ao sistema</CardDescription>
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
                          Permite que o responsável faça login no sistema
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
                        <FormLabel>E-mail <span className="text-destructive">*</span></FormLabel>
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
                          <FormLabel>Senha <span className="text-destructive">*</span></FormLabel>
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
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconBuilding className="h-5 w-5 text-muted-foreground" />
                Status
              </CardTitle>
              <CardDescription>Configure o status do responsável</CardDescription>
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
                          Define se o responsável está ativo no sistema
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
