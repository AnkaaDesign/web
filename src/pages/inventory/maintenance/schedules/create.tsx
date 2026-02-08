import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/ui/page-header";
import { routes, FAVORITE_PAGES } from "../../../../constants";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { IconCalendar, IconCheck, IconLoader2 } from "@tabler/icons-react";
import { MaintenanceScheduleForm } from "@/components/inventory/maintenance/schedule/form";
import { useMaintenanceScheduleMutations } from "../../../../hooks";
import { type MaintenanceScheduleCreateFormData } from "../../../../schemas";

export const CreateMaintenanceSchedulePage = () => {
  const navigate = useNavigate();

  // Track page access
  usePageTracker({
    title: "Criar Agendamento de Manutenção",
    icon: "calendar",
  });

  const { createMutation } = useMaintenanceScheduleMutations();
  const [formState, setFormState] = useState({ isValid: false, isDirty: false });

  const handleSubmit = async (data: MaintenanceScheduleCreateFormData) => {
    try {
      await createMutation.mutateAsync({
        data,
        include: {
          item: true,
        },
      });

      // Success notification is automatically shown by the API client
      navigate(routes.inventory.maintenance.schedules.root);
    } catch (error: any) {
      // Error is already handled by the API client and mutation
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error creating maintenance schedule:", error);
      }
    }
  };

  const handleCancel = () => {
    navigate(routes.inventory.maintenance.schedules.root);
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
      label: "Cadastrar",
      icon: createMutation.isPending ? IconLoader2 : IconCheck,
      onClick: () => {
        const submitButton = document.getElementById("maintenance-schedule-form-submit");
        if (submitButton) {
          submitButton.click();
        }
      },
      variant: "default" as const,
      loading: createMutation.isPending,
      disabled: createMutation.isPending || !formState.isValid,
    },
  ];

  return (
    <div className="h-full flex flex-col px-4 pt-4">
      <PageHeader
        variant="form"
        title="Criar Agendamento de Manutenção"
        icon={IconCalendar}
        breadcrumbs={[
          { label: "Início", href: routes.home },
          { label: "Estoque", href: routes.inventory.root },
          { label: "Manutenção", href: routes.inventory.maintenance.root },
          { label: "Agendamentos", href: routes.inventory.maintenance.schedules.root },
          { label: "Criar" },
        ]}
        actions={actions}
        favoritePage={FAVORITE_PAGES.ESTOQUE_MANUTENCAO_AGENDAMENTOS_CADASTRAR}
      />
      <div className="flex-1 overflow-y-auto pb-6">
        <div className="mt-4 space-y-4">
          <MaintenanceScheduleForm mode="create" onSubmit={handleSubmit} onCancel={handleCancel} isSubmitting={createMutation.isPending} onFormStateChange={setFormState} />
        </div>
      </div>
    </div>
  );
};

export default CreateMaintenanceSchedulePage;
