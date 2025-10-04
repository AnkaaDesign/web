import { useParams, Navigate } from "react-router-dom";
import { IconBuildingSkyscraper, IconLoader2 } from "@tabler/icons-react";

import { routes, SECTOR_PRIVILEGES } from "../../../../constants";
import { useSector } from "../../../../hooks";

import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/page-header";
import { SectorForm } from "@/components/administration/sector/form";
import { usePageTracker } from "@/hooks/use-page-tracker";

export const SectorEditPage = () => {
  usePageTracker({ title: "sector-edit" });
  const { id } = useParams<{ id: string }>();

  const {
    data: sector,
    isLoading,
    error,
  } = useSector(id || "", {
    enabled: !!id,
  });

  if (!id) {
    return <Navigate to={routes.administration.sectors.root} replace />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <p className="text-destructive mb-4">Erro ao carregar setor</p>
        <Navigate to={routes.administration.sectors.root} replace />
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

  if (!sector || !sector.data) {
    return <Navigate to={routes.administration.sectors.root} replace />;
  }

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.ADMIN}>
      <div className="h-full flex flex-col">
        {/* Fixed Header */}
        <div className="flex-shrink-0">
          <div className="max-w-3xl mx-auto">
            <PageHeader
              variant="form"
              title="Editar Setor"
              icon={IconBuildingSkyscraper}
              breadcrumbs={[
                { label: "Início", href: "/" },
                { label: "Administração" },
                { label: "Setores", href: routes.administration.sectors.root },
                { label: sector.data.name || "Carregando...", href: routes.administration.sectors.details(id) },
                { label: "Editar" },
              ]}
            />
          </div>
        </div>

        {/* Scrollable Form Container */}
        <div className="flex-1 overflow-y-auto mt-6">
          <div className="max-w-3xl mx-auto h-full">
            <SectorForm mode="update" sector={sector.data} />
          </div>
        </div>
      </div>
    </PrivilegeRoute>
  );
};
