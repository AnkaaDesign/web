import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MaintenanceForm } from "@/components/inventory/maintenance/form";
import { useMaintenanceMutations } from "../../../hooks";
import { type MaintenanceCreateFormData } from "../../../schemas";
import { routes, FAVORITE_PAGES } from "../../../constants";
import { PageHeader } from "@/components/ui";
import { IconCheck, IconLoader2, IconTool } from "@tabler/icons-react";
import { usePageTracker } from "@/hooks/use-page-tracker";

export const CreateMaintenancePage = () => {
  usePageTracker({
    title: "Cadastrar Manutenção",
    icon: "tool",
  });

  const navigate = useNavigate();
  const { createMutation } = useMaintenanceMutations();
  const [formState, setFormState] = useState({ isValid: false, isDirty: false });

  const handleSubmit = async (data: MaintenanceCreateFormData) => {
    try {
      const result = await createMutation.mutateAsync({
        data,
        include: {
          item: true,
          itemsNeeded: {
            include: {
              item: true,
            },
          },
        },
      });

      navigate(routes.inventory.maintenance.details(result.data?.id || ""));
    } catch (error: any) {
      // Error is already handled by the API client and mutation
      console.error("Error creating maintenance:", error);
    }
  };

  const handleCancel = () => {
    navigate(routes.inventory.maintenance.root);
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
        const submitButton = document.getElementById("maintenance-form-submit");
        submitButton?.click();
      },
      variant: "default" as const,
      loading: createMutation.isPending,
      disabled: createMutation.isPending,
    },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Fixed Header */}
      <div className="flex-shrink-0">
        <div className="max-w-5xl mx-auto">
          <PageHeader
            variant="form"
            title="Cadastrar Manutenção"
            icon={IconTool}
            breadcrumbs={[
              { label: "Início", href: routes.home },
              { label: "Estoque", href: routes.inventory.root },
              { label: "Manutenção", href: routes.inventory.maintenance.root },
              { label: "Cadastrar" },
            ]}
            actions={actions}
            favoritePage={FAVORITE_PAGES.ESTOQUE_MANUTENCAO_CADASTRAR}
          />
        </div>
      </div>

      {/* Scrollable Form Container */}
      <div className="flex-1 overflow-y-auto mt-6">
        <div className="max-w-5xl mx-auto h-full">
          <MaintenanceForm mode="create" onSubmit={handleSubmit} isSubmitting={createMutation.isPending} onFormStateChange={setFormState} />
        </div>
      </div>
    </div>
  );
};

export default CreateMaintenancePage;
