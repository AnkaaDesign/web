import { useMemo } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CustomerLogoDisplay } from "@/components/ui/avatar-display";
import {
  IconFileInvoice,
  IconBuilding,
  IconNote,
  IconTruck,
  IconCreditCard,
  IconCalendar,
  IconReceipt,
  IconShieldCheck,
  IconPhoto,
} from "@tabler/icons-react";
import { formatCurrency } from "../../../../../utils";
import {
  computeServiceDiscount,
  computeServiceNet,
} from "../../../../../utils/task-quote-calculations";
import { DISCOUNT_TYPE_LABELS } from "@/constants/enum-labels";
import { generatePaymentText, generateGuaranteeText } from "@/utils/quote-text-generators";
import { getApiBaseUrl } from "@/config/api";

interface QuoteStepReviewProps {
  disabled?: boolean;
  existingQuote?: any;
  userRole?: string;
  selectedCustomers: Map<string, any>;
  onStatusChange?: (status: string) => void;
  layoutFiles?: Array<{ thumbnailUrl?: string; uploadedFileId?: string; id?: string }>;
}

export function QuoteStepReview({
  disabled,
  existingQuote,
  userRole,
  selectedCustomers,
  onStatusChange,
  layoutFiles,
}: QuoteStepReviewProps) {
  const { control } = useFormContext();

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

  const validServices = useMemo(
    () => (services || []).filter((s: any) => s.description?.trim()),
    [services],
  );

  const hasMultipleCustomers =
    Array.isArray(customerConfigs) && customerConfigs.length >= 2;

  // Group services by customer for multi-customer view
  const customerGroups = useMemo(() => {
    if (!hasMultipleCustomers) return null;
    const groups = new Map<string, { name: string; services: any[] }>();
    for (const svc of validServices) {
      const customerId = svc.invoiceToCustomerId || "__unassigned__";
      const customer = selectedCustomers.get(customerId);
      const name = customer?.fantasyName || customer?.corporateName || "Sem cliente";
      if (!groups.has(customerId)) {
        groups.set(customerId, { name, services: [] });
      }
      groups.get(customerId)!.services.push(svc);
    }
    return groups;
  }, [hasMultipleCustomers, validServices, selectedCustomers]);

  // Compute totals
  const displaySubtotal = subtotalValue || 0;
  const displayTotal = totalValue || 0;
  const discountAmount = Math.max(0, displaySubtotal - displayTotal);

  const formatDate = (date: any) => {
    if (!date) return "-";
    const d = new Date(date);
    return d.toLocaleDateString("pt-BR");
  };

  return (
    <Card className="border flex flex-col">
      <CardHeader className="pb-6">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <IconFileInvoice className="h-5 w-5 text-muted-foreground" />
            Resumo do Orçamento
          </CardTitle>
        </div>
      </CardHeader>

      <CardContent className="pt-0 flex-1">
        <div className="space-y-4">
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
            // Multi-customer grouped layout
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
                                (sum: number, s: any) =>
                                  sum +
                                  (typeof s.amount === "number"
                                    ? s.amount
                                    : Number(s.amount) || 0),
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

            // Single customer / flat table
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
                    {validServices.map((svc: any, idx: number) => (
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

          {/* Per-Customer Config Cards */}
          {Array.isArray(customerConfigs) && customerConfigs.length > 0 && (() => {
            const configs =
              customerConfigs.length >= 2 ? customerConfigs : [];
            if (configs.length === 0) return null;

            return (
              <div className="grid grid-cols-1 md:grid-cols-2 items-stretch gap-3">
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
                  const configDiscountAmount = Math.max(
                    0,
                    configSubtotal - configTotal,
                  );
                  const configPaymentText = generatePaymentText({
                    customPaymentText: config.customPaymentText,
                    paymentCondition: config.paymentCondition,
                    downPaymentDate: config.downPaymentDate,
                    total: configTotal,
                  });

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
                        <span className="text-muted-foreground font-medium">Cliente {i + 1}:</span>
                        {customer?.corporateName ||
                          customer?.fantasyName ||
                          "Cliente"}
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Subtotal</span>
                        <span className="font-medium">
                          {formatCurrency(configSubtotal)}
                        </span>
                      </div>

                      {configDiscountAmount > 0 && (
                        <div className="flex items-center justify-between text-sm text-destructive">
                          <span>Desconto (serviços)</span>
                          <span className="font-medium">
                            - {formatCurrency(configDiscountAmount)}
                          </span>
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-2 border-t border-border dark:border-border/30">
                        <span className="text-sm font-bold text-foreground">
                          Total
                        </span>
                        <span className="text-base font-bold text-primary">
                          {formatCurrency(configTotal)}
                        </span>
                      </div>

                      {configPaymentText && (
                        <div className="pt-2">
                          <div className="flex items-center gap-2 text-sm font-semibold text-foreground mb-1">
                            <IconCreditCard className="h-4 w-4 text-muted-foreground" />
                            Condições de Pagamento
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {configPaymentText}
                          </p>
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
            (() => {
              const config = customerConfigs[0];
              const configTotal =
                typeof config.total === "number"
                  ? config.total
                  : Number(config.total) || 0;
              const paymentText = generatePaymentText({
                customPaymentText: config.customPaymentText,
                paymentCondition: config.paymentCondition,
                downPaymentDate: config.downPaymentDate,
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
          {(customForecastDays ||
            (simultaneousTasks && simultaneousTasks > 1)) && (
            <div className="bg-muted/30 rounded-lg p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground mb-2">
                <IconTruck className="h-4 w-4 text-muted-foreground" />
                Prazo de Entrega
              </div>
              <p className="text-sm text-muted-foreground">
                {customForecastDays && (
                  <>
                    O prazo de entrega é de {customForecastDays} dias úteis a
                    partir da data de liberação.
                  </>
                )}
                {simultaneousTasks && simultaneousTasks > 1 && (
                  <>
                    {customForecastDays ? " " : ""}Capacidade de produção:{" "}
                    {simultaneousTasks} tarefas simultâneas.
                  </>
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
                {generateGuaranteeText({
                  guaranteeYears,
                  customGuaranteeText,
                })}
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
      </CardContent>
    </Card>
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
