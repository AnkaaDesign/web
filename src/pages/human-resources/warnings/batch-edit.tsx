import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { IconAlertTriangle, IconLoader2 } from "@tabler/icons-react";

import { routes, SECTOR_PRIVILEGES } from "../../../constants";
import { useWarnings, useWarningBatchMutations } from "../../../hooks";
import type { Warning } from "../../../types";

import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/page-header";
import { WarningBatchEditTable } from "@/components/human-resources/warning/batch-edit";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { usePageTracker } from "@/hooks/common/use-page-tracker";

export const WarningBatchEditPage = () => {
  usePageTracker({ title: "Edição em Lote de Advertências", icon: "edit" });
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedIds = searchParams.get("ids")?.split(",").filter(Boolean) || [];

  const { data, isLoading } = useWarnings({
    where: {
      id: { in: selectedIds },
    },
    limit: 100,
    include: {
      collaborator: true,
      supervisor: true,
    },
    enabled: selectedIds.length > 0,
  });

  const { batchUpdateAsync: batchUpdate } = useWarningBatchMutations();

  useEffect(() => {
    if (data?.data) {
      setWarnings(data.data);
    }
  }, [data]);

  useEffect(() => {
    if (selectedIds.length === 0) {
      navigate(routes.humanResources.warnings.root);
    }
  }, [selectedIds, navigate]);

  if (isLoading) {
    return (
      <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.HUMAN_RESOURCES}>
        <div className="container mx-auto max-w-7xl p-4 sm:p-4 space-y-6">
          <PageHeader
            variant="batch"
            title="Edição em Lote de Advertências"
            icon={IconAlertTriangle}
            breadcrumbs={[
              { label: "Início", href: routes.home },
              { label: "Recursos Humanos" },
              { label: "Advertências", href: routes.humanResources.warnings.root },
              { label: "Edição em Lote" },
            ]}
            selection={{
              count: selectedIds.length,
              entityName: "advertências",
              onClearSelection: () => navigate(routes.humanResources.warnings.root),
            }}
          />
          <div className="flex items-center justify-center min-h-[400px]">
            <IconLoader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </div>
      </PrivilegeRoute>
    );
  }

  if (warnings.length === 0) {
    return (
      <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.HUMAN_RESOURCES}>
        <div className="container mx-auto max-w-7xl p-4 sm:p-4 space-y-6">
          <PageHeader
            variant="batch"
            title="Edição em Lote de Advertências"
            icon={IconAlertTriangle}
            breadcrumbs={[
              { label: "Início", href: routes.home },
              { label: "Recursos Humanos" },
              { label: "Advertências", href: routes.humanResources.warnings.root },
              { label: "Edição em Lote" },
            ]}
            selection={{
              count: 0,
              entityName: "advertências",
              onClearSelection: () => navigate(routes.humanResources.warnings.root),
            }}
          />
          <Card>
            <CardContent className="p-8 text-center">
              <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
                <IconAlertTriangle className="h-10 w-10 text-orange-500" />
              </div>
              <p className="text-muted-foreground">Nenhuma advertência selecionada para edição em lote.</p>
            </CardContent>
          </Card>
        </div>
      </PrivilegeRoute>
    );
  }

  const handleSubmit = async (data: any) => {
    setIsSubmitting(true);
    try {
      const result = await batchUpdate(data);

      if (result.data) {
        // Success toast is handled automatically by API client
        toast.success(`${result.data.totalSuccess} advertência${result.data.totalSuccess !== 1 ? "s" : ""} processada${result.data.totalSuccess !== 1 ? "s" : ""}`);

        if (result.data.totalFailed > 0) {
          toast.error(`${result.data.totalFailed} advertência${result.data.totalFailed !== 1 ? "s" : ""} falhou ao atualizar`);
        }
      }

      navigate(routes.humanResources.warnings.root);
    } catch (error) {
      toast.error("Erro ao atualizar advertências");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.HUMAN_RESOURCES}>
      <div className="h-full flex flex-col bg-background px-4 pt-4">
        <PageHeader
          variant="batch"
          title="Edição em Lote de Advertências"
          icon={IconAlertTriangle}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Recursos Humanos" },
            { label: "Advertências", href: routes.humanResources.warnings.root },
            { label: "Edição em Lote" },
          ]}
          selection={{
            count: warnings.length,
            entityName: "advertências",
            onClearSelection: () => navigate(routes.humanResources.warnings.root),
          }}
          backButton={{
            onClick: () => navigate(routes.humanResources.warnings.root),
            label: "Voltar para lista",
          }}
          className="flex-shrink-0"
        />
        <div className="flex-1 overflow-hidden pt-4 pb-6">
          <WarningBatchEditTable warnings={warnings} onSubmit={handleSubmit} isSubmitting={isSubmitting} />
        </div>
      </div>
    </PrivilegeRoute>
  );
};
