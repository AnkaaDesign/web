import { useMemo, useCallback } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Combobox } from "@/components/ui/combobox";
import { QuoteStatusBadge } from "@/components/production/task/quote/quote-status-badge";
import { formatCurrency, formatDate, formatChassis, formatCNPJ, formatCPF } from "@/utils";
import { TRUCK_CATEGORY_LABELS, IMPLEMENT_TYPE_LABELS } from "@/constants/enum-labels";
import type { TRUCK_CATEGORY, IMPLEMENT_TYPE } from "@/constants/enums";
import { generatePaymentText } from "@/utils/quote-text-generators";
import { BoletoActions } from "@/components/production/task/billing/boleto-actions";
import { NfseStatusBadge } from "@/components/production/task/billing/nfse-status-badge";
import { NfseActions } from "@/components/production/task/billing/nfse-actions";
import { NfseEnrichedInfo } from "@/components/production/task/billing/nfse-enriched-info";
import { SECTOR_PRIVILEGES } from "@/constants";
import { canUpdateQuoteStatus } from "@/utils/permissions/quote-permissions";
import type { Invoice } from "@/types/invoice";
import type { TASK_QUOTE_STATUS } from "@/types/task-quote";
import { IconFileInvoice, IconCurrencyReal, IconBuilding, IconTruck, IconCreditCard, IconReceipt, IconDownload, IconEye, IconLoader2, IconFolderCheck, IconCameraCheck, IconCameraBolt, IconExternalLink } from "@tabler/icons-react";
import { cn, getApiBaseUrl } from "@/lib/utils";
import { useState } from "react";
import { invoiceService } from "@/api-client/invoice";
import { nfseService } from "@/api-client/nfse";
import { SERVICE_ORDER_TYPE } from "@/constants/enums";
import { useFileViewer } from "@/components/common/file";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { useNavigate } from "react-router-dom";
import { routes } from "@/constants";
import { exportDossiePdf } from "@/utils/dossie-pdf-generator";

const STATUSES_REQUIRING_COMPLETE_DATA = ["COMMERCIAL_APPROVED", "BILLING_APPROVED"];

// All statuses — automatic ones are shown (so current value displays) but disabled
const ALL_STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "PENDING", label: "Pendente" },
  { value: "BUDGET_APPROVED", label: "Orçamento Aprovado" },
  { value: "COMMERCIAL_APPROVED", label: "Aprovado pelo Comercial" },
  { value: "BILLING_APPROVED", label: "Faturamento Aprovado" },
  { value: "UPCOMING", label: "A Vencer" },
  { value: "DUE", label: "Vencido" },
  { value: "PARTIAL", label: "Parcial" },
  { value: "SETTLED", label: "Liquidado" },
];

// Statuses that are set automatically and cannot be manually selected
const AUTOMATIC_STATUSES = ["UPCOMING", "DUE", "PARTIAL"];

const getStatusTriggerClass = (status: string) => {
  const map: Record<string, string> = {
    PENDING: "bg-neutral-500 text-white hover:bg-neutral-600 border-neutral-600",
    BUDGET_APPROVED: "bg-green-700 text-white hover:bg-green-800 border-green-800",
    COMMERCIAL_APPROVED: "bg-blue-700 text-white hover:bg-blue-800 border-blue-800",
    BILLING_APPROVED: "bg-green-700 text-white hover:bg-green-800 border-green-800",
    UPCOMING: "bg-amber-600 text-white hover:bg-amber-700 border-amber-700",
    DUE: "bg-red-600 text-white hover:bg-red-700 border-red-700",
    PARTIAL: "bg-blue-700 text-white hover:bg-blue-800 border-blue-800",
    SETTLED: "bg-green-700 text-white hover:bg-green-800 border-green-800",
  };
  return map[status] || "";
};

interface BillingStepReviewProps {
  task: any;
  customersCache: React.MutableRefObject<Map<string, any>>;
  invoices?: Invoice[];
  userPrivilege?: string;
  disabled?: boolean;
  isGenerating?: boolean;
  /** When set, filters to show only this customer's data */
  filterCustomerId?: string;
}

export function BillingStepReview({ task, customersCache, invoices = [], userPrivilege = "", disabled, isGenerating = false, filterCustomerId }: BillingStepReviewProps) {
  const navigate = useNavigate();
  const { control, setValue } = useFormContext();
  const currentStatus = useWatch({ control, name: "status" }) || "";
  const services = useWatch({ control, name: "services" }) || [];
  const customerConfigs = useWatch({ control, name: "customerConfigs" }) || [];

  // File viewer for dossiê images
  let fileViewerContext: ReturnType<typeof useFileViewer> | null = null;
  try {
    fileViewerContext = useFileViewer();
  } catch {
    // Context not available
  }

  const handleDossieFileClick = useCallback((file: any) => {
    if (!fileViewerContext || !task?.serviceOrders) return;
    const productionSOs = (task.serviceOrders as any[])
      .filter((so) => so.type === SERVICE_ORDER_TYPE.PRODUCTION && (so.checkinFiles?.length > 0 || so.checkoutFiles?.length > 0))
      .sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0));
    const allFiles: any[] = [];
    for (const so of productionSOs) {
      const checkin = so.checkinFiles || [];
      const checkout = so.checkoutFiles || [];
      const maxLen = Math.max(checkin.length, checkout.length);
      for (let i = 0; i < maxLen; i++) {
        if (i < checkin.length) allFiles.push(checkin[i]);
        if (i < checkout.length) allFiles.push(checkout[i]);
      }
    }
    const index = allFiles.findIndex((f: any) => f.id === file.id);
    fileViewerContext.actions.viewFiles(allFiles, index >= 0 ? index : 0);
  }, [fileViewerContext, task?.serviceOrders]);

  const allValidServices = useMemo(
    () => services.filter((s: any) => s.description?.trim()),
    [services],
  );

  // Filter by selected customer when filterCustomerId is set
  const validServices = useMemo(() => {
    if (!filterCustomerId) return allValidServices;
    return allValidServices.filter((s: any) => s.invoiceToCustomerId === filterCustomerId || !s.invoiceToCustomerId);
  }, [allValidServices, filterCustomerId]);

  const filteredCustomerConfigs = useMemo(() => {
    if (!filterCustomerId) return customerConfigs;
    return customerConfigs.filter((c: any) => c.customerId === filterCustomerId);
  }, [customerConfigs, filterCustomerId]);

  const filteredInvoices = useMemo(() => {
    if (!filterCustomerId) return invoices;
    return invoices.filter((inv: any) => inv.customerId === filterCustomerId);
  }, [invoices, filterCustomerId]);

  const subtotal = validServices.reduce((sum: number, s: any) => sum + (Number(s?.amount) || 0), 0);
  const totalFromConfigs = customerConfigs.reduce((sum: number, c: any) => sum + (Number(c?.total) || 0), 0);
  const total = totalFromConfigs || subtotal;
  const discountAmount = Math.max(0, subtotal - total);

  const hasMultipleCustomers = !filterCustomerId && customerConfigs.length >= 2;

  // Group services by customer for multi-customer view
  const customerGroups = useMemo(() => {
    if (!hasMultipleCustomers) return null;
    const groups = new Map<string, { name: string; services: any[] }>();
    // Initialize groups from all customerConfigs so every customer appears
    for (const config of customerConfigs) {
      const cached = customersCache.current.get(config.customerId);
      const name = config.customerData?.corporateName || config.customerData?.fantasyName || cached?.corporateName || cached?.fantasyName || "Sem cliente";
      groups.set(config.customerId, { name, services: [] });
    }
    // Assign valid services to their customer group
    for (const svc of validServices) {
      const customerId = svc.invoiceToCustomerId || "__unassigned__";
      if (groups.has(customerId)) {
        groups.get(customerId)!.services.push(svc);
      } else {
        const cached = customersCache.current.get(customerId);
        const name = cached?.corporateName || cached?.fantasyName || "Sem cliente";
        groups.set(customerId, { name, services: [svc] });
      }
    }
    return groups;
  }, [hasMultipleCustomers, validServices, customersCache, customerConfigs]);

  const canChangeStatus = canUpdateQuoteStatus(userPrivilege);

  // Compute paid/total installment counts for PARTIAL badge
  const installmentCounts = useMemo(() => {
    let paid = 0;
    let total = 0;
    for (const inv of filteredInvoices) {
      const insts = (inv as any).installments || [];
      for (const inst of insts) {
        if (inst.status !== 'CANCELLED') {
          total++;
          if (inst.status === 'PAID') paid++;
        }
      }
    }
    return { paid, total };
  }, [invoices]);

  // Validate customer data completeness for statuses that require it
  const validateCustomerDataForStatus = useCallback((targetStatus: string): boolean => {
    if (!STATUSES_REQUIRING_COMPLETE_DATA.includes(targetStatus)) return true;

    for (let i = 0; i < customerConfigs.length; i++) {
      const config = customerConfigs[i];
      const data = config.customerData || {};
      const errors: string[] = [];
      if (!data.cnpj && !data.cpf) errors.push("CNPJ ou CPF");
      if (!data.fantasyName?.trim()) errors.push("Nome Fantasia");
      if (!data.corporateName?.trim()) errors.push("Razão Social");
      if (!data.zipCode?.trim()) errors.push("CEP");
      if (!data.city?.trim()) errors.push("Cidade");
      if (!data.state?.trim()) errors.push("Estado");
      if (!data.address?.trim()) errors.push("Logradouro");
      if (!data.addressNumber?.trim()) errors.push("Número");
      if (!data.neighborhood?.trim()) errors.push("Bairro");
      if (!config.paymentCondition && !(config.paymentConfig as any)?.type) errors.push("Condição de Pagamento");
      if (errors.length > 0) {
        const name = data.fantasyName || data.corporateName || `Cliente ${i + 1}`;
        toast.error(`${name} — campos obrigatórios não preenchidos`, {
          description: errors.join(", "),
        });
        return false;
      }
    }

    // Multi-customer: all services must have invoiceToCustomerId
    if (customerConfigs.length >= 2) {
      const unassigned = validServices.filter((s: any) => !s.invoiceToCustomerId);
      if (unassigned.length > 0) {
        toast.error("Serviços sem cliente atribuído", {
          description: "Todos os serviços devem ter um cliente selecionado em 'Faturar Para'",
        });
        return false;
      }
    }

    return true;
  }, [customerConfigs, validServices]);

  return (
    <div className="space-y-6">
      {/* Generation progress banner */}
      {isGenerating && (
        <div className="flex items-center gap-3 rounded-lg border border-blue-500/30 bg-blue-500/10 p-4">
          <IconLoader2 className="h-5 w-5 animate-spin text-blue-500 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-blue-500">Gerando faturas, boletos e NFS-e...</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Aguarde enquanto os documentos são processados. Esta página será atualizada automaticamente.
            </p>
          </div>
        </div>
      )}

      {/* Task Info Summary — with inline status */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <IconTruck className="h-4 w-4 text-muted-foreground" />
              Resumo da Tarefa
            </CardTitle>
            <div className="flex items-center gap-2">
            {task?.id && (
              <Button
                variant="outline"
                size="default"
                onClick={() => navigate(
                  task.status === "COMPLETED" || task.status === "CANCELLED"
                    ? routes.production.history.details(task.id)
                    : routes.production.preparation.details(task.id)
                )}
                className="gap-1.5 h-9"
              >
                <IconExternalLink className="h-3.5 w-3.5" />
                Ver Tarefa
              </Button>
            )}
            {canChangeStatus ? (
              <Combobox
                value={currentStatus}
                onValueChange={(v) => {
                  if (v && typeof v === "string") {
                    if (!validateCustomerDataForStatus(v)) return;
                    setValue("status", v, { shouldDirty: true });
                  }
                }}
                options={ALL_STATUS_OPTIONS.map((s) => ({
                  ...s,
                  disabled: s.value === currentStatus
                    || AUTOMATIC_STATUSES.includes(s.value)
                    || (userPrivilege === SECTOR_PRIVILEGES.COMMERCIAL && s.value === "BILLING_APPROVED")
                    || (userPrivilege === SECTOR_PRIVILEGES.FINANCIAL && s.value === "COMMERCIAL_APPROVED")
                    || (s.value === "BILLING_APPROVED" && currentStatus !== "COMMERCIAL_APPROVED"),
                }))}
                searchable={false}
                clearable={false}
                disabled={disabled}
                className="w-[240px]"
                triggerClassName={cn("font-medium", getStatusTriggerClass(currentStatus))}
              />
            ) : (
              <QuoteStatusBadge
                status={currentStatus as TASK_QUOTE_STATUS}
                size="lg"
                paidCount={installmentCounts.paid}
                totalCount={installmentCounts.total}
              />
            )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5">
              <span className="text-sm text-muted-foreground">Logomarca</span>
              <span className="text-sm font-medium">{task.name}</span>
            </div>
            {task.customer && (
              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5">
                <span className="text-sm text-muted-foreground">Cliente</span>
                <span className="text-sm font-medium">{task.customer.corporateName || task.customer.fantasyName}</span>
              </div>
            )}
            {task.truck?.plate && (
              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5">
                <span className="text-sm text-muted-foreground">Placa</span>
                <span className="text-sm font-medium">{task.truck.plate}</span>
              </div>
            )}
            {task.serialNumber && (
              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5">
                <span className="text-sm text-muted-foreground">Nº de Série</span>
                <span className="text-sm font-medium">{task.serialNumber}</span>
              </div>
            )}
            {task.truck?.chassisNumber && (
              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5">
                <span className="text-sm text-muted-foreground">Chassi</span>
                <span className="text-sm font-medium">{formatChassis(task.truck.chassisNumber)}</span>
              </div>
            )}
            {task.truck?.category && (
              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5">
                <span className="text-sm text-muted-foreground">Categoria</span>
                <span className="text-sm font-medium">{TRUCK_CATEGORY_LABELS[task.truck.category as TRUCK_CATEGORY] || task.truck.category}</span>
              </div>
            )}
            {task.truck?.implementType && (
              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5">
                <span className="text-sm text-muted-foreground">Implemento</span>
                <span className="text-sm font-medium">{IMPLEMENT_TYPE_LABELS[task.truck.implementType as IMPLEMENT_TYPE] || task.truck.implementType}</span>
              </div>
            )}
            {task.finishedAt && (
              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5">
                <span className="text-sm text-muted-foreground">Finalizado em</span>
                <span className="text-sm font-medium">{formatDate(task.finishedAt)}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Services Summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <IconCurrencyReal className="h-4 w-4 text-muted-foreground" />
            Serviços ({validServices.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Services table - grouped by customer or flat */}
          {(() => {
            if (hasMultipleCustomers && customerGroups) {
              return (
                <div className="grid grid-cols-1 md:grid-cols-2 items-stretch gap-3">
                  {Array.from(customerGroups.entries()).map(([customerId, group], groupIndex) => {
                    const config = customerConfigs.find((c: any) => c.customerId === customerId);
                    const groupSubtotal = group.services.reduce((sum: number, s: any) => sum + (Number(s?.amount) || 0), 0);
                    const groupTotal = config?.total != null ? Number(config.total) : groupSubtotal;

                    return (
                      <div key={customerId} className="border border-border rounded-lg overflow-hidden">
                        <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/40 border-b border-border">
                          <IconBuilding className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-semibold">
                            <span className="text-muted-foreground font-medium">Cliente {groupIndex + 1}:</span>{" "}
                            {group.name}
                          </span>
                          <span className="text-xs text-muted-foreground ml-auto">
                            {formatCurrency(groupTotal)}
                          </span>
                        </div>
                        <table className="w-full">
                          <thead className="bg-muted/50">
                            <tr>
                              <th className="px-4 py-2.5 text-left text-sm font-semibold text-muted-foreground">Descrição</th>
                              <th className="px-4 py-2.5 text-right text-sm font-semibold text-muted-foreground w-28">Valor</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {group.services.map((svc: any, idx: number) => (
                              <ServiceTableRow key={idx} service={svc} />
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  })}
                </div>
              );
            }

            // Single customer - flat table
            return (
              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-sm font-semibold text-muted-foreground">Descrição</th>
                      <th className="px-4 py-2.5 text-right text-sm font-semibold text-muted-foreground w-32">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {validServices.map((svc: any, idx: number) => (
                      <ServiceTableRow key={idx} service={svc} />
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()}

          {/* Totals */}
          <div className="bg-muted/20 border border-border rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium">{formatCurrency(subtotal)}</span>
            </div>
            {discountAmount > 0 && (() => {
              const firstConfig = customerConfigs[0];
              let label = 'Desconto';
              if (firstConfig?.discountType === 'PERCENTAGE' && firstConfig?.discountValue) {
                label = `Desconto (${firstConfig.discountValue}%)`;
              }
              if (firstConfig?.discountReference) {
                label += ` — ${firstConfig.discountReference}`;
              }
              return (
                <div className="flex items-center justify-between text-sm text-destructive">
                  <span>{label}</span>
                  <span className="font-medium">- {formatCurrency(discountAmount)}</span>
                </div>
              );
            })()}
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <span className="text-base font-bold">TOTAL</span>
              <span className="text-xl font-bold text-primary">{formatCurrency(total)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Per-Customer Summary Cards */}
      {customerConfigs.length > 0 && (
        <div className={filteredCustomerConfigs.length >= 2 ? "grid grid-cols-1 lg:grid-cols-2 gap-4" : "space-y-4"}>
          {filteredCustomerConfigs.map((config: any, _i: number) => {
            const cached = customersCache.current.get(config.customerId);
            const name = config.customerData?.corporateName || config.customerData?.fantasyName || cached?.corporateName || cached?.fantasyName || "Cliente";
            const configTotal = Number(config.total) || 0;
            const paymentText = generatePaymentText({
              customPaymentText: config.customPaymentText,
              paymentCondition: config.paymentCondition,

              total: configTotal,
            });

            // Validate NFS-e data
            const data = config.customerData || {};
            const hasCnpj = !!data.cnpj || !!data.cpf;
            const hasAddress = !!data.city && !!data.state && !!data.address;
            const isComplete = hasCnpj && hasAddress && !!data.corporateName;

            const docLabel = data.cnpj ? "CNPJ" : data.cpf ? "CPF" : "Documento";
            const docValue = data.cnpj ? formatCNPJ(data.cnpj) : data.cpf ? formatCPF(data.cpf) : "-";
            const addressValue = data.address
              ? `${data.address}, ${data.addressNumber || "s/n"} - ${data.neighborhood ? data.neighborhood + ", " : ""}${data.city}/${data.state}`
              : "-";

            return (
              <Card key={config.customerId}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <IconBuilding className="h-4 w-4 text-muted-foreground" />
                    {name}
                    {!isComplete && (
                      <Badge variant="destructive" className="text-xs">Dados incompletos</Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5">
                      <span className="text-sm text-muted-foreground">Razão Social</span>
                      <span className="text-sm font-medium">{data.corporateName || "-"}</span>
                    </div>
                    <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5">
                      <span className="text-sm text-muted-foreground">{docLabel}</span>
                      <span className="text-sm font-medium">{docValue}</span>
                    </div>
                    {data.stateRegistration && (
                      <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5">
                        <span className="text-sm text-muted-foreground">Inscrição Estadual</span>
                        <span className="text-sm font-medium">{data.stateRegistration}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5">
                      <span className="text-sm text-muted-foreground">Endereço</span>
                      <span className="text-sm font-medium text-right max-w-[60%]">
                        {addressValue}{data.zipCode ? ` - CEP: ${data.zipCode}` : ""}
                      </span>
                    </div>
                    <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5">
                      <span className="text-sm text-muted-foreground font-bold">Total</span>
                      <span className="text-sm font-bold text-primary">{formatCurrency(configTotal)}</span>
                    </div>
                    {paymentText && (
                      <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5">
                        <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                          <IconCreditCard className="h-3.5 w-3.5" />
                          Pagamento
                        </span>
                        <span className="text-sm font-medium text-right max-w-[60%]">{paymentText}</span>
                      </div>
                    )}
                    {config.orderNumber && (
                      <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5">
                        <span className="text-sm text-muted-foreground">N° do Pedido</span>
                        <span className="text-sm font-medium">{config.orderNumber}</span>
                      </div>
                    )}
                  </div>

                  {/* Installments / NFS-e */}
                  {(() => {
                    const configInvoice = invoices.find((inv) => inv.customerConfigId === config.id);
                    if (!configInvoice) return null;

                    const installments = configInvoice.installments
                      ? [...configInvoice.installments].sort((a: any, b: any) => a.number - b.number)
                      : [];
                    const nfseDocuments = (configInvoice as any).nfseDocuments ?? [];
                    // Current NFSe: AUTHORIZED > PROCESSING > PENDING > ERROR (priority order)
                    const activeNfse = nfseDocuments.find((d: any) => d.status === "AUTHORIZED")
                      ?? nfseDocuments.find((d: any) => d.status === "PROCESSING")
                      ?? nfseDocuments.find((d: any) => d.status === "PENDING")
                      ?? nfseDocuments.find((d: any) => d.status === "ERROR")
                      ?? null;
                    const canceledNfses = nfseDocuments.filter((d: any) => d.status === "CANCELLED");

                    return (
                      <div className="mt-4 space-y-3">
                        {/* Parcelas */}
                        {installments.length > 0 && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm font-semibold">
                              <div className="flex items-center gap-2">
                                <IconReceipt className="h-3.5 w-3.5 text-muted-foreground" />
                                Parcelas
                              </div>
                              <DownloadAllBoletosButton installments={installments} />
                            </div>
                            <div className="divide-y divide-border/50 rounded-md border border-border/50 overflow-hidden">
                              {installments.map((installment: any) => (
                                <div key={installment.id} className="px-3 py-2 hover:bg-muted/40 transition-colors">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3 flex-1 min-w-0 flex-wrap">
                                      <span className="text-xs text-muted-foreground">
                                        {formatDate(installment.dueDate)}
                                      </span>
                                      <span className="text-xs font-medium">
                                        {formatCurrency(installment.amount)}
                                      </span>
                                      <UnifiedInstallmentBadge installment={installment} />
                                    </div>
                                    <BoletoActions
                                      installmentId={installment.id}
                                      bankSlip={installment.bankSlip}
                                      dueDate={installment.dueDate}
                                      installmentStatus={installment.status}
                                      installmentPaymentMethod={installment.paymentMethod}
                                      receiptFile={installment.receiptFile}
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* NFS-e */}
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm font-semibold">
                            <IconFileInvoice className="h-3.5 w-3.5 text-muted-foreground" />
                            NFS-e
                          </div>
                          {/* Active/Current NFS-e with cancel button inline */}
                          {activeNfse && (
                            <div className="rounded-md border border-border/50 px-3 py-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <NfseStatusBadge status={activeNfse.status} size="sm" />
                                </div>
                                <div className="flex items-center gap-1">
                                  {activeNfse.elotechNfseId && (
                                    <NfsePdfButtons elotechNfseId={activeNfse.elotechNfseId} />
                                  )}
                                  {/* Cancel button — only for authorized NFSe */}
                                  {activeNfse.status === 'AUTHORIZED' && (
                                    <NfseActions invoiceId={configInvoice.id} nfseDocuments={nfseDocuments} />
                                  )}
                                </div>
                              </div>
                              {activeNfse.elotechNfseId && (
                                <NfseEnrichedInfo elotechNfseId={activeNfse.elotechNfseId} />
                              )}
                              {activeNfse.status === 'ERROR' && activeNfse.errorMessage && (
                                <p className="text-xs text-destructive mt-1">{activeNfse.errorMessage}</p>
                              )}
                            </div>
                          )}
                          {/* No NFS-e at all — show emit button */}
                          {!activeNfse && canceledNfses.length === 0 && (
                            <div className="rounded-md border border-border/50 px-3 py-2 flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">Nao emitida</span>
                              <NfseActions invoiceId={configInvoice.id} nfseDocuments={nfseDocuments} />
                            </div>
                          )}
                          {/* Canceled NFS-e entries — with reemit button on the last one */}
                          {canceledNfses.map((doc: any, idx: number) => (
                            <div
                              key={doc.id}
                              className="rounded-md border border-border/50 px-3 py-2 cursor-pointer hover:bg-muted/30 transition-colors"
                              onClick={() => doc.elotechNfseId && navigate(routes.financial.nfse.detail(doc.elotechNfseId))}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <NfseStatusBadge status={doc.status} size="sm" />
                                </div>
                                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                  {doc.elotechNfseId && (
                                    <NfsePdfButtons elotechNfseId={doc.elotechNfseId} />
                                  )}
                                  {/* Reemit button — only on last cancelled when no active NFSe */}
                                  {!activeNfse && idx === canceledNfses.length - 1 && (
                                    <NfseActions invoiceId={configInvoice.id} nfseDocuments={nfseDocuments} />
                                  )}
                                </div>
                              </div>
                              {doc.elotechNfseId && (
                                <NfseEnrichedInfo elotechNfseId={doc.elotechNfseId} />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dossiê — Proof of services with check-in/check-out photos */}
      {(() => {
        const serviceOrdersWithFiles = (task.serviceOrders || [])
          .filter((so: any) => so.type === SERVICE_ORDER_TYPE.PRODUCTION && (so.checkinFiles?.length > 0 || so.checkoutFiles?.length > 0))
          .sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0));

        if (serviceOrdersWithFiles.length === 0) return null;

        const totalDossieFiles = serviceOrdersWithFiles.reduce(
          (sum: number, so: any) => sum + (so.checkinFiles?.length || 0) + (so.checkoutFiles?.length || 0), 0
        );

        const apiUrl = getApiBaseUrl();

        return (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <IconFolderCheck className="h-4 w-4 text-muted-foreground" />
                  Dossiê
                  <Badge variant="secondary" className="ml-1">
                    {totalDossieFiles} {totalDossieFiles === 1 ? 'foto' : 'fotos'}
                  </Badge>
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1.5"
                  onClick={() => {
                    try {
                      const taskDisplayName = [task.name, task.serialNumber || task.truck?.plate].filter(Boolean).join(" - ");
                      exportDossiePdf({
                        taskDisplayName,
                        customerName: task.customer?.fantasyName || task.customer?.corporateName,
                        serialNumber: task.serialNumber,
                        plate: task.truck?.plate,
                        serviceOrders: serviceOrdersWithFiles,
                      });
                    } catch (err: any) {
                      toast.error(err?.message || "Erro ao gerar dossiê");
                    }
                  }}
                >
                  <IconDownload className="h-3.5 w-3.5" />
                  Baixar PDF
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Registro fotográfico dos serviços por ordem de serviço
              </p>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-3 gap-4">
                {serviceOrdersWithFiles.map((serviceOrder: any) => {
                  const isOutrosWithObservation = serviceOrder.description === 'Outros' && !!serviceOrder.observation;
                  const displayDescription = isOutrosWithObservation ? serviceOrder.observation : serviceOrder.description;
                  const checkinFiles = serviceOrder.checkinFiles || [];
                  const checkoutFiles = serviceOrder.checkoutFiles || [];

                  return (
                    <div key={serviceOrder.id} className="border border-border/30 rounded-lg overflow-hidden">
                      {/* Service Order Header */}
                      <div className="bg-muted/30 px-3 py-2 flex items-center gap-2 border-b border-border/30">
                        <h4 className="text-xs font-semibold truncate">{displayDescription}</h4>
                        {!isOutrosWithObservation && serviceOrder.observation && (
                          <span className="text-[11px] text-muted-foreground truncate" title={serviceOrder.observation}>
                            — {serviceOrder.observation}
                          </span>
                        )}
                      </div>

                      {/* Antes / Depois Content */}
                      <div className="px-3 py-3 space-y-5">
                        {/* Antes */}
                        <div className="space-y-2">
                          <div className="flex items-center gap-1.5">
                            <IconCameraCheck className="h-4 w-4 text-blue-500" />
                            <span className="text-xs font-medium">Antes</span>
                            <span className="text-[11px] text-muted-foreground">{checkinFiles.length}</span>
                          </div>
                          {checkinFiles.length > 0 ? (
                            <div className="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-2">
                              {checkinFiles.map((file: any) => {
                                const src = file.thumbnailUrl
                                  ? (file.thumbnailUrl.startsWith('/api') ? `${apiUrl}${file.thumbnailUrl}` : file.thumbnailUrl)
                                  : `${apiUrl}/files/thumbnail/${file.id}`;
                                return (
                                  <button
                                    key={file.id}
                                    onClick={() => handleDossieFileClick(file)}
                                    className="relative aspect-square rounded overflow-hidden border border-border/30 bg-muted hover:opacity-80 transition-opacity cursor-pointer"
                                  >
                                    <img
                                      src={src}
                                      alt={file.originalName || file.filename}
                                      className="w-full h-full object-cover"
                                    />
                                  </button>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="text-[11px] text-muted-foreground italic">Nenhuma foto</p>
                          )}
                        </div>

                        {/* Depois */}
                        <div className="space-y-2">
                          <div className="flex items-center gap-1.5">
                            <IconCameraBolt className="h-4 w-4 text-green-500" />
                            <span className="text-xs font-medium">Depois</span>
                            <span className="text-[11px] text-muted-foreground">{checkoutFiles.length}</span>
                          </div>
                          {checkoutFiles.length > 0 ? (
                            <div className="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-2">
                              {checkoutFiles.map((file: any) => {
                                const src = file.thumbnailUrl
                                  ? (file.thumbnailUrl.startsWith('/api') ? `${apiUrl}${file.thumbnailUrl}` : file.thumbnailUrl)
                                  : `${apiUrl}/files/thumbnail/${file.id}`;
                                return (
                                  <button
                                    key={file.id}
                                    onClick={() => handleDossieFileClick(file)}
                                    className="relative aspect-square rounded overflow-hidden border border-border/30 bg-muted hover:opacity-80 transition-opacity cursor-pointer"
                                  >
                                    <img
                                      src={src}
                                      alt={file.originalName || file.filename}
                                      className="w-full h-full object-cover"
                                    />
                                  </button>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="text-[11px] text-muted-foreground italic">Nenhuma foto</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })()}

    </div>
  );
}

// =====================
// Unified Installment Badge
// =====================

function getPaymentMethodLabel(bankSlip: any, installment?: any): string {
  // Check installment paymentMethod first (more reliable)
  const instMethod = installment?.paymentMethod;
  if (instMethod === 'BANK_SLIP') return 'Paga (Boleto)';
  if (instMethod === 'PIX') return 'Paga (PIX)';
  if (instMethod === 'CASH') return 'Paga (Dinheiro)';
  if (instMethod === 'TRANSFER') return 'Paga (Transferência)';
  if (instMethod === 'OTHER') return 'Paga (Outro)';
  if (instMethod) return `Paga (${instMethod})`;

  // Fallback to bankSlip sicrediStatus
  const method = bankSlip?.sicrediStatus;
  if (method === 'PAID_PIX') return 'Paga (PIX)';
  if (method === 'PAID_CASH') return 'Paga (Dinheiro)';
  if (method === 'PAID_TRANSFER') return 'Paga (Transferência)';
  if (method?.startsWith('PAID_')) return 'Paga (por fora)';
  return 'Paga (Boleto)';
}

function UnifiedInstallmentBadge({ installment }: { installment: any }) {
  const bankSlip = installment.bankSlip;

  // Paid (by bank slip or externally)
  if (installment.status === 'PAID') {
    return (
      <Badge variant="green" size="sm" className="font-medium whitespace-nowrap">
        {getPaymentMethodLabel(bankSlip, installment)}
      </Badge>
    );
  }

  // Bank slip error/rejected — blocking
  if (bankSlip && ['ERROR', 'REJECTED'].includes(bankSlip.status)) {
    return <Badge variant="destructive" size="sm" className="font-medium whitespace-nowrap">Erro</Badge>;
  }

  // Overdue
  if (installment.status === 'OVERDUE' || bankSlip?.status === 'OVERDUE') {
    return <Badge variant="destructive" size="sm" className="font-medium whitespace-nowrap">Vencida</Badge>;
  }

  // Cancelled
  if (installment.status === 'CANCELLED') {
    return <Badge variant="cancelled" size="sm" className="font-medium whitespace-nowrap">Cancelada</Badge>;
  }

  // Bank slip cancelled but installment not paid — cancelled
  if (bankSlip?.status === 'CANCELLED') {
    return <Badge variant="cancelled" size="sm" className="font-medium whitespace-nowrap">Cancelado</Badge>;
  }

  // Active bank slip
  if (bankSlip?.status === 'ACTIVE') {
    return <Badge variant="processing" size="sm" className="font-medium whitespace-nowrap">Aberto</Badge>;
  }

  // Creating/registering
  if (bankSlip && ['CREATING', 'REGISTERING'].includes(bankSlip.status)) {
    return <Badge variant="processing" size="sm" className="font-medium whitespace-nowrap">Processando</Badge>;
  }

  // Default: pending
  return <Badge variant="pending" size="sm" className="font-medium whitespace-nowrap">Pendente</Badge>;
}

// =====================
// Service Table Row
// =====================

function ServiceTableRow({ service }: { service: any }) {
  const amount = typeof service.amount === "number" ? service.amount : Number(service.amount) || 0;
  const isOutrosWithObservation = service.description === "Outros" && !!service.observation;
  const displayDescription = isOutrosWithObservation ? service.observation : service.description;

  return (
    <tr className="hover:bg-muted/30 transition-colors">
      <td className="px-4 py-1.5 text-sm align-middle">
        <div>
          <span>
            {displayDescription}
            {!isOutrosWithObservation && service.observation && (
              <span className="text-muted-foreground italic"> — {service.observation}</span>
            )}
          </span>
        </div>
      </td>
      <td className="px-4 py-1.5 text-sm text-right font-medium align-middle">
        {formatCurrency(amount)}
      </td>
    </tr>
  );
}

function DownloadAllBoletosButton({ installments }: { installments: any[] }) {
  const [isDownloading, setIsDownloading] = useState(false);

  const downloadable = installments.filter(
    (inst) => inst.bankSlip && (inst.bankSlip.status === 'ACTIVE' || inst.bankSlip.status === 'OVERDUE'),
  );

  if (downloadable.length < 2) return null;

  const handleDownloadAll = async () => {
    setIsDownloading(true);
    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();

      for (const inst of downloadable) {
        const res = await invoiceService.getBoletoPdf(inst.id);
        const blob = res.data instanceof Blob
          ? res.data
          : new Blob([res.data], { type: 'application/pdf' });
        zip.file(`boleto-parcela-${inst.number}.pdf`, blob);
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `boletos.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // silently fail
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleDownloadAll}
      disabled={isDownloading}
      title="Baixar todos os boletos"
      className="h-7 px-2 text-xs gap-1"
    >
      {isDownloading ? (
        <IconLoader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <IconDownload className="h-3.5 w-3.5" />
      )}
      Baixar todos
    </Button>
  );
}

function NfsePdfButtons({ elotechNfseId }: { elotechNfseId: number }) {
  const [isViewing, setIsViewing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const fetchPdf = async () => {
    const res = await nfseService.getPdf(elotechNfseId);
    return res.data instanceof Blob
      ? res.data
      : new Blob([res.data], { type: 'application/pdf' });
  };

  const handleView = async () => {
    setIsViewing(true);
    try {
      const blob = await fetchPdf();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch {
      // silently fail
    } finally {
      setIsViewing(false);
    }
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const blob = await fetchPdf();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nfse-${elotechNfseId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // silently fail
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleView}
        disabled={isViewing}
        title="Visualizar NFS-e"
        className="h-7 w-7 p-0"
      >
        {isViewing ? (
          <IconLoader2 className="h-4 w-4 animate-spin" />
        ) : (
          <IconEye className="h-4 w-4" />
        )}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleDownload}
        disabled={isDownloading}
        title="Baixar NFS-e"
        className="h-7 w-7 p-0"
      >
        {isDownloading ? (
          <IconLoader2 className="h-4 w-4 animate-spin" />
        ) : (
          <IconDownload className="h-4 w-4" />
        )}
      </Button>
    </>
  );
}
