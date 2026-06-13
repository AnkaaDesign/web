import { useState } from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import { IconEdit, IconTrash, IconRefresh, IconBan, IconPlayerTrackNext } from "@tabler/icons-react";

import {
  routes,
  SECTOR_PRIVILEGES,
  CHANGE_LOG_ENTITY_TYPE,
  TERMINATION_STATUS,
  TERMINATION_STATUS_LABELS,
} from "../../../../constants";
import { useTermination, useTerminationMutations, useTerminationAdvance } from "../../../../hooks/personnel-department/use-terminations";
import { useAuth } from "../../../../hooks/common/use-auth";

import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { ChangelogHistory } from "@/components/ui/changelog-history";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
import {
  StatusStepperCard,
  SummaryCard,
  ItemsCard,
  DocumentsCard,
  PaymentCard,
  TerminationDetailSkeleton,
  getNextTerminationStatus,
} from "@/components/personnel-department/termination/detail";
import { usePageTracker } from "@/hooks/common/use-page-tracker";

export const TerminationDetailPage = () => {
  usePageTracker({ title: "Detalhes da Rescisão" });
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { user } = useAuth();
  const isAdmin = user?.sector?.privileges === SECTOR_PRIVILEGES.ADMIN;

  const [showAdvanceDialog, setShowAdvanceDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const { deleteAsync, deleteMutation } = useTerminationMutations();
  const advance = useTerminationAdvance();

  const {
    data: response,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useTermination(id || "", {
    include: {
      user: { include: { position: true, sector: true } },
      initiatedBy: true,
      items: { orderBy: { createdAt: "asc" } },
      documents: { include: { file: true }, orderBy: { type: "asc" } },
    },
    enabled: !!id,
  });

  const termination = response?.data;

  if (!id) {
    return <Navigate to={routes.personnelDepartment.terminations.root} replace />;
  }

  if (error) {
    return <Navigate to={routes.personnelDepartment.terminations.root} replace />;
  }

  if (isLoading || !termination) {
    return (
      <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN]}>
        <TerminationDetailSkeleton />
      </PrivilegeRoute>
    );
  }

  const isFinal = termination.status === TERMINATION_STATUS.COMPLETED || termination.status === TERMINATION_STATUS.CANCELLED;
  const nextStatus = getNextTerminationStatus(termination);
  const items = termination.items || [];
  const nextIsCompleted = nextStatus === TERMINATION_STATUS.COMPLETED;

  // Advance guards (mirror server-side rules)
  let advanceDisabledReason: string | null = null;
  if (isFinal || !nextStatus) {
    advanceDisabledReason = `Não é possível alterar o status de uma rescisão ${TERMINATION_STATUS_LABELS[termination.status].toLowerCase()}.`;
  } else if (nextStatus === TERMINATION_STATUS.PAYMENT && items.length === 0) {
    advanceDisabledReason = "Não é possível avançar para Pagamento: nenhuma verba rescisória foi calculada.";
  } else if (nextIsCompleted && !termination.paymentDate) {
    advanceDisabledReason = "Não é possível concluir a rescisão: a data de pagamento não foi informada.";
  }

  const handleAdvance = async () => {
    try {
      await advance.mutateAsync({ id });
      setShowAdvanceDialog(false);
    } catch (error) {
      // Error is handled by the API client with detailed message
      if (process.env.NODE_ENV !== "production") {
        console.error("Error advancing termination:", error);
      }
    }
  };

  const handleCancelTermination = async () => {
    try {
      await advance.mutateAsync({ id, data: { status: TERMINATION_STATUS.CANCELLED } });
      setShowCancelDialog(false);
    } catch (error) {
      // Error is handled by the API client with detailed message
      if (process.env.NODE_ENV !== "production") {
        console.error("Error cancelling termination:", error);
      }
    }
  };

  const handleDelete = async () => {
    try {
      await deleteAsync(id);
      navigate(routes.personnelDepartment.terminations.root);
    } catch (error) {
      // Error is handled by the API client with detailed message
      if (process.env.NODE_ENV !== "production") {
        console.error("Error deleting termination:", error);
      }
    }
    setShowDeleteDialog(false);
  };

  // "Avançar" lives in headerExtra so it can carry a Tooltip with the guard message
  const advanceButton = (
    <Button variant="default" size="default" onClick={() => setShowAdvanceDialog(true)} disabled={!!advanceDisabledReason || advance.isPending}>
      <IconPlayerTrackNext className="h-4 w-4 mr-2" />
      Avançar
    </Button>
  );

  const headerExtra = advanceDisabledReason ? (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0}>{advanceButton}</span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">{advanceDisabledReason}</TooltipContent>
    </Tooltip>
  ) : (
    advanceButton
  );

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="detail"
          title={termination.user?.name ? `Rescisão — ${termination.user.name}` : "Rescisão"}
          breadcrumbs={[
            { label: "Início", href: "/" },
            { label: "Departamento Pessoal" },
            { label: "Rescisões", href: routes.personnelDepartment.terminations.root },
            { label: termination.user?.name || "Detalhes" },
          ]}
          headerExtra={headerExtra}
          actions={[
            {
              key: "refresh",
              label: "Atualizar",
              icon: IconRefresh,
              onClick: () => refetch(),
              loading: isRefetching,
            },
            {
              key: "edit",
              label: "Editar",
              icon: IconEdit,
              onClick: () => navigate(routes.personnelDepartment.terminations.edit(id)),
              disabled: isFinal,
            },
            ...(!isFinal
              ? [
                  {
                    key: "cancel",
                    label: "Cancelar",
                    icon: IconBan,
                    onClick: () => setShowCancelDialog(true),
                    variant: "outline" as const,
                  },
                ]
              : []),
            ...(isAdmin
              ? [
                  {
                    key: "delete",
                    label: "Excluir",
                    icon: IconTrash,
                    onClick: () => setShowDeleteDialog(true),
                    disabled: deleteMutation.isPending,
                  },
                ]
              : []),
          ]}
          className="flex-shrink-0"
        />

        <div className="flex-1 overflow-y-auto pb-6">
          <div className="space-y-4">
            {/* Dismissal warning when the next advance completes the process */}
            {nextIsCompleted && !isFinal && (
              <Alert variant="warning">
                <AlertTitle>Atenção</AlertTitle>
                <AlertDescription>
                  Concluir a rescisão irá demitir o colaborador (contrato marcado como Demitido). Informe a data de pagamento antes de avançar.
                </AlertDescription>
              </Alert>
            )}

            {/* Status stepper */}
            <StatusStepperCard termination={termination} />

            {/* Summary + Payment */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
              <SummaryCard termination={termination} />
              <div className="space-y-4">
                <PaymentCard termination={termination} disabled={isFinal} />
                <ChangelogHistory
                  entityType={CHANGE_LOG_ENTITY_TYPE.TERMINATION}
                  entityId={id}
                  entityName={termination.user?.name}
                  entityCreatedAt={termination.createdAt}
                />
              </div>
            </div>

            {/* Verbas */}
            <ItemsCard termination={termination} disabled={isFinal} />

            {/* Documentos */}
            <DocumentsCard termination={termination} disabled={isFinal} />
          </div>
        </div>

        {/* Advance Confirmation Dialog */}
        <AlertDialog open={showAdvanceDialog} onOpenChange={setShowAdvanceDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Avançar rescisão</AlertDialogTitle>
              <AlertDialogDescription>
                Avançar o processo de {TERMINATION_STATUS_LABELS[termination.status]} para{" "}
                <span className="font-medium">{nextStatus ? TERMINATION_STATUS_LABELS[nextStatus] : "-"}</span>?
                {nextIsCompleted && (
                  <span className="block mt-2 font-medium text-destructive">Atenção: concluir a rescisão irá demitir o colaborador.</span>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Voltar</AlertDialogCancel>
              <AlertDialogAction onClick={handleAdvance} disabled={advance.isPending}>
                Avançar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Cancel Confirmation Dialog */}
        <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancelar rescisão</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja cancelar a rescisão{termination.user?.name ? ` de "${termination.user.name}"` : ""}? O processo será encerrado e não poderá mais ser
                avançado.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Voltar</AlertDialogCancel>
              <AlertDialogAction onClick={handleCancelTermination} disabled={advance.isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Cancelar rescisão
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir a rescisão{termination.user?.name ? ` de "${termination.user.name}"` : ""}? Esta ação não pode ser desfeita.
                {termination.status === TERMINATION_STATUS.COMPLETED && (
                  <span className="block mt-2 font-medium text-destructive">Não é possível excluir uma rescisão concluída.</span>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Voltar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={deleteMutation.isPending || termination.status === TERMINATION_STATUS.COMPLETED}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </PrivilegeRoute>
  );
};

export default TerminationDetailPage;
