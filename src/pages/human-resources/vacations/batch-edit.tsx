import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { IconBeach, IconLoader2, IconAlertTriangle } from "@tabler/icons-react";

import { routes, SECTOR_PRIVILEGES } from "../../../constants";
import { useVacations } from "../../../hooks";
import type { Vacation } from "../../../types";

import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/page-header";
import { VacationBatchForm } from "@/components/human-resources/vacation/batch-edit/vacation-batch-form";
import { Card, CardContent } from "@/components/ui/card";
import { usePageTracker } from "@/hooks/use-page-tracker";

export const VacationBatchEditPage = () => {
  usePageTracker({ title: "Page", icon: "star" });
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [vacations, setVacations] = useState<Vacation[]>([]);

  const selectedIds = searchParams.get("ids")?.split(",").filter(Boolean) || [];

  const { data, isLoading } = useVacations({
    where: {
      id: { in: selectedIds },
    },
    include: {
      user: true,
    },
    limit: 100,
    enabled: selectedIds.length > 0,
  });

  useEffect(() => {
    if (data?.data) {
      setVacations(data.data);
    }
  }, [data]);

  useEffect(() => {
    if (selectedIds.length === 0) {
      navigate(routes.humanResources.vacations.root);
    }
  }, [selectedIds, navigate]);

  if (isLoading) {
    return (
      <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.HUMAN_RESOURCES}>
        <div className="flex flex-col h-full">
          <div className="flex-shrink-0">
            <div className="container mx-auto max-w-7xl p-4 sm:p-6">
              <PageHeader
                variant="batch"
                title="Edição em Lote de Férias"
                icon={IconBeach}
                breadcrumbs={[
                  { label: "Início", href: routes.home },
                  { label: "Recursos Humanos" },
                  { label: "Férias", href: routes.humanResources.vacations.root },
                  { label: "Edição em Lote" },
                ]}
                selection={{
                  count: selectedIds.length,
                  entityName: "férias",
                  onClearSelection: () => navigate(routes.humanResources.vacations.root),
                }}
              />
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <IconLoader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </div>
      </PrivilegeRoute>
    );
  }

  if (vacations.length === 0) {
    return (
      <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.HUMAN_RESOURCES}>
        <div className="flex flex-col h-full">
          <div className="flex-shrink-0">
            <div className="container mx-auto max-w-7xl p-4 sm:p-6">
              <PageHeader
                variant="batch"
                title="Edição em Lote de Férias"
                icon={IconBeach}
                breadcrumbs={[
                  { label: "Início", href: routes.home },
                  { label: "Recursos Humanos" },
                  { label: "Férias", href: routes.humanResources.vacations.root },
                  { label: "Edição em Lote" },
                ]}
                selection={{
                  count: 0,
                  entityName: "férias",
                  onClearSelection: () => navigate(routes.humanResources.vacations.root),
                }}
              />
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center p-4">
            <Card>
              <CardContent className="p-8 text-center">
                <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
                  <IconAlertTriangle className="h-10 w-10 text-orange-500" />
                </div>
                <p className="text-muted-foreground">Nenhuma férias selecionada para edição em lote.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </PrivilegeRoute>
    );
  }

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.HUMAN_RESOURCES}>
      <div className="flex flex-col h-full">
        {/* Fixed Header */}
        <div className="flex-shrink-0">
          <div className="container mx-auto max-w-7xl p-4 sm:p-6">
            <PageHeader
              variant="batch"
              title="Edição em Lote de Férias"
              icon={IconBeach}
              breadcrumbs={[
                { label: "Início", href: routes.home },
                { label: "Recursos Humanos" },
                { label: "Férias", href: routes.humanResources.vacations.root },
                { label: "Edição em Lote" },
              ]}
              selection={{
                count: vacations.length,
                entityName: "férias",
                onClearSelection: () => navigate(routes.humanResources.vacations.root),
              }}
              backButton={{
                onClick: () => navigate(routes.humanResources.vacations.root),
                label: "Voltar para lista",
              }}
            />
          </div>
        </div>

        {/* Scrollable Form Container */}
        <div className="flex-1 overflow-y-auto">
          <div className="container mx-auto max-w-7xl p-4 sm:p-6">
            <VacationBatchForm vacations={vacations} />
          </div>
        </div>
      </div>
    </PrivilegeRoute>
  );
};
