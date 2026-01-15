import {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
import { useFieldArray, useWatch, useFormContext } from "react-hook-form";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { IconPlus, IconTrash, IconCalendar, IconCurrencyReal } from "@tabler/icons-react";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Combobox } from "@/components/ui/combobox";
import { formatCurrency } from "../../../../utils";
import { DISCOUNT_TYPE, SERVICE_ORDER_TYPE } from "@/constants/enums";
import { DISCOUNT_TYPE_LABELS } from "@/constants/enum-labels";
import { serviceService } from "../../../../api-client";

interface PricingSelectorProps {
  control: any;
  disabled?: boolean;
  userRole?: string;
  readOnly?: boolean;
  onItemCountChange?: (count: number) => void;
}

export interface PricingSelectorRef {
  addItem: () => void;
  clearAll: () => void;
}

interface Service {
  id: string;
  description: string;
  type: string;
}

export const PricingSelector = forwardRef<
  PricingSelectorRef,
  PricingSelectorProps
>(({ control, disabled, userRole, readOnly, onItemCountChange }, ref) => {
  const [initialized, setInitialized] = useState(false);
  const [validityPeriod, setValidityPeriod] = useState<number | null>(null);
  const lastRowRef = useRef<HTMLDivElement>(null);
  const { setValue, clearErrors } = useFormContext();

  const { fields, append, remove } = useFieldArray({
    control,
    name: "pricing.items",
  });

  // Watch pricing values to check for incomplete entries and calculate total
  const pricingItems = useWatch({
    control,
    name: "pricing.items",
  });

  const pricingStatus = useWatch({
    control,
    name: "pricing.status",
  }) || 'DRAFT';

  const pricingExpiresAt = useWatch({
    control,
    name: "pricing.expiresAt",
  });

  const discountType = useWatch({
    control,
    name: "pricing.discountType",
  }) || DISCOUNT_TYPE.NONE;

  const discountValue = useWatch({
    control,
    name: "pricing.discountValue",
  });

  // Search function for service combobox with pagination
  const searchServices = useCallback(async (
    search: string,
    page: number = 1,
  ): Promise<{
    data: Service[];
    hasMore: boolean;
  }> => {
    try {
      const params: any = {
        type: SERVICE_ORDER_TYPE.PRODUCTION,
        orderBy: { description: "asc" },
        page: page,
        take: 50,
      };

      if (search && search.trim()) {
        params.searchingFor = search.trim();
      }

      const response = await serviceService.getServices(params);
      const services = response.data || [];
      const hasMore = response.meta?.hasNextPage || false;

      return {
        data: services,
        hasMore,
      };
    } catch (error) {
      console.error("Failed to search services:", error);
      return { data: [], hasMore: false };
    }
  }, []);

  // Helper functions for Combobox async mode
  const getOptionLabel = useCallback((service: Service) => service.description, []);
  const getOptionValue = useCallback((service: Service) => service.id, []);

  // Calculate subtotal from all pricing items
  const subtotal = useMemo(() => {
    if (!pricingItems || pricingItems.length === 0) return 0;
    return pricingItems.reduce((sum: number, item: any) => {
      const amount = typeof item.amount === 'number' ? item.amount : Number(item.amount) || 0;
      return sum + amount;
    }, 0);
  }, [pricingItems]);

  // Calculate discount amount based on type and value
  const discountAmount = useMemo(() => {
    if (discountType === DISCOUNT_TYPE.NONE || !discountValue) return 0;
    if (discountType === DISCOUNT_TYPE.PERCENTAGE) {
      return Math.round((subtotal * discountValue) / 100 * 100) / 100;
    }
    if (discountType === DISCOUNT_TYPE.FIXED_VALUE) {
      return discountValue;
    }
    return 0;
  }, [subtotal, discountType, discountValue]);

  // Calculate total with discount applied
  const calculatedTotal = useMemo(() => {
    return Math.max(0, Math.round((subtotal - discountAmount) * 100) / 100);
  }, [subtotal, discountAmount]);

  // Check if any pricing item is incomplete (skip first item as it's always available)
  const hasIncompletePricing = useMemo(() => {
    if (!pricingItems || pricingItems.length === 0) return false;

    // Only check items beyond the first one
    // If there's only one item and it's empty, it's okay (like cuts)
    if (pricingItems.length === 1) {
      const item = pricingItems[0];
      const isEmpty = !item.serviceId && (item.amount === null || item.amount === undefined || item.amount === 0);
      // Don't show error for the default empty first item
      if (isEmpty) return false;

      // Show error if partially filled
      return !item.serviceId || item.amount === null || item.amount === undefined;
    }

    // For multiple items, check if any are incomplete
    return pricingItems.some((item: any) =>
      !item.serviceId ||
      item.amount === null || item.amount === undefined
    );
  }, [pricingItems]);

  // Initialize with one empty row by default for better UX
  useEffect(() => {
    if (!initialized && fields.length === 0) {
      // Auto-add first row if no pricing items exist
      append({
        serviceId: "",
        amount: undefined,
      });

      // Set default validity period to 30 days
      const defaultPeriod = 30;
      setValidityPeriod(defaultPeriod);
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + defaultPeriod);
      expiryDate.setHours(23, 59, 59, 999);
      setValue("pricing.expiresAt", expiryDate);

      // Initialize pricing fields
      setValue("pricing.status", "DRAFT");
      setValue("pricing.discountType", DISCOUNT_TYPE.NONE);
      setValue("pricing.discountValue", null);
      setValue("pricing.subtotal", 0);
      setValue("pricing.total", 0);

      setInitialized(true);
    } else if (!initialized) {
      setInitialized(true);
    }
  }, [initialized, fields.length, append, setValue]);

  // Notify parent about count changes
  useEffect(() => {
    if (onItemCountChange) {
      // Count pricing items or 1 if there's pricing data (to show the pricing card)
      const count = pricingItems && pricingItems.length > 0 ? 1 : 0;
      onItemCountChange(count);
    }
  }, [pricingItems, onItemCountChange]);

  // Update subtotal and total in form whenever they change
  useEffect(() => {
    if (pricingItems && pricingItems.length > 0) {
      setValue("pricing.subtotal", subtotal);
      setValue("pricing.total", calculatedTotal);
    }
  }, [subtotal, calculatedTotal, pricingItems, setValue]);

  const handleAddItem = useCallback(() => {
    // Clear any existing pricing errors before adding
    clearErrors("pricing");

    append({
      serviceId: "",
      amount: undefined,
    });

    // Focus on the new input after adding
    setTimeout(() => {
      const serviceInput = lastRowRef.current?.querySelector(
        '[role="combobox"]',
      ) as HTMLElement;
      serviceInput?.focus();
    }, 100);
  }, [append, clearErrors]);

  // Clear all pricing items
  const clearAll = useCallback(() => {
    // Remove all items from the end to the beginning
    for (let i = fields.length - 1; i >= 0; i--) {
      remove(i);
    }
    // Set pricing to undefined entirely so the optional schema validation works
    setValue("pricing", undefined);
    clearErrors("pricing");
    // Reset validity period
    setValidityPeriod(null);
  }, [fields.length, remove, setValue, clearErrors]);

  // Expose methods via ref
  useImperativeHandle(
    ref,
    () => ({
      addItem: handleAddItem,
      clearAll,
    }),
    [handleAddItem, clearAll],
  );

  const canEditStatus = userRole === 'ADMIN' || userRole === 'FINANCIAL' || userRole === 'COMMERCIAL';

  // Status options for Combobox
  const statusOptions = [
    { label: 'Rascunho', value: 'DRAFT' },
    { label: 'Aprovado', value: 'APPROVED' },
    { label: 'Rejeitado', value: 'REJECTED' },
    { label: 'Cancelado', value: 'CANCELLED' },
  ];

  // Validity period options (in days)
  const validityPeriodOptions = [
    { label: '7 dias', value: '7' },
    { label: '30 dias', value: '30' },
    { label: '60 dias', value: '60' },
    { label: '90 dias', value: '90' },
  ];

  // Calculate expiresAt date from validity period
  const handleValidityPeriodChange = useCallback((period: string) => {
    const days = Number(period);
    setValidityPeriod(days);

    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + days);
    // Set to end of day
    expiryDate.setHours(23, 59, 59, 999);

    setValue("pricing.expiresAt", expiryDate);
  }, [setValue]);

  // Detect validity period from existing expiresAt date (for edit form)
  useEffect(() => {
    if (!pricingExpiresAt || validityPeriod !== null) return;

    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const expiryDate = new Date(pricingExpiresAt);
    expiryDate.setHours(0, 0, 0, 0);

    const diffInMs = expiryDate.getTime() - now.getTime();
    const diffInDays = Math.round(diffInMs / (1000 * 60 * 60 * 24));

    // Check if the difference matches one of our predefined periods (with ±1 day tolerance)
    const periods = [7, 30, 60, 90];
    for (const period of periods) {
      if (Math.abs(diffInDays - period) <= 1) {
        setValidityPeriod(period);
        break;
      }
    }
  }, [pricingExpiresAt, validityPeriod]);

  return (
    <div className="space-y-4">
      {/* Status and Validity Period - Side by side at top */}
      {pricingItems && pricingItems.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-[minmax(300px,1fr)_minmax(250px,1fr)] gap-4">
          {/* Status Selector - Only shown when user has permission */}
          {canEditStatus && !readOnly ? (
            <FormField
              control={control}
              name="pricing.status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status da Precificação</FormLabel>
                  <FormControl>
                    <Combobox
                      options={statusOptions}
                      value={field.value || 'DRAFT'}
                      onValueChange={field.onChange}
                      placeholder="Selecione o status"
                      emptyMessage="Nenhum status encontrado"
                      disabled={disabled}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          ) : (
            <div />
          )}

          {/* Validity Period Field */}
          <FormField
            control={control}
            name="pricing.expiresAt"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  <IconCalendar className="h-4 w-4" />
                  Validade da Proposta
                  <span className="text-destructive">*</span>
                </FormLabel>
                <FormControl>
                  <Combobox
                    value={validityPeriod?.toString() || ""}
                    onValueChange={handleValidityPeriodChange}
                    options={validityPeriodOptions}
                    placeholder="Selecione o período"
                    emptyMessage="Nenhum período encontrado"
                    disabled={disabled || readOnly}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      )}

      {/* Services List */}
      {fields.length > 0 && (
        <div className="space-y-3">
          {fields.map((field, index) => {
            const isLastRow = index === fields.length - 1;
            return (
              <div
                key={field.id}
                ref={isLastRow ? lastRowRef : null}
                className="grid grid-cols-1 md:grid-cols-[minmax(300px,1fr)_minmax(250px,1fr)] gap-4 items-end"
              >
                {/* Service Selector */}
                <FormField
                  control={control}
                  name={`pricing.items.${index}.serviceId`}
                  render={({ field: serviceField }) => (
                    <FormItem>
                      {index === 0 && (
                        <FormLabel className="flex items-center gap-2">
                          Serviço
                        </FormLabel>
                      )}
                      <FormControl>
                        <Combobox<Service>
                          value={serviceField.value || ""}
                          onValueChange={serviceField.onChange}
                          async={true}
                          queryKey={["pricing", "services", "PRODUCTION", index]}
                          queryFn={searchServices}
                          getOptionLabel={getOptionLabel}
                          getOptionValue={getOptionValue}
                          renderOption={(service) => <span>{service.description}</span>}
                          pageSize={50}
                          minSearchLength={0}
                          debounceMs={300}
                          placeholder="Selecione um serviço"
                          emptyText="Nenhum serviço encontrado"
                          searchPlaceholder="Buscar serviço..."
                          disabled={disabled || readOnly}
                          loadMoreText="Carregar mais serviços"
                          loadingMoreText="Carregando..."
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Amount Field with embedded action buttons */}
                <FormField
                  control={control}
                  name={`pricing.items.${index}.amount`}
                  render={({ field }) => (
                    <FormItem>
                      {index === 0 && (
                        <FormLabel className="flex items-center gap-2">
                          <IconCurrencyReal className="h-4 w-4" />
                          Valor
                        </FormLabel>
                      )}
                      <FormControl>
                        <div className="relative flex items-center gap-1">
                          <Input
                            type="currency"
                            {...field}
                            placeholder="R$ 0,00"
                            disabled={disabled || readOnly}
                            className="pr-20"
                          />
                          {!readOnly && !disabled && (
                            <div className="absolute right-1 flex items-center gap-1">
                              {/* Remove Button */}
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => remove(index)}
                                disabled={disabled}
                                className="text-destructive h-8 w-8"
                                title="Remover serviço"
                              >
                                <IconTrash className="h-4 w-4" />
                              </Button>

                              {/* Add Button - Only show on last row */}
                              {isLastRow && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={handleAddItem}
                                  disabled={disabled}
                                  className="text-primary h-8 w-8"
                                  title="Adicionar serviço"
                                >
                                  <IconPlus className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Discount and Summary Section - Always shown when there are pricing items */}
      {pricingItems && pricingItems.length > 0 && (
        <div className="space-y-4 pt-4 border-t">
          {/* Discount Type and Discount Value */}
          <div className="grid grid-cols-1 md:grid-cols-[minmax(300px,1fr)_minmax(250px,1fr)] gap-4">
            {/* Discount Type Field */}
            <FormField
              control={control}
              name="pricing.discountType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    Tipo de Desconto
                  </FormLabel>
                  <FormControl>
                    <Combobox
                      value={field.value || DISCOUNT_TYPE.NONE}
                      onValueChange={field.onChange}
                      disabled={disabled || readOnly}
                      options={[
                        DISCOUNT_TYPE.NONE,
                        DISCOUNT_TYPE.PERCENTAGE,
                        DISCOUNT_TYPE.FIXED_VALUE,
                      ].map((type) => ({
                        value: type,
                        label: DISCOUNT_TYPE_LABELS[type],
                      }))}
                      placeholder="Selecione o tipo"
                      emptyMessage="Nenhum tipo encontrado"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Discount Value Field - Only enabled when type is not NONE */}
            <FormField
              control={control}
              name="pricing.discountValue"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    Valor do Desconto
                    {discountType === DISCOUNT_TYPE.PERCENTAGE && (
                      <span className="text-xs text-muted-foreground">(%)</span>
                    )}
                    {discountType === DISCOUNT_TYPE.FIXED_VALUE && (
                      <span className="text-xs text-muted-foreground">(R$)</span>
                    )}
                  </FormLabel>
                  <FormControl>
                    <Input
                      type={discountType === DISCOUNT_TYPE.FIXED_VALUE ? "currency" : "number"}
                      {...field}
                      value={field.value || ""}
                      onChange={(value) => {
                        // Currency Input passes value directly, number input passes event
                        if (discountType === DISCOUNT_TYPE.FIXED_VALUE) {
                          field.onChange(value);
                        } else {
                          const e = value as any;
                          field.onChange(e.target?.value ? Number(e.target.value) : null);
                        }
                      }}
                      disabled={disabled || readOnly || discountType === DISCOUNT_TYPE.NONE}
                      placeholder={discountType === DISCOUNT_TYPE.NONE ? "-" : discountType === DISCOUNT_TYPE.FIXED_VALUE ? "R$ 0,00" : "0"}
                      min={discountType === DISCOUNT_TYPE.PERCENTAGE ? "0" : undefined}
                      max={discountType === DISCOUNT_TYPE.PERCENTAGE ? "100" : undefined}
                      step={discountType === DISCOUNT_TYPE.PERCENTAGE ? "0.01" : undefined}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Subtotal and Total - Stacked in right column */}
          <div className="grid grid-cols-1 md:grid-cols-[minmax(300px,1fr)_minmax(250px,1fr)] gap-4">
            {/* Empty spacer to push to right column */}
            <div className="hidden md:block" />

            {/* Subtotal and Total container */}
            <div className="space-y-3">
              {/* Subtotal Field - Read-only */}
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

              {/* Total Field - Read-only */}
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  <IconCurrencyReal className="h-4 w-4" />
                  Valor Total
                  {discountAmount > 0 && (
                    <span className="text-xs text-muted-foreground">
                      (Desconto: -{formatCurrency(discountAmount)})
                    </span>
                  )}
                </FormLabel>
                <FormControl>
                  <Input
                    value={formatCurrency(calculatedTotal)}
                    readOnly
                    className="bg-transparent font-bold text-lg text-primary cursor-not-allowed"
                  />
                </FormControl>
              </FormItem>
            </div>
          </div>
        </div>
      )}

      {/* Validation Alert - Only for incomplete items */}
      {hasIncompletePricing && (
        <Alert variant="destructive">
          <AlertDescription>
            Alguns serviços da precificação estão incompletos. Selecione o serviço e preencha o valor antes de enviar o formulário.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
});

PricingSelector.displayName = "PricingSelector";
