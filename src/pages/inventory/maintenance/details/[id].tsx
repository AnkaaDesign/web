import { useParams, useNavigate } from "react-router-dom";
import { useMaintenance, useMaintenanceMutations, useFinishMaintenance } from "../../../../hooks";
import { routes, MAINTENANCE_STATUS, CHANGE_LOG_ENTITY_TYPE } from "../../../../constants";
import { Button } from "@/components/ui/button";
import { IconAlertTriangle, IconSettings, IconCheck, IconTrash, IconPlayerPlay, IconRefresh, IconEdit } from "@tabler/icons-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/page-header";
import { MaintenanceInfoCard } from "@/components/inventory/maintenance/detail/maintenance-info-card";
import { TargetItemCard } from "@/components/inventory/maintenance/detail/target-item-card";
import { MaintenanceItemsCard } from "@/components/inventory/maintenance/detail/maintenance-items-card";
import { LastRunCard } from "@/components/inventory/maintenance/detail/last-run-card";
import { MaintenanceMetricsCard } from "@/components/inventory/maintenance/detail/maintenance-metrics-card";
import { MaintenanceDetailSkeleton } from "@/components/inventory/maintenance/detail/maintenance-detail-skeleton";
import { ChangelogHistory } from "@/components/ui/changelog-history";

const MaintenanceDetailsPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { updateAsync, deleteAsync } = useMaintenanceMutations();
  const finishMutation = useFinishMaintenance();

  const {
    data: response,
    isLoading,
    error,
    refetch,
  } = useMaintenance(id!, {
    include: {
      item: {
        include: {
          brand: true,
          category: true,
          supplier: true,
          prices: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      },
      itemsNeeded: {
        include: {
          item: {
            include: {
              brand: true,
              category: true,
              prices: {
                orderBy: { createdAt: "desc" },
                take: 1,
              },
            },
          },
        },
      },
      weeklyConfig: true,
      monthlyConfig: true,
      yearlyConfig: true,
    },
    enabled: !!id,
  });

  const maintenance = response?.data;

  if (isLoading) {
    return <MaintenanceDetailSkeleton />;
  }

  if (error || !maintenance) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-neutral-900 dark:to-neutral-800">
        <div className="container mx-auto p-4 sm:p-6 max-w-7xl">
          <div className="flex flex-1 items-center justify-center min-h-[60vh]">
            <div className="text-center px-4 max-w-md mx-auto">
              <div className="animate-in fade-in-50 duration-500">
                <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
                  <IconAlertTriangle className="h-10 w-10 text-red-500" />
                </div>
                <h2 className="text-xl sm:text-2xl font-semibold mb-3 text-foreground">Manutenção não encontrada</h2>
                <p className="text-sm sm:text-base text-muted-foreground mb-6 leading-relaxed">A manutenção que você está procurando não existe ou foi removida do sistema.</p>
                <div className="space-y-3">
                  <Button onClick={() => navigate(routes.inventory.maintenance.root)} className="w-full sm:w-auto">
                    Ir para Lista de Manutenções
                  </Button>
                  <Button variant="outline" onClick={() => navigate(routes.inventory.root)} className="w-full sm:w-auto">
                    Ir para Estoque
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleEdit = () => {
    navigate(routes.inventory.maintenance.edit(maintenance.id));
  };

  const handleRefresh = () => {
    refetch();
  };

  const handleMaintenanceUpdate = () => {
    refetch();
  };

  const handleStart = async () => {
    try {
      const result = await updateAsync({
        id: maintenance.id,
        data: {
          status: MAINTENANCE_STATUS.IN_PROGRESS,
        },
      });

      if (result.success) {
        refetch();
      }
    } catch (error) {
      console.error("Error starting maintenance:", error);
    }
  };

  const handleFinish = async () => {
    try {
      const result = await finishMutation.mutateAsync({
        id: maintenance.id,
        include: {
          item: true,
          lastMaintenanceRun: true,
        },
      });

      if (result.success) {
        refetch();
      }
    } catch (error) {
      console.error("Error finishing maintenance:", error);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Tem certeza que deseja excluir esta manutenção?")) {
      return;
    }

    try {
      const result = await deleteAsync(maintenance.id);

      if (result.success) {
        toast.success("Manutenção excluída com sucesso");
        navigate(routes.inventory.maintenance.root);
      }
    } catch (error) {
      console.error("Error deleting maintenance:", error);
    }
  };

  // Determine which actions are available based on status
  const canStart = maintenance.status === MAINTENANCE_STATUS.PENDING || maintenance.status === MAINTENANCE_STATUS.OVERDUE;
  const canFinish = maintenance.status === MAINTENANCE_STATUS.IN_PROGRESS;
  const canDelete = maintenance.status === MAINTENANCE_STATUS.CANCELLED || maintenance.status === MAINTENANCE_STATUS.COMPLETED;

  // Build actions array dynamically
  const actions = [
    {
      key: "refresh",
      label: "Atualizar",
      icon: IconRefresh,
      onClick: handleRefresh,
    },
  ];

  // Add status-specific actions
  if (canStart) {
    actions.push({
      key: "start",
      label: "Iniciar",
      icon: IconPlayerPlay,
      onClick: handleStart,
    });
  }

  if (canFinish) {
    actions.push({
      key: "finish",
      label: "Concluir",
      icon: IconCheck,
      onClick: handleFinish,
    });
  }

  // Delete action
  if (canDelete) {
    actions.push({
      key: "delete",
      label: "Excluir",
      icon: IconTrash,
      onClick: handleDelete,
    });
  }

  // Edit action always at the end
  actions.push({
    key: "edit",
    label: "Editar",
    icon: IconEdit,
    onClick: handleEdit,
  });

  return (
    <div className="flex flex-col h-full space-y-6">
      {/* Hero Section */}
      <div className="animate-in fade-in-50 duration-500">
        <PageHeader
          variant="detail"
          title={maintenance.name}
          icon={IconSettings}
          className="shadow-lg"
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Estoque", href: routes.inventory.root },
            { label: "Manutenções", href: routes.inventory.maintenance.root },
            { label: maintenance.name },
          ]}
          actions={actions}
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="space-y-6">
          {/* Core Information Grid - Basic Info and Target Item */}
          <div className="animate-in fade-in-50 duration-700">
            {/* Mobile: Single column stacked */}
            <div className="block lg:hidden space-y-4">
              <MaintenanceInfoCard maintenance={maintenance} onMaintenanceUpdate={handleMaintenanceUpdate} className="h-full" />
              <TargetItemCard item={maintenance.item} className="h-full" />
            </div>

            {/* Desktop/Tablet: 2 columns grid */}
            <div className="hidden lg:block">
              <div className="grid grid-cols-2 gap-6">
                <MaintenanceInfoCard maintenance={maintenance as any} onMaintenanceUpdate={handleMaintenanceUpdate} className="h-full" />
                <TargetItemCard item={maintenance.item} className="h-full" />
              </div>
            </div>
          </div>

          {/* Execution and Metrics Grid */}
          <div className="animate-in fade-in-50 duration-800">
            {/* Mobile: Single column stacked */}
            <div className="block lg:hidden space-y-4">
              <LastRunCard
                lastExecution={
                  maintenance.lastRun
                    ? {
                        id: "last-run",
                        status: "COMPLETED",
                        executedAt: maintenance.lastRun.toISOString(),
                        completedAt: maintenance.finishedAt?.toISOString() || null,
                      }
                    : undefined
                }
                previousExecutions={[]}
                className="h-full"
              />
              <MaintenanceMetricsCard maintenance={maintenance} className="h-full" />
            </div>

            {/* Desktop/Tablet: 2 columns grid */}
            <div className="hidden lg:block">
              <div className="grid grid-cols-2 gap-6">
                <LastRunCard
                  lastExecution={
                    maintenance.lastRun
                      ? {
                          id: "last-run",
                          status: "COMPLETED",
                          executedAt: maintenance.lastRun.toISOString(),
                          completedAt: maintenance.lastRun.toISOString(),
                        }
                      : undefined
                  }
                  previousExecutions={[]}
                  className="h-full"
                />
                <MaintenanceMetricsCard maintenance={maintenance} className="h-full" />
              </div>
            </div>
          </div>

          {/* Items Needed and Changelog Grid */}
          <div className="animate-in fade-in-50 duration-900">
            {/* Mobile: Single column stacked */}
            <div className="block lg:hidden space-y-4">
              <MaintenanceItemsCard maintenanceItems={maintenance.itemsNeeded} className="h-full" />
              <ChangelogHistory
                entityType={CHANGE_LOG_ENTITY_TYPE.MAINTENANCE}
                entityId={maintenance.id}
                entityName={maintenance.name}
                entityCreatedAt={maintenance.createdAt}
                className="h-full"
                maxHeight="500px"
              />
            </div>

            {/* Desktop/Tablet: 2 columns grid */}
            <div className="hidden lg:block">
              <div className="grid grid-cols-2 gap-6">
                <MaintenanceItemsCard maintenanceItems={maintenance.itemsNeeded} className="h-full" />
                <ChangelogHistory
                  entityType={CHANGE_LOG_ENTITY_TYPE.MAINTENANCE}
                  entityId={maintenance.id}
                  entityName={maintenance.name}
                  entityCreatedAt={maintenance.createdAt}
                  className="h-full"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MaintenanceDetailsPage;
