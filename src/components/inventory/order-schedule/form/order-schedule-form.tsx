import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { IconLoader, IconDeviceFloppy, IconX } from "@tabler/icons-react";

// Form components
import { ItemsSelector } from "./items-selector";
import { ScheduleForm } from "@/components/ui/schedule-form";

// Types and validation
import { type OrderScheduleCreateFormData, type OrderScheduleUpdateFormData, orderScheduleCreateSchema, orderScheduleUpdateSchema } from "../../../../schemas";
import { useEffect } from "react";

interface OrderScheduleFormProps {
  initialData?: Partial<OrderScheduleCreateFormData | OrderScheduleUpdateFormData>;
  onSubmit: (data: OrderScheduleCreateFormData | OrderScheduleUpdateFormData) => Promise<void>;
  onCancel?: () => void;
  isSubmitting?: boolean;
  isLoading?: boolean;
  mode?: "create" | "edit";
  onFormStateChange?: (formState: { isValid: boolean; isDirty: boolean }) => void;
}

export function OrderScheduleForm({ initialData, onSubmit, onCancel, isSubmitting = false, isLoading = false, mode = "create", onFormStateChange }: OrderScheduleFormProps) {
  const form = useForm<OrderScheduleCreateFormData | OrderScheduleUpdateFormData>({
    resolver: zodResolver(mode === "create" ? orderScheduleCreateSchema : orderScheduleUpdateSchema),
    defaultValues: {
      frequency: undefined,
      frequencyCount: 1,
      isActive: true,
      items: [],
      specificDate: undefined,
      dayOfMonth: undefined,
      dayOfWeek: undefined,
      month: undefined,
      customMonths: undefined,
      weeklyConfigId: undefined,
      monthlyConfigId: undefined,
      yearlyConfigId: undefined,
      ...initialData,
    },
    mode: "onBlur",
    reValidateMode: "onChange",
  });

  // Notify parent of form state changes
  useEffect(() => {
    if (onFormStateChange) {
      onFormStateChange({
        isValid: form.formState.isValid,
        isDirty: form.formState.isDirty,
      });
    }
  }, [form.formState.isValid, form.formState.isDirty, onFormStateChange]);

  const handleSubmit = async (data: OrderScheduleCreateFormData | OrderScheduleUpdateFormData) => {
    try {
      await onSubmit(data);
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("Erro ao salvar cronograma:", error);
      }
    }
  };

  const handleCancel = () => {
    form.reset();
    onCancel?.();
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        {/* Hidden submit button for external trigger */}
        <button type="submit" id="order-schedule-form-submit" className="hidden" />

        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>Informações Básicas</CardTitle>
            <CardDescription>Defina os itens do cronograma de pedidos</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Items Selector */}
            <ItemsSelector control={form.control} disabled={isLoading} required />
          </CardContent>
        </Card>

        {/* Schedule Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Configuração do Cronograma</CardTitle>
            <CardDescription>Defina quando e como os pedidos devem ser criados automaticamente</CardDescription>
          </CardHeader>
          <CardContent>
            <ScheduleForm control={form.control as any} disabled={isSubmitting || isLoading} type="order" showNextRun={true} />
          </CardContent>
        </Card>
      </form>
    </Form>
  );
}
