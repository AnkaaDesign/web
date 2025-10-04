import { useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { IconLoader as Loader2 } from "@tabler/icons-react";
import { IconPackage } from "@tabler/icons-react";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Activity } from "../../../../types";
import type { ActivityUpdateFormData } from "../../../../schemas";
import { activityUpdateSchema } from "../../../../schemas";
import { ACTIVITY_OPERATION, ACTIVITY_OPERATION_LABELS, ACTIVITY_REASON, ACTIVITY_REASON_LABELS } from "../../../../constants";
import { useActivityMutations, useUsers, useEditForm, useItem } from "../../../../hooks";
import { routes } from "../../../../constants";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { PageHeader } from "@/components/ui/page-header";
import { ActivityUserSelector } from "./activity-user-selector";
import { NaturalFloatInput } from "@/components/ui/natural-float-input";

interface ActivityEditFormProps {
  activity: Activity;
}

export function ActivityEditForm({ activity }: ActivityEditFormProps) {
  const navigate = useNavigate();
  const { updateAsync, updateMutation } = useActivityMutations();
  const { data: usersResponse } = useUsers({
    orderBy: { name: "asc" },
    take: 100,
  });

  const users = usersResponse?.data || [];

  // Fetch item details with borrow information
  const { data: itemData } = useItem(activity.itemId, {
    include: {
      borrows: {
        where: { status: "ACTIVE" },
      },
    },
  });

  // Calculate available stock
  const activeBorrowsQuantity =
    itemData?.data?.borrows?.reduce((total, borrow) => {
      return borrow.status === "ACTIVE" ? total + borrow.quantity : total;
    }, 0) || 0;

  const currentStock = itemData?.data?.quantity || 0;
  const availableStock = currentStock - activeBorrowsQuantity;

  // Add a flag to force standard form submission
  const useStandardSubmit = true;

  // Memoize the mapDataToForm function to prevent recreating it on every render
  const mapDataToForm = useMemo(
    () =>
      (data: Activity): ActivityUpdateFormData => {
        const mapped: ActivityUpdateFormData = {
          quantity: data.quantity,
          operation: data.operation,
          userId: data.userId || undefined,
          reason: data.reason || undefined,
        };
        return mapped;
      },
    [],
  );

  const form = useEditForm<ActivityUpdateFormData>({
    originalData: activity,
    defaultValues: {
      quantity: activity.quantity,
      operation: activity.operation,
      userId: activity.userId || undefined,
      reason: activity.reason || undefined,
    },
    resolver: zodResolver(activityUpdateSchema),
    mapDataToForm: mapDataToForm,
    formOptions: {
      mode: "onChange",
    },
    onSubmit: async (changedFields) => {
      try {
        // If no fields changed, show a message
        if (Object.keys(changedFields).length === 0) {
          toast.info("Nenhuma alteração foi feita");
          return;
        }

        const result = await updateAsync({
          id: activity.id,
          data: changedFields as ActivityUpdateFormData,
        });

        if (result.success) {
          // Success toast is handled automatically by API client
          navigate(routes.inventory.movements.root);
        }
      } catch (error) {
        console.error("Error updating activity:", error);
        // Error is handled by the mutation hook
      }
    },
  });

  const handleCancel = () => {
    navigate(routes.inventory.movements.root);
  };

  // Alternative submit handler that submits all values
  const handleDirectSubmit = form.handleSubmitChanges(async (data) => {
    try {
      const result = await updateAsync({
        id: activity.id,
        data: {
          quantity: data.quantity,
          operation: data.operation,
          userId: data.userId,
          reason: data.reason,
        },
      });

      if (result.success) {
        // Success toast is handled automatically by API client
        navigate(routes.inventory.movements.root);
      }
    } catch (error) {
      console.error("Error updating activity:", error);
      toast.error("Erro ao atualizar atividade");
    }
  });

  const isSubmitting = updateMutation.isPending;

  // Watch the operation field for conditional rendering
  const operationValue = form.watch("operation");

  // Debug form values
  useEffect(() => {
    const formValues = form.getValues();
  }, [activity, form, itemData, availableStock]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Editar Movimentação"
        icon={IconPackage}
        variant="form"
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Estoque", href: "/estoque" }, { label: "Movimentações", href: routes.inventory.movements.list }, { label: "Editar" }]}
        isDirty={form.formState.isDirty}
        isSubmitting={isSubmitting}
        actions={[
          {
            key: "cancel",
            label: "Cancelar",
            onClick: handleCancel,
            variant: "outline",
            disabled: isSubmitting,
          },
          {
            key: "save",
            label: "Salvar Alterações",
            icon: isSubmitting ? Loader2 : undefined,
            onClick: useStandardSubmit ? handleDirectSubmit : form.handleSubmitChanges(),
            variant: "default",
            disabled: isSubmitting || !form.formState.isValid,
            loading: isSubmitting,
          },
        ]}
      />

      <form onSubmit={useStandardSubmit ? handleDirectSubmit : form.handleSubmitChanges()} className="space-y-6 max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Informações da Movimentação</CardTitle>
            <CardDescription>Atualize as informações da movimentação de estoque</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Item field - read-only */}
            <FormField
              control={form.control}
              name="itemId"
              render={() => (
                <FormItem>
                  <FormLabel>Item</FormLabel>
                  <FormControl>
                    <Input
                      value={activity.item ? (activity.item.uniCode ? `${activity.item.uniCode} - ${activity.item.name}` : activity.item.name) : "Item não encontrado"}
                      disabled
                      className="bg-muted"
                    />
                  </FormControl>
                  {itemData && (
                    <FormDescription>
                      Estoque disponível: {availableStock}
                      {activeBorrowsQuantity > 0 && ` (${activeBorrowsQuantity} emprestado)`}
                    </FormDescription>
                  )}
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Quantidade <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <NaturalFloatInput
                        value={field.value || 0.01}
                        onChange={field.onChange}
                        min={0.01}
                        max={999999}
                        step={0.01}
                        placeholder="0,01"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="operation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Operação</FormLabel>
                    <FormControl>
                      <Combobox
                        value={field.value || ""}
                        onValueChange={field.onChange}
                        options={[
                          { label: ACTIVITY_OPERATION_LABELS[ACTIVITY_OPERATION.INBOUND], value: ACTIVITY_OPERATION.INBOUND },
                          { label: ACTIVITY_OPERATION_LABELS[ACTIVITY_OPERATION.OUTBOUND], value: ACTIVITY_OPERATION.OUTBOUND },
                        ]}
                        placeholder="Selecione o tipo"
                        searchPlaceholder="Buscar tipo..."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="userId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Usuário Responsável
                    {operationValue === ACTIVITY_OPERATION.OUTBOUND && <span className="text-destructive"> *</span>}
                    {operationValue === ACTIVITY_OPERATION.INBOUND && <span className="text-gray-500 text-xs ml-1">(opcional)</span>}
                  </FormLabel>
                  <FormControl>
                    <ActivityUserSelector
                      value={field.value || undefined}
                      onChange={(value) => field.onChange(value)}
                      users={users}
                      placeholder={operationValue === ACTIVITY_OPERATION.INBOUND ? "Selecione o usuário responsável (opcional)" : "Selecione o usuário responsável"}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Motivo (opcional)</FormLabel>
                  <FormControl>
                    <Combobox
                      value={field.value || ""}
                      onValueChange={(value) => field.onChange(value || undefined)}
                      options={[
                        { label: "Sem motivo específico", value: "" },
                        ...Object.values(ACTIVITY_REASON).map((reason) => ({
                          label: ACTIVITY_REASON_LABELS[reason],
                          value: reason,
                        })),
                      ]}
                      placeholder="Selecione o motivo"
                      searchPlaceholder="Buscar motivo..."
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
