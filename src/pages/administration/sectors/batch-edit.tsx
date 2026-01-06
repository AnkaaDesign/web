import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { IconBuildingSkyscraper, IconLoader2, IconAlertTriangle } from "@tabler/icons-react";

import { routes, SECTOR_PRIVILEGES } from "../../../constants";
import { useSectors, useSectorBatchMutations } from "../../../hooks";
import type { Sector } from "../../../types";

import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { SectorBatchEditTable } from "@/components/administration/sector/batch-edit";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { usePageTracker } from "@/hooks/use-page-tracker";

export const SectorBatchEditPage = () => {
  usePageTracker({
    title: "Edição em Lote de Setores",
    icon: "building-skyscraper",
  });
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedIds = searchParams.get("ids")?.split(",").filter(Boolean) || [];

  const { data, isLoading } = useSectors({
    where: {
      id: { in: selectedIds },
    },
    limit: 100,
    enabled: selectedIds.length > 0,
  });

  const { batchUpdateAsync: batchUpdate } = useSectorBatchMutations();

  useEffect(() => {
    if (data?.data) {
      setSectors(data.data);
    }
  }, [data]);

  useEffect(() => {
    if (selectedIds.length === 0) {
      navigate(routes.administration.sectors.root);
    }
  }, [selectedIds, navigate]);

  const handleSubmit = async (data: any) => {
    setIsSubmitting(true);
    try {
      const result = await batchUpdate(data);

      if (result.data) {
        // Batch operations need manual toast since API client skips them
        toast.success(`${result.data.totalSuccess} setor${result.data.totalSuccess !== 1 ? "es" : ""} processado${result.data.totalSuccess !== 1 ? "s" : ""}`);

        if (result.data.totalFailed > 0) {
          toast.error(`${result.data.totalFailed} setor${result.data.totalFailed !== 1 ? "es" : ""} falhou ao atualizar`);
        }
      }

      navigate(routes.administration.sectors.root);
    } catch (error) {
      toast.error("Erro ao atualizar setores");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.ADMIN}>
        <div className="h-full flex flex-col bg-background px-4 pt-4">
          <PageHeader
            variant="batch"
            title="Edição em Lote de Setores"
            icon={IconBuildingSkyscraper}
            breadcrumbs={[
              { label: "Início", href: routes.home },
              { label: "Administração" },
              { label: "Setores", href: routes.administration.sectors.root },
              { label: "Edição em Lote" },
            ]}
            selection={{
              count: selectedIds.length,
              entityName: "setores",
              onClearSelection: () => navigate(routes.administration.sectors.root),
            }}
            className="flex-shrink-0"
          />
          <div className="flex-1 overflow-hidden pt-4 pb-6">
            <div className="flex items-center justify-center min-h-[400px]">
              <IconLoader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          </div>
        </div>
      </PrivilegeRoute>
    );
  }

  if (sectors.length === 0) {
    return (
      <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.ADMIN}>
        <div className="h-full flex flex-col bg-background px-4 pt-4">
          <PageHeader
            variant="batch"
            title="Edição em Lote de Setores"
            icon={IconBuildingSkyscraper}
            breadcrumbs={[
              { label: "Início", href: routes.home },
              { label: "Administração" },
              { label: "Setores", href: routes.administration.sectors.root },
              { label: "Edição em Lote" },
            ]}
            selection={{
              count: 0,
              entityName: "setores",
              onClearSelection: () => navigate(routes.administration.sectors.root),
            }}
            className="flex-shrink-0"
          />
          <div className="flex-1 overflow-hidden pt-4 pb-6">
            <div className="max-w-7xl mx-auto">
              <Card>
                <CardContent className="p-8 text-center">
                  <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
                    <IconAlertTriangle className="h-10 w-10 text-orange-500" />
                  </div>
                  <p className="text-muted-foreground">Nenhum setor selecionado para edição em lote.</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </PrivilegeRoute>
    );
  }

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.ADMIN}>
      <div className="h-full flex flex-col bg-background px-4 pt-4">
        <PageHeader
          variant="batch"
          title="Edição em Lote de Setores"
          icon={IconBuildingSkyscraper}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Administração" },
            { label: "Setores", href: routes.administration.sectors.root },
            { label: "Edição em Lote" },
          ]}
          selection={{
            count: sectors.length,
            entityName: "setores",
            onClearSelection: () => navigate(routes.administration.sectors.root),
          }}
          backButton={{
            onClick: () => navigate(routes.administration.sectors.root),
            label: "Voltar para lista",
          }}
          className="flex-shrink-0"
        />
        <div className="flex-1 overflow-hidden pt-4 pb-6">
          <SectorBatchEditTable sectors={sectors} onSubmit={handleSubmit} isSubmitting={isSubmitting} />
        </div>
      </div>
    </PrivilegeRoute>
  );
};
