import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/ui/page-header";
import { routes, FAVORITE_PAGES } from "../../../../constants";
import { usePageTracker } from "@/hooks/use-page-tracker";
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
      console.error("Error creating maintenance schedule:", error);
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
    <div className="h-full flex flex-col">
      {/* Fixed Header */}
      <div className="flex-shrink-0">
        <div className="max-w-5xl mx-auto">
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
        </div>
      </div>

      {/* Scrollable Form Container */}
      <div className="flex-1 min-h-0 overflow-y-auto mt-6">
        <div className="max-w-5xl mx-auto h-full">
          <MaintenanceScheduleForm mode="create" onSubmit={handleSubmit} onCancel={handleCancel} isSubmitting={createMutation.isPending} onFormStateChange={setFormState} />
        </div>
      </div>
    </div>
  );
};

export default CreateMaintenanceSchedulePage;
