import { useState, useCallback, useRef, useMemo, useEffect, forwardRef } from "react";
import {
  useFieldArray,
  useFormContext,
  useWatch,
  useController,
} from "react-hook-form";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";

import {
  IconPlus,
  IconTrash,
  IconCurrencyReal,
  IconNote,
  IconListDetails,
} from "@tabler/icons-react";
import { ServiceAutocomplete } from "../../form/service-autocomplete";
import { formatCurrency } from "../../../../../utils";
import { cn } from "@/lib/utils";
import { DISCOUNT_TYPE, SERVICE_ORDER_TYPE } from "@/constants/enums";
import { DISCOUNT_TYPE_LABELS } from "@/constants/enum-labels";
import {
  computeServiceDiscount,
  computeCustomerConfigTotals,
} from "../../../../../utils/task-quote-calculations";
import {
  getQuoteServicesToAddFromServiceOrders,
  type SyncServiceOrder,
} from "../../../../../utils/task-quote-service-order-sync";

interface QuoteStepServicesProps {
  task: any;
  disabled?: boolean;
  selectedCustomers: Map<string, any>;
}

export function QuoteStepServices({
  task,
  disabled,
  selectedCustomers,
}: QuoteStepServicesProps) {
  const { control, setValue, getValues, clearErrors } = useFormContext();
  const lastRowRef = useRef<HTMLDivElement>(null);
  const [syncedOnMount, setSyncedOnMount] = useState(false);

  const { fields, append, remove } = useFieldArray({
    control,
    name: "services",
  });

  const quoteItems = useWatch({ control, name: "services" });
  const watchedCustomerConfigs = useWatch({ control, name: "customerConfigs" });

  // Service order sync on mount
  useEffect(() => {
    if (syncedOnMount || !task) return;
    setSyncedOnMount(true);

    const serviceOrders: SyncServiceOrder[] = (task.serviceOrders || []).filter(
      (so: any) => so.type === SERVICE_ORDER_TYPE.PRODUCTION,
    );
    if (serviceOrders.length === 0) return;

    const currentServices = getValues("services") || [];
    const toAdd = getQuoteServicesToAddFromServiceOrders(
      serviceOrders,
      currentServices,
    );
    if (toAdd.length > 0) {
      toAdd.forEach((svc) => {
        append(
          {
            description: svc.description,
            observation: svc.observation || null,
            amount: svc.amount ?? 0,
            invoiceToCustomerId: null,
            discountType: "NONE",
            discountValue: null,
            discountReference: null,
          },
          { shouldFocus: false },
        );
      });
    }
  }, [task, syncedOnMount, getValues, append]);

  // Auto-calculate per-customer subtotals/totals
  useEffect(() => {
    const configs = watchedCustomerConfigs;
    if (!Array.isArray(configs) || configs.length < 1 || !quoteItems) return;

    const isSingleConfig = configs.length === 1;
    let updated = false;
    const newConfigs = configs.map((config: any) => {
      if (!config?.customerId) return config;
      const { subtotal, total } = computeCustomerConfigTotals(
        quoteItems,
        config.customerId,
        isSingleConfig,
      );
      if (config.subtotal !== subtotal || config.total !== total) {
        updated = true;
        return { ...config, subtotal, total };
      }
      return config;
    });
    if (updated) {
      setValue("customerConfigs", newConfigs, { shouldDirty: false });
    }
  }, [quoteItems, watchedCustomerConfigs, setValue]);

  // Update aggregate subtotal/total
  const subtotal = useMemo(() => {
    if (!quoteItems || quoteItems.length === 0) return 0;
    return quoteItems.reduce(
      (sum: number, item: any) => sum + (Number(item.amount) || 0),
      0,
    );
  }, [quoteItems]);

  const aggregateTotal = useMemo(() => {
    if (
      !Array.isArray(watchedCustomerConfigs) ||
      watchedCustomerConfigs.length === 0
    )
      return subtotal;
    return watchedCustomerConfigs.reduce(
      (sum: number, config: any) =>
        sum + (typeof config?.total === "number" ? config.total : Number(config?.total) || 0),
      0,
    );
  }, [watchedCustomerConfigs, subtotal]);

  useEffect(() => {
    if (quoteItems && quoteItems.length > 0) {
      const configSubtotalSum =
        Array.isArray(watchedCustomerConfigs) && watchedCustomerConfigs.length > 0
          ? watchedCustomerConfigs.reduce(
              (sum: number, c: any) => sum + (Number(c?.subtotal) || 0),
              0,
            )
          : subtotal;
      setValue("subtotal", configSubtotalSum, { shouldDirty: false });
      setValue("total", aggregateTotal, { shouldDirty: false });
    }
  }, [subtotal, aggregateTotal, quoteItems, watchedCustomerConfigs, setValue]);

  // Clear orphaned service assignments when customer configs change
  useEffect(() => {
    const configs = watchedCustomerConfigs || [];
    const currentIds = Array.isArray(configs)
      ? configs.map((c: any) => c?.customerId).filter(Boolean)
      : [];
    const items = getValues("services") || [];
    items.forEach((item: any, index: number) => {
      if (
        item.invoiceToCustomerId &&
        !currentIds.includes(item.invoiceToCustomerId)
      ) {
        setValue(`services.${index}.invoiceToCustomerId`, null);
      }
    });
  }, [watchedCustomerConfigs, getValues, setValue]);

  const handleAddItem = useCallback(() => {
    clearErrors("services");
    append({
      description: "",
      observation: null,
      amount: undefined,
      invoiceToCustomerId: null,
      discountType: "NONE",
      discountValue: null,
      discountReference: null,
    });
    setTimeout(() => {
      if (lastRowRef.current) {
        const combobox = lastRowRef.current.querySelector(
          '[role="combobox"]',
        ) as HTMLElement;
        combobox?.focus();
      }
    }, 100);
  }, [append, clearErrors]);

  const hasIncompleteQuote = useMemo(() => {
    if (!quoteItems || quoteItems.length === 0) return false;
    return quoteItems.some((item: any) => {
      const hasDescription = item.description && item.description.trim() !== "";
      const hasAmount =
        item.amount !== null && item.amount !== undefined && item.amount > 0;
      return hasAmount && !hasDescription;
    });
  }, [quoteItems]);

  const hasMultipleCustomers =
    Array.isArray(watchedCustomerConfigs) && watchedCustomerConfigs.length >= 2;
  const customerConfigCustomers = Array.from(selectedCustomers.values());

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <IconListDetails className="h-4 w-4" />
            Serviços
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Header row */}
          {fields.length > 0 && (
            <div
              className={cn(
                "grid gap-2 items-end text-xs font-medium text-muted-foreground px-1",
                hasMultipleCustomers
                  ? "grid-cols-[minmax(120px,1fr)_minmax(120px,1fr)_130px_minmax(120px,1fr)_110px_minmax(100px,1fr)_36px_36px]"
                  : "grid-cols-[minmax(150px,2fr)_130px_minmax(120px,1fr)_110px_minmax(100px,1fr)_36px_36px]",
              )}
            >
              <span>Serviço</span>
              {hasMultipleCustomers && <span>Faturar para</span>}
              <span>Valor (R$)</span>
              <span>Desconto</span>
              <span>Vlr. Desc.</span>
              <span>Referência</span>
              <span className="text-center">Obs</span>
              <span></span>
            </div>
          )}

          {/* Service Rows */}
          {fields.map((field, index) => (
            <ServiceRow
              key={field.id}
              control={control}
              index={index}
              disabled={disabled}
              onRemove={() => remove(index)}
              ref={index === fields.length - 1 ? lastRowRef : null}
              customerConfigCustomers={
                hasMultipleCustomers ? customerConfigCustomers : undefined
              }
            />
          ))}

          {/* Add Service Button */}
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
        </CardContent>
      </Card>

      {/* Totals */}
      {fields.length > 0 && (
        <Card>
          <CardContent className="py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  <IconCurrencyReal className="h-4 w-4" />
                  Subtotal
                </FormLabel>
                <FormControl>
                  <Input
                    value={formatCurrency(subtotal)}
                    readOnly
                    className="bg-muted cursor-not-allowed font-medium"
                  />
                </FormControl>
              </FormItem>
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  <IconCurrencyReal className="h-4 w-4" />
                  Valor Total
                </FormLabel>
                <FormControl>
                  <Input
                    value={formatCurrency(aggregateTotal)}
                    readOnly
                    className="bg-transparent font-bold text-lg text-primary cursor-not-allowed border-primary"
                  />
                </FormControl>
              </FormItem>
            </div>
          </CardContent>
        </Card>
      )}

      {hasIncompleteQuote && (
        <Alert variant="destructive">
          <AlertDescription>
            Alguns serviços estão incompletos. Selecione o serviço e preencha o
            valor antes de avançar.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

// =====================
// Service Row Component
// =====================

interface ServiceRowProps {
  control: any;
  index: number;
  disabled?: boolean;
  onRemove: () => void;
  customerConfigCustomers?: Array<{
    id: string;
    fantasyName?: string;
    corporateName?: string;
  }>;
}

const ServiceRow = forwardRef<HTMLDivElement, ServiceRowProps>(
  (
    { control, index, disabled, onRemove, customerConfigCustomers },
    ref,
  ) => {
    const { setValue: setFormValue } = useFormContext();
    const [isObservationModalOpen, setIsObservationModalOpen] = useState(false);
    const [tempObservation, setTempObservation] = useState("");

    const currentObservation = useWatch({
      control,
      name: `services.${index}.observation`,
      defaultValue: "",
    });
    const { field: observationField } = useController({
      control,
      name: `services.${index}.observation`,
      defaultValue: "",
    });

    const discountType = useWatch({
      control,
      name: `services.${index}.discountType`,
      defaultValue: "NONE",
    });

    const hasObservation = Boolean(
      currentObservation && currentObservation.trim(),
    );
    const hasMultipleCustomers =
      customerConfigCustomers && customerConfigCustomers.length >= 2;

    return (
      <>
        <div
          ref={ref}
          className={cn(
            "grid gap-2 items-center",
            hasMultipleCustomers
              ? "grid-cols-[minmax(120px,1fr)_minmax(120px,1fr)_130px_minmax(120px,1fr)_110px_minmax(100px,1fr)_36px_36px]"
              : "grid-cols-[minmax(150px,2fr)_130px_minmax(120px,1fr)_110px_minmax(100px,1fr)_36px_36px]",
          )}
        >
          {/* Description */}
          <ServiceAutocomplete
            control={control}
            name={`services.${index}.description`}
            disabled={disabled}
            placeholder="Selecione ou digite"
            showLabel={false}
            type={SERVICE_ORDER_TYPE.PRODUCTION}
          />

          {/* Invoice To Customer */}
          {hasMultipleCustomers && (
            <FormField
              control={control}
              name={`services.${index}.invoiceToCustomerId`}
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Combobox
                      value={field.value || ""}
                      onValueChange={(value) =>
                        field.onChange(value || null)
                      }
                      disabled={disabled}
                      options={customerConfigCustomers!.map((c) => ({
                        value: c.id,
                        label:
                          c.fantasyName ||
                          c.corporateName ||
                          "Cliente sem nome",
                      }))}
                      placeholder="Selecione"
                      searchable={false}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          )}

          {/* Amount */}
          <FormField
            control={control}
            name={`services.${index}.amount`}
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Input
                    type="currency"
                    {...field}
                    placeholder="R$ 0,00"
                    disabled={disabled}
                    className="bg-transparent"
                  />
                </FormControl>
              </FormItem>
            )}
          />

          {/* Discount Type */}
          <FormField
            control={control}
            name={`services.${index}.discountType`}
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Combobox
                    value={field.value || "NONE"}
                    onValueChange={(value) => {
                      const safeType = value || "NONE";
                      field.onChange(safeType);
                      if (safeType === "NONE") {
                        setFormValue(`services.${index}.discountValue`, null);
                        setFormValue(`services.${index}.discountReference`, null);
                      }
                    }}
                    disabled={disabled}
                    options={Object.values(DISCOUNT_TYPE).map((type) => ({
                      value: type,
                      label: DISCOUNT_TYPE_LABELS[type],
                    }))}
                    placeholder="Nenhum"
                    emptyText="Nenhuma opção"
                  />
                </FormControl>
              </FormItem>
            )}
          />

          {/* Discount Value */}
          <FormField
            control={control}
            name={`services.${index}.discountValue`}
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Input
                    type={
                      discountType === "FIXED_VALUE" ? "currency" : "number"
                    }
                    value={field.value ?? ""}
                    onChange={(value) => {
                      if (discountType === "FIXED_VALUE") {
                        field.onChange(value);
                      } else {
                        const num = Number(value);
                        field.onChange(isNaN(num) ? null : num);
                      }
                    }}
                    disabled={disabled || discountType === "NONE"}
                    placeholder={
                      discountType === "NONE"
                        ? "-"
                        : discountType === "FIXED_VALUE"
                          ? "R$ 0,00"
                          : "0"
                    }
                    min={discountType === "PERCENTAGE" ? 0 : undefined}
                    max={discountType === "PERCENTAGE" ? 100 : undefined}
                    className="bg-transparent"
                  />
                </FormControl>
              </FormItem>
            )}
          />

          {/* Discount Reference */}
          <FormField
            control={control}
            name={`services.${index}.discountReference`}
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Input
                    {...field}
                    value={field.value || ""}
                    placeholder={
                      discountType === "NONE" ? "-" : "Justificativa..."
                    }
                    disabled={disabled || discountType === "NONE"}
                    maxLength={500}
                    className="bg-transparent"
                  />
                </FormControl>
              </FormItem>
            )}
          />

          {/* Observation Button */}
          <div className="flex justify-center">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => {
                setTempObservation(currentObservation || "");
                setIsObservationModalOpen(true);
              }}
              disabled={disabled}
              className="relative h-9 w-9"
              title={
                hasObservation
                  ? "Ver/Editar observação"
                  : "Adicionar observação"
              }
            >
              <IconNote className="h-4 w-4" />
              {hasObservation && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                  !
                </span>
              )}
            </Button>
          </div>

          {/* Remove Button */}
          <div className="flex justify-center">
            {!disabled ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onRemove}
                className="text-destructive h-9 w-9"
                title="Remover serviço"
              >
                <IconTrash className="h-4 w-4" />
              </Button>
            ) : (
              <div className="w-9" />
            )}
          </div>
        </div>

        {/* Observation Modal */}
        <Dialog
          open={isObservationModalOpen}
          onOpenChange={setIsObservationModalOpen}
        >
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Observação do Serviço</DialogTitle>
              <DialogDescription>
                Adicione notas ou detalhes adicionais para este serviço.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Textarea
                value={tempObservation}
                onChange={(e) => setTempObservation(e.target.value)}
                placeholder="Digite a observação..."
                rows={4}
                className="resize-none"
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsObservationModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={() => {
                  observationField.onChange(tempObservation || null);
                  setIsObservationModalOpen(false);
                }}
              >
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  },
);

ServiceRow.displayName = "ServiceRow";
