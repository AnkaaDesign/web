import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { routes, PPE_DELIVERY_STATUS, SECTOR_PRIVILEGES } from "../../../../../constants";
import { usePpeDelivery, usePpeDeliveryMutations, useMarkPpeDeliveryAsDelivered, useAuth } from "../../../../../hooks";
import { PpeDeliveryInfoCard, PpeDeliveryScheduleCard, PpeDeliveryChangelogCard, PpeDeliveryItemCard } from "@/components/inventory/epi/delivery/detail";
import { PageHeader } from "@/components/ui/page-header";
import { IconShield, IconEdit, IconCheck, IconX, IconTrash, IconTruck, IconAlertTriangle } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
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
import { IconLoader } from "@tabler/icons-react";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { hasPrivilege } from "../../../../../utils";
import { usePageTracker } from "@/hooks/use-page-tracker";
import { DETAIL_PAGE_SPACING, getDetailGridClasses } from "@/lib/layout-constants";

const EPIDeliveryDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { updateAsync: updateMutation, deleteAsync: deleteMutation } = usePpeDeliveryMutations();
  const markAsDeliveredMutation = useMarkPpeDeliveryAsDelivered();
  const { user: currentUser } = useAuth();

  // Dialog states
  const [showDeliveryDialog, setShowDeliveryDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Track page access
  usePageTracker({
    title: "Detalhes da Entrega de EPI",
    icon: "shield",
  });

  // Permission checks
  const canManageWarehouse = currentUser && hasPrivilege(currentUser, SECTOR_PRIVILEGES.WAREHOUSE);
  const isAdmin = currentUser && hasPrivilege(currentUser, SECTOR_PRIVILEGES.ADMIN);

  // Fetch PPE delivery data
  const {
    data: response,
    isLoading,
    error,
    refetch,
  } = usePpeDelivery(id!, {
    include: {
      item: {
        include: {
          brand: true,
          category: true,
          measures: true,
          prices: {
            orderBy: {
              updatedAt: "desc",
            },
            take: 1,
          },
        },
      },
      user: {
        include: {
          position: true,
          sector: true,
        },
      },
      reviewedByUser: true,
      ppeSchedule: true,
      deliveryDocument: true,
    },
    enabled: !!id,
  });

  const ppeDelivery = response?.data;

  // Handlers

  const handleEdit = () => {
    if (ppeDelivery && canManageWarehouse) {
      navigate(routes.inventory.ppe.deliveries.edit(ppeDelivery.id));
    }
  };

  const handleMarkDelivered = async () => {
    if (!ppeDelivery || !currentUser) return;

    try {
      await markAsDeliveredMutation.mutateAsync({
        id: ppeDelivery.id,
        deliveryDate: new Date(),
      });
      refetch();
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error marking delivery as delivered:", error);
      }
    } finally {
      setShowDeliveryDialog(false);
    }
  };

  const handleCancel = async () => {
    if (!ppeDelivery) return;

    try {
      await updateMutation({
        id: ppeDelivery.id,
        data: {
          status: PPE_DELIVERY_STATUS.CANCELLED,
        },
      });
      refetch();
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error cancelling delivery:", error);
      }
    } finally {
      setShowCancelDialog(false);
    }
  };

  const handleDelete = async () => {
    if (!ppeDelivery) return;

    try {
      await deleteMutation(ppeDelivery.id);
      navigate(routes.inventory.ppe.deliveries.root);
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error deleting delivery:", error);
      }
    } finally {
      setShowDeleteDialog(false);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.WAREHOUSE, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN]}>
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-neutral-900 dark:to-neutral-800">
          <div className="container mx-auto p-4 sm:p-4 max-w-7xl">
            <div className="animate-pulse space-y-6">
              {/* Header Skeleton */}
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <div className="h-4 w-16 bg-muted rounded"></div>
                  <div className="h-4 w-4 bg-muted rounded"></div>
                  <div className="h-4 w-20 bg-muted rounded"></div>
                  <div className="h-4 w-4 bg-muted rounded"></div>
                  <div className="h-4 w-24 bg-muted rounded"></div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="h-8 bg-muted rounded w-48"></div>
                  <div className="flex gap-2">
                    <div className="h-9 w-20 bg-muted rounded"></div>
                    <div className="h-9 w-20 bg-muted rounded"></div>
                    <div className="h-9 w-16 bg-muted rounded"></div>
                  </div>
                </div>
              </div>

              {/* 3 Column Grid Skeleton */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="h-96 bg-muted rounded-xl"></div>
                <div className="h-96 bg-muted rounded-xl"></div>
                <div className="h-96 bg-muted rounded-xl"></div>
              </div>
            </div>
          </div>
        </div>
      </PrivilegeRoute>
    );
  }

  // Error state
  if (error || !ppeDelivery) {
    return (
      <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.WAREHOUSE, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN]}>
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-neutral-900 dark:to-neutral-800">
          <div className="container mx-auto p-4 sm:p-4 max-w-7xl">
            <div className="flex flex-1 items-center justify-center min-h-[60vh]">
              <div className="text-center px-4 max-w-md mx-auto">
                <div className="animate-in fade-in-50 duration-500">
                  <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
                    <IconAlertTriangle className="h-10 w-10 text-red-500" />
                  </div>
                  <h2 className="text-xl sm:text-2xl font-semibold mb-3 text-foreground">Entrega não encontrada</h2>
                  <p className="text-sm sm:text-base text-muted-foreground mb-6 leading-relaxed">
                    A entrega de EPI que você está procurando não existe ou foi removida do sistema.
                  </p>
                  <div className="space-y-3">
                    <Button onClick={() => navigate(routes.inventory.ppe.deliveries.root)} className="w-full sm:w-auto">
                      Ir para Lista de Entregas
                    </Button>
                    <Button variant="outline" onClick={() => navigate(routes.inventory.ppe.root)} className="w-full sm:w-auto">
                      Ir para EPIs
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </PrivilegeRoute>
    );
  }

  // Check if can edit/delete based on status
  const canEdit = canManageWarehouse && ppeDelivery.status === PPE_DELIVERY_STATUS.PENDING;
  const canDelete = isAdmin && ppeDelivery.status === PPE_DELIVERY_STATUS.PENDING;
  const canMarkAsDelivered = canManageWarehouse && ppeDelivery.status === PPE_DELIVERY_STATUS.PENDING;
  const canCancel = canManageWarehouse && ppeDelivery.status === PPE_DELIVERY_STATUS.PENDING;

  // Build custom actions for header
  const customActions = [];

  if (canMarkAsDelivered) {
    customActions.push({
      key: "deliver",
      label: "Marcar como Entregue",
      icon: IconTruck,
      onClick: () => setShowDeliveryDialog(true),
    });
  }

  if (canCancel) {
    customActions.push({
      key: "cancel",
      label: "Cancelar",
      icon: IconX,
      onClick: () => setShowCancelDialog(true),
    });
  }

  if (canDelete) {
    customActions.push({
      key: "delete",
      label: "Excluir",
      icon: IconTrash,
      onClick: () => setShowDeleteDialog(true),
    });
  }

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.WAREHOUSE, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN]}>
      <div className="h-full flex flex-col px-4 pt-4">
        <div className="flex-shrink-0">
          <PageHeader
            variant="detail"
            title={`${ppeDelivery.item?.name || "Item"} - ${ppeDelivery.user?.name || "Usuário"}`}
            className="shadow-sm"
            breadcrumbs={[
              { label: "Início", href: routes.home },
              { label: "Estoque", href: routes.inventory.root },
              { label: "EPIs", href: routes.inventory.ppe.root },
              { label: "Entregas", href: routes.inventory.ppe.deliveries.root },
              { label: `${ppeDelivery.item?.name || "Item"} - ${ppeDelivery.user?.name || "Usuário"}` },
            ]}
            actions={[
              ...(canEdit
                ? [
                    {
                      key: "edit",
                      label: "Editar",
                      icon: IconEdit,
                      onClick: handleEdit,
                    },
                  ]
                : []),
              ...customActions,
            ]}
          />
        </div>
        <div className="flex-1 overflow-y-auto pb-6">
          <div className="space-y-4 mt-4">
            {/* First Row: Basic Info and Item (1/2 each) */}
            <div className={DETAIL_PAGE_SPACING.HEADER_TO_GRID}>
            <div className={getDetailGridClasses()}>
              <PpeDeliveryInfoCard ppeDelivery={ppeDelivery} className="h-full" />
              <PpeDeliveryItemCard ppeDelivery={ppeDelivery} className="h-full" />
            </div>
          </div>

            {/* Second Row: Schedule (if available) */}
            {ppeDelivery.ppeSchedule && (
              <div className={getDetailGridClasses()}>
                <PpeDeliveryScheduleCard schedule={ppeDelivery.ppeSchedule} className="h-full" />
              </div>
            )}

            {/* Third Row: Changelog (full width) */}
            <PpeDeliveryChangelogCard delivery={ppeDelivery} className="h-full" />
          </div>
        </div>

        {/* Mark as Delivered Dialog */}
        <AlertDialog open={showDeliveryDialog} onOpenChange={setShowDeliveryDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar Entrega</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja marcar esta entrega como realizada?
                <br />
                <br />
                <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                  <p className="text-sm">
                    <span className="font-medium">Item:</span> {ppeDelivery.item?.name || "-"}
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">Funcionário:</span> {ppeDelivery.user?.name || "-"}
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">Quantidade:</span> {ppeDelivery.quantity}
                  </p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={markAsDeliveredMutation.isPending}>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleMarkDelivered} disabled={markAsDeliveredMutation.isPending}>
                {markAsDeliveredMutation.isPending ? (
                  <>
                    <IconLoader className="mr-2 h-4 w-4 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <IconCheck className="mr-2 h-4 w-4" />
                    Confirmar Entrega
                  </>
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Cancel Dialog */}
        <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancelar Entrega</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja cancelar esta entrega? Esta ação não pode ser desfeita.
                <br />
                <br />
                <strong>Item:</strong> {ppeDelivery.item?.name || "-"}
                <br />
                <strong>Funcionário:</strong> {ppeDelivery.user?.name || "-"}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Voltar</AlertDialogCancel>
              <AlertDialogAction onClick={handleCancel} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Cancelar Entrega
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir Entrega</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir esta entrega? Esta ação não pode ser desfeita.
                <br />
                <br />
                <strong>Item:</strong> {ppeDelivery.item?.name || "-"}
                <br />
                <strong>Funcionário:</strong> {ppeDelivery.user?.name || "-"}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </PrivilegeRoute>
  );
};

export { EPIDeliveryDetails };
