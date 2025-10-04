import { useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { IconCheck, IconLoader2, IconX } from "@tabler/icons-react";
import { debounce } from "../../../utils";

import type { Expense } from "../../../types";
import type {
  ExpenseCreateFormData,
  ExpenseUpdateFormData
} from "../../../schemas";
import {
  expenseCreateSchema,
  expenseUpdateSchema,
} from "../../../schemas";
import { routes } from "../../../constants";
// import { useExpenseMutations } from "../../../hooks";

import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

import { DescriptionInput } from "./form/description-input";
import { AmountInput } from "./form/amount-input";
import { ExpenseDatePicker } from "./form/expense-date-picker";
import { CategorySelect } from "./form/category-select";
import { PaymentMethodSelect } from "./form/payment-method-select";
import { ReceiptNumberInput } from "./form/receipt-number-input";
import { VendorInput } from "./form/vendor-input";
import { NotesInput } from "./form/notes-input";
import { FormErrorDisplay } from "./form/form-error-display";

interface CreateModeProps {
  mode: "create";
  onSubmit?: (data: ExpenseCreateFormData) => Promise<void>;
  defaultValues?: Partial<ExpenseCreateFormData>;
}

interface UpdateModeProps {
  mode: "update";
  expense: Expense;
  onSubmit?: (data: ExpenseUpdateFormData) => Promise<void>;
  defaultValues?: Partial<ExpenseUpdateFormData>;
}

type ExpenseFormProps = (CreateModeProps | UpdateModeProps) & {
  isSubmitting?: boolean;
};

export function ExpenseForm(props: ExpenseFormProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  // const { createAsync, updateAsync } = useExpenseMutations();

  const form = useForm<ExpenseCreateFormData | ExpenseUpdateFormData>({
    resolver: zodResolver(
      props.mode === "create" ? expenseCreateSchema : expenseUpdateSchema
    ),
    mode: "onChange",
    defaultValues: props.defaultValues || (props.mode === "create" ? {
      description: "",
      amount: 0,
      expenseDate: new Date(),
      category: undefined,
      paymentMethod: undefined,
      receiptNumber: "",
      vendor: "",
      notes: "",
    } : {
      description: props.expense.description || "",
      amount: props.expense.amount || 0,
      expenseDate: new Date(props.expense.expenseDate),
      category: props.expense.category,
      paymentMethod: props.expense.paymentMethod,
      receiptNumber: props.expense.receiptNumber || "",
      vendor: props.expense.vendor || "",
      notes: props.expense.notes || "",
    }),
  });

  const isSubmitting = props.isSubmitting || form.formState.isSubmitting;

  // URL state persistence for create mode
  const debouncedUpdateUrl = useMemo(
    () => debounce((values: Partial<ExpenseCreateFormData>) => {
      if (props.mode === "create") {
        const currentParams = new URLSearchParams(searchParams);

        // Update URL with form values
        Object.entries(values).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== "") {
            if (value instanceof Date) {
              currentParams.set(key, value.toISOString());
            } else {
              currentParams.set(key, String(value));
            }
          } else {
            currentParams.delete(key);
          }
        });

        setSearchParams(currentParams, { replace: true });
      }
    }, 300),
    [searchParams, setSearchParams, props.mode]
  );

  // Watch form changes and update URL
  useEffect(() => {
    if (props.mode === "create") {
      const subscription = form.watch((values) => {
        debouncedUpdateUrl(values as Partial<ExpenseCreateFormData>);
      });
      return () => subscription.unsubscribe();
    }
  }, [form, debouncedUpdateUrl, props.mode]);

  // Load values from URL on mount for create mode
  useEffect(() => {
    if (props.mode === "create" && searchParams.size > 0) {
      const urlValues: Partial<ExpenseCreateFormData> = {};

      const description = searchParams.get("description");
      if (description) urlValues.description = description;

      const amount = searchParams.get("amount");
      if (amount && !isNaN(Number(amount))) urlValues.amount = Number(amount);

      const expenseDate = searchParams.get("expenseDate");
      if (expenseDate) {
        const date = new Date(expenseDate);
        if (!isNaN(date.getTime())) urlValues.expenseDate = date;
      }

      const category = searchParams.get("category");
      if (category) urlValues.category = category as any;

      const paymentMethod = searchParams.get("paymentMethod");
      if (paymentMethod) urlValues.paymentMethod = paymentMethod as any;

      const receiptNumber = searchParams.get("receiptNumber");
      if (receiptNumber) urlValues.receiptNumber = receiptNumber;

      const vendor = searchParams.get("vendor");
      if (vendor) urlValues.vendor = vendor;

      const notes = searchParams.get("notes");
      if (notes) urlValues.notes = notes;

      // Reset form with URL values
      if (Object.keys(urlValues).length > 0) {
        form.reset({ ...form.getValues(), ...urlValues });
      }
    }
  }, [searchParams, form, props.mode]);

  const handleSubmit = async (data: ExpenseCreateFormData | ExpenseUpdateFormData) => {
    try {
      if (props.onSubmit) {
        await props.onSubmit(data);
      } else {
        // Default behavior using hooks
        // if (props.mode === "create") {
        //   await createAsync(data as ExpenseCreateFormData);
        //   toast.success("Despesa criada com sucesso!");
        //   navigate(routes.FINANCEIRO_DESPESAS_LISTAR);
        // } else {
        //   await updateAsync({
        //     id: props.expense.id,
        //     data: data as ExpenseUpdateFormData
        //   });
        //   toast.success("Despesa atualizada com sucesso!");
        //   navigate(routes.FINANCEIRO_DESPESAS_LISTAR);
        // }
        toast.success(props.mode === "create" ? "Despesa criada com sucesso!" : "Despesa atualizada com sucesso!");
      }
    } catch (error) {
      console.error("Error submitting expense:", error);
      toast.error("Erro ao salvar despesa. Tente novamente.");
    }
  };

  const handleCancel = () => {
    // navigate(routes.FINANCEIRO_DESPESAS_LISTAR);
    navigate(-1);
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>
            {props.mode === "create" ? "Nova Despesa" : "Editar Despesa"}
          </CardTitle>
          <CardDescription>
            {props.mode === "create"
              ? "Preencha os dados da nova despesa"
              : "Atualize os dados da despesa"}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Column */}
                <div className="space-y-4">
                  <DescriptionInput control={form.control} />
                  <AmountInput control={form.control} />
                  <ExpenseDatePicker control={form.control} />
                  <CategorySelect control={form.control} />
                </div>

                {/* Right Column */}
                <div className="space-y-4">
                  <PaymentMethodSelect control={form.control} />
                  <ReceiptNumberInput control={form.control} />
                  <VendorInput control={form.control} />
                  <NotesInput control={form.control} />
                </div>
              </div>

              {/* Error Display */}
              <FormErrorDisplay
                errors={form.formState.errors}
                isSubmitting={isSubmitting}
              />

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-6 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancel}
                  disabled={isSubmitting}
                >
                  <IconX className="h-4 w-4 mr-2" />
                  Cancelar
                </Button>

                <Button
                  type="submit"
                  disabled={isSubmitting || !form.formState.isValid}
                >
                  {isSubmitting ? (
                    <IconLoader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <IconCheck className="h-4 w-4 mr-2" />
                  )}
                  {props.mode === "create" ? "Criar Despesa" : "Atualizar Despesa"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}