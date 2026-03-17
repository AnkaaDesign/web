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
import { computeServiceNet, computeCustomerConfigTotals } from "@/utils/task-quote-calculations";
import { DISCOUNT_TYPE, DISCOUNT_TYPE_LABELS, SERVICE_ORDER_TYPE } from "@/constants";
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

  // Discount type options
  const discountTypeOptions = Object.entries(DISCOUNT_TYPE_LABELS).map(([value, label]) => ({
    value,
    label,
  }));

  // Add new service row
  const handleAddItem = useCallback(() => {
    append({
      description: "",
      observation: null,
      amount: 0,
      invoiceToCustomerId: customerConfigs.length === 1 ? customerConfigs[0].customerId : null,
      discountType: "NONE",
      discountValue: null,
      discountReference: null,
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
      const result = computeCustomerConfigTotals(currentServices, config.customerId, isSingle);
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
              ? "grid-cols-[minmax(80px,1fr)_minmax(90px,1fr)_180px_180px_180px_minmax(100px,1fr)_36px]"
              : "grid-cols-[minmax(100px,1fr)_180px_180px_180px_minmax(100px,1fr)_36px]"
          }`}>
            <span className="px-2">Descrição</span>
            {hasMultipleCustomers && <span className="px-2">Cliente</span>}
            <span className="px-2">Valor</span>
            <span className="px-2">Desconto</span>
            <span className="px-2">Valor Desc.</span>
            <span className="px-2">Ref. Desconto</span>
            <span />
          </div>

          {/* Service rows */}
          {fields.map((field, index) => {
            const service = services[index];
            const discountType = service?.discountType || "NONE";

            return (
              <div
                key={field.id}
                className={`grid gap-2 items-center ${
                  hasMultipleCustomers
                    ? "grid-cols-[minmax(80px,1fr)_minmax(90px,1fr)_180px_180px_180px_minmax(100px,1fr)_36px]"
                    : "grid-cols-[minmax(100px,1fr)_180px_180px_180px_minmax(100px,1fr)_36px]"
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

                {/* Discount Type */}
                <Combobox
                  value={discountType}
                  onValueChange={(v) => {
                    const newType = String(v || "NONE");
                    setFormValue(`services.${index}.discountType`, newType, { shouldDirty: true });
                    if (newType === "NONE") {
                      setFormValue(`services.${index}.discountValue`, null, { shouldDirty: true });
                      setFormValue(`services.${index}.discountReference`, null, { shouldDirty: true });
                    }
                    setTimeout(recalculateTotals, 0);
                  }}
                  options={discountTypeOptions}
                  searchable={false}
                  clearable={false}
                  disabled={disabled}
                  className="h-9"
                />

                {/* Discount Value */}
                <Input
                  type={discountType === "PERCENTAGE" ? "number" : "currency"}
                  value={service?.discountValue || 0}
                  onChange={(val) => {
                    setFormValue(`services.${index}.discountValue`, val, { shouldDirty: true });
                    setTimeout(recalculateTotals, 0);
                  }}
                  disabled={disabled || discountType === "NONE"}
                  placeholder={discountType === "PERCENTAGE" ? "%" : "R$ 0,00"}
                  className="h-9"
                  {...(discountType === "PERCENTAGE" ? { min: 0, max: 100 } : {})}
                />

                {/* Discount Reference */}
                <Input
                  value={service?.discountReference || ""}
                  onChange={(e) => {
                    const val = typeof e === "string" ? e : e?.target?.value || "";
                    setFormValue(`services.${index}.discountReference`, val || null, { shouldDirty: true });
                  }}
                  disabled={disabled || discountType === "NONE"}
                  placeholder="Referência"
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

          {/* Totals */}
          <div className="bg-muted/20 border border-border rounded-lg p-4 space-y-2 mt-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium">
                {formatCurrency(services.reduce((sum: number, s: any) => sum + (Number(s?.amount) || 0), 0))}
              </span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <span className="text-base font-bold">TOTAL</span>
              <span className="text-xl font-bold text-primary">
                {formatCurrency(services.reduce((sum: number, s: any) => sum + computeServiceNet(s || {}), 0))}
              </span>
            </div>
          </div>
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
