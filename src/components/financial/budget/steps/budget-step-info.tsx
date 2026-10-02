import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Combobox } from "@/components/ui/combobox";
import { PINNED_CUSTOMERS } from "@/config/company";
import { Input } from "@/components/ui/input";
import { CustomerLogoDisplay } from "@/components/ui/avatar-display";
import { IconUsers, IconCalendar } from "@tabler/icons-react";
import { formatCNPJ } from "@/utils";
import { hasNoEffectiveDiscount, pickDiscountTerms } from "@/utils/budget-calculations";
import { getCustomers } from "@/api-client";
import { ValidityField } from "@/components/financial/budget/validity";

interface BudgetStepInfoProps {
  disabled?: boolean;
  customersCache: React.MutableRefObject<Map<string, any>>;
  selectedCustomers: Map<string, any>;
  setSelectedCustomers: (customers: Map<string, any>) => void;
}

const VALIDITY_DAYS_OPTIONS = Array.from({ length: 30 }, (_, i) => ({
  value: String(i + 1),
  label: `${i + 1} ${i + 1 === 1 ? "dia" : "dias"}`,
}));

const GUARANTEE_OPTIONS = [
  { value: "5", label: "5 anos" },
  { value: "10", label: "10 anos" },
  { value: "15", label: "15 anos" },
  { value: "CUSTOM", label: "Personalizado" },
] as const;

export function BudgetStepInfo({
  disabled,
  customersCache,
  selectedCustomers: _selectedCustomers,
  setSelectedCustomers,
}: BudgetStepInfoProps) {
  const { setValue, getValues, control } = useFormContext();
  const [showCustomGuarantee, setShowCustomGuarantee] = useState(false);

  // Stores the last single customer config before it was removed, so discount can be
  // carried over when the user does a remove-then-add instead of atomic replacement.
  const lastRemovedSingleConfigRef = useRef<any>(null);

  // Watch form values
  const quoteExpiresAt = useWatch({ control, name: "expiresAt" });
  const guaranteeYears = useWatch({ control, name: "guaranteeYears" });
  const customGuaranteeText = useWatch({ control, name: "customGuaranteeText" });
  const customerConfigs = useWatch({ control, name: "customerConfigs" }) || [];

  // QUANTOS VEÍCULOS este orçamento vai cobrir.
  //


  // Show custom guarantee textarea whenever the saved text is populated
  useEffect(() => {
    if (customGuaranteeText) setShowCustomGuarantee(true);
  }, [customGuaranteeText]);

  const currentGuaranteeOption = useMemo(() => {
    if (customGuaranteeText) return "CUSTOM";
    if (guaranteeYears) return guaranteeYears.toString();
    return "";
  }, [guaranteeYears, customGuaranteeText]);

  const handleGuaranteeOptionChange = useCallback(
    (value: string) => {
      if (value === "CUSTOM") {
        setShowCustomGuarantee(true);
        setValue("guaranteeYears", null);
      } else {
        setShowCustomGuarantee(false);
        setValue("customGuaranteeText", null);
        setValue("guaranteeYears", value ? Number(value) : null);
      }
    },
    [setValue],
  );

  // `shouldDirty`: o Salvar grava pelo `dirtyFields`, e sem ele trocar SÓ a
  // validade não mandava nada — zero prorrogações registradas em 120 dias (até
  // 25/09/2026).
  const handleValidityChange = useCallback(
    (next: Date) => setValue("expiresAt", next, { shouldDirty: true }),
    [setValue],
  );

  // Customer search — pin the Ibiporã customer first (the highest-volume invoice-to client).
  const PINNED_CUSTOMER_ID = PINNED_CUSTOMERS.IBIPORA;

  const searchCustomers = useCallback(
    async (search?: string, page: number = 1): Promise<{ data: any[]; hasMore: boolean }> => {
      const params: any = {
        orderBy: { fantasyName: "asc" },
        page,
        take: 50,
        include: { logo: true },
      };
      if (search && search.trim()) {
        params.searchingFor = search.trim();
      }
      try {
        const response = await getCustomers(params);
        const customers = response.data || [];
        customers.forEach((c: any) => customersCache.current.set(c.id, c));

        // Pin specific customer to the top on first page with no search
        if (page === 1 && !search?.trim()) {
          const pinnedIndex = customers.findIndex((c: any) => c.id === PINNED_CUSTOMER_ID);
          if (pinnedIndex > 0) {
            const [pinned] = customers.splice(pinnedIndex, 1);
            customers.unshift(pinned);
          } else if (pinnedIndex === -1) {
            // Fetch pinned customer if not in first page
            try {
              const pinnedResponse = await getCustomers({
                where: { id: PINNED_CUSTOMER_ID },
                take: 1,
                include: { logo: true },
              });
              const pinnedCustomer = pinnedResponse.data?.[0];
              if (pinnedCustomer) {
                customersCache.current.set(pinnedCustomer.id, pinnedCustomer);
                customers.unshift(pinnedCustomer);
              }
            } catch { /* ignore */ }
          }
        }

        return { data: customers, hasMore: response.meta?.hasNextPage || false };
      } catch {
        return { data: [], hasMore: false };
      }
    },
    [customersCache],
  );

  const handleCustomerChange = useCallback(
    (value: any) => {
      const selectedIds: string[] = Array.isArray(value) ? value : value ? [value] : [];
      const currentConfigs = getValues("customerConfigs") || [];

      // Mirror the CURRENT single-customer discount on every change — not only on
      // the 1→0 transition. "Faturar Para" is a multi-select, so every click is a
      // toggle and an atomic 1→1 replacement is unreachable from this UI: the real
      // gesture is tick-new-then-untick-old (1→2→1). The previous code nulled this
      // ref the instant the selection reached two, so by the time it collapsed back
      // to one the discount was already gone, and the 1→1 branch could never fire.
      // Writing `null` when the single config has no discount is what makes a
      // deliberate "Nenhum" stick instead of being resurrected on the next collapse.
      if (currentConfigs.length === 1) {
        lastRemovedSingleConfigRef.current = hasNoEffectiveDiscount(currentConfigs[0])
          ? null
          : pickDiscountTerms(currentConfigs[0]);
      }
      const discountCarry = lastRemovedSingleConfigRef.current;

      const newConfigs = selectedIds.map((customerId) => {
        const existing = currentConfigs.find((c: any) => c.customerId === customerId);
        // Re-apply the remembered terms only when collapsing to exactly ONE customer
        // that has no discount of its own. Multi-customer billing keeps its
        // per-customer discounts untouched.
        if (existing) {
          return selectedIds.length === 1 && discountCarry && hasNoEffectiveDiscount(existing)
            ? { ...existing, ...discountCarry }
            : existing;
        }

        const cached = customersCache.current.get(customerId);
        const inherit = selectedIds.length === 1 ? discountCarry : null;
        return {
          customerId,
          subtotal: 0,
          total: 0,
          discountType: inherit?.discountType ?? "NONE",
          discountValue: inherit?.discountValue ?? null,
          discountReference: inherit?.discountReference ?? null,
          paymentCondition: null,
          customPaymentText: null,
          generateInvoice: true,
          generateBankSlip: true,
          customerData: {
            corporateName: cached?.corporateName || "",
            fantasyName: cached?.fantasyName || "",
            cnpj: cached?.cnpj || "",
            cpf: cached?.cpf || "",
            address: cached?.address || "",
            addressNumber: cached?.addressNumber || "",
            addressComplement: cached?.addressComplement || "",
            neighborhood: cached?.neighborhood || "",
            city: cached?.city || "",
            state: cached?.state || "",
            zipCode: cached?.zipCode || "",
            stateRegistration: cached?.stateRegistration || "",
            municipalRegistration: cached?.municipalRegistration || "",
            // Contato só para a pré-visualização da NFS-e (Fone/Fax e E-Mail do tomador):
            // não é editado aqui nem reenviado no save.
            email: cached?.email || "",
            phones: cached?.phones || [],
            streetType: cached?.streetType || null,
          },
        };
      });

      setValue("customerConfigs", newConfigs, { shouldDirty: true });

      // Update selected customers map.
      //
      // Always keep an ENTRY per selected id. Dropping the ones missing from the
      // search cache erased the customer from every downstream consumer (the
      // per-service "Faturar para" options, the per-config totals label, the
      // review step) even though the config itself was there — leaving a billing
      // customer that existed for the save guard but not for the UI. Fall back to
      // whatever the config already carries so the entry is at worst unlabelled.
      const newMap = new Map<string, any>();
      selectedIds.forEach((id: string) => {
        const cached = customersCache.current.get(id);
        const fromConfig = newConfigs.find((c: any) => c.customerId === id)?.customerData;
        newMap.set(id, cached ?? { id, ...(fromConfig ?? {}) });
      });
      setSelectedCustomers(newMap);
    },
    [getValues, setValue, customersCache, setSelectedCustomers],
  );

  const selectedCustomerIds = customerConfigs.map((c: any) => c.customerId);

  // Seed the Combobox with the already-selected customers so their badges render
  // even before the async search returns them. Without this, pre-selected customers
  // (loaded from saved data) have no option object in the Combobox and show no chip.
  const initialCustomerOptions = useMemo(
    () =>
      customerConfigs.map((config: any) => {
        const cached = customersCache.current.get(config.customerId);
        const data = config.customerData || {};
        return {
          id: config.customerId,
          corporateName: cached?.corporateName || data.corporateName || "",
          fantasyName: cached?.fantasyName || data.fantasyName || "",
          cnpj: cached?.cnpj || data.cnpj || "",
          logo: cached?.logo,
        };
      }),
    [customerConfigs, customersCache],
  );

  return (
    <div className="space-y-4">
      {/* Invoice-To Customers */}
      <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <IconUsers className="h-4 w-4 text-muted-foreground" />
              Faturar Para
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Combobox<any>
              mode="multiple"
              placeholder="Selecione os clientes para faturamento"
              emptyText="Nenhum cliente encontrado"
              value={selectedCustomerIds}
              onValueChange={handleCustomerChange}
              async={true}
              initialOptions={initialCustomerOptions}
              queryKey={["customers-budget-detail"]}
              queryFn={searchCustomers}
              minSearchLength={0}
              disabled={disabled}
              getOptionValue={(customer: any) => customer.id}
              getOptionLabel={(customer: any) => customer.corporateName || customer.fantasyName}
              renderOption={(customer: any) => (
                <div className="flex items-center gap-3 w-full">
                  <CustomerLogoDisplay
                    logo={customer.logo}
                    customerName={customer.fantasyName || customer.corporateName}
                    size="sm"
                    shape="rounded"
                    className="flex-shrink-0"
                  />
                  <div className="flex flex-col gap-1 min-w-0 flex-1">
                    <div className="font-medium truncate">{customer.corporateName || customer.fantasyName}</div>
                    {customer.cnpj && <div className="text-xs opacity-70">{formatCNPJ(customer.cnpj)}</div>}
                  </div>
                </div>
              )}
            />

            {customerConfigs.length > 0 && (
              <div className="space-y-2">
                {customerConfigs.map((config: any) => {
                  const cached = customersCache.current.get(config.customerId);
                  const name = cached?.corporateName || cached?.fantasyName || "Cliente";
                  const cnpj = cached?.cnpj;

                  return (
                    <div key={config.customerId} className="flex items-center gap-3 bg-muted/30 rounded-lg px-4 py-3">
                      <CustomerLogoDisplay
                        logo={cached?.logo}
                        customerName={name}
                        size="sm"
                        shape="rounded"
                        className="flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{name}</div>
                        {cnpj && (
                          <div className="text-xs text-muted-foreground">{formatCNPJ(cnpj)}</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

      {/* Validity, Guarantee, Forecast, Simultaneous Tasks */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <IconCalendar className="h-4 w-4 text-muted-foreground" />
            Prazos e Configurações
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <FormField
              control={control}
              name="expiresAt"
              render={() => (
                <FormItem>
                  <FormLabel>Validade da Proposta</FormLabel>
                  <FormControl>
                    <ValidityField
                      value={quoteExpiresAt}
                      onChange={handleValidityChange}
                      disabled={disabled}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormItem>
              <FormLabel>Período de Garantia</FormLabel>
              <FormControl>
                <Combobox
                  value={currentGuaranteeOption}
                  onValueChange={(value) => {
                    if (typeof value === "string")
                      handleGuaranteeOptionChange(value);
                  }}
                  disabled={disabled}
                  options={GUARANTEE_OPTIONS.map((opt) => ({
                    value: opt.value,
                    label: opt.label,
                  }))}
                  placeholder="Selecione"
                  emptyText="Nenhuma opção"
                />
              </FormControl>
            </FormItem>

            <FormField
              control={control}
              name="customForecastDays"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Prazo Entrega</FormLabel>
                  <FormControl>
                    <Combobox
                      value={field.value ? String(field.value) : ""}
                      onValueChange={(value) =>
                        field.onChange(value ? Number(value) : null)
                      }
                      disabled={disabled}
                      options={VALIDITY_DAYS_OPTIONS}
                      placeholder="Auto"
                      emptyText="Nenhuma opção"
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={control}
              name="simultaneousTasks"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tarefas Simultâneas</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      {...field}
                      value={field.value ?? ""}
                      onChange={(val) => field.onChange(val ? Number(val) : null)}
                      disabled={disabled}
                      placeholder="1-100"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* JUNTO OU SEPARADO mudou de passo: a escolha é sobre FATURAMENTO —
              quantas faturas, quantas notas, quantos planos de parcelas — e
              agora mora junto das condições de pagamento, no passo do cliente.
              Ver `budget-step-customer-payment.tsx`. */}

          {showCustomGuarantee && (
            <FormField
              control={control}
              name="customGuaranteeText"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Texto Personalizado de Garantia</FormLabel>
                  <FormControl>
                    <textarea
                      {...field}
                      value={field.value || ""}
                      placeholder="Descreva as condições de garantia personalizadas..."
                      disabled={disabled}
                      rows={3}
                      className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          )}
        </CardContent>
      </Card>

    </div>
  );
}
