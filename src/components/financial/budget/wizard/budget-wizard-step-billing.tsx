/**
 * ④ FATURAMENTO — quem paga, com o cadastro e as condições de cada um.
 *
 * Decisão do dono (02/10/2026): UMA lista de pagadores (não um passo por
 * cliente), cada um escolhido num combobox de cliente que aceita criar, e um
 * botão "+ Adicionar pagador" abaixo do último.
 *
 * O que mantém um pagador honesto:
 *   · o mesmo cliente não entra duas vezes;
 *   · trocar o cliente REFAZ a cópia do cadastro (nada do anterior sobra) e leva
 *     os serviços que eram dele para o novo;
 *   · tirar um pagador solta os serviços que eram dele — e com dois ou mais
 *     pagadores, o passo pede quem paga cada serviço (o valor de um serviço sem
 *     pagador sumia de todo total).
 */
import { useCallback, useMemo, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { IconListCheck, IconPlus, IconReceipt2, IconX } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { toast } from "@/components/ui/sonner";
import {
  BillingSplitField,
  type BillingSplitValue,
  type BillingSplitVehicle,
} from "@/components/financial/shared/billing-split-field";
import { formatCurrency } from "@/utils";
import {
  customerStillPays,
  distinctPayerCustomerIds,
  duplicatePayerIndex,
  newPayerConfig,
  remapServicesPayer,
  swapPayerCustomer,
} from "@/utils/budget-payers";
import { validServicesOf } from "@/utils/budget-wizard";
import { BudgetPayerCard } from "./budget-payer-card";
import { PayerCustomerCombobox } from "./payer-customer-combobox";
import { WizardSection } from "./wizard-section";

interface BudgetWizardStepBillingProps {
  disabled?: boolean;
  customersCache: React.MutableRefObject<Map<string, any>>;
  /** Espelho dos clientes escolhidos (o Orçamento o usa no Resumo). */
  setSelectedCustomers?: (customers: Map<string, any>) => void;
  quoteId?: string;
  /** Quantos veículos o orçamento cobre (o dinheiro do passo é POR VEÍCULO). */
  vehicleCount: number;
  /** Os veículos com id — só no detalhe; é o que permite compor lotes. */
  existingVehicles?: BillingSplitVehicle[];
  /** Faturas já aprovadas — travam a divisão. */
  approvedBillingCount?: number;
  /** Há coleta de assinaturas rodando — refatiar a derruba, e o controle avisa. */
  warnSignature?: boolean;
  /**
   * O RECORTE DE UMA COBRANÇA — as posições, na lista do orçamento, dos
   * pagadores que a tela de Faturamento mostra. Ausente = a lista inteira (o
   * Orçamento). As demais posições não são desenhadas: os valores delas ficam
   * no formulário e a gravação as reenvia como vieram.
   */
  scopeIdx?: number[];
  /**
   * Cada pagador mostra de quais veículos é a fatura (`config.taskIds`) e o
   * total da fatura — só na tela de Faturamento.
   */
  showCoverage?: boolean;
}

export function BudgetWizardStepBilling({
  disabled,
  customersCache,
  setSelectedCustomers,
  quoteId,
  vehicleCount,
  existingVehicles = [],
  approvedBillingCount = 0,
  warnSignature,
  scopeIdx,
  showCoverage = false,
}: BudgetWizardStepBillingProps) {
  const { control, getValues, setValue } = useFormContext();
  const configs = (useWatch({ control, name: "customerConfigs" }) as any[] | undefined) ?? [];
  const services = (useWatch({ control, name: "services" }) as any[] | undefined) ?? [];
  const billingSplit = useWatch({ control, name: "billingSplit" }) as string | undefined;
  const billingGroups = (useWatch({ control, name: "billingGroups" }) as string[][] | undefined) ?? [];
  const [adding, setAdding] = useState(false);

  const syncSelected = useCallback(
    (next: any[]) => {
      const map = new Map<string, any>();
      for (const c of next) {
        if (!c?.customerId) continue;
        map.set(c.customerId, customersCache.current.get(c.customerId) ?? { id: c.customerId, ...(c.customerData ?? {}) });
      }
      setSelectedCustomers?.(map);
    },
    [customersCache, setSelectedCustomers],
  );

  const writeConfigs = useCallback(
    (next: any[]) => {
      setValue("customerConfigs", next, { shouldDirty: true });
      syncSelected(next);
    },
    [setValue, syncSelected],
  );

  const handleSwap = useCallback(
    (index: number, record: any) => {
      const current = (getValues("customerConfigs") as any[]) ?? [];
      if (duplicatePayerIndex(current, record.id, index, scopeIdx) >= 0) {
        toast.warning(scopeIdx ? "Este cliente já é pagador desta cobrança." : "Este cliente já é pagador deste orçamento.");
        return;
      }
      const previousId = current[index]?.customerId as string | undefined;
      customersCache.current.set(record.id, record);
      const next = current.map((c, i) => (i === index ? swapPayerCustomer(c, record) : c));
      writeConfigs(next);
      // Os serviços só seguem o novo cliente se o anterior não paga mais NENHUMA
      // fatura (numa cobrança veículo a veículo ele segue nas irmãs).
      if (previousId && previousId !== record.id && !customerStillPays(next, previousId)) {
        setValue("services", remapServicesPayer((getValues("services") as any[]) ?? [], previousId, record.id), {
          shouldDirty: true,
        });
      }
    },
    [getValues, setValue, writeConfigs, customersCache, scopeIdx],
  );

  const handleRemove = useCallback(
    (index: number) => {
      const current = (getValues("customerConfigs") as any[]) ?? [];
      const removedId = current[index]?.customerId as string | undefined;
      const next = current.filter((_, i) => i !== index);
      writeConfigs(next);
      if (removedId && !customerStillPays(next, removedId)) {
        setValue("services", remapServicesPayer((getValues("services") as any[]) ?? [], removedId, null), {
          shouldDirty: true,
        });
      }
    },
    [getValues, setValue, writeConfigs],
  );

  const handleAdd = useCallback(
    (record: any) => {
      const current = (getValues("customerConfigs") as any[]) ?? [];
      if (duplicatePayerIndex(current, record.id, -1, scopeIdx) >= 0) {
        toast.warning(scopeIdx ? "Este cliente já é pagador desta cobrança." : "Este cliente já é pagador deste orçamento.");
        return;
      }
      customersCache.current.set(record.id, record);
      writeConfigs([...current, newPayerConfig(record)]);
      setAdding(false);
    },
    [getValues, writeConfigs, customersCache, scopeIdx],
  );

  /**
   * As posições DESENHADAS. No Faturamento, o recorte desta cobrança mais os
   * pagadores recém-acrescentados (ainda sem posição na lista do servidor), que
   * nascem no fim da lista — ver a página.
   */
  const visibleIdx = useMemo(
    () => scopeIdx ?? configs.map((_, i) => i),
    [scopeIdx, configs],
  );
  const visibleConfigs = useMemo(() => visibleIdx.map((i) => configs[i]).filter(Boolean), [visibleIdx, configs]);
  const payerIds = useMemo(
    () => visibleConfigs.map((c) => c?.customerId).filter(Boolean) as string[],
    [visibleConfigs],
  );
  /** Quem pode receber serviço: os clientes DISTINTOS do orçamento inteiro. */
  const serviceCustomerIds = useMemo(() => distinctPayerCustomerIds(configs), [configs]);
  const showSplit = existingVehicles.length > 1 || vehicleCount > 1;
  const validServiceRows = useMemo(
    () =>
      services
        .map((service, index) => ({ service, index }))
        .filter(({ service }) => validServicesOf([service]).length > 0),
    [services],
  );
  const payerOptions = useMemo(
    () =>
      serviceCustomerIds.map((customerId) => {
        const record = customersCache.current.get(customerId);
        const config = configs.find((c) => c?.customerId === customerId);
        return {
          value: customerId,
          label: record?.fantasyName || record?.corporateName || config?.customerData?.fantasyName || "Cliente",
        };
      }),
    [serviceCustomerIds, configs, customersCache],
  );

  return (
    <div className="space-y-4">
      {showSplit && (
        <WizardSection
          icon={<IconReceipt2 className="h-5 w-5" />}
          title="Como faturar os veículos"
          description="Uma fatura para todos, uma por veículo, ou em lotes."
        >
          <BillingSplitField
            vehicles={existingVehicles}
            vehicleCount={vehicleCount}
            value={(billingSplit ?? "JOINT") as BillingSplitValue}
            groups={billingGroups}
            disabled={disabled}
            approvedCount={approvedBillingCount}
            warnSignature={warnSignature}
            onChange={({ billingSplit: nextSplit, billingGroups: nextGroups }) => {
              setValue("billingSplit", nextSplit, { shouldDirty: true });
              setValue("billingGroups", nextGroups, { shouldDirty: true });
            }}
          />
        </WizardSection>
      )}

      {visibleIdx.map((index, position) => {
        const config = configs[index];
        if (!config) return null;
        return (
          <BudgetPayerCard
            // ⚠️ A chave é a FATURA (id), não o cliente: numa cobrança veículo a
            // veículo o mesmo cliente está em N pagadores.
            key={config?.id || `${config?.customerId || "novo"}-${index}`}
            configIndex={index}
            title={`Pagador ${position + 1}`}
            record={config?.customerId ? customersCache.current.get(config.customerId) ?? null : null}
            takenCustomerIds={payerIds.filter((id) => id !== config?.customerId)}
            onSwapCustomer={(record) => handleSwap(index, record)}
            onRemove={visibleIdx.length > 1 ? () => handleRemove(index) : undefined}
            customersCache={customersCache}
            disabled={disabled}
            quoteId={quoteId}
            vehicleCount={vehicleCount}
            coverage={
              showCoverage
                ? { vehicles: existingVehicles, coveredIds: (config?.taskIds as string[] | undefined) ?? [] }
                : undefined
            }
          />
        );
      })}

      {adding || visibleIdx.length === 0 ? (
        <div className="space-y-2 rounded-lg border border-dashed border-border p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">
              {visibleIdx.length > 0 ? "Novo pagador" : scopeIdx ? "Quem paga esta cobrança?" : "Quem paga este orçamento?"}
            </p>
            {visibleIdx.length > 0 && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setAdding(false)} className="gap-1">
                <IconX className="h-4 w-4" />
                Cancelar
              </Button>
            )}
          </div>
          <PayerCustomerCombobox
            value={null}
            onSelect={handleAdd}
            takenCustomerIds={payerIds}
            customersCache={customersCache}
            disabled={disabled}
            queryKey="budget-payer-new"
          />
        </div>
      ) : (
        <Button type="button" variant="outline" className="w-full gap-2" onClick={() => setAdding(true)} disabled={disabled}>
          <IconPlus className="h-4 w-4" />
          Adicionar pagador
        </Button>
      )}

      {serviceCustomerIds.length > 1 && validServiceRows.length > 0 && (
        <WizardSection
          icon={<IconListCheck className="h-5 w-5" />}
          title="Quem paga cada serviço"
          description="Com mais de um pagador, todo serviço precisa de um — senão o valor dele não entra em fatura nenhuma."
        >
          <div className="divide-y divide-border rounded-lg border border-border">
            {validServiceRows.map(({ service, index }) => {
              const assigned =
                service.invoiceToCustomerId && serviceCustomerIds.includes(service.invoiceToCustomerId);
              return (
                <div key={service.id ?? index} className="flex flex-wrap items-center gap-3 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{service.description}</p>
                    {service.amount != null && (
                      <p className="text-xs text-muted-foreground">{formatCurrency(Number(service.amount) || 0)} por veículo</p>
                    )}
                  </div>
                  <div className="w-full sm:w-64">
                    <Combobox
                      value={assigned ? service.invoiceToCustomerId : ""}
                      onValueChange={(value) =>
                        setValue(`services.${index}.invoiceToCustomerId`, typeof value === "string" && value ? value : null, {
                          shouldDirty: true,
                        })
                      }
                      options={payerOptions}
                      placeholder="Faturar para..."
                      searchable={false}
                      clearable={false}
                      disabled={disabled}
                      triggerClassName={assigned ? undefined : "border-amber-400"}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </WizardSection>
      )}
    </div>
  );
}
