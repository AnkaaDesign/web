import React, { useEffect, useMemo, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  IconInfoCircle,
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
  ResponsibleRole,
  getResponsibleRoles
} from '@/types/responsible';
import { CustomerLogoDisplay } from '@/components/ui/avatar-display';
import { formatCNPJ } from '@/utils';
import { isValidCPF } from '@/utils/validators';
import { useCnpjAutocomplete } from '@/hooks/common/use-cnpj-autocomplete';

// Schema for responsible form
const responsibleSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  phone: z.string().min(1, 'Telefone é obrigatório'),
  email: z.string().email('E-mail inválido').optional().nullable().or(z.literal('')),
  // CPF é OPCIONAL e NÃO é único (a identidade do contato vem do telefone), mas
  // quando informado tem de passar no mod-11: é o mesmo campo que a cerimônia de
  // assinatura eletrônica usa para a conferência parcial do documento.
  cpf: z
    .string()
    .optional()
    .nullable()
    .or(z.literal(''))
    .refine(
      value => {
        const digits = (value || '').replace(/\D/g, '');
        return digits.length === 0 || isValidCPF(digits);
      },
      { message: 'CPF inválido' },
    ),
  companyId: z.string().optional().nullable().or(z.literal('')),
  // A contact can hold several roles at once (e.g. proprietário + financeiro).
  roles: z.array(z.nativeEnum(ResponsibleRole)).min(1, 'Selecione ao menos uma função'),
  isActive: z.boolean().default(true),
});

// Não há mais `password` nem "Habilitar acesso ao sistema". O portal do cliente
// entra por código de uso único enviado ao telefone ou ao e-mail do contato, e
// a coluna de senha foi apagada da API (76855c16). Todo contato ATIVO pode
// entrar, então o controle de acesso é o switch "Ativo" do cartão de Status.
//
// O e-mail é opcional em criação e edição: muito cadastro não tem e-mail, e a
// exigência real pertence à emissão do envelope de assinatura, que recusa
// nominalmente quem está sem endereço na hora de enviar.

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
      cpf: initialData?.cpf || '',
      companyId: initialData?.companyId || '',
      // Sem função pré-selecionada: quem cadastra escolhe. O schema exige ao
      // menos uma ("Selecione ao menos uma função"), então o campo vazio avisa
      // em vez de gravar um "Comercial" que ninguém marcou.
      roles: getResponsibleRoles(initialData),
      isActive: initialData?.isActive ?? true,
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

  // Track form state changes
  useEffect(() => {
    if (onFormStateChange) {
      onFormStateChange({
        isValid: form.formState.isValid,
        isDirty: form.formState.isDirty,
      });
    }
  }, [form.formState.isValid, form.formState.isDirty, onFormStateChange]);

  const handleSubmit = async (data: ResponsibleFormData) => {
    // Clean up data before submitting
    const submitData: any = {
      ...data,
      // Convert empty strings to null for optional fields
      email: (data.email || '').trim() || null,
      // Dígitos puros: é assim que a API grava (e o `cpfNormalized` gerado indexa).
      cpf: (data.cpf || '').replace(/\D/g, '') || null,
      companyId: data.companyId || null,
    };

    await onSubmit(submitData);
  };

  return (
    <Form {...form}>
      {/* max-w-6xl para casar com o cabeçalho da página: as fileiras deste
          formulário são de três colunas, e a 4xl elas ficavam estreitas com meia
          tela sobrando ao lado. */}
      <form id="responsible-form" onSubmit={form.handleSubmit(handleSubmit)} className="container mx-auto max-w-6xl">
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
            <CardContent>
              {/* Uma grade só de 12 colunas para os seis campos, sempre 7 + 5.
                  Cada fileira pareia o campo LONGO (nome, e-mail, empresa) com o
                  de formato fixo ao lado (CPF, telefone, função), e a divisão
                  repetida desenha duas colunas retas de cima a baixo do cartão —
                  em vez de cada fileira quebrar num ponto diferente.

                  `items-start`: a Função pendura os chips do que foi escolhido
                  embaixo do campo. Alinhado por outro eixo, essa altura extra
                  deslocaria a Empresa ao lado. */}
              <div className="grid grid-cols-1 items-start gap-x-6 gap-y-5 md:grid-cols-12">
                {/* Fileira 1 — quem é a pessoa. */}
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem className="md:col-span-7">
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
                  name="cpf"
                  render={({ field }) => (
                    <FormItem className="md:col-span-5">
                      <FormLabel>CPF</FormLabel>
                      <FormControl>
                        <Input
                          type="cpf"
                          value={field.value ?? ''}
                          onChange={(newValue) => field.onChange(typeof newValue === 'string' ? newValue : '')}
                          onBlur={field.onBlur}
                          name={field.name}
                          placeholder="000.000.000-00"
                          disabled={isSubmitting}
                          className="bg-transparent"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Fileira 2 — por onde se fala com ela. O e-mail vive AQUI, e
                    é o canal do convite e do código da assinatura
                    eletrônica, e um dos dois caminhos (com o telefone) do
                    código de entrada no portal do cliente. */}
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem className="md:col-span-7">
                      <FormLabel>E-mail</FormLabel>
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
                      <p className="text-xs text-muted-foreground">
                        Recebe o convite e o código da assinatura eletrônica e pode receber o código de entrada no portal.
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem className="md:col-span-5">
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

                {/* Fileira 3 — o que ela representa. */}
                <FormField
                  control={form.control}
                  name="companyId"
                  render={({ field }) => (
                    <FormItem className="flex flex-col md:col-span-7">
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
                            // Combobox não dispara onBlur, então em mode:'onBlur'
                            // o RHF nunca revalida o form a partir daqui — sem
                            // isso, escolher a empresa por último trava o botão
                            // "Cadastrar" desabilitado mesmo com tudo preenchido.
                            form.trigger();
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
                  name="roles"
                  render={({ field }) => (
                    <FormItem className="flex flex-col md:col-span-5">
                      <FormLabel>Função <span className="text-destructive">*</span></FormLabel>
                      <FormControl>
                        <Combobox
                          mode="multiple"
                          options={roleOptions}
                          value={field.value}
                          onValueChange={(value) => {
                            field.onChange(value);
                            // Mesmo motivo do campo Empresa: sem isso, escolher
                            // a função por último deixa "Cadastrar" desabilitado.
                            form.trigger();
                          }}
                          placeholder="Selecione as funções"
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
                        {/* Sem senha no portal, "Ativo" É o controle de acesso:
                            o código de entrada só é emitido para contato ativo. */}
                        <p className="text-sm text-muted-foreground">
                          Um contato inativo deixa de aparecer nas seleções de responsável e não consegue entrar no portal do cliente
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
