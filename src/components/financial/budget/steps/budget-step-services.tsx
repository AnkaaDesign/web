import { useCallback, useState, useMemo, useEffect } from "react";
import { useFormContext, useFieldArray, useWatch } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatCurrency, formatDate } from "@/utils";
import { computeConfigDiscount, computeCustomerConfigTotals } from "@/utils/task-quote-calculations";
import { SERVICE_ORDER_TYPE } from "@/constants/enums";
import { Label } from "@/components/ui/label";
import { routes } from "@/constants";
import { ServiceAutocomplete } from "@/components/production/task/form/service-autocomplete";
import { useTaskQuoteSuggestion } from "@/hooks/production/use-task-quote";
import {
  IconPlus,
  IconTrash,
  IconNote,
  IconCurrencyReal,
  IconAlertTriangle,
  IconBulb,
  IconExternalLink,
  IconChevronDown,
  IconX,
} from "@tabler/icons-react";
import {
  getQuoteServicesToAddFromServiceOrders,
  type SyncServiceOrder,
} from "@/utils/task-quote-service-order-sync";

const ADJUSTMENT_PRESETS = [0, 5, 10, 15, 20];

interface BudgetStepServicesProps {
  task: any;
  disabled?: boolean;
  selectedCustomers: Map<string, any>;
  isCreateMode?: boolean;
}

export function BudgetStepServices({
  task,
  disabled,
  selectedCustomers,
  isCreateMode,
}: BudgetStepServicesProps) {
  const { control, setValue: setFormValue, getValues } = useFormContext();
  const { fields, append, remove, replace } = useFieldArray({ control, name: "services" });
  const services = useWatch({ control, name: "services" }) || [];
  const customerConfigs = useWatch({ control, name: "customerConfigs" }) || [];
  const hasMultipleCustomers = customerConfigs.length >= 2;
  const [syncedOnMount, setSyncedOnMount] = useState(false);

  // Suggestion state
  const [adjustmentPercent, setAdjustmentPercent] = useState(0);
  const [isCustomAdjustment, setIsCustomAdjustment] = useState(false);
  const [customAdjustmentInput, setCustomAdjustmentInput] = useState("");
  const [suggestionApplied, setSuggestionApplied] = useState(false);

  // Watch form fields for suggestion query (only in create mode)
  const watchedName = useWatch({ control, name: "name" });
  const watchedCustomerId = useWatch({ control, name: "customerId" });
  const watchedCategory = useWatch({ control, name: "category" });
  const watchedImplementType = useWatch({ control, name: "implementType" });

  const suggestionParams = useMemo(() => ({
    name: watchedName || "",
    customerId: watchedCustomerId || "",
    category: watchedCategory || "",
    implementType: watchedImplementType || "",
  }), [watchedName, watchedCustomerId, watchedCategory, watchedImplementType]);

  const {
    data: suggestionApiResponse,
  } = useTaskQuoteSuggestion(
    isCreateMode ? suggestionParams : { name: "", customerId: "", category: "", implementType: "" },
  );

  // Hook unwraps axios .data, so suggestionApiResponse = { success, data, message }
  const suggestion = suggestionApiResponse?.data || null;

  // Detect if user manually typed in any real service row → dismiss ghost
  const userHasManualServices = useMemo(() => {
    return services.some((s: any) => s.description?.trim() || (s.amount && Number(s.amount) > 0));
  }, [services]);

  // Toolbar shows whenever a suggestion exists
  const showSuggestionToolbar = !!(isCreateMode && suggestion?.services?.length);
  // Ghost preview rows only when not yet applied and user hasn't manually typed
  const showSuggestionPreview = showSuggestionToolbar && !suggestionApplied && !userHasManualServices;

  // Compute suggested services with adjustment applied
  const suggestedServices = useMemo(() => {
    if (!suggestion?.services?.length) return [];
    const multiplier = 1 + adjustmentPercent / 100;
    return suggestion.services.map((svc: any) => ({
      description: svc.description || "",
      observation: svc.observation || null,
      amount: Math.round((Number(svc.amount) || 0) * multiplier * 100) / 100,
      invoiceToCustomerId: null,
    }));
  }, [suggestion, adjustmentPercent]);

  const suggestedTotal = useMemo(() => {
    return suggestedServices.reduce((sum: number, s: any) => sum + (s.amount || 0), 0);
  }, [suggestedServices]);

  // Observation modal state
  const [observationModal, setObservationModal] = useState<{ index: number; value: string } | null>(null);

  // Customer options for invoice-to combobox
  const customerOptions = useMemo(() => {
    return Array.from(selectedCustomers.entries()).map(([id, c]) => ({
      value: id,
      label: c?.corporateName || c?.fantasyName || id,
    }));
  }, [selectedCustomers]);


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
          },
          { shouldFocus: false },
        );
      });
    }
  }, [task, syncedOnMount, getValues, append]);

  // Add new service row
  const handleAddItem = useCallback(() => {
    append({
      description: "",
      observation: null,
      amount: 0,
      invoiceToCustomerId: customerConfigs.length === 1 ? customerConfigs[0]?.customerId : null,
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
      const result = computeCustomerConfigTotals(currentServices, config.customerId, isSingle, config.discountType, config.discountValue);
      subtotal += result.subtotal;
      total += result.total;
      return { ...config, subtotal: result.subtotal, total: result.total };
    });

    setFormValue("customerConfigs", updatedConfigs, { shouldDirty: false });
    setFormValue("subtotal", subtotal, { shouldDirty: false });
    setFormValue("total", total, { shouldDirty: false });
  }, [getValues, setFormValue]);

  // Fill services from suggestion
  const handleFillSuggestion = useCallback(() => {
    if (!suggestedServices.length) return;

    const newServices = suggestedServices.map((svc: any) => ({
      description: svc.description,
      observation: svc.observation,
      amount: svc.amount,
      invoiceToCustomerId: svc.invoiceToCustomerId,
    }));

    replace(newServices);
    setSuggestionApplied(true);
    setTimeout(recalculateTotals, 0);
  }, [suggestedServices, replace, recalculateTotals]);

  // Reset suggestion
  const handleResetSuggestion = useCallback(() => {
    replace([{
      description: "",
      observation: null,
      amount: 0,
      invoiceToCustomerId: null,
    }]);
    setSuggestionApplied(false);
    setAdjustmentPercent(0);
    setIsCustomAdjustment(false);
    setCustomAdjustmentInput("");
    setTimeout(recalculateTotals, 0);
  }, [replace, recalculateTotals]);

  // Combobox options for adjustment
  const adjustmentOptions = useMemo(() => [
    ...ADJUSTMENT_PRESETS.map((val) => ({
      value: String(val),
      label: val === 0 ? "Nenhum reajuste" : `Reajuste: ${val}%`,
    })),
    { value: "CUSTOM", label: "Reajuste personalizado" },
  ], []);

  // Handle adjustment combobox change
  const handleAdjustmentSelect = useCallback((rawValue: string | string[] | null | undefined) => {
    const value = Array.isArray(rawValue) ? rawValue[0] : rawValue ?? "";
    if (value === "CUSTOM") {
      setIsCustomAdjustment(true);
      setCustomAdjustmentInput(adjustmentPercent > 0 ? String(adjustmentPercent) : "");
    } else {
      setIsCustomAdjustment(false);
      setCustomAdjustmentInput("");
      setAdjustmentPercent(Number(value) || 0);
    }
  }, [adjustmentPercent]);

  // Handle custom adjustment input
  const handleCustomAdjustmentChange = useCallback((value: string) => {
    setCustomAdjustmentInput(value);
    const parsed = parseFloat(value);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
      setAdjustmentPercent(parsed);
    } else if (value === "") {
      setAdjustmentPercent(0);
    }
  }, []);

  // Reset suggestion applied state when suggestion source changes
  useEffect(() => {
    setSuggestionApplied(false);
  }, [suggestion]);

  // Validate: any service with amount but no description
  const hasValidationIssue = services.some((s: any) => s.amount > 0 && !s.description?.trim());

  // Grid class
  const gridClass = hasMultipleCustomers
    ? "grid-cols-[minmax(120px,1fr)_minmax(120px,1fr)_200px_36px]"
    : "grid-cols-[minmax(150px,1fr)_200px_36px]";

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

          {/* Suggestion toolbar — always visible when suggestion exists */}
          {showSuggestionToolbar && (
            <div className="border border-border rounded-lg px-3 pt-2.5 pb-3 bg-muted/20">
              <div className="flex items-start gap-4">
                {/* Left column: title + orçamento button */}
                <div className="flex flex-col gap-2 min-w-0">
                  <div className="flex items-center gap-1.5 h-7">
                    <IconBulb className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-sm font-medium">Sugestão</span>
                  </div>
                  {suggestion.task?.id ? (
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      className="h-7 text-xs w-fit"
                      asChild
                    >
                      <a
                        href={routes.production.history.details(suggestion.task.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <IconExternalLink className="h-3.5 w-3.5" />
                        Orçamento de {formatDate(suggestion.taskCreatedAt || suggestion.createdAt)}
                      </a>
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground h-7 flex items-center">
                      Orçamento de {formatDate(suggestion.taskCreatedAt || suggestion.createdAt)}
                    </span>
                  )}
                </div>

                {/* Right column: reajuste + action buttons — all fixed w-[220px] */}
                <div className="ml-auto flex flex-col gap-2 w-[220px]">
                  {/* Reajuste */}
                  {isCustomAdjustment ? (
                    <div className="flex items-center gap-1.5 h-7 w-[220px]">
                      <input
                        type="number"
                        value={customAdjustmentInput}
                        onChange={(e) => handleCustomAdjustmentChange(e.target.value)}
                        placeholder="0"
                        autoFocus
                        className="h-7 flex-1 min-w-0 text-xs rounded-md border border-input bg-background px-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        min={0}
                        max={100}
                      />
                      <span className="text-xs text-muted-foreground flex-shrink-0">%</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 flex-shrink-0"
                        onClick={() => {
                          setIsCustomAdjustment(false);
                          if (!customAdjustmentInput) setAdjustmentPercent(0);
                        }}
                      >
                        <IconX className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <Combobox
                      value={String(adjustmentPercent)}
                      onValueChange={handleAdjustmentSelect}
                      options={adjustmentOptions}
                      searchable={false}
                      clearable={false}
                      className="h-7 w-[220px] text-xs"
                    />
                  )}

                  {/* Action buttons — same fixed width */}
                  <div className="flex items-center gap-2 w-[220px]">
                    {(suggestionApplied || userHasManualServices) && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs flex-1"
                        onClick={handleResetSuggestion}
                        disabled={disabled}
                      >
                        <IconX className="h-3.5 w-3.5" />
                        Limpar
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      className="h-7 text-xs flex-1"
                      onClick={handleFillSuggestion}
                      disabled={disabled}
                    >
                      <IconBulb className="h-3.5 w-3.5" />
                      {suggestionApplied || userHasManualServices ? "Preencher" : "Preencher Sugestão"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Header */}
          <div className={`grid gap-2 text-xs font-semibold text-muted-foreground uppercase ${gridClass}`}>
            <span className="px-2">Descrição</span>
            {hasMultipleCustomers && <span className="px-2">Cliente</span>}
            <span className="px-2">Valor</span>
            <span />
          </div>

          {/* Ghost rows — look like real inputs but with placeholder styling */}
          {showSuggestionPreview && suggestedServices.map((svc: any, idx: number) => (
            <div
              key={`suggestion-${idx}`}
              className={`grid gap-2 items-center pointer-events-none ${gridClass}`}
            >
              {/* Description — mimics Combobox trigger */}
              <div className="flex items-center gap-1 min-w-0">
                <div className="flex-1 min-w-0 h-9 rounded-md border border-input bg-background flex items-center justify-between px-3">
                  <span className="text-sm text-muted-foreground truncate">
                    {svc.description}
                  </span>
                  <IconChevronDown className="h-4 w-4 shrink-0 opacity-50 ml-2" />
                </div>
                <div className="h-9 w-9 rounded-md border border-input bg-background flex items-center justify-center flex-shrink-0">
                  <IconNote className="h-3.5 w-3.5 text-muted-foreground/50" />
                </div>
              </div>

              {/* Customer */}
              {hasMultipleCustomers && (
                <div className="h-9 rounded-md border border-input bg-background flex items-center justify-between px-3">
                  <span className="text-sm text-muted-foreground">Cliente</span>
                  <IconChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                </div>
              )}

              {/* Amount */}
              <div className="h-9 rounded-md border border-input bg-background flex items-center px-3">
                <span className="text-sm text-muted-foreground">
                  {formatCurrency(svc.amount)}
                </span>
              </div>

              {/* Empty trash cell */}
              <div className="h-9 w-9" />
            </div>
          ))}

          {/* Suggested totals — same style as real totals but muted */}
          {showSuggestionPreview && (
            <div className="bg-muted/20 border border-border rounded-lg p-4 space-y-2 mt-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium text-muted-foreground">
                  {formatCurrency(suggestedTotal)}
                </span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-border">
                <span className="text-base font-bold text-muted-foreground">TOTAL</span>
                <span className="text-xl font-bold text-muted-foreground">
                  {formatCurrency(suggestedTotal)}
                </span>
              </div>
            </div>
          )}

          {/* Real service rows */}
          {fields.map((field, index) => {
            const service = services[index];

            return (
              <div
                key={field.id}
                className={`grid gap-2 items-center ${gridClass}`}
              >
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

          {/* Real totals with discount controls (when not showing suggestion preview) */}
          {!showSuggestionPreview && customerConfigs.map((config: any, configIndex: number) => {
            const configSubtotal = Number(config?.subtotal) || 0;
            const configTotal = Number(config?.total) || 0;
            const discountType = config?.discountType || "NONE";
            const discountAmount = computeConfigDiscount(configSubtotal, discountType, config?.discountValue);
            const customerName = selectedCustomers.get(config.customerId)?.corporateName
              || selectedCustomers.get(config.customerId)?.fantasyName
              || "";

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
