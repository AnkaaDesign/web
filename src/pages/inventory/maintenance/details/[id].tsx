import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useMaintenance, useMaintenanceMutations, useFinishMaintenance } from "../../../../hooks";
import { routes, MAINTENANCE_STATUS, CHANGE_LOG_ENTITY_TYPE } from "../../../../constants";
import { Button } from "@/components/ui/button";
import { IconAlertTriangle, IconCheck, IconTrash, IconPlayerPlay, IconRefresh, IconEdit } from "@tabler/icons-react";
import { PageHeader } from "@/components/ui/page-header";
import { MaintenanceInfoCard } from "@/components/inventory/maintenance/detail/maintenance-info-card";
import { TargetItemCard } from "@/components/inventory/maintenance/detail/target-item-card";
import { ItemsNeededList } from "@/components/inventory/maintenance/common/items-needed-list";
import { MaintenanceDetailSkeleton } from "@/components/inventory/maintenance/detail/maintenance-detail-skeleton";
import { ChangelogHistory } from "@/components/ui/changelog-history";
import { useAuth } from "@/contexts/auth-context";
import { canEditMaintenance } from "@/utils/permissions/entity-permissions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const MaintenanceDetailsPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canEdit = canEditMaintenance(user);
  const { updateAsync, deleteAsync } = useMaintenanceMutations();
  const finishMutation = useFinishMaintenance();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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
      maintenanceSchedule: {
        include: {
          weeklyConfig: true,
          monthlyConfig: true,
          yearlyConfig: true,
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
        <div className="container mx-auto p-4 sm:p-4 max-w-7xl">
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
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error starting maintenance:", error);
      }
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
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error finishing maintenance:", error);
      }
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const result = await deleteAsync(maintenance.id);

      if (result.success) {
        navigate(routes.inventory.maintenance.root);
      }
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error deleting maintenance:", error);
      }
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  // Determine which actions are available based on status
  const canStart = maintenance.status === MAINTENANCE_STATUS.PENDING || maintenance.status === MAINTENANCE_STATUS.OVERDUE;
  const canFinish = maintenance.status === MAINTENANCE_STATUS.IN_PROGRESS;
  const canDelete = maintenance.status === MAINTENANCE_STATUS.CANCELLED || maintenance.status === MAINTENANCE_STATUS.COMPLETED;

  // Build actions array dynamically
  const actions: Array<{
    key: string;
    label: string;
    icon?: any;
    onClick?: () => void;
    disabled?: boolean;
  }> = [
    {
      key: "refresh",
      label: "Atualizar",
      icon: IconRefresh,
      onClick: handleRefresh,
    },
  ];

  // Add status-specific actions only if user can edit
  if (canEdit && canStart) {
    actions.push({
      key: "start",
      label: "Iniciar",
      icon: IconPlayerPlay,
      onClick: handleStart,
    });
  }

  if (canEdit && canFinish) {
    actions.push({
      key: "finish",
      label: "Concluir",
      icon: IconCheck,
      onClick: handleFinish,
    });
  }

  // Edit action only if user can edit
  if (canEdit) {
    actions.push({
      key: "edit",
      label: "Editar",
      icon: IconEdit,
      onClick: handleEdit,
    });
  }

  // Delete action only if user can edit
  if (canEdit && canDelete) {
    actions.push({
      key: "delete",
      label: "Excluir",
      icon: IconTrash,
      onClick: () => setShowDeleteDialog(true),
      disabled: isDeleting,
    });
  }

  return (
    <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
      <PageHeader
        variant="detail"
        title={maintenance.name}
        breadcrumbs={[
          { label: "Início", href: routes.home },
          { label: "Estoque", href: routes.inventory.root },
          { label: "Manutenções", href: routes.inventory.maintenance.root },
          { label: maintenance.name },
        ]}
        actions={actions}
        className="flex-shrink-0"
      />
      <div className="flex-1 overflow-y-auto pb-6">
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Core Information Grid - Basic Info and Target Item */}
            <MaintenanceInfoCard maintenance={maintenance as any} onMaintenanceUpdate={handleMaintenanceUpdate} className="h-full" />
            <TargetItemCard item={maintenance.item} className="h-full" />
          </div>

          {/* Items Needed - Full Width */}
          {maintenance.itemsNeeded && maintenance.itemsNeeded.length > 0 && (
            <ItemsNeededList itemsConfig={maintenance.itemsNeeded.map((mi: any) => ({
              itemId: mi.item?.id || mi.itemId,
              quantity: mi.quantity,
            }))} />
          )}

          {/* Changelog History - Full Width */}
          <ChangelogHistory
            entityType={CHANGE_LOG_ENTITY_TYPE.MAINTENANCE}
            entityId={maintenance.id}
            entityName={maintenance.name}
            entityCreatedAt={maintenance.createdAt}
            maxHeight="500px"
          />
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Manutenção</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta manutenção? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default MaintenanceDetailsPage;
