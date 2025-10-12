import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { routes, SECTOR_PRIVILEGES } from "../../../../../constants";
import { usePpeDeliverySchedule, usePpeDeliveryScheduleMutations, useAuth } from "../../../../../hooks";
import { PpeScheduleInfoCard, PpeScheduleItemsCard, PpeScheduleDeliveriesCard } from "@/components/inventory/epi/schedule/detail";
import { PageHeader } from "@/components/ui/page-header";
import { IconCalendar, IconEdit, IconRefresh, IconTrash, IconPlayerPlay, IconPlayerPause, IconAlertTriangle } from "@tabler/icons-react";
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

const EPIScheduleDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { updateAsync, deleteAsync } = usePpeDeliveryScheduleMutations();
  const { data: currentUser } = useAuth();

  // Dialog states
  const [showActivateDialog, setShowActivateDialog] = useState(false);
  const [showDeactivateDialog, setShowDeactivateDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Track page access
  usePageTracker({
    title: "Detalhes do Agendamento de EPI",
    icon: "calendar",
  });

  // Permission checks
  const canManageWarehouse = currentUser && hasPrivilege(currentUser, SECTOR_PRIVILEGES.WAREHOUSE);
  const isAdmin = currentUser && hasPrivilege(currentUser, SECTOR_PRIVILEGES.ADMIN);

  // Fetch PPE schedule data
  const {
    data: response,
    isLoading,
    error,
    refetch,
  } = usePpeDeliverySchedule(id!, {
    include: {
      item: {
        include: {
          brand: true,
          category: true,
        },
      },
    },
    enabled: !!id,
  });

  const ppeSchedule = response?.data;

  // Handlers

  const handleEdit = () => {
    if (ppeSchedule && canManageWarehouse) {
      navigate(`/estoque/epi/agendamentos/editar/${ppeSchedule.id}`);
    }
  };

  const handleRefresh = () => {
    refetch();
  };

  const handleActivate = async () => {
    if (!ppeSchedule) return;

    setIsProcessing(true);
    try {
      await updateAsync({
        id: ppeSchedule.id,
        data: {
          isActive: true,
        },
      });

      toast.success("Agendamento ativado com sucesso");
      refetch();
    } catch (error) {
      toast.error("Erro ao ativar agendamento");
    } finally {
      setIsProcessing(false);
      setShowActivateDialog(false);
    }
  };

  const handleDeactivate = async () => {
    if (!ppeSchedule) return;

    setIsProcessing(true);
    try {
      await updateAsync({
        id: ppeSchedule.id,
        data: {
          isActive: false,
        },
      });

      toast.success("Agendamento desativado com sucesso");
      refetch();
    } catch (error) {
      toast.error("Erro ao desativar agendamento");
    } finally {
      setIsProcessing(false);
      setShowDeactivateDialog(false);
    }
  };

  const handleDelete = async () => {
    if (!ppeSchedule) return;

    setIsProcessing(true);
    try {
      await deleteAsync(ppeSchedule.id);
      toast.success("Agendamento excluído com sucesso");
      navigate("/estoque/epi/agendamentos");
    } catch (error) {
      toast.error("Erro ao excluir agendamento");
      setIsProcessing(false);
    } finally {
      setShowDeleteDialog(false);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.WAREHOUSE}>
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-neutral-900 dark:to-neutral-800">
          <div className="container mx-auto p-4 sm:p-6 max-w-7xl">
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
  if (error || !ppeSchedule) {
    return (
      <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.WAREHOUSE}>
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-neutral-900 dark:to-neutral-800">
          <div className="container mx-auto p-4 sm:p-6 max-w-7xl">
            <div className="flex flex-1 items-center justify-center min-h-[60vh]">
              <div className="text-center px-4 max-w-md mx-auto">
                <div className="animate-in fade-in-50 duration-500">
                  <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
                    <IconAlertTriangle className="h-10 w-10 text-red-500" />
                  </div>
                  <h2 className="text-xl sm:text-2xl font-semibold mb-3 text-foreground">Agendamento não encontrado</h2>
                  <p className="text-sm sm:text-base text-muted-foreground mb-6 leading-relaxed">
                    O agendamento de EPI que você está procurando não existe ou foi removido do sistema.
                  </p>
                  <div className="space-y-3">
                    <Button onClick={() => navigate("/estoque/epi/agendamentos")} className="w-full sm:w-auto">
                      Ir para Lista de Agendamentos
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

  // Check permissions for actions
  const canEdit = canManageWarehouse;
  const canDelete = isAdmin;
  const canToggleActive = canManageWarehouse;

  // Build custom actions for header
  const customActions = [];

  if (canToggleActive) {
    if (ppeSchedule.isActive) {
      customActions.push({
        key: "deactivate",
        label: "Desativar",
        icon: IconPlayerPause,
        onClick: () => setShowDeactivateDialog(true),
      });
    } else {
      customActions.push({
        key: "activate",
        label: "Ativar",
        icon: IconPlayerPlay,
        onClick: () => setShowActivateDialog(true),
      });
    }
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
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.WAREHOUSE}>
      <div className="flex flex-col h-full space-y-6">
        {/* Header */}
        <div className="animate-in fade-in-50 duration-500">
          <PageHeader
            variant="detail"
            title={ppeSchedule.name}
            icon={IconCalendar}
            className="shadow-lg"
            breadcrumbs={[
              { label: "Início", href: routes.home },
              { label: "Estoque", href: routes.inventory.root },
              { label: "EPIs", href: routes.inventory.ppe.root },
              { label: "Agendamentos", href: "/estoque/epi/agendamentos" },
              { label: ppeSchedule.name },
            ]}
            actions={[
              {
                key: "refresh",
                label: "Atualizar",
                icon: IconRefresh,
                onClick: handleRefresh,
              },
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

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="animate-in fade-in-50 duration-700 space-y-6">
            {/* First Row: Info and Items (1/2 each) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <PpeScheduleInfoCard schedule={ppeSchedule} className="h-full" />
              <PpeScheduleItemsCard schedule={ppeSchedule} className="h-full" />
            </div>

            {/* Second Row: Deliveries (full width) */}
            <div className="grid grid-cols-1 gap-6">
              <PpeScheduleDeliveriesCard scheduleId={ppeSchedule.id} className="h-full" />
            </div>
          </div>
        </div>

        {/* Activate Dialog */}
        <AlertDialog open={showActivateDialog} onOpenChange={setShowActivateDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Ativar Agendamento</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja ativar este agendamento? Ele começará a gerar entregas automaticamente de acordo com a
                frequência configurada.
                <br />
                <br />
                <strong>Nome:</strong> {ppeSchedule.name}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isProcessing}>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleActivate} disabled={isProcessing}>
                {isProcessing ? (
                  <>
                    <IconLoader className="mr-2 h-4 w-4 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <IconPlayerPlay className="mr-2 h-4 w-4" />
                    Ativar
                  </>
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Deactivate Dialog */}
        <AlertDialog open={showDeactivateDialog} onOpenChange={setShowDeactivateDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Desativar Agendamento</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja desativar este agendamento? Ele parará de gerar entregas automaticamente.
                <br />
                <br />
                <strong>Nome:</strong> {ppeSchedule.name}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isProcessing}>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeactivate} disabled={isProcessing} className="bg-orange-600 hover:bg-orange-700">
                {isProcessing ? (
                  <>
                    <IconLoader className="mr-2 h-4 w-4 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <IconPlayerPause className="mr-2 h-4 w-4" />
                    Desativar
                  </>
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir Agendamento</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir este agendamento? Esta ação não pode ser desfeita.
                <br />
                <br />
                <strong>Nome:</strong> {ppeSchedule.name}
                <br />
                <br />
                <strong className="text-destructive">Atenção:</strong> As entregas geradas por este agendamento não serão excluídas.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isProcessing}>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} disabled={isProcessing} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                {isProcessing ? (
                  <>
                    <IconLoader className="mr-2 h-4 w-4 animate-spin" />
                    Excluindo...
                  </>
                ) : (
                  "Excluir"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </PrivilegeRoute>
  );
};

export { EPIScheduleDetails };
export default EPIScheduleDetails;
