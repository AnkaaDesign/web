import { useMemo, useCallback } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Combobox } from "@/components/ui/combobox";
import { Label } from "@/components/ui/label";
import { QuoteStatusBadge } from "@/components/production/task/quote/quote-status-badge";
import { formatCurrency, formatDate, formatChassis, formatCNPJ, formatCPF } from "@/utils";
import { computeServiceDiscount, computeServiceNet } from "@/utils/task-quote-calculations";
import { generatePaymentText } from "@/utils/quote-text-generators";
import { DISCOUNT_TYPE_LABELS } from "@/constants/enum-labels";
import { InstallmentStatusBadge } from "@/components/production/task/billing/installment-status-badge";
import { BankSlipStatusBadge } from "@/components/production/task/billing/bank-slip-status-badge";
import { BoletoActions } from "@/components/production/task/billing/boleto-actions";
import { NfseStatusBadge } from "@/components/production/task/billing/nfse-status-badge";
import { NfseActions } from "@/components/production/task/billing/nfse-actions";
import { NfseEnrichedInfo } from "@/components/production/task/billing/nfse-enriched-info";
import { SECTOR_PRIVILEGES } from "@/constants";
import { canUpdateQuoteStatus } from "@/utils/permissions/quote-permissions";
import type { Invoice } from "@/types/invoice";
import type { TASK_QUOTE_STATUS } from "@/types/task-quote";
import { IconFileInvoice, IconCurrencyReal, IconBuilding, IconTruck, IconCreditCard, IconReceipt, IconDownload, IconEye, IconLoader2 } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { invoiceService } from "@/api-client/invoice";
import { nfseService } from "@/api-client/nfse";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";

const STATUSES_REQUIRING_COMPLETE_DATA = ["VERIFIED_BY_FINANCIAL", "BILLING_APPROVED"];

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "PENDING", label: "Pendente" },
  { value: "BUDGET_APPROVED", label: "Orçamento Aprovado" },
  { value: "VERIFIED_BY_FINANCIAL", label: "Verificado pelo Financeiro" },
  { value: "BILLING_APPROVED", label: "Faturamento Aprovado" },
  { value: "UPCOMING", label: "A Vencer" },
  { value: "DUE", label: "Vencido" },
  { value: "PARTIAL", label: "Parcial" },
  { value: "SETTLED", label: "Liquidado" },
];

const getStatusTriggerClass = (status: string) => {
  const map: Record<string, string> = {
    PENDING: "bg-neutral-500 text-white hover:bg-neutral-600 border-neutral-600",
    BUDGET_APPROVED: "bg-green-700 text-white hover:bg-green-800 border-green-800",
    VERIFIED_BY_FINANCIAL: "bg-blue-700 text-white hover:bg-blue-800 border-blue-800",
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
}

export function BillingStepReview({ task, customersCache, invoices = [], userPrivilege = "", disabled }: BillingStepReviewProps) {
  const { control, setValue } = useFormContext();
  const currentStatus = useWatch({ control, name: "status" }) || "";
  const services = useWatch({ control, name: "services" }) || [];
  const customerConfigs = useWatch({ control, name: "customerConfigs" }) || [];

  const validServices = useMemo(
    () => services.filter((s: any) => s.description?.trim()),
    [services],
  );
  const subtotal = validServices.reduce((sum: number, s: any) => sum + (Number(s?.amount) || 0), 0);
  const total = validServices.reduce((sum: number, s: any) => sum + computeServiceNet(s || {}), 0);
  const discountAmount = Math.max(0, subtotal - total);

  const hasMultipleCustomers = customerConfigs.length >= 2;

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
      if (!config.paymentCondition) errors.push("Condição de Pagamento");
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
      {/* Task Info Summary — with inline status */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <IconTruck className="h-4 w-4 text-muted-foreground" />
              Resumo da Tarefa
            </CardTitle>
            {canChangeStatus ? (
              <Combobox
                value={currentStatus}
                onValueChange={(v) => {
                  if (v && typeof v === "string") {
                    if (!validateCustomerDataForStatus(v)) return;
                    setValue("status", v, { shouldDirty: true });
                  }
                }}
                options={STATUS_OPTIONS.map((s) => ({
                  ...s,
                  disabled: s.value === currentStatus || (userPrivilege === SECTOR_PRIVILEGES.FINANCIAL && s.value === "BILLING_APPROVED"),
                }))}
                searchable={false}
                clearable={false}
                disabled={disabled}
                className="w-[240px]"
                triggerClassName={cn("font-medium", getStatusTriggerClass(currentStatus))}
              />
            ) : (
              <QuoteStatusBadge status={currentStatus as TASK_QUOTE_STATUS} size="lg" />
            )}
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
                <span className="text-sm font-mono font-medium">{formatChassis(task.truck.chassisNumber)}</span>
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
                    const groupSubtotal = group.services.reduce((sum: number, s: any) => sum + (Number(s?.amount) || 0), 0);
                    const groupTotal = group.services.reduce((sum: number, s: any) => sum + computeServiceNet(s || {}), 0);

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
            {discountAmount > 0 && (
              <div className="flex items-center justify-between text-sm text-destructive">
                <span>Desconto (serviços)</span>
                <span className="font-medium">- {formatCurrency(discountAmount)}</span>
              </div>
            )}
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <span className="text-base font-bold">TOTAL</span>
              <span className="text-xl font-bold text-primary">{formatCurrency(total)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Per-Customer Summary Cards */}
      {customerConfigs.length > 0 && (
        <div className={customerConfigs.length >= 2 ? "grid grid-cols-1 lg:grid-cols-2 gap-4" : "space-y-4"}>
          {customerConfigs.map((config: any, i: number) => {
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
                  </div>

                  {/* Installments / NFS-e */}
                  {(() => {
                    const configInvoice = invoices.find((inv) => inv.customerConfigId === config.id);
                    if (!configInvoice) return null;

                    const installments = configInvoice.installments
                      ? [...configInvoice.installments].sort((a: any, b: any) => a.number - b.number)
                      : [];
                    const nfseDocuments = (configInvoice as any).nfseDocuments ?? [];
                    const activeNfse = nfseDocuments.find((d: any) => d.status === "AUTHORIZED") ?? nfseDocuments[nfseDocuments.length - 1] ?? null;

                    return (
                      <div className="mt-4 space-y-3">
                        {/* Boletos */}
                        {installments.length > 0 && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm font-semibold">
                              <div className="flex items-center gap-2">
                                <IconReceipt className="h-3.5 w-3.5 text-muted-foreground" />
                                Boletos
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
                                      <InstallmentStatusBadge status={installment.status} size="sm" />
                                      {installment.bankSlip && (
                                        <BankSlipStatusBadge status={installment.bankSlip.status} size="sm" />
                                      )}
                                    </div>
                                    <BoletoActions
                                      installmentId={installment.id}
                                      bankSlip={installment.bankSlip}
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
                          <div className="rounded-md border border-border/50 px-3 py-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                {activeNfse ? (
                                  <NfseStatusBadge status={activeNfse.status} size="sm" />
                                ) : (
                                  <span className="text-xs text-muted-foreground">Não emitida</span>
                                )}
                                {nfseDocuments.length > 1 && (
                                  <span className="text-xs text-muted-foreground">
                                    ({nfseDocuments.length} emissões)
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1">
                                {activeNfse?.elotechNfseId && (
                                  <NfsePdfButtons elotechNfseId={activeNfse.elotechNfseId} />
                                )}
                                <NfseActions invoiceId={configInvoice.id} nfseDocuments={nfseDocuments} />
                              </div>
                            </div>
                            {activeNfse?.elotechNfseId && (
                              <NfseEnrichedInfo elotechNfseId={activeNfse.elotechNfseId} />
                            )}
                            {activeNfse?.status === 'ERROR' && activeNfse.errorMessage && (
                              <p className="text-xs text-destructive mt-1">{activeNfse.errorMessage}</p>
                            )}
                          </div>
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
    </div>
  );
}

// =====================
// Service Table Row
// =====================

function ServiceTableRow({ service }: { service: any }) {
  const amount = typeof service.amount === "number" ? service.amount : Number(service.amount) || 0;
  const discount = computeServiceDiscount(amount, service.discountType, service.discountValue);
  const net = computeServiceNet({ amount, discountType: service.discountType, discountValue: service.discountValue });
  const isOutrosWithObservation = service.description === "Outros" && !!service.observation;
  const displayDescription = isOutrosWithObservation ? service.observation : service.description;

  return (
    <tr className="hover:bg-muted/30 transition-colors h-[3.75rem]">
      <td className="px-4 py-1.5 text-sm align-middle">
        <div>
          <span>
            {displayDescription}
            {!isOutrosWithObservation && service.observation && (
              <span className="text-muted-foreground italic"> — {service.observation}</span>
            )}
          </span>
          {discount > 0 && (
            <p className="text-xs text-destructive leading-tight">
              Desconto:{" "}
              {service.discountType === "PERCENTAGE"
                ? `${service.discountValue}%`
                : formatCurrency(discount)}{" "}
              ({DISCOUNT_TYPE_LABELS[service.discountType]})
              {service.discountReference && ` — ${service.discountReference}`}
            </p>
          )}
        </div>
      </td>
      <td className="px-4 py-1.5 text-sm text-right font-medium align-middle">
        {discount > 0 ? (
          <div>
            <p className="text-xs text-muted-foreground line-through leading-tight">{formatCurrency(amount)}</p>
            <p>{formatCurrency(net)}</p>
          </div>
        ) : (
          formatCurrency(amount)
        )}
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
