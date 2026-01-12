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
import { IconPlus, IconTrash, IconCalendar, IconFileText, IconCurrencyReal, IconCheck, IconX, IconClock, IconBan } from "@tabler/icons-react";
import { Input } from "@/components/ui/input";
import { FormMoneyInput } from "@/components/ui/form-money-input";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Combobox } from "@/components/ui/combobox";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "../../../../utils";
import type { TASK_PRICING_STATUS } from "../../../../types/task-pricing";

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

export const PricingSelector = forwardRef<
  PricingSelectorRef,
  PricingSelectorProps
>(({ control, disabled, userRole, readOnly, onItemCountChange }, ref) => {
  const [initialized, setInitialized] = useState(false);
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

  // Calculate total from all pricing items
  const calculatedTotal = useMemo(() => {
    if (!pricingItems || pricingItems.length === 0) return 0;
    return pricingItems.reduce((sum: number, item: any) => {
      const amount = typeof item.amount === 'number' ? item.amount : Number(item.amount) || 0;
      return sum + amount;
    }, 0);
  }, [pricingItems]);

  // Check if any pricing item is incomplete
  const hasIncompletePricing = useMemo(() => {
    if (!pricingItems || pricingItems.length === 0) return false;
    return pricingItems.some((item: any) =>
      !item.description || item.description.trim() === "" ||
      !item.amount || item.amount === 0
    );
  }, [pricingItems]);

  // Initialize with no rows by default (optional field)
  useEffect(() => {
    if (!initialized) {
      setInitialized(true);
    }
  }, [initialized]);

  // Notify parent about count changes
  useEffect(() => {
    if (onItemCountChange) {
      // Count pricing items or 1 if there's pricing data (to show the pricing card)
      const count = pricingItems && pricingItems.length > 0 ? 1 : 0;
      onItemCountChange(count);
    }
  }, [pricingItems, onItemCountChange]);

  const handleAddItem = useCallback(() => {
    // Clear any existing pricing errors before adding
    clearErrors("pricing");

    // If this is the first item, initialize the status field
    if (!pricingItems || pricingItems.length === 0) {
      setValue("pricing.status", "DRAFT");
    }

    append({
      description: "",
      amount: undefined,
    });

    // Focus on the new input after adding
    setTimeout(() => {
      const descriptionInput = lastRowRef.current?.querySelector(
        'input[name^="pricing.items."][name$=".description"]',
      ) as HTMLInputElement;
      descriptionInput?.focus();
    }, 100);
  }, [append, clearErrors, pricingItems, setValue]);

  // Clear all pricing items
  const clearAll = useCallback(() => {
    // Remove all items from the end to the beginning
    for (let i = fields.length - 1; i >= 0; i--) {
      remove(i);
    }
    // Set pricing to undefined entirely so the optional schema validation works
    setValue("pricing", undefined);
    clearErrors("pricing");
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

  // Status badge config
  const statusConfig = {
    DRAFT: {
      label: 'Rascunho',
      icon: IconClock,
      className: 'bg-gray-100 text-gray-700',
    },
    APPROVED: {
      label: 'Aprovado',
      icon: IconCheck,
      className: 'bg-green-100 text-green-700',
    },
    REJECTED: {
      label: 'Rejeitado',
      icon: IconX,
      className: 'bg-red-100 text-red-700',
    },
    CANCELLED: {
      label: 'Cancelado',
      icon: IconBan,
      className: 'bg-gray-50 text-gray-600',
    },
  };

  const { label, icon: StatusIcon, className: statusClass } = statusConfig[pricingStatus as TASK_PRICING_STATUS] || statusConfig.DRAFT;

  const canEditStatus = userRole === 'ADMIN' || userRole === 'FINANCIAL' || userRole === 'COMMERCIAL';

  // Status options for Combobox
  const statusOptions = [
    { label: 'Rascunho', value: 'DRAFT' },
    { label: 'Aprovado', value: 'APPROVED' },
    { label: 'Rejeitado', value: 'REJECTED' },
    { label: 'Cancelado', value: 'CANCELLED' },
  ];

  return (
    <div className="space-y-4">
      {/* Status Badge and Selector Row - Only shown when items exist */}
      {pricingItems && pricingItems.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Badge className={statusClass}>
              <StatusIcon className="w-3 h-3 mr-1" />
              {label}
            </Badge>
          </div>

          {/* Status Selector (for authorized users) */}
          {canEditStatus && !readOnly && (
            <FormField
              control={control}
              name="pricing.status"
              render={({ field }) => (
                <FormItem className="w-[180px]">
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
          )}
        </div>
      )}

      {/* Expiry Date and Total in same row - Always shown when there are pricing items */}
      {pricingItems && pricingItems.length > 0 && (
        <div className="flex items-end gap-2">
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Expiry Date Field */}
            <FormField
              control={control}
              name="pricing.expiresAt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <IconCalendar className="h-4 w-4" />
                    Data de Validade
                    <span className="text-destructive">*</span>
                  </FormLabel>
                  <FormControl>
                    <DateTimeInput
                      {...field}
                      value={field.value || null}
                      placeholder="Selecione a data de validade"
                      disabled={disabled || readOnly}
                      showTime={false}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Total Field - Looks like input but is read-only */}
            <FormItem>
              <FormLabel className="flex items-center gap-2">
                <IconCurrencyReal className="h-4 w-4" />
                Valor Total
              </FormLabel>
              <FormControl>
                <Input
                  value={formatCurrency(calculatedTotal)}
                  readOnly
                  className="bg-transparent font-semibold text-primary cursor-not-allowed"
                />
              </FormControl>
            </FormItem>
          </div>

          {/* Empty spacer to match the trash button width */}
          <div className="w-10 h-10" />
        </div>
      )}

      {fields.length > 0 && (
        <div className="space-y-3">
          {fields.map((field, index) => (
            <div
              key={field.id}
              ref={index === fields.length - 1 ? lastRowRef : null}
              className="flex items-end gap-2"
            >
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Description Field */}
                <FormField
                  control={control}
                  name={`pricing.items.${index}.description`}
                  render={({ field }) => (
                    <FormItem>
                      {index === 0 && (
                        <FormLabel className="flex items-center gap-2">
                          <IconFileText className="h-4 w-4" />
                          Descrição do Item
                        </FormLabel>
                      )}
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value || ""}
                          placeholder="Ex: Pintura lateral, Aerografia logo"
                          disabled={disabled || readOnly}
                          className="bg-transparent"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Amount Field */}
                <FormMoneyInput
                  name={`pricing.items.${index}.amount`}
                  {...(index === 0 ? {
                    label: (
                      <div className="flex items-center gap-2">
                        <IconCurrencyReal className="h-4 w-4" />
                        Valor
                      </div>
                    )
                  } : { label: "" })}
                  placeholder="R$ 0,00"
                  disabled={disabled || readOnly}
                />
              </div>

              {/* Remove Button */}
              {!readOnly && !disabled && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => remove(index)}
                  disabled={disabled}
                  className="text-destructive"
                  title="Remover item"
                >
                  <IconTrash className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {fields.length > 0 && !readOnly && !disabled && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAddItem}
          disabled={disabled}
          className="w-full"
        >
          <IconPlus className="h-4 w-4 mr-2" />
          Adicionar Item
        </Button>
      )}

      {/* Validation Alert - Only for incomplete items */}
      {hasIncompletePricing && (
        <Alert variant="destructive">
          <AlertDescription>
            Alguns itens do precificação estão incompletos. Preencha a descrição e o valor antes de enviar o formulário.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
});

PricingSelector.displayName = "PricingSelector";
