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
import { IconPlus, IconTrash, IconCalendar, IconFileText, IconCurrencyReal } from "@tabler/icons-react";
import { Input } from "@/components/ui/input";
import { FormMoneyInput } from "@/components/ui/form-money-input";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatCurrency } from "../../../../utils";
import type {
  TaskCreateFormData,
  TaskUpdateFormData,
} from "../../../../schemas";

interface BudgetSelectorProps {
  control: any;
  disabled?: boolean;
  onBudgetCountChange?: (count: number) => void;
}

export interface BudgetSelectorRef {
  addBudget: () => void;
  clearAll: () => void;
}

export const BudgetSelector = forwardRef<
  BudgetSelectorRef,
  BudgetSelectorProps
>(({ control, disabled, onBudgetCountChange }, ref) => {
  const [initialized, setInitialized] = useState(false);
  const lastRowRef = useRef<HTMLDivElement>(null);
  const { setValue, clearErrors } = useFormContext();

  const { fields, append, remove } = useFieldArray({
    control,
    name: "budget.items",
  });

  // Watch budget values to check for incomplete entries and calculate total
  const budgetItems = useWatch({
    control,
    name: "budget.items",
  });

  const budgetExpiresIn = useWatch({
    control,
    name: "budget.expiresIn",
  });

  // Calculate total from all budget items
  const calculatedTotal = useMemo(() => {
    if (!budgetItems || budgetItems.length === 0) return 0;
    return budgetItems.reduce((sum: number, item: any) => {
      const amount = typeof item.amount === 'number' ? item.amount : Number(item.amount) || 0;
      return sum + amount;
    }, 0);
  }, [budgetItems]);

  // Check if any budget item is incomplete
  const hasIncompleteBudgets = useMemo(() => {
    if (!budgetItems || budgetItems.length === 0) return false;
    return budgetItems.some((item: any) =>
      !item.description || item.description.trim() === "" ||
      !item.amount || item.amount === 0
    );
  }, [budgetItems]);

  // Initialize with no rows by default (optional field)
  useEffect(() => {
    if (!initialized) {
      setInitialized(true);
    }
  }, [initialized]);

  // Notify parent about count changes
  useEffect(() => {
    if (onBudgetCountChange) {
      // Count budget items or 1 if there's budget data (to show the budget card)
      const count = budgetItems && budgetItems.length > 0 ? 1 : 0;
      onBudgetCountChange(count);
    }
  }, [budgetItems, onBudgetCountChange]);

  const handleAddBudgetItem = useCallback(() => {
    // Clear any existing budget errors before adding
    clearErrors("budget");

    append({
      description: "",
      amount: undefined,
    });

    // Focus on the new input after adding
    setTimeout(() => {
      const descriptionInput = lastRowRef.current?.querySelector(
        'input[name^="budget.items."][name$=".description"]',
      ) as HTMLInputElement;
      descriptionInput?.focus();
    }, 100);
  }, [append, clearErrors]);

  // Clear all budget items
  const clearAll = useCallback(() => {
    // Remove all items from the end to the beginning
    for (let i = fields.length - 1; i >= 0; i--) {
      remove(i);
    }
    // Set budget to undefined entirely so the optional schema validation works
    // Setting individual fields to null still leaves an object that triggers validation
    setValue("budget", undefined);
    clearErrors("budget");
  }, [fields.length, remove, setValue, clearErrors]);

  // Expose methods via ref
  useImperativeHandle(
    ref,
    () => ({
      addBudget: handleAddBudgetItem,
      clearAll,
    }),
    [handleAddBudgetItem, clearAll],
  );

  const canRemove = fields.length > 0;

  return (
    <div className="space-y-4">
      {/* Expiry Date and Total in same row - Always shown when there are budget items */}
      {budgetItems && budgetItems.length > 0 && (
        <div className="flex items-end gap-2">
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Expiry Date Field */}
            <FormField
              control={control}
              name="budget.expiresIn"
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
                      disabled={disabled}
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
                  name={`budget.items.${index}.description`}
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
                          disabled={disabled}
                          className="bg-transparent"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Amount Field */}
                <FormMoneyInput
                  name={`budget.items.${index}.amount`}
                  {...(index === 0 ? {
                    label: (
                      <div className="flex items-center gap-2">
                        <IconCurrencyReal className="h-4 w-4" />
                        Valor
                      </div>
                    )
                  } : { label: "" })}
                  placeholder="R$ 0,00"
                  disabled={disabled}
                />
              </div>

              {/* Remove Button */}
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
            </div>
          ))}
        </div>
      )}

      {fields.length > 0 && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAddBudgetItem}
          disabled={disabled}
          className="w-full"
        >
          <IconPlus className="h-4 w-4 mr-2" />
          Adicionar
        </Button>
      )}

      {/* Validation Alert - Only for incomplete items */}
      {hasIncompleteBudgets && (
        <Alert variant="destructive">
          <AlertDescription>
            Alguns itens do orçamento estão incompletos. Preencha a descrição e o valor antes de enviar o formulário.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
});

BudgetSelector.displayName = "BudgetSelector";
