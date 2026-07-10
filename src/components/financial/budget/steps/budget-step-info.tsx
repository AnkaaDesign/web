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
import { Input } from "@/components/ui/input";
import { CustomerLogoDisplay } from "@/components/ui/avatar-display";
import { IconUsers, IconCalendar } from "@tabler/icons-react";
import {
  ApprovedLayoutPicker,
  type LayoutOption,
} from "@/components/financial/common/approved-layout-picker";
import { formatCNPJ } from "@/utils";
import { getCustomers } from "@/api-client";
import type { FileWithPreview } from "@/components/common/file/file-uploader";

interface BudgetStepInfoProps {
  disabled?: boolean;
  layoutFiles: FileWithPreview[];
  onLayoutFilesChange: (files: FileWithPreview[]) => void;
  layouts?: LayoutOption[];
  customersCache: React.MutableRefObject<Map<string, any>>;
  selectedCustomers: Map<string, any>;
  setSelectedCustomers: (customers: Map<string, any>) => void;
}

const VALIDITY_PERIOD_OPTIONS = [
  { label: "15 dias", value: "15" },
  { label: "30 dias", value: "30" },
  { label: "60 dias", value: "60" },
  { label: "90 dias", value: "90" },
];

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
  layoutFiles,
  onLayoutFilesChange,
  layouts,
  customersCache,
  selectedCustomers: _selectedCustomers,
  setSelectedCustomers,
}: BudgetStepInfoProps) {
  const { setValue, getValues, control } = useFormContext();
  const [validityPeriod, setValidityPeriod] = useState<number | null>(null);
  const [showCustomGuarantee, setShowCustomGuarantee] = useState(false);

  // Stores the last single customer config before it was removed, so discount can be
  // carried over when the user does a remove-then-add instead of atomic replacement.
  const lastRemovedSingleConfigRef = useRef<any>(null);

  // Watch form values
  const quoteExpiresAt = useWatch({ control, name: "expiresAt" });
  const guaranteeYears = useWatch({ control, name: "guaranteeYears" });
  const customGuaranteeText = useWatch({ control, name: "customGuaranteeText" });
  const customerConfigs = useWatch({ control, name: "customerConfigs" }) || [];

  // Sync validity period whenever expiresAt changes (including after form.reset() populates saved data)
  useEffect(() => {
    if (!quoteExpiresAt) return;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const expiryDate = new Date(quoteExpiresAt);
    expiryDate.setHours(0, 0, 0, 0);
    const diffInDays = Math.round(
      (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );
    for (const period of [15, 30, 60, 90]) {
      if (Math.abs(diffInDays - period) <= 1) {
        setValidityPeriod(period);
        return;
      }
    }
    setValidityPeriod(30);
  }, [quoteExpiresAt]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const handleValidityPeriodChange = useCallback(
    (period: string) => {
      const days = Number(period);
      setValidityPeriod(days);
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + days);
      expiryDate.setHours(23, 59, 59, 999);
      setValue("expiresAt", expiryDate);
    },
    [setValue],
  );

  // Customer search — pin Ankaa customer first
  const PINNED_CUSTOMER_ID = "93dfbeb1-aec0-4829-a297-6a2f09fcfe08";

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

      // Save the config before the last customer is removed so its discount can be
      // restored when the user adds a new customer (remove-then-add flow).
      if (currentConfigs.length === 1 && selectedIds.length === 0) {
        lastRemovedSingleConfigRef.current = currentConfigs[0];
      }
      // In multi-customer mode the discount is per-customer, so don't carry over.
      if (selectedIds.length >= 2) {
        lastRemovedSingleConfigRef.current = null;
      }

      // Source for discount carry-over:
      // 1. Atomic 1→1 replacement: the config being replaced is the source.
      // 2. Remove-then-add (0→1): the last removed single config is the source.
      const discountSource =
        (currentConfigs.length === 1 && selectedIds.length === 1 ? currentConfigs[0] : null) ??
        (currentConfigs.length === 0 && selectedIds.length === 1
          ? lastRemovedSingleConfigRef.current
          : null);

      const newConfigs = selectedIds.map((customerId) => {
        const existing = currentConfigs.find((c: any) => c.customerId === customerId);
        if (existing) return existing;

        const cached = customersCache.current.get(customerId);
        return {
          customerId,
          subtotal: 0,
          total: 0,
          discountType: discountSource?.discountType ?? "NONE",
          discountValue: discountSource?.discountValue ?? null,
          discountReference: discountSource?.discountReference ?? null,
          paymentCondition: null,
          customPaymentText: null,
          generateInvoice: true,
          generateBankSlip: true,
          responsibleId: null,
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
            streetType: cached?.streetType || null,
          },
        };
      });

      setValue("customerConfigs", newConfigs, { shouldDirty: true });

      // Update selected customers map
      const newMap = new Map<string, any>();
      selectedIds.forEach((id: string) => {
        const cached = customersCache.current.get(id);
        if (cached) newMap.set(id, cached);
      });
      setSelectedCustomers(newMap);
    },
    [getValues, setValue, customersCache, setSelectedCustomers],
  );

  const selectedCustomerIds = customerConfigs.map((c: any) => c.customerId);

  // --- Layout Aprovado picker --------------------------------------------------
  // The budget's approved layout is chosen FROM the task's layouts (shared
  // ApprovedLayoutPicker). There is NO upload here — new images are added to the
  // task in Step 1. Selecting files here syncs the `layoutFileIds` form field.
  const handleLayoutChange = useCallback(
    (files: FileWithPreview[]) => {
      onLayoutFilesChange(files);
      const ids = files
        .map((f) => (f as any).uploadedFileId || f.id)
        .filter(Boolean)
        .slice(0, 2);
      setValue("layoutFileIds", ids, { shouldDirty: true });
    },
    [onLayoutFilesChange, setValue],
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
                    <Combobox
                      value={validityPeriod?.toString() || ""}
                      onValueChange={(value) => {
                        if (typeof value === "string")
                          handleValidityPeriodChange(value);
                      }}
                      options={VALIDITY_PERIOD_OPTIONS}
                      placeholder="Selecione"
                      emptyText="Nenhum período encontrado"
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

      {/* Layout Aprovado — pick the budget's approved layout FROM the task's
          layouts (managed in Step 1). Shared with the billing step. */}
      <ApprovedLayoutPicker
        layouts={layouts}
        layoutFiles={layoutFiles}
        onChange={handleLayoutChange}
        disabled={disabled}
      />
    </div>
  );
}
