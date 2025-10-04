import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Form, FormDescription } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { IconLoader, IconDeviceFloppy, IconX } from "@tabler/icons-react";

// Form components
import { OrderScheduleSupplierSelector } from "./supplier-selector";
import { OrderScheduleCategorySelector } from "./category-selector";
import { ItemsSelector } from "./items-selector";
import { ScheduleForm } from "@/components/ui/schedule-form";

// Types and validation
import { type OrderScheduleCreateFormData, orderScheduleCreateSchema } from "../../../../schemas";

interface OrderScheduleFormProps {
  initialData?: Partial<OrderScheduleCreateFormData>;
  onSubmit: (data: OrderScheduleCreateFormData) => Promise<void>;
  onCancel?: () => void;
  isLoading?: boolean;
  mode?: "create" | "edit";
}

export function OrderScheduleForm({ initialData, onSubmit, onCancel, isLoading = false, mode = "create" }: OrderScheduleFormProps) {
  const form = useForm<OrderScheduleCreateFormData>({
    resolver: zodResolver(orderScheduleCreateSchema),
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

  const handleSubmit = async (data: OrderScheduleCreateFormData) => {
    try {
      await onSubmit(data);
    } catch (error) {
      console.error("Erro ao salvar cronograma:", error);
    }
  };

  const handleCancel = () => {
    form.reset();
    onCancel?.();
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">{mode === "create" ? "Criar Cronograma de Pedidos" : "Editar Cronograma de Pedidos"}</h2>
            <p className="text-muted-foreground">
              {mode === "create" ? "Configure um novo cronograma automático para pedidos" : "Atualize as configurações do cronograma de pedidos"}
            </p>
          </div>
        </div>

        <Separator />

        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>Informações Básicas</CardTitle>
            <CardDescription>Defina o status, fornecedor ou categoria e os itens do cronograma</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Supplier Selector */}
              <OrderScheduleSupplierSelector control={form.control} disabled={isLoading} />

              {/* Category Selector */}
              <OrderScheduleCategorySelector control={form.control} disabled={isLoading} />
            </div>

            <FormDescription>Selecione um fornecedor OU uma categoria para o cronograma</FormDescription>

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
            <ScheduleForm control={form.control as any} disabled={isLoading} type="order" showNextRun={true} />
          </CardContent>
        </Card>

        {/* Form Actions */}
        <div className="flex items-center justify-end gap-4 pt-6">
          {onCancel && (
            <Button type="button" variant="outline" onClick={handleCancel} disabled={isLoading}>
              <IconX className="mr-2 h-4 w-4" />
              Cancelar
            </Button>
          )}

          <Button type="submit" disabled={isLoading || !form.formState.isValid}>
            {isLoading ? (
              <>
                <IconLoader className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <IconDeviceFloppy className="mr-2 h-4 w-4" />
                {mode === "create" ? "Cadastrar" : "Atualizar Cronograma"}
              </>
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
