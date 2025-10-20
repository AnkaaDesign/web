import {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
import { useFieldArray, useWatch } from "react-hook-form";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { Input } from "@/components/ui/input";
import { FormMoneyInput } from "@/components/ui/form-money-input";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
}

export const BudgetSelector = forwardRef<
  BudgetSelectorRef,
  BudgetSelectorProps
>(({ control, disabled, onBudgetCountChange }, ref) => {
  const [initialized, setInitialized] = useState(false);
  const lastRowRef = useRef<HTMLDivElement>(null);

  const { fields, append, remove } = useFieldArray({
    control,
    name: "budget",
  });

  // Watch budget values to check for incomplete entries
  const budgetValues = useWatch({
    control,
    name: "budget",
  });

  // Check if any budget is incomplete
  const hasIncompleteBudgets = useMemo(() => {
    if (!budgetValues || budgetValues.length === 0) return false;
    return budgetValues.some((budget: any) =>
      !budget.referencia || budget.referencia.trim() === "" ||
      !budget.valor || budget.valor === 0
    );
  }, [budgetValues]);

  // Initialize with no rows by default (optional field)
  useEffect(() => {
    if (!initialized) {
      setInitialized(true);
    }
  }, [initialized]);

  // Notify parent about count changes
  useEffect(() => {
    if (onBudgetCountChange) {
      onBudgetCountChange(fields.length);
    }
  }, [fields.length, onBudgetCountChange]);

  const handleAddBudget = useCallback(() => {
    append({
      referencia: "",
      valor: null,
    });

    // Focus on the new input after adding
    setTimeout(() => {
      const referenciaInput = lastRowRef.current?.querySelector(
        'input[name^="budget."][name$=".referencia"]',
      ) as HTMLInputElement;
      referenciaInput?.focus();
    }, 100);
  }, [append]);

  // Expose methods via ref
  useImperativeHandle(
    ref,
    () => ({
      addBudget: handleAddBudget,
    }),
    [handleAddBudget],
  );

  const canRemove = fields.length > 0;

  return (
    <div className="space-y-4">
      {fields.length > 0 && (
        <div className="space-y-3">
          {fields.map((field, index) => (
            <div
              key={field.id}
              ref={index === fields.length - 1 ? lastRowRef : null}
              className="flex items-end gap-2"
            >
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Referencia Field */}
                <FormField
                  control={control}
                  name={`budget.${index}.referencia`}
                  render={({ field }) => (
                    <FormItem>
                      {index === 0 && <FormLabel>Referência (Serviços)</FormLabel>}
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

                {/* Valor Field */}
                <FormMoneyInput
                  name={`budget.${index}.valor`}
                  {...(index === 0 ? { label: "Valor" } : { label: "" })}
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
                title="Remover orçamento"
              >
                <IconTrash className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {hasIncompleteBudgets && (
        <Alert variant="destructive">
          <AlertDescription>Alguns orçamentos estão incompletos. Preencha a referência e o valor antes de enviar o formulário.</AlertDescription>
        </Alert>
      )}
    </div>
  );
});

BudgetSelector.displayName = "BudgetSelector";
