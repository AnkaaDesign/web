import { useMemo, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { CustomerLogoDisplay } from "@/components/ui/avatar-display";
import { QuoteStatusBadge } from "@/components/production/task/quote/quote-status-badge";
import {
  IconFileInvoice,
  IconBuilding,
  IconTruck,
  IconCreditCard,
  IconCalendar,
  IconReceipt,
  IconShieldCheck,
  IconPhoto,
  IconExternalLink,
} from "@tabler/icons-react";
import { formatCurrency, formatDate, formatChassis } from "@/utils";
import {
  computeServiceDiscount,
  computeServiceNet,
} from "@/utils/task-quote-calculations";
import { DISCOUNT_TYPE_LABELS } from "@/constants/enum-labels";
import { generatePaymentText, generateGuaranteeText } from "@/utils/quote-text-generators";
import { getApiBaseUrl } from "@/config/api";
import { routes } from "@/constants";
import { canUpdateQuoteStatus } from "@/utils/permissions/quote-permissions";
import { cn } from "@/lib/utils";
import type { TASK_QUOTE_STATUS } from "@/types/task-quote";

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "PENDING", label: "Pendente" },
  { value: "BUDGET_APPROVED", label: "Orçamento Aprovado" },
];

const getStatusTriggerClass = (status: string) => {
  const map: Record<string, string> = {
    PENDING: "bg-neutral-500 text-white hover:bg-neutral-600 border-neutral-600",
    BUDGET_APPROVED: "bg-green-700 text-white hover:bg-green-800 border-green-800",
  };
  return map[status] || "";
};

interface BudgetStepReviewProps {
  task?: any;
  disabled?: boolean;
  existingQuote?: any;
  userRole?: string;
  selectedCustomers: Map<string, any>;
  onStatusChange?: (status: string) => void;
  layoutFiles?: Array<{ thumbnailUrl?: string; uploadedFileId?: string; id?: string }>;
}

export function BudgetStepReview({
  task,
  existingQuote,
  userRole = "",
  selectedCustomers,
  onStatusChange,
  layoutFiles,
  disabled,
}: BudgetStepReviewProps) {
  const navigate = useNavigate();
  const { control, setValue } = useFormContext();

  const currentStatus = useWatch({ control, name: "status" }) || "";
  const services = useWatch({ control, name: "services" });
  const customerConfigs = useWatch({ control, name: "customerConfigs" });
  const guaranteeYears = useWatch({ control, name: "guaranteeYears" });
  const customGuaranteeText = useWatch({ control, name: "customGuaranteeText" });
  const customForecastDays = useWatch({ control, name: "customForecastDays" });
  const simultaneousTasks = useWatch({ control, name: "simultaneousTasks" });
  const subtotalValue = useWatch({ control, name: "subtotal" });
  const totalValue = useWatch({ control, name: "total" });
  const expiresAt = useWatch({ control, name: "expiresAt" });
  const layoutFileId = useWatch({ control, name: "layoutFileId" });

  const [customerFilter, setCustomerFilter] = useState<string>("all");

  const validServices = useMemo(
    () => (services || []).filter((s: any) => s.description?.trim()),
    [services],
  );

  const hasMultipleCustomers =
    Array.isArray(customerConfigs) && customerConfigs.length >= 2;

  // Customer filter options for multi-customer
  const customerFilterOptions = useMemo(() => {
    if (!hasMultipleCustomers) return [];
    const options = [{ value: "all", label: "Completo" }];
    (customerConfigs || []).forEach((config: any, i: number) => {
      const customer = selectedCustomers.get(config.customerId);
      const name = customer?.corporateName || customer?.fantasyName || `Cliente ${i + 1}`;
      options.push({ value: config.customerId, label: `Cliente ${i + 1}: ${name}` });
    });
    return options;
  }, [hasMultipleCustomers, customerConfigs, selectedCustomers]);

  // Filter services based on selected customer
  const filteredServices = useMemo(() => {
    if (customerFilter === "all" || !hasMultipleCustomers) return validServices;
    return validServices.filter((s: any) => s.invoiceToCustomerId === customerFilter);
  }, [validServices, customerFilter, hasMultipleCustomers]);

  // Group services by customer for multi-customer view
  const customerGroups = useMemo(() => {
    if (!hasMultipleCustomers || customerFilter !== "all") return null;
    const groups = new Map<string, { name: string; services: any[] }>();
    // Use customerConfigs order for consistent numbering
    for (const config of customerConfigs || []) {
      const customer = selectedCustomers.get(config.customerId);
      const name = customer?.fantasyName || customer?.corporateName || "Sem cliente";
      groups.set(config.customerId, { name, services: [] });
    }
    for (const svc of validServices) {
      const customerId = svc.invoiceToCustomerId || "__unassigned__";
      if (groups.has(customerId)) {
        groups.get(customerId)!.services.push(svc);
      }
    }
    return groups;
  }, [hasMultipleCustomers, validServices, selectedCustomers, customerConfigs, customerFilter]);

  // Compute totals based on filter
  const { displaySubtotal, displayTotal, discountAmount } = useMemo(() => {
    if (customerFilter === "all" || !hasMultipleCustomers) {
      const sub = subtotalValue || 0;
      const tot = totalValue || 0;
      return { displaySubtotal: sub, displayTotal: tot, discountAmount: Math.max(0, sub - tot) };
    }
    const config = (customerConfigs || []).find((c: any) => c.customerId === customerFilter);
    if (config) {
      const sub = typeof config.subtotal === "number" ? config.subtotal : Number(config.subtotal) || 0;
      const tot = typeof config.total === "number" ? config.total : Number(config.total) || 0;
      return { displaySubtotal: sub, displayTotal: tot, discountAmount: Math.max(0, sub - tot) };
    }
    return { displaySubtotal: 0, displayTotal: 0, discountAmount: 0 };
  }, [customerFilter, hasMultipleCustomers, subtotalValue, totalValue, customerConfigs]);

  const canChangeStatus = canUpdateQuoteStatus(userRole);

  // Public budget URL
  const publicBudgetUrl = existingQuote?.id && task?.customer?.id
    ? routes.customer.budget(task.customer.id, existingQuote.id)
    : null;

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
            <div className="flex items-center gap-2">
              {publicBudgetUrl && (
                <Button
                  variant="outline"
                  size="default"
                  onClick={() => window.open(publicBudgetUrl, "_blank")}
                  className="gap-1.5 h-9"
                >
                  <IconExternalLink className="h-3.5 w-3.5" />
                  Visualizar
                </Button>
              )}
              {canChangeStatus ? (
                <Combobox
                  value={currentStatus}
                  onValueChange={(v) => {
                    if (v && typeof v === "string") {
                      setValue("status", v, { shouldDirty: true });
                      onStatusChange?.(v);
                    }
                  }}
                  options={STATUS_OPTIONS.map((s) => ({
                    ...s,
                    disabled: s.value === currentStatus,
                  }))}
                  searchable={false}
                  clearable={false}
                  disabled={disabled}
                  className="w-[220px]"
                  triggerClassName={cn("font-medium h-9", getStatusTriggerClass(currentStatus))}
                />
              ) : (
                <QuoteStatusBadge status={currentStatus as TASK_QUOTE_STATUS} size="lg" />
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {task?.name && (
              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5">
                <span className="text-sm text-muted-foreground">Logomarca</span>
                <span className="text-sm font-medium">{task.name}</span>
              </div>
            )}
            {task?.customer && (
              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5">
                <span className="text-sm text-muted-foreground">Cliente</span>
                <span className="text-sm font-medium">{task.customer.corporateName || task.customer.fantasyName}</span>
              </div>
            )}
            {task?.truck?.plate && (
              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5">
                <span className="text-sm text-muted-foreground">Placa</span>
                <span className="text-sm font-medium">{task.truck.plate}</span>
              </div>
            )}
            {task?.serialNumber && (
              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5">
                <span className="text-sm text-muted-foreground">Nº de Série</span>
                <span className="text-sm font-medium">{task.serialNumber}</span>
              </div>
            )}
            {task?.truck?.chassisNumber && (
              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5">
                <span className="text-sm text-muted-foreground">Chassi</span>
                <span className="text-sm font-mono font-medium">{formatChassis(task.truck.chassisNumber)}</span>
              </div>
            )}
            {task?.finishedAt && (
              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5">
                <span className="text-sm text-muted-foreground">Finalizado em</span>
                <span className="text-sm font-medium">{formatDate(task.finishedAt)}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Services */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <IconFileInvoice className="h-5 w-5 text-muted-foreground" />
              Serviços ({filteredServices.length})
            </CardTitle>
            {hasMultipleCustomers && (
              <Combobox
                value={customerFilter}
                onValueChange={(v) => setCustomerFilter(String(v ?? "all"))}
                options={customerFilterOptions}
                searchable={false}
                clearable={false}
                className="w-[240px]"
              />
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Budget Number and Validity */}
          <div className="flex flex-wrap gap-3">
            {existingQuote?.budgetNumber && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/30 rounded-lg p-3">
                <IconReceipt className="h-4 w-4" />
                <span>
                  Orçamento Nº:{" "}
                  <span className="font-medium text-foreground">
                    {String(existingQuote.budgetNumber).padStart(4, "0")}
                  </span>
                </span>
              </div>
            )}
            {expiresAt && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/30 rounded-lg p-3">
                <IconCalendar className="h-4 w-4" />
                <span>
                  Validade:{" "}
                  <span className="font-medium text-foreground">
                    {formatDate(expiresAt)}
                  </span>
                </span>
              </div>
            )}
          </div>

          {/* Services Table */}
          {(() => {
            // Multi-customer grouped layout (only when filter is "all")
            if (hasMultipleCustomers && customerGroups) {
              return (
                <div className="grid grid-cols-1 md:grid-cols-2 items-stretch gap-3">
                  {Array.from(customerGroups.entries()).map(
                    ([customerId, group], groupIndex) => (
                      <div
                        key={customerId}
                        className="border border-border dark:border-border/30 rounded-lg overflow-hidden"
                      >
                        <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/40 border-b border-border dark:border-border/30">
                          <IconBuilding className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-semibold">
                            <span className="text-muted-foreground font-medium">Cliente {groupIndex + 1}:</span>{" "}
                            {group.name}
                          </span>
                          <span className="text-xs text-muted-foreground ml-auto">
                            {formatCurrency(
                              group.services.reduce(
                                (sum: number, s: any) => sum + computeServiceNet(s || {}),
                                0,
                              ),
                            )}
                          </span>
                        </div>
                        <div>
                          <table className="w-full">
                            <thead className="bg-muted/50">
                              <tr>
                                <th className="px-4 py-2.5 text-left text-sm font-semibold text-muted-foreground">
                                  Descrição
                                </th>
                                <th className="px-4 py-2.5 text-right text-sm font-semibold text-muted-foreground w-28">
                                  Valor
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border dark:divide-border/30">
                              {group.services.map((svc: any, idx: number) => (
                                <ServiceTableRow key={idx} service={svc} />
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ),
                  )}
                </div>
              );
            }

            // Single customer / filtered / flat table
            return (
              <div className="border border-border dark:border-border/30 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">
                        Descrição
                      </th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-muted-foreground w-32">
                        Valor
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border dark:divide-border/30">
                    {filteredServices.map((svc: any, idx: number) => (
                      <ServiceTableRow key={idx} service={svc} />
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()}

          {/* Pricing Summary */}
          <div className="bg-muted/20 border border-border dark:border-border/30 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium">
                {formatCurrency(displaySubtotal)}
              </span>
            </div>

            {discountAmount > 0 && (
              <div className="flex items-center justify-between text-sm text-destructive">
                <span>Desconto (serviços)</span>
                <span className="font-medium">
                  - {formatCurrency(discountAmount)}
                </span>
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-border dark:border-border/30">
              <span className="text-base font-bold text-foreground">TOTAL</span>
              <span className="text-xl font-bold text-primary">
                {formatCurrency(displayTotal)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Per-Customer Config Cards */}
      {Array.isArray(customerConfigs) && customerConfigs.length > 0 && (() => {
        const configs = customerFilter !== "all"
          ? (customerConfigs || []).filter((c: any) => c.customerId === customerFilter)
          : customerConfigs.length >= 2 ? customerConfigs : [];
        if (configs.length === 0 && customerFilter === "all") return null;

        // Single customer payment (when only 1 config and filter is "all")
        if (configs.length === 0 && customerFilter !== "all") return null;

        return (
          <div className={configs.length >= 2 ? "grid grid-cols-1 md:grid-cols-2 items-stretch gap-3" : "space-y-3"}>
            {configs.map((config: any, i: number) => {
              const customer = selectedCustomers.get(config.customerId);
              const configSubtotal =
                typeof config.subtotal === "number"
                  ? config.subtotal
                  : Number(config.subtotal) || 0;
              const configTotal =
                typeof config.total === "number"
                  ? config.total
                  : Number(config.total) || 0;
              const configDiscountAmount = Math.max(0, configSubtotal - configTotal);
              const configPaymentText = generatePaymentText({
                customPaymentText: config.customPaymentText,
                paymentCondition: config.paymentCondition,
                total: configTotal,
              });

              // Find original index for consistent numbering
              const originalIndex = (customerConfigs || []).findIndex((c: any) => c.customerId === config.customerId);

              return (
                <div
                  key={config.customerId || i}
                  className="bg-muted/30 rounded-lg p-4 space-y-2 flex flex-col"
                >
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    {customer && (
                      <CustomerLogoDisplay
                        logo={customer.logo}
                        customerName={customer.fantasyName}
                        size="xs"
                        shape="rounded"
                      />
                    )}
                    {!customer && (
                      <IconBuilding className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="text-muted-foreground font-medium">Cliente {originalIndex + 1}:</span>
                    {customer?.corporateName || customer?.fantasyName || "Cliente"}
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-medium">{formatCurrency(configSubtotal)}</span>
                  </div>

                  {configDiscountAmount > 0 && (
                    <div className="flex items-center justify-between text-sm text-destructive">
                      <span>Desconto (serviços)</span>
                      <span className="font-medium">- {formatCurrency(configDiscountAmount)}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-border dark:border-border/30">
                    <span className="text-sm font-bold text-foreground">Total</span>
                    <span className="text-base font-bold text-primary">{formatCurrency(configTotal)}</span>
                  </div>

                  {configPaymentText && (
                    <div className="pt-2">
                      <div className="flex items-center gap-2 text-sm font-semibold text-foreground mb-1">
                        <IconCreditCard className="h-4 w-4 text-muted-foreground" />
                        Condições de Pagamento
                      </div>
                      <p className="text-sm text-muted-foreground">{configPaymentText}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* Single customer: payment conditions */}
      {Array.isArray(customerConfigs) &&
        customerConfigs.length === 1 &&
        customerFilter === "all" &&
        (() => {
          const config = customerConfigs[0];
          const configTotal = typeof config.total === "number" ? config.total : Number(config.total) || 0;
          const paymentText = generatePaymentText({
            customPaymentText: config.customPaymentText,
            paymentCondition: config.paymentCondition,
            total: configTotal,
          });
          if (!paymentText) return null;
          return (
            <div className="bg-muted/30 rounded-lg p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground mb-2">
                <IconCreditCard className="h-4 w-4 text-muted-foreground" />
                Condições de Pagamento
              </div>
              <p className="text-sm text-muted-foreground">{paymentText}</p>
            </div>
          );
        })()}

      {/* Delivery Deadline */}
      {(customForecastDays || (simultaneousTasks && simultaneousTasks > 1)) && (
        <div className="bg-muted/30 rounded-lg p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground mb-2">
            <IconTruck className="h-4 w-4 text-muted-foreground" />
            Prazo de Entrega
          </div>
          <p className="text-sm text-muted-foreground">
            {customForecastDays && (
              <>O prazo de entrega é de {customForecastDays} dias úteis a partir da data de liberação.</>
            )}
            {simultaneousTasks && simultaneousTasks > 1 && (
              <>{customForecastDays ? " " : ""}Capacidade de produção: {simultaneousTasks} tarefas simultâneas.</>
            )}
          </p>
        </div>
      )}

      {/* Guarantee */}
      {(guaranteeYears || customGuaranteeText) && (
        <div className="bg-muted/30 rounded-lg p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground mb-2">
            <IconShieldCheck className="h-4 w-4 text-muted-foreground" />
            Garantia
          </div>
          <p className="text-sm text-muted-foreground">
            {generateGuaranteeText({ guaranteeYears, customGuaranteeText })}
          </p>
        </div>
      )}

      {/* Layout Preview */}
      {(() => {
        const layoutFile = layoutFiles?.[0];
        const thumbnailSrc = layoutFileId
          ? `${getApiBaseUrl()}/files/thumbnail/${layoutFileId}`
          : layoutFile?.thumbnailUrl || (layoutFile?.uploadedFileId ? `${getApiBaseUrl()}/files/thumbnail/${layoutFile.uploadedFileId}` : null);
        if (!thumbnailSrc) return null;
        return (
          <div className="bg-muted/30 rounded-lg p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
              <IconPhoto className="h-4 w-4 text-muted-foreground" />
              Layout
            </div>
            <img
              src={thumbnailSrc}
              alt="Layout aprovado"
              className="max-h-48 rounded-lg shadow-sm object-contain"
            />
          </div>
        );
      })()}
    </div>
  );
}

// =====================
// Service Table Row
// =====================

function ServiceTableRow({ service }: { service: any }) {
  const amount =
    typeof service.amount === "number"
      ? service.amount
      : Number(service.amount) || 0;
  const discount = computeServiceDiscount(
    amount,
    service.discountType,
    service.discountValue,
  );
  const net = computeServiceNet({
    amount,
    discountType: service.discountType,
    discountValue: service.discountValue,
  });
  const isOutrosWithObservation =
    service.description === "Outros" && !!service.observation;
  const displayDescription = isOutrosWithObservation
    ? service.observation
    : service.description;

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
              {service.discountReference &&
                ` — ${service.discountReference}`}
            </p>
          )}
        </div>
      </td>
      <td className="px-4 py-1.5 text-sm text-right font-medium align-middle">
        {discount > 0 ? (
          <div>
            <p className="text-xs text-muted-foreground line-through leading-tight">
              {formatCurrency(amount)}
            </p>
            <p>{formatCurrency(net)}</p>
          </div>
        ) : (
          formatCurrency(amount)
        )}
      </td>
    </tr>
  );
}
