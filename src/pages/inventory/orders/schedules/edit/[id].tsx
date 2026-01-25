import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { routes, FAVORITE_PAGES } from "../../../../../constants";
import { useOrderSchedule, useOrderScheduleMutations } from "../../../../../hooks";
import { OrderScheduleForm } from "@/components/inventory/order-schedule/form/order-schedule-form";
import { PageHeader } from "@/components/ui/page-header";
import { usePageTracker } from "@/hooks/use-page-tracker";
import { IconCalendarRepeat, IconCheck, IconLoader2, IconAlertTriangle } from "@tabler/icons-react";
import type { OrderScheduleUpdateFormData } from "../../../../../schemas";
import { Alert } from "@/components/ui/alert";

export const OrderScheduleEditPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [formState, setFormState] = useState({ isValid: false, isDirty: false });

  // Track page access
  usePageTracker({
    title: "Editar Agendamento de Pedido",
    icon: "calendar-repeat",
  });

  const { updateMutation } = useOrderScheduleMutations();

  // Fetch order schedule with all related data
  const {
    data: response,
    isLoading,
    error,
  } = useOrderSchedule(id!, {
    include: {
      supplier: true,
      weeklyConfig: { include: { daysOfWeek: true } },
      monthlyConfig: { include: { occurrences: true } },
      yearlyConfig: { include: { monthlyConfigs: true } },
    },
    enabled: !!id,
  });

  const schedule = response?.data;

  const handleSubmit = async (data: OrderScheduleUpdateFormData) => {
    if (!id) return;

    try {
      await updateMutation.mutateAsync({ id, data });
      // Success notification is automatically shown by the API client
      navigate(routes.inventory.orders.schedules.root);
    } catch (error: any) {
      // Error is already handled by the API client and mutation
      if (process.env.NODE_ENV !== "production") {
        console.error("Error updating order schedule:", error);
      }
    }
  };

  const handleCancel = () => {
    navigate(routes.inventory.orders.schedules.root);
  };

  const actions = [
    {
      key: "cancel",
      label: "Cancelar",
      onClick: handleCancel,
      variant: "outline" as const,
    },
    {
      key: "submit",
      label: "Salvar",
      icon: updateMutation.isPending ? IconLoader2 : IconCheck,
      onClick: () => {
        const submitButton = document.getElementById("order-schedule-form-submit");
        if (submitButton) {
          submitButton.click();
        }
      },
      variant: "default" as const,
      loading: updateMutation.isPending,
      disabled: updateMutation.isPending || !formState.isDirty,
    },
  ];

  // Loading state
  if (isLoading) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex-shrink-0">
          <div className="max-w-5xl mx-auto">
            <PageHeader
              variant="form"
              title="Editar Agendamento de Pedido"
              icon={IconCalendarRepeat}
              breadcrumbs={[
                { label: "Início", href: routes.home },
                { label: "Estoque", href: routes.inventory.root },
                { label: "Pedidos", href: routes.inventory.orders.root },
                { label: "Agendamentos", href: routes.inventory.orders.schedules.root },
                { label: "Editar" },
              ]}
              actions={actions}
            />
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto mt-6">
          <div className="max-w-5xl mx-auto h-full flex items-center justify-center">
            <div className="text-center">
              <IconLoader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">Carregando agendamento...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !schedule) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex-shrink-0">
          <div className="max-w-5xl mx-auto">
            <PageHeader
              variant="form"
              title="Editar Agendamento de Pedido"
              icon={IconCalendarRepeat}
              breadcrumbs={[
                { label: "Início", href: routes.home },
                { label: "Estoque", href: routes.inventory.root },
                { label: "Pedidos", href: routes.inventory.orders.root },
                { label: "Agendamentos", href: routes.inventory.orders.schedules.root },
                { label: "Editar" },
              ]}
            />
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto mt-6">
          <div className="max-w-5xl mx-auto">
            <Alert variant="destructive">
              <IconAlertTriangle className="h-4 w-4" />
              <div className="ml-2">
                <h4 className="font-semibold">Erro ao carregar agendamento</h4>
                <p className="text-sm mt-1">
                  Não foi possível carregar o agendamento de pedido. Verifique se o ID está correto ou tente novamente mais tarde.
                </p>
              </div>
            </Alert>
          </div>
        </div>
      </div>
    );
  }

  // Prepare default values from the schedule data
  const defaultValues: Partial<OrderScheduleUpdateFormData> = {
    frequency: schedule.frequency,
    frequencyCount: schedule.frequencyCount,
    isActive: schedule.isActive,
    items: schedule.items,
    supplierId: schedule.supplierId || undefined,
    specificDate: schedule.specificDate ? new Date(schedule.specificDate) : undefined,
    dayOfMonth: schedule.dayOfMonth || undefined,
    dayOfWeek: schedule.dayOfWeek || undefined,
    month: schedule.month || undefined,
    customMonths: schedule.customMonths || undefined,
    weeklyConfigId: schedule.weeklyConfigId || undefined,
    monthlyConfigId: schedule.monthlyConfigId || undefined,
    yearlyConfigId: schedule.yearlyConfigId || undefined,
  };

  return (
    <div className="h-full flex flex-col px-4 pt-4">
      <PageHeader
        variant="form"
        title="Editar Agendamento de Pedido"
        icon={IconCalendarRepeat}
        breadcrumbs={[
          { label: "Início", href: routes.home },
          { label: "Estoque", href: routes.inventory.root },
          { label: "Pedidos", href: routes.inventory.orders.root },
          { label: "Agendamentos", href: routes.inventory.orders.schedules.root },
          { label: "Editar" },
        ]}
        actions={actions}
        favoritePage={FAVORITE_PAGES.ESTOQUE_PEDIDOS_AGENDAMENTOS_EDITAR}
      />
      <div className="flex-1 overflow-y-auto pb-6">
        <div className="mt-4 space-y-4">
          <OrderScheduleForm
            mode="edit"
            initialData={defaultValues}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            isSubmitting={updateMutation.isPending}
            onFormStateChange={setFormState}
          />
        </div>
      </div>
    </div>
  );
};

export default OrderScheduleEditPage;
