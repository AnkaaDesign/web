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
import type { Representative } from '@/types/representative';
import type { Customer } from '@/types/customer';
import {
  REPRESENTATIVE_ROLE_LABELS,
  RepresentativeRole
} from '@/types/representative';
import { CustomerLogoDisplay } from '@/components/ui/avatar-display';
import { formatCNPJ } from '@/utils';
import { useCnpjAutocomplete } from '@/hooks/common/use-cnpj-autocomplete';

// Schema for representative form
const representativeSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  phone: z.string().min(1, 'Telefone é obrigatório'),
  email: z.string().email('E-mail inválido').optional().nullable().or(z.literal('')),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres').optional().nullable().or(z.literal('')),
  customerId: z.string().optional().nullable().or(z.literal('')),
  role: z.nativeEnum(RepresentativeRole),
  isActive: z.boolean().default(true),
  hasSystemAccess: z.boolean().default(false),
});

type RepresentativeFormData = z.infer<typeof representativeSchema>;

interface RepresentativeFormProps {
  mode: 'create' | 'edit';
  initialData?: Representative;
  initialCustomer?: Customer; // Customer object for proper display in combobox
  onSubmit: (data: any) => void | Promise<void>;
  isSubmitting?: boolean;
  onFormStateChange?: (state: { isValid: boolean; isDirty: boolean }) => void;
}

export function RepresentativeForm({
  mode,
  initialData,
  initialCustomer,
  onSubmit,
  isSubmitting = false,
  onFormStateChange,
}: RepresentativeFormProps) {
  // Use initialCustomer from props, or fall back to initialData.customer
  const effectiveInitialCustomer = initialCustomer || initialData?.customer;

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
    search: string,
    page: number = 1,
  ): Promise<{
    data: Customer[];
    hasMore: boolean;
  }> => {
    // Process input for CNPJ detection
    processInput(search);

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
  const handleCreateCustomer = useCallback(async (searchText: string): Promise<Customer | undefined> => {
    setIsCreatingCustomer(true);
    try {
      const customerData = buildCustomerData(searchText);
      const result = await quickCreateCustomer(customerData);

      if (result.success && result.data) {
        resetCnpjState();
        return result.data;
      }
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
      role: initialData?.role || RepresentativeRole.COMMERCIAL,
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

  const handleSubmit = async (data: RepresentativeFormData) => {
    // Clean up data before submitting
    const submitData: any = {
      ...data,
      // Convert empty strings to null for optional fields
      email: hasSystemAccess && data.email ? data.email : null,
      password: hasSystemAccess && data.password ? data.password : null,
      customerId: data.customerId || null,
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

              {/* Customer and Role in same row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="customerId"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel className="flex items-center gap-2">
                        <IconUser className="h-4 w-4" />
                        Cliente
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
                          placeholder="Selecione um cliente"
                          emptyText={isLookingUp ? "Buscando CNPJ..." : "Nenhum cliente encontrado"}
                          searchPlaceholder="Pesquisar por nome ou CNPJ..."
                          disabled={isSubmitting || isCreatingCustomer}
                          async={true}
                          allowCreate={true}
                          createLabel={dynamicCreateLabel}
                          onCreate={handleCreateCustomer}
                          isCreating={isCreatingCustomer || isLookingUp}
                          queryKey={["customers", "search", "representative-form"]}
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
                          loadMoreText="Carregar mais clientes"
                          loadingMoreText="Carregando..."
                          minSearchLength={0}
                          pageSize={20}
                          debounceMs={500}
                          loadOnMount={false}
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