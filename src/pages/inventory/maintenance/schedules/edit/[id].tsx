import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "@/components/ui/page-header";
import { routes, FAVORITE_PAGES } from "../../../../../constants";
import { usePageTracker } from "@/hooks/use-page-tracker";
import { IconCalendar, IconCheck, IconLoader2, IconAlertTriangle } from "@tabler/icons-react";
import { MaintenanceScheduleForm } from "@/components/inventory/maintenance/schedule/form";
import { useMaintenanceSchedule, useMaintenanceScheduleMutations } from "../../../../../hooks";
import { type MaintenanceScheduleUpdateFormData } from "../../../../../schemas";
import { Alert } from "@/components/ui/alert";

export const EditMaintenanceSchedulePage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Track page access
  usePageTracker({
    title: "Editar Agendamento de Manutenção",
    icon: "calendar",
  });

  const { updateMutation } = useMaintenanceScheduleMutations();
  const [formState, setFormState] = useState({ isValid: false, isDirty: false });

  // Fetch existing maintenance schedule data
  const {
    data: response,
    isLoading,
    error,
  } = useMaintenanceSchedule(id!, {
    include: {
      item: true,
    },
    enabled: !!id,
  });

  const schedule = response?.data;

  const handleSubmit = async (data: MaintenanceScheduleUpdateFormData) => {
    if (!id) return;

    try {
      await updateMutation.mutateAsync({
        id,
        data,
        include: {
          item: true,
        },
      });

      // Success notification is automatically shown by the API client
      navigate(routes.inventory.maintenance.schedules.details(id));
    } catch (error: any) {
      // Error is already handled by the API client and mutation
      console.error("Error updating maintenance schedule:", error);
    }
  };

  const handleCancel = () => {
    if (id) {
      navigate(routes.inventory.maintenance.schedules.details(id));
    } else {
      navigate(routes.inventory.maintenance.schedules.root);
    }
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
        const submitButton = document.getElementById("maintenance-schedule-form-submit");
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
              title="Editar Agendamento de Manutenção"
              icon={IconCalendar}
              breadcrumbs={[
                { label: "Início", href: routes.home },
                { label: "Estoque", href: routes.inventory.root },
                { label: "Manutenção", href: routes.inventory.maintenance.root },
                { label: "Agendamentos", href: routes.inventory.maintenance.schedules.root },
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
              title="Editar Agendamento de Manutenção"
              icon={IconCalendar}
              breadcrumbs={[
                { label: "Início", href: routes.home },
                { label: "Estoque", href: routes.inventory.root },
                { label: "Manutenção", href: routes.inventory.maintenance.root },
                { label: "Agendamentos", href: routes.inventory.maintenance.schedules.root },
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
                  Não foi possível carregar o agendamento de manutenção. Verifique se o ID está correto ou tente novamente mais tarde.
                </p>
              </div>
            </Alert>
          </div>
        </div>
      </div>
    );
  }

  // Prepare default values from the schedule data
  const defaultValues: Partial<MaintenanceScheduleUpdateFormData> = {
    name: schedule.name,
    description: schedule.description || "",
    itemId: schedule.itemId || undefined,
    frequency: schedule.frequency,
    frequencyCount: schedule.frequencyCount,
    isActive: schedule.isActive,
    maintenanceItemsConfig: schedule.maintenanceItemsConfig as any || [],
    specificDate: schedule.specificDate ? new Date(schedule.specificDate) : undefined,
    dayOfMonth: schedule.dayOfMonth || undefined,
    dayOfWeek: schedule.dayOfWeek || undefined,
    month: schedule.month || undefined,
    nextRun: schedule.nextRun ? new Date(schedule.nextRun) : undefined,
  };

  return (
    <div className="h-full flex flex-col">
      {/* Fixed Header */}
      <div className="flex-shrink-0">
        <div className="max-w-5xl mx-auto">
          <PageHeader
            variant="form"
            title="Editar Agendamento de Manutenção"
            icon={IconCalendar}
            breadcrumbs={[
              { label: "Início", href: routes.home },
              { label: "Estoque", href: routes.inventory.root },
              { label: "Manutenção", href: routes.inventory.maintenance.root },
              { label: "Agendamentos", href: routes.inventory.maintenance.schedules.root },
              { label: schedule.name, href: routes.inventory.maintenance.schedules.details(schedule.id) },
              { label: "Editar" },
            ]}
            actions={actions}
            favoritePage={FAVORITE_PAGES.ESTOQUE_MANUTENCAO_AGENDAMENTOS_EDITAR}
          />
        </div>
      </div>

      {/* Scrollable Form Container */}
      <div className="flex-1 min-h-0 overflow-y-auto mt-6">
        <div className="max-w-5xl mx-auto h-full">
          <MaintenanceScheduleForm
            mode="update"
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            isSubmitting={updateMutation.isPending}
            defaultValues={defaultValues}
            onFormStateChange={setFormState}
          />
        </div>
      </div>
    </div>
  );
};

export default EditMaintenanceSchedulePage;
