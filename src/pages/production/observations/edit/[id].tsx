import { useParams, useNavigate } from "react-router-dom";
import { useObservation } from "../../../../hooks";
import { routes, SECTOR_PRIVILEGES } from "../../../../constants";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ObservationForm } from "@/components/production/observation/form";
import { IconAlertCircle } from "@tabler/icons-react";
import { usePageTracker } from "@/hooks/use-page-tracker";
import type { Observation } from "../../../../types";

export const ObservationEdit = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Track page for analytics
  usePageTracker({ title: "Observações - Editar", icon: "observations_edit" });

  // Fetch observation data
  const { data, isLoading, isError } = useObservation(id!, {
    enabled: !!id,
    include: {
      task: {
        include: {
          customer: {
            include: {
              logo: true,
            },
          },
          sector: true,
        },
      },
      files: true,
    },
  });

  const observation = data?.data;

  const handleSuccess = (updatedObservation: Observation) => {
    navigate(routes.production.observations.details(updatedObservation.id));
  };

  const handleCancel = () => {
    if (id) {
      navigate(routes.production.observations.details(id));
    } else {
      navigate(routes.production.observations.root);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.PRODUCTION, SECTOR_PRIVILEGES.WAREHOUSE, SECTOR_PRIVILEGES.COMMERCIAL, SECTOR_PRIVILEGES.ADMIN]}>
        <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
          <PageHeader
            variant="form"
            title="Carregando..."
            icon={IconAlertCircle}
            breadcrumbs={[
              { label: "Início", href: routes.home },
              { label: "Produção", href: routes.production.root },
              { label: "Observações", href: routes.production.observations.root },
              { label: "Editar" },
            ]}
            className="flex-shrink-0"
          />
          <div className="flex-1 overflow-y-auto pb-6">
            <Card>
              <CardContent className="p-4">
                <div className="space-y-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-32 w-full" />
                  <Skeleton className="h-64 w-full" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </PrivilegeRoute>
    );
  }

  // Error or not found state
  if (isError || !observation) {
    return (
      <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.PRODUCTION, SECTOR_PRIVILEGES.WAREHOUSE, SECTOR_PRIVILEGES.COMMERCIAL, SECTOR_PRIVILEGES.ADMIN]}>
        <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
          <PageHeader
            variant="form"
            title="Observação não encontrada"
            icon={IconAlertCircle}
            breadcrumbs={[
              { label: "Início", href: routes.home },
              { label: "Produção", href: routes.production.root },
              { label: "Observações", href: routes.production.observations.root },
              { label: "Editar" },
            ]}
            backButton={{
              onClick: () => navigate(routes.production.observations.root),
            }}
            className="flex-shrink-0"
          />
          <div className="flex-1 overflow-y-auto pb-6">
            <Card>
              <CardContent className="p-4">
                <div className="text-center">
                  <div className="p-4 rounded-lg bg-red-50 border border-red-200">
                    <p className="text-red-800 font-medium">Observação não encontrada</p>
                    <p className="text-red-600 text-sm mt-1">A observação solicitada não existe ou você não tem permissão para acessá-la.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </PrivilegeRoute>
    );
  }

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.PRODUCTION, SECTOR_PRIVILEGES.WAREHOUSE, SECTOR_PRIVILEGES.COMMERCIAL, SECTOR_PRIVILEGES.ADMIN]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="form"
          title={`Editar Observação`}
          icon={IconAlertCircle}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Produção", href: routes.production.root },
            { label: "Observações", href: routes.production.observations.root },
            { label: observation.id, href: routes.production.observations.details(observation.id) },
            { label: "Editar" },
          ]}
          actions={[
            {
              key: "cancel",
              label: "Cancelar",
              onClick: handleCancel,
              variant: "outline" as const,
            },
            {
              key: "submit",
              label: "Salvar",
              onClick: () => {
                // Trigger form submit by clicking the hidden submit button
                const submitButton = document.getElementById("observation-form-submit");
                if (submitButton) {
                  submitButton.click();
                }
              },
              variant: "default" as const,
            },
          ]}
          className="flex-shrink-0"
        />
        <div className="flex-1 overflow-y-auto pb-6">
          <ObservationForm observationId={observation.id} mode="edit" onSuccess={handleSuccess} onCancel={handleCancel} />
        </div>
      </div>
    </PrivilegeRoute>
  );
};
