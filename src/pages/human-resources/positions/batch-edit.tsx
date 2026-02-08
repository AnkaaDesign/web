import { useState, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { usePositions } from "../../../hooks";
import type { Position } from "../../../types";
import { routes, FAVORITE_PAGES, SECTOR_PRIVILEGES } from "../../../constants";
import { PositionBatchEditTable } from "@/components/human-resources/position/batch-edit/position-batch-edit-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { toast } from "sonner";
import { IconBriefcase, IconAlertTriangle, IconLoader, IconDeviceFloppy, IconX, IconArrowLeft } from "@tabler/icons-react";
import { usePageTracker } from "@/hooks/common/use-page-tracker";

export const PositionBatchEditPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  usePageTracker({
    title: "Editar Cargos em Lote",
    icon: "briefcase",
  });

  // Get position IDs from URL params
  const positionIds = useMemo(() => {
    const ids = searchParams.get("ids");
    if (!ids) return [];
    return ids.split(",").filter(Boolean);
  }, [searchParams]);

  // Fetch positions to edit
  const {
    data: positionsResponse,
    isLoading,
    error,
  } = usePositions(
    {
      where: {
        id: { in: positionIds },
      },
      include: {
        users: true,
        remunerations: true,
        _count: true,
      },
    },
    {
      enabled: positionIds.length > 0,
    },
  );

  const positions = positionsResponse?.data || [];

  // Validate that we have positions to edit
  const hasValidPositions = positions.length > 0;
  const allPositionsFound = positions.length === positionIds.length;

  const handleCancel = () => {
    navigate(routes.humanResources.positions.root);
  };

  if (positionIds.length === 0) {
    return (
      <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.HUMAN_RESOURCES}>
        <div className="container mx-auto p-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconAlertTriangle className="h-5 w-5 text-destructive" />
                Nenhum Cargo Selecionado
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center space-y-4">
                <p className="text-muted-foreground">Nenhum cargo foi selecionado para edição em lote.</p>
                <Button onClick={handleCancel} variant="outline">
                  <IconArrowLeft className="mr-2 h-4 w-4" />
                  Voltar para Lista
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </PrivilegeRoute>
    );
  }

  if (isLoading) {
    return (
      <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.HUMAN_RESOURCES}>
        <div className="container mx-auto p-4">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Carregando Cargos...</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center p-8">
                <IconLoader className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>
      </PrivilegeRoute>
    );
  }

  if (error || !hasValidPositions) {
    return (
      <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.HUMAN_RESOURCES}>
        <div className="container mx-auto p-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconAlertTriangle className="h-5 w-5 text-destructive" />
                Erro ao Carregar Cargos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center space-y-4">
                <p className="text-muted-foreground">{error ? "Ocorreu um erro ao carregar os cargos selecionados." : "Os cargos selecionados não foram encontrados."}</p>
                {!allPositionsFound && positions.length > 0 && (
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
                    <p className="text-sm text-amber-700 dark:text-amber-300">
                      Apenas {positions.length} de {positionIds.length} cargos foram encontrados. Os cargos não encontrados podem ter sido excluídos.
                    </p>
                  </div>
                )}
                <div className="flex gap-2 justify-center">
                  <Button onClick={handleCancel} variant="outline">
                    <IconArrowLeft className="mr-2 h-4 w-4" />
                    Voltar para Lista
                  </Button>
                  {positions.length > 0 && (
                    <Button onClick={() => navigate(routes.humanResources.positions.root)}>
                      <IconBriefcase className="mr-2 h-4 w-4" />
                      Ir para Lista de Cargos
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </PrivilegeRoute>
    );
  }

  const actions = [
    {
      key: "cancel",
      label: "Cancelar",
      onClick: handleCancel,
      variant: "outline" as const,
      disabled: false,
    },
    {
      key: "save",
      label: "Salvar Alterações",
      icon: IconDeviceFloppy,
      onClick: () => {
        const submitButton = document.getElementById("position-batch-form-submit");
        if (submitButton) {
          submitButton.click();
        }
      },
      variant: "default" as const,
      disabled: false,
    },
  ];

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.HUMAN_RESOURCES}>
      <div className="h-full flex flex-col bg-background px-4 pt-4">
        <PageHeader
          title="Editar Cargos em Lote"
          icon={IconBriefcase}
          favoritePage={FAVORITE_PAGES.RECURSOS_HUMANOS_CARGOS_LISTAR}
          breadcrumbs={[
            { label: "Início", href: "/" },
            { label: "Recursos Humanos", href: routes.humanResources.root },
            { label: "Cargos", href: routes.humanResources.positions.root },
            { label: "Editar em Lote" },
          ]}
          actions={actions}
          className="flex-shrink-0"
        />
        <div className="flex-1 overflow-hidden pt-4 pb-6">
          <PositionBatchEditTable
            positions={positions}
            onCancel={handleCancel}
            onSubmit={() => {
              // This will be triggered from the page header save button
              const submitButton = document.getElementById("position-batch-form-submit");
              if (submitButton) {
                submitButton.click();
              }
            }}
          />
        </div>
      </div>
    </PrivilegeRoute>
  );
};
