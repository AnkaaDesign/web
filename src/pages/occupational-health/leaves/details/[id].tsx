import { useState } from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import { IconEdit, IconTrash, IconRefresh, IconLoader2, IconAlertTriangle, IconCalendarCheck } from "@tabler/icons-react";

import { routes, SECTOR_PRIVILEGES, CHANGE_LOG_ENTITY_TYPE, LEAVE_STATUS } from "../../../../constants";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useLeave, useLeaveMutations } from "../../../../hooks/occupational-health/use-leaves";
import { useAuth } from "@/contexts/auth-context";

import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { ChangelogHistory } from "@/components/ui/changelog-history";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { usePageTracker } from "@/hooks/common/use-page-tracker";

import { CollaboratorCard, LeaveInfoCard, LeavePayrollSplitCard, LeaveFilesCard, ScheduleReturnExamDialog, ReturnExamAlert } from "@/components/occupational-health/leave/detail";
import { FinishLeaveDialog } from "@/components/occupational-health/leave/finish-leave-dialog";

export const LeaveDetailPage = () => {
  usePageTracker({ title: "Detalhes do Afastamento" });
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isFinishDialogOpen, setIsFinishDialogOpen] = useState(false);
  const [isScheduleExamDialogOpen, setIsScheduleExamDialogOpen] = useState(false);

  const { user } = useAuth();
  const isAdmin = user?.sector?.privileges === SECTOR_PRIVILEGES.ADMIN;

  const {
    data: response,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useLeave(id || "", {
    include: {
      user: {
        include: {
          position: true,
          sector: true,
          currentContract: true,
        },
      },
      files: true,
    },
    enabled: !!id,
  });

  const { deleteAsync, deleteMutation } = useLeaveMutations();

  const leave = response?.data;

  if (!id) {
    return <Navigate to={routes.occupationalHealth.leaves.root} replace />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <p className="text-destructive mb-4">Erro ao carregar afastamento</p>
        <Navigate to={routes.occupationalHealth.leaves.root} replace />
      </div>
    );
  }

  if (isLoading) {
    return (
      <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN]}>
        <div className="flex items-center justify-center h-full">
          <IconLoader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </PrivilegeRoute>
    );
  }

  if (!leave) {
    return <Navigate to={routes.occupationalHealth.leaves.root} replace />;
  }

  const isFinishable = leave.status === LEAVE_STATUS.SCHEDULED || leave.status === LEAVE_STATUS.ACTIVE;
  const showReturnExamAlert = leave.returnExamRequired && leave.status !== LEAVE_STATUS.CANCELLED;
  // Afastado is now an overlay sourced from the Leave itself (ON_LEAVE is no
  // longer a contract status): an ACTIVE leave means the collaborator is afastado.
  const isContractOnLeave = leave.status === LEAVE_STATUS.ACTIVE;

  const handleDelete = async () => {
    try {
      await deleteAsync(id);
      navigate(routes.occupationalHealth.leaves.root);
    } catch (error) {
      // Error toast is handled by the API client
      if (process.env.NODE_ENV !== "production") {
        console.error("Error deleting leave:", error);
      }
    }
    setIsDeleteDialogOpen(false);
  };

  const pageActions = [
    {
      key: "refresh",
      label: "Atualizar",
      icon: IconRefresh,
      onClick: () => refetch(),
      loading: isRefetching,
    },
    ...(isFinishable
      ? [
          {
            key: "finish",
            label: "Finalizar",
            icon: IconCalendarCheck,
            onClick: () => setIsFinishDialogOpen(true),
          },
        ]
      : []),
    {
      key: "edit",
      label: "Editar",
      icon: IconEdit,
      onClick: () => navigate(routes.occupationalHealth.leaves.edit(id)),
    },
    ...(isAdmin
      ? [
          {
            key: "delete",
            label: "Excluir",
            icon: IconTrash,
            onClick: () => setIsDeleteDialogOpen(true),
            disabled: deleteMutation.isPending,
          },
        ]
      : []),
  ];

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="detail"
          title={leave.user?.name ? `Afastamento — ${leave.user.name}` : "Afastamento"}
          breadcrumbs={[
            { label: "Início", href: "/" },
            { label: "Medicina do Trabalho", href: routes.occupationalHealth.root },
            { label: "Afastamentos", href: routes.occupationalHealth.leaves.root },
            { label: leave.user?.name || "Detalhes" },
          ]}
          actions={pageActions}
          className="flex-shrink-0"
        />
        <div className="flex-1 overflow-y-auto pb-6">
          <div className="space-y-4">
            {/* Return exam alert (shows the auto-created exam's status when it exists) */}
            {showReturnExamAlert && <ReturnExamAlert leave={leave} onScheduleClick={() => setIsScheduleExamDialogOpen(true)} />}

            {/* Afastamento ativo — o colaborador está afastado enquanto este leave estiver ativo */}
            {isContractOnLeave && (
              <Alert variant="warning">
                <AlertTitle>Vínculo afastado</AlertTitle>
                <AlertDescription>
                  {leave.user?.name || "Este colaborador"} está <strong>afastado</strong> enquanto este afastamento estiver ativo. A folha será proporcionalizada enquanto o afastamento estiver ativo.
                </AlertDescription>
              </Alert>
            )}

            {/* Info cards grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
              <div className="space-y-4">
                <CollaboratorCard leave={leave} />
                <LeaveInfoCard leave={leave} />
              </div>
              <div className="space-y-4">
                <LeavePayrollSplitCard leave={leave} />
                <LeaveFilesCard leave={leave} />
                <ChangelogHistory
                  entityType={CHANGE_LOG_ENTITY_TYPE.LEAVE}
                  entityId={id}
                  entityName={leave.user?.name ? `Afastamento — ${leave.user.name}` : "Afastamento"}
                  entityCreatedAt={leave.createdAt}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Finish Dialog */}
        <FinishLeaveDialog leave={leave} open={isFinishDialogOpen} onOpenChange={setIsFinishDialogOpen} />

        {/* Schedule Return Exam Dialog */}
        <ScheduleReturnExamDialog leave={leave} open={isScheduleExamDialogOpen} onOpenChange={setIsScheduleExamDialogOpen} />

        {/* Delete Confirmation Dialog */}
        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <IconAlertTriangle className="h-5 w-5 text-destructive" />
                Confirmar Exclusão
              </DialogTitle>
              <DialogDescription>
                Tem certeza que deseja excluir o afastamento{leave.user?.name ? ` do colaborador "${leave.user.name}"` : ""}? Esta ação não poderá ser desfeita.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
                Cancelar
              </Button>
              <Button variant="destructive" onClick={handleDelete} disabled={deleteMutation.isPending}>
                {deleteMutation.isPending ? <IconLoader2 className="h-4 w-4 mr-2 animate-spin" /> : <IconTrash className="h-4 w-4 mr-2" />}
                Excluir
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PrivilegeRoute>
  );
};

export default LeaveDetailPage;
