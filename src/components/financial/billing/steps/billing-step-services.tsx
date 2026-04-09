import { useCallback, useState, useMemo } from "react";
import { useFormContext, useFieldArray, useWatch } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatCurrency } from "@/utils";
import { computeConfigDiscount, computeCustomerConfigTotals } from "@/utils/task-quote-calculations";
import { SERVICE_ORDER_TYPE } from "@/constants/enums";
import { Label } from "@/components/ui/label";
import { ServiceAutocomplete } from "@/components/production/task/form/service-autocomplete";
import { IconPlus, IconTrash, IconNote, IconCurrencyReal, IconAlertTriangle } from "@tabler/icons-react";

interface BillingStepServicesProps {
  disabled?: boolean;
}

export function BillingStepServices({ disabled }: BillingStepServicesProps) {
  const { control, setValue: setFormValue, getValues } = useFormContext();
  const { fields, append, remove } = useFieldArray({ control, name: "services" });
  const services = useWatch({ control, name: "services" }) || [];
  const customerConfigs = useWatch({ control, name: "customerConfigs" }) || [];
  const hasMultipleCustomers = customerConfigs.length >= 2;

  // Observation modal state
  const [observationModal, setObservationModal] = useState<{ index: number; value: string } | null>(null);

  // Customer options for invoice-to combobox
  const customerOptions = useMemo(() => {
    return customerConfigs.map((c: any) => ({
      value: c.customerId,
      label: c.customerData?.corporateName || c.customerData?.fantasyName || c.customerId,
    }));
  }, [customerConfigs]);

  // Add new service row
  const handleAddItem = useCallback(() => {
    append({
      description: "",
      observation: null,
      amount: 0,
      invoiceToCustomerId: customerConfigs.length === 1 ? customerConfigs[0].customerId : null,
    });
  }, [append, customerConfigs]);

  // Recalculate customer config totals when services change
  const recalculateTotals = useCallback(() => {
    const currentServices = getValues("services") || [];
    const currentConfigs = getValues("customerConfigs") || [];
    const isSingle = currentConfigs.length === 1;

    let subtotal = 0;
    let total = 0;

    const updatedConfigs = currentConfigs.map((config: any) => {
      const result = computeCustomerConfigTotals(
        currentServices,
        config.customerId,
        isSingle,
        config.discountType,
        config.discountValue,
      );
      subtotal += result.subtotal;
      total += result.total;
      return { ...config, subtotal: result.subtotal, total: result.total };
    });

    setFormValue("customerConfigs", updatedConfigs, { shouldDirty: false });
    setFormValue("subtotal", subtotal, { shouldDirty: false });
    setFormValue("total", total, { shouldDirty: false });
  }, [getValues, setFormValue]);

  // Validate: any service with amount but no description
  const hasValidationIssue = services.some((s: any) => s.amount > 0 && !s.description?.trim());

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <IconCurrencyReal className="h-4 w-4 text-muted-foreground" />
            Serviços
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {hasValidationIssue && (
            <Alert variant="destructive">
              <IconAlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Existem serviços com valor preenchido mas sem descrição.
              </AlertDescription>
            </Alert>
          )}

          {/* Header */}
          <div className={`grid gap-2 text-xs font-semibold text-muted-foreground uppercase ${
            hasMultipleCustomers
              ? "grid-cols-[minmax(100px,1fr)_minmax(90px,1fr)_180px_36px]"
              : "grid-cols-[minmax(100px,1fr)_180px_36px]"
          }`}>
            <span className="px-2">Descrição</span>
            {hasMultipleCustomers && <span className="px-2">Cliente</span>}
            <span className="px-2">Valor</span>
            <span />
          </div>

          {/* Service rows */}
          {fields.map((field, index) => {
            const service = services[index];

            return (
              <div
                key={field.id}
                className={`grid gap-2 items-center ${
                  hasMultipleCustomers
                    ? "grid-cols-[minmax(100px,1fr)_minmax(90px,1fr)_180px_36px]"
                    : "grid-cols-[minmax(100px,1fr)_180px_36px]"
                }`}
              >
                {/* Description */}
                <div className="flex items-center gap-1 min-w-0">
                  <div className="flex-1 min-w-0 [&>.space-y-2]:space-y-0">
                    <ServiceAutocomplete
                      control={control}
                      name={`services.${index}.description`}
                      disabled={disabled}
                      placeholder="Selecione ou digite"
                      showLabel={false}
                      type={SERVICE_ORDER_TYPE.PRODUCTION}
                      className="w-full h-9"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setObservationModal({ index, value: service?.observation || "" })}
                    className="relative flex items-center justify-center h-9 w-9 rounded border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors flex-shrink-0"
                  >
                    <IconNote className="h-3.5 w-3.5" />
                    {service?.observation && (
                      <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground">
                        !
                      </span>
                    )}
                  </button>
                </div>

                {/* Invoice To Customer */}
                {hasMultipleCustomers && (
                  <Combobox
                    value={service?.invoiceToCustomerId || ""}
                    onValueChange={(v) => {
                      setFormValue(`services.${index}.invoiceToCustomerId`, v || null, { shouldDirty: true });
                      setTimeout(recalculateTotals, 0);
                    }}
                    options={customerOptions}
                    placeholder="Cliente"
                    searchable={false}
                    clearable
                    disabled={disabled}
                    className="h-9"
                  />
                )}

                {/* Amount */}
                <Input
                  type="currency"
                  value={service?.amount || 0}
                  onChange={(val) => {
                    setFormValue(`services.${index}.amount`, val, { shouldDirty: true });
                    setTimeout(recalculateTotals, 0);
                  }}
                  disabled={disabled}
                  className="h-9"
                />

                {/* Remove */}
                {!disabled && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      remove(index);
                      setTimeout(recalculateTotals, 0);
                    }}
                    className="h-9 w-9 text-muted-foreground hover:text-destructive"
                  >
                    <IconTrash className="h-4 w-4" />
                  </Button>
                )}
              </div>
            );
          })}

          {/* Add button */}
          {!disabled && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddItem}
              className="w-full"
            >
              <IconPlus className="h-4 w-4 mr-2" />
              Adicionar Serviço
            </Button>
          )}

          {/* Totals with discount controls per customer config */}
          {customerConfigs.map((config: any, configIndex: number) => {
            const configSubtotal = Number(config?.subtotal) || 0;
            const configTotal = Number(config?.total) || 0;
            const discountType = config?.discountType || "NONE";
            const discountAmount = computeConfigDiscount(configSubtotal, discountType, config?.discountValue);
            const customerName = config?.customerData?.corporateName || config?.customerData?.fantasyName || "";

            const setDiscountField = (field: string, value: any) => {
              const configs = getValues("customerConfigs") || [];
              const updated = configs.map((c: any, i: number) =>
                i === configIndex ? { ...c, [field]: value } : c,
              );
              setFormValue("customerConfigs", updated, { shouldDirty: true });
              setTimeout(recalculateTotals, 0);
            };

            return (
              <div key={config.customerId || configIndex} className="bg-muted/20 border border-border rounded-lg p-4 space-y-3 mt-4">
                {hasMultipleCustomers && (
                  <span className="text-xs font-semibold text-muted-foreground uppercase">
                    {customerName || `Cliente ${configIndex + 1}`}
                  </span>
                )}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium">{formatCurrency(configSubtotal)}</span>
                </div>

                {/* Discount controls */}
                <div className="grid grid-cols-3 gap-3 pt-2 border-t border-border/50">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Desconto</Label>
                    <Combobox
                      value={discountType}
                      onValueChange={(v) => {
                        const newType = String(v || "NONE");
                        setDiscountField("discountType", newType);
                        if (newType === "NONE") {
                          setDiscountField("discountValue", null);
                          setDiscountField("discountReference", null);
                        }
                      }}
                      options={[
                        { value: "NONE", label: "Nenhum" },
                        { value: "PERCENTAGE", label: "Porcentagem" },
                        { value: "FIXED_VALUE", label: "Valor Fixo" },
                      ]}
                      searchable={false}
                      clearable={false}
                      disabled={disabled}
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Valor Desc.</Label>
                    <Input
                      type={discountType === "PERCENTAGE" ? "number" : "currency"}
                      value={config?.discountValue || 0}
                      onChange={(val) => setDiscountField("discountValue", val)}
                      disabled={disabled || discountType === "NONE"}
                      placeholder={discountType === "PERCENTAGE" ? "%" : "R$ 0,00"}
                      className="h-9"
                      {...(discountType === "PERCENTAGE" ? { min: 0, max: 100 } : {})}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Ref. Desconto</Label>
                    <Input
                      value={config?.discountReference || ""}
                      onChange={(val) => setDiscountField("discountReference", val || null)}
                      disabled={disabled || discountType === "NONE"}
                      placeholder="Referência"
                      className="h-9"
                    />
                  </div>
                </div>

                {discountAmount > 0 && (
                  <div className="flex items-center justify-between text-sm text-destructive">
                    <span>Desconto</span>
                    <span className="font-medium">- {formatCurrency(discountAmount)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <span className="text-base font-bold">TOTAL</span>
                  <span className="text-xl font-bold text-primary">{formatCurrency(configTotal)}</span>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Observation Modal */}
      <Dialog open={!!observationModal} onOpenChange={(open) => !open && setObservationModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Observação do Serviço</DialogTitle>
            <DialogDescription>
              Adicione uma observação para este serviço
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={observationModal?.value || ""}
            onChange={(e) => {
              if (observationModal) {
                setObservationModal({ ...observationModal, value: e.target.value });
              }
            }}
            rows={4}
            placeholder="Digite a observação..."
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setObservationModal(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (observationModal) {
                  setFormValue(`services.${observationModal.index}.observation`, observationModal.value || null, { shouldDirty: true });
                  setObservationModal(null);
                }
              }}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
