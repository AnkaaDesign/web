import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { MaintenanceForm } from "@/components/inventory/maintenance/form";
import { useMaintenance, useMaintenanceMutations } from "../../../../hooks";
import { type MaintenanceUpdateFormData, mapMaintenanceToFormData } from "../../../../schemas";
import { routes } from "../../../../constants";
import { IconLoader2, IconTool, IconCheck } from "@tabler/icons-react";
import { PageHeader } from "@/components/ui";
import { Card, CardContent } from "@/components/ui/card";
import { usePageTracker } from "@/hooks/use-page-tracker";

export const EditMaintenancePage = () => {
  const { id } = useParams<{ id: string }>();

  usePageTracker({
    title: "Editar Manutenção",
    icon: "tool",
  });

  const navigate = useNavigate();
  const { updateMutation } = useMaintenanceMutations();
  const [formState, setFormState] = useState({ isValid: false, isDirty: false });

  // Fetch maintenance data with all includes
  const {
    data: maintenance,
    isLoading,
    error,
  } = useMaintenance(id!, {
    include: {
      item: true,
      itemsNeeded: {
        include: {
          item: true,
        },
      },
    },
    enabled: !!id,
  });

  const handleSubmit = async (data: MaintenanceUpdateFormData) => {
    if (!id) return;

    try {
      const result = await updateMutation.mutateAsync({
        id,
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
      // Error handled by mutation hook
      throw error;
    }
  };

  if (isLoading) {
    return (
      <div className="h-full flex flex-col">
        {/* Fixed Header */}
        <div className="flex-shrink-0">
          <div className="max-w-5xl mx-auto">
            <PageHeader
              title="Editar Manutenção"
              icon={IconTool}
              variant="form"
              breadcrumbs={[
                { label: "Início", href: routes.home },
                { label: "Estoque", href: routes.inventory.root },
                { label: "Manutenções", href: routes.inventory.maintenance.list },
                { label: "Editar" },
              ]}
              backButton={{
                onClick: () => navigate(routes.inventory.maintenance.list),
              }}
            />
          </div>
        </div>

        {/* Scrollable Form Container */}

        <div className="flex-1 mt-6">
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <div className="flex items-center gap-2 text-muted-foreground">
                <IconLoader2 className="h-5 w-5 animate-spin" />
                Carregando manutenção...
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error || !maintenance?.data) {
    return (
      <div className="h-full flex flex-col">
        {/* Fixed Header */}
        <div className="flex-shrink-0">
          <div className="max-w-5xl mx-auto">
            <PageHeader
              title="Editar Manutenção"
              icon={IconTool}
              variant="form"
              breadcrumbs={[
                { label: "Início", href: routes.home },
                { label: "Estoque", href: routes.inventory.root },
                { label: "Manutenções", href: routes.inventory.maintenance.list },
                { label: "Editar" },
              ]}
              backButton={{
                onClick: () => navigate(routes.inventory.maintenance.list),
              }}
            />
          </div>
        </div>

        {/* Scrollable Form Container */}

        <div className="flex-1 mt-6">
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <div className="text-center">
                <p className="text-destructive mb-2">Erro ao carregar manutenção</p>
                <p className="text-sm text-muted-foreground">{error?.message || "Manutenção não encontrada"}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Map the fetched data to form data format
  const formData = mapMaintenanceToFormData(maintenance.data);

  // Submit action
  const handleFormSubmit = () => {
    const form = document.getElementById("maintenance-form-submit") as HTMLFormElement;
    if (form) {
      form.requestSubmit();
    }
  };

  // Define actions for PageHeader
  const actions = [
    {
      key: "submit",
      label: "Salvar Alterações",
      icon: updateMutation.isPending ? IconLoader2 : IconCheck,
      onClick: handleFormSubmit,
      variant: "default" as const,
      disabled: updateMutation.isPending || (!formState.isDirty && !updateMutation.isPending),
      loading: updateMutation.isPending,
    },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Fixed Header */}
      <div className="flex-shrink-0">
        <div className="max-w-5xl mx-auto">
          <PageHeader
            title="Editar Manutenção"
            icon={IconTool}
            variant="form"
            breadcrumbs={[
              { label: "Início", href: routes.home },
              { label: "Estoque", href: routes.inventory.root },
              { label: "Manutenções", href: routes.inventory.maintenance.list },
              { label: "Editar" },
            ]}
            backButton={{
              onClick: () => navigate(routes.inventory.maintenance.details(id!)),
            }}
            actions={actions}
          />
        </div>
      </div>

      {/* Scrollable Form Container */}
      <div className="flex-1 overflow-y-auto mt-6">
        <div className="max-w-5xl mx-auto h-full">
          <MaintenanceForm mode="update" onSubmit={handleSubmit} defaultValues={formData} isSubmitting={updateMutation.isPending} onFormStateChange={setFormState} />
        </div>
      </div>
    </div>
  );
};
