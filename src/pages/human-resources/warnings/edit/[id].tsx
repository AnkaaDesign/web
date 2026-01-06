import { useParams, Navigate } from "react-router-dom";
import { IconAlertTriangle, IconLoader2 } from "@tabler/icons-react";

import { routes, SECTOR_PRIVILEGES } from "../../../../constants";
import { useWarning } from "../../../../hooks";

import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/page-header";
import { WarningForm } from "@/components/human-resources/warning/form";
import { usePageTracker } from "@/hooks/use-page-tracker";

export const WarningEditPage = () => {
  usePageTracker({ title: "Editar Advertência", icon: "edit" });
  const { id } = useParams<{ id: string }>();

  const {
    data: warning,
    isLoading,
    error,
  } = useWarning(id || "", {
    include: {
      collaborator: true,
      supervisor: true,
      witness: true,
    },
    enabled: !!id,
  });

  if (!id) {
    return <Navigate to={routes.humanResources.warnings.root} replace />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <p className="text-destructive mb-4">Erro ao carregar advertência</p>
        <Navigate to={routes.humanResources.warnings.root} replace />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <IconLoader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!warning || !warning.data) {
    return <Navigate to={routes.humanResources.warnings.root} replace />;
  }

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.HUMAN_RESOURCES}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="form"
          title="Editar Advertência"
          icon={IconAlertTriangle}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Recursos Humanos" },
            { label: "Advertências", href: routes.humanResources.warnings.root },
            { label: warning.data.collaborator?.name || "Advertência", href: routes.humanResources.warnings.details(id) },
            { label: "Editar" },
          ]}
          className="flex-shrink-0"
        />
        <div className="flex-1 overflow-y-auto pb-6">
          <WarningForm mode="update" warning={warning.data} />
        </div>
      </div>
    </PrivilegeRoute>
  );
};
