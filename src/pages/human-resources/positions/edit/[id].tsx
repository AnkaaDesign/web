import { useParams, Navigate } from "react-router-dom";
import { IconBriefcase, IconLoader2 } from "@tabler/icons-react";

import { routes, SECTOR_PRIVILEGES } from "../../../../constants";
import { usePosition } from "../../../../hooks";

import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/page-header";
import { PositionForm } from "@/components/human-resources/position/form";
import { usePageTracker } from "@/hooks/use-page-tracker";

export const PositionEditPage = () => {
  usePageTracker({ title: "Page", icon: "star" });
  const { id } = useParams<{ id: string }>();

  const {
    data: position,
    isLoading,
    error,
  } = usePosition(id || "", {
    enabled: !!id,
  });

  if (!id) {
    return <Navigate to={routes.humanResources.positions.root} replace />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <p className="text-destructive mb-4">Erro ao carregar cargo</p>
        <Navigate to={routes.humanResources.positions.root} replace />
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

  if (!position) {
    return <Navigate to={routes.humanResources.positions.root} replace />;
  }

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.HUMAN_RESOURCES}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="form"
          title="Editar Cargo"
          icon={IconBriefcase}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Recursos Humanos" },
            { label: "Cargos", href: routes.humanResources.positions.root },
            { label: position?.data?.name || "Cargo", href: routes.humanResources.positions.details(id) },
            { label: "Editar" },
          ]}
          className="flex-shrink-0"
        />
        <div className="flex-1 overflow-y-auto pb-6">
          <PositionForm mode="update" position={position?.data as any} />
        </div>
      </div>
    </PrivilegeRoute>
  );
};
