import { useEffect, useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useActivities } from "../../../hooks";
import { routes, FAVORITE_PAGES } from "../../../constants";
import { ActivityBatchEditTable } from "@/components/inventory/activity/batch-edit/activity-batch-edit-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { IconPackage, IconAlertTriangle, IconLoader, IconDeviceFloppy, IconArrowLeft } from "@tabler/icons-react";
import { usePageTracker } from "@/hooks/use-page-tracker";

export default function BatchEditMovementsPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  usePageTracker({
    title: "Editar Movimentações em Lote",
    icon: "package",
  });

  // Get activity IDs from URL params
  const activityIds = useMemo(() => {
    const ids = searchParams.get("ids");
    if (!ids) return [];
    return ids.split(",").filter(Boolean);
  }, [searchParams]);

  // Fetch activities to edit
  const {
    data: response,
    isLoading,
    error,
  } = useActivities({
    where: {
      id: { in: activityIds },
    },
    include: {
      item: {
        include: {
          category: true,
          brand: true,
        },
      },
      user: {
        include: {
          position: true,
        },
      },
    },
    enabled: activityIds.length > 0,
  });

  const activities = response?.data || [];

  // Validate that we have activities to edit
  const hasValidActivities = activities.length > 0;
  const allActivitiesFound = activities.length === activityIds.length;

  const handleCancel = () => {
    navigate(routes.inventory.movements.list);
  };

  if (activityIds.length === 0) {
    return (
      <div className="container mx-auto p-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconAlertTriangle className="h-5 w-5 text-destructive" />
              Nenhuma Movimentação Selecionada
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center space-y-4">
              <p className="text-muted-foreground">Nenhuma movimentação foi selecionada para edição em lote.</p>
              <Button onClick={handleCancel} variant="outline">
                <IconArrowLeft className="mr-2 h-4 w-4" />
                Voltar para Lista
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto p-4">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Carregando Movimentações...</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center p-8">
              <IconLoader className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !hasValidActivities) {
    return (
      <div className="container mx-auto p-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconAlertTriangle className="h-5 w-5 text-destructive" />
              Erro ao Carregar Movimentações
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center space-y-4">
              <p className="text-muted-foreground">{error ? "Ocorreu um erro ao carregar as movimentações selecionadas." : "As movimentações selecionadas não foram encontradas."}</p>
              {!allActivitiesFound && activities.length > 0 && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    Apenas {activities.length} de {activityIds.length} movimentações foram encontradas. As movimentações não encontradas podem ter sido excluídas.
                  </p>
                </div>
              )}
              <div className="flex gap-2 justify-center">
                <Button onClick={handleCancel} variant="outline">
                  <IconArrowLeft className="mr-2 h-4 w-4" />
                  Voltar para Lista
                </Button>
                {activities.length > 0 && (
                  <Button onClick={() => navigate(routes.inventory.movements.list)}>
                    <IconPackage className="mr-2 h-4 w-4" />
                    Ir para Lista de Movimentações
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
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
        const submitButton = document.getElementById("activity-batch-form-submit");
        if (submitButton) {
          submitButton.click();
        }
      },
      variant: "default" as const,
      disabled: false,
    },
  ];

  return (
    <div className="h-full flex flex-col space-y-4">
      {/* Fixed Header */}
      <div className="flex-shrink-0">
        <PageHeader
          title="Editar Movimentações em Lote"
          icon={IconPackage}
          favoritePage={FAVORITE_PAGES.ESTOQUE_MOVIMENTACOES_LISTAR}
          breadcrumbs={[
            { label: "Início", href: "/" },
            { label: "Estoque", href: routes.inventory.root },
            { label: "Movimentações", href: routes.inventory.movements.list },
            { label: "Editar em Lote" },
          ]}
          actions={actions}
        />
      </div>

      {/* Scrollable Content Container */}
      <div className="flex-1 overflow-hidden">
        <ActivityBatchEditTable activities={activities} onCancel={handleCancel} />
      </div>
    </div>
  );
}
