import { useCallback, useRef } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Combobox } from "@/components/ui/combobox";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { CustomerLogoDisplay } from "@/components/ui/avatar-display";
import { formatCNPJ, formatBrazilianPhone } from "@/utils";
import { IconUsers, IconUser, IconAlertTriangle, IconTrash } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { getCustomers } from "@/api-client/customer";
import { useResponsibles } from "@/hooks/administration/use-responsible";

interface BillingStepInfoProps {
  task?: any;
  disabled?: boolean;
  customersCache: React.MutableRefObject<Map<string, any>>;
}

export function BillingStepInfo({ disabled, customersCache }: BillingStepInfoProps) {
  const { control, setValue, getValues } = useFormContext();
  const customerConfigs = useWatch({ control, name: "customerConfigs" }) || [];

  // Stores the last single customer config before it was removed, so discount can be
  // carried over when the user does a remove-then-add instead of atomic replacement.
  const lastRemovedSingleConfigRef = useRef<any>(null);

  const { data: responsiblesData } = useResponsibles({ isActive: true, pageSize: 200 });
  const allResponsibles = responsiblesData?.data || [];
  const responsibleOptions = allResponsibles.map((r: any) => ({
    value: r.id,
    label: r.name,
    description: r.phone ? formatBrazilianPhone(r.phone) : undefined,
  }));

  // Pin Ankaa customer first
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
        const hasMore = response.meta?.hasNextPage || false;
        customers.forEach((c: any) => {
          customersCache.current.set(c.id, c);
        });

        // Pin specific customer to the top on first page with no search
        if (page === 1 && !search?.trim()) {
          const pinnedIndex = customers.findIndex((c: any) => c.id === PINNED_CUSTOMER_ID);
          if (pinnedIndex > 0) {
            const [pinned] = customers.splice(pinnedIndex, 1);
            customers.unshift(pinned);
          } else if (pinnedIndex === -1) {
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

        return { data: customers, hasMore };
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
    },
    [getValues, setValue, customersCache],
  );

  const selectedCustomerIds = customerConfigs.map((c: any) => c.customerId);

  const getCustomerValidationStatus = (customerId: string) => {
    const config = customerConfigs.find((c: any) => c.customerId === customerId);
    const data = config?.customerData;
    if (!data) return { valid: false };
    const missing: string[] = [];
    if (!data.cnpj && !data.cpf) missing.push("CNPJ/CPF");
    if (!data.corporateName) missing.push("Razão Social");
    if (!data.city) missing.push("Cidade");
    if (!data.state) missing.push("Estado");
    if (!data.address) missing.push("Endereço");
    return { valid: missing.length === 0 };
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Faturar Para */}
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
            queryKey={["customers-billing-detail"]}
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
                const name = config.customerData?.corporateName || config.customerData?.fantasyName || cached?.corporateName || cached?.fantasyName || "Cliente";
                const cnpj = config.customerData?.cnpj || cached?.cnpj;
                const validation = getCustomerValidationStatus(config.customerId);

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
                    {!validation.valid ? (
                      <Badge variant="destructive" className="flex items-center gap-1 whitespace-nowrap">
                        <IconAlertTriangle className="h-3 w-3" />
                        Dados incompletos
                      </Badge>
                    ) : (
                      <Badge variant="approved" className="whitespace-nowrap">
                        Dados completos
                      </Badge>
                    )}
                    {!disabled && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => {
                          const updated = customerConfigs.filter((c: any) => c.customerId !== config.customerId);
                          setValue("customerConfigs", updated, { shouldDirty: true });
                        }}
                      >
                        <IconTrash className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Responsável pelo Orçamento */}
      {customerConfigs.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <IconUser className="h-4 w-4 text-muted-foreground" />
              Responsável pelo Orçamento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {customerConfigs.map((config: any, i: number) => {
              const cached = customersCache.current.get(config.customerId);
              const customerName = config.customerData?.corporateName || config.customerData?.fantasyName || cached?.corporateName || cached?.fantasyName || "Cliente";
              const selectedResp = allResponsibles.find((r: any) => r.id === config.responsibleId);

              return (
                <div key={config.customerId} className="space-y-4">
                  <div className="space-y-2">
                    {customerConfigs.length > 1 && (
                      <Label className="text-xs text-muted-foreground">{customerName}</Label>
                    )}
                    <Combobox
                      value={config.responsibleId || ""}
                      onValueChange={(v) =>
                        setValue(`customerConfigs.${i}.responsibleId`, v || null, { shouldDirty: true })
                      }
                      options={responsibleOptions}
                      placeholder="Selecione o responsável..."
                      searchPlaceholder="Buscar responsável..."
                      emptyText="Nenhum responsável encontrado"
                      clearable
                      searchable
                      disabled={disabled}
                      className="w-full"
                    />
                  </div>
                  {selectedResp && (
                    <div className="flex items-center gap-3 bg-muted/30 rounded-lg px-4 py-3">
                      <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                        <IconUser className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{selectedResp.name}</div>
                        {selectedResp.phone && (
                          <div className="text-xs text-muted-foreground">{formatBrazilianPhone(selectedResp.phone)}</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
