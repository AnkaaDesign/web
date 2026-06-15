import { useState } from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import { IconEdit, IconTrash, IconBan, IconPlayerTrackNext, IconPlayerTrackPrev } from "@tabler/icons-react";

import {
  routes,
  SECTOR_PRIVILEGES,
  CHANGE_LOG_ENTITY_TYPE,
  TERMINATION_STATUS,
  TERMINATION_STATUS_LABELS,
} from "../../../../constants";
import { useTermination, useTerminationMutations, useTerminationAdvance, useTerminationRegress } from "../../../../hooks/personnel-department/use-terminations";
import { useAuth } from "../../../../hooks/common/use-auth";

import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { ChangelogHistory } from "@/components/ui/changelog-history";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
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
  getPreviousTerminationStatus,
} from "@/components/personnel-department/termination/detail";
import { usePageTracker } from "@/hooks/common/use-page-tracker";

export const TerminationDetailPage = () => {
  usePageTracker({ title: "Detalhes da Rescisão" });
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { user } = useAuth();
  const isAdmin = user?.sector?.privileges === SECTOR_PRIVILEGES.ADMIN;

  const [showAdvanceDialog, setShowAdvanceDialog] = useState(false);
  const [showRegressDialog, setShowRegressDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const { deleteAsync, deleteMutation } = useTerminationMutations();
  const advance = useTerminationAdvance();
  const regress = useTerminationRegress();

  const {
    data: response,
    isLoading,
    error,
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
  const prevStatus = getPreviousTerminationStatus(termination);
  const items = termination.items || [];
  const nextIsCompleted = nextStatus === TERMINATION_STATUS.COMPLETED;
  const canRegress = !isFinal && !!prevStatus;

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

  const handleRegress = async () => {
    try {
      await regress.mutateAsync({ id });
      setShowRegressDialog(false);
    } catch (error) {
      // Error is handled by the API client with detailed message
      if (process.env.NODE_ENV !== "production") {
        console.error("Error regressing termination:", error);
      }
    }
  };

  const handleCancelTermination = async () => {
    const reason = cancelReason.trim();
    if (!reason) return;
    try {
      await advance.mutateAsync({ id, data: { status: TERMINATION_STATUS.CANCELLED, reason } });
      setShowCancelDialog(false);
      setCancelReason("");
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
          actions={[
            ...(canRegress
              ? [
                  {
                    key: "regress",
                    label: "Voltar etapa",
                    icon: IconPlayerTrackPrev,
                    onClick: () => setShowRegressDialog(true),
                    variant: "outline" as const,
                    disabled: regress.isPending,
                  },
                ]
              : []),
            // Ordem desejada no header: Voltar etapa · Avançar · Editar · Cancelar.
            ...(!isFinal
              ? [
                  {
                    key: "advance",
                    label: "Avançar",
                    icon: IconPlayerTrackNext,
                    onClick: () => setShowAdvanceDialog(true),
                    variant: "default" as const,
                    group: "primary" as const,
                    disabled: !!advanceDisabledReason || advance.isPending,
                  },
                ]
              : []),
            {
              key: "edit",
              label: "Editar",
              icon: IconEdit,
              onClick: () => navigate(routes.personnelDepartment.terminations.edit(id)),
              group: "primary" as const,
              disabled: isFinal,
            },
            ...(!isFinal
              ? [
                  {
                    key: "cancel",
                    label: "Cancelar",
                    icon: IconBan,
                    onClick: () => setShowCancelDialog(true),
                    variant: "destructive" as const,
                    group: "danger" as const,
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
                    group: "danger" as const,
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

            {/* Why "Avançar" is blocked (covers cases not in the dismissal warning above) */}
            {advanceDisabledReason && !isFinal && !nextIsCompleted && (
              <Alert>
                <AlertDescription>{advanceDisabledReason}</AlertDescription>
              </Alert>
            )}

            {/* Status stepper */}
            <StatusStepperCard termination={termination} />

            {/* Summary + Payment (Payment stretches to match the Summary height) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
              <SummaryCard termination={termination} />
              <PaymentCard termination={termination} disabled={isFinal} className="h-full" />
            </div>

            {/* Verbas + Documentos — half each */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
              <ItemsCard termination={termination} disabled={isFinal} />
              <DocumentsCard termination={termination} disabled={isFinal} />
            </div>

            {/* Histórico de Alterações — full width so the timeline has room */}
            <ChangelogHistory
              entityType={CHANGE_LOG_ENTITY_TYPE.TERMINATION}
              entityId={id}
              entityName={termination.user?.name}
              entityCreatedAt={termination.createdAt}
            />
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

        {/* Regress (step back) Confirmation Dialog */}
        <AlertDialog open={showRegressDialog} onOpenChange={setShowRegressDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Voltar etapa</AlertDialogTitle>
              <AlertDialogDescription>
                Retroceder o processo de {TERMINATION_STATUS_LABELS[termination.status]} para{" "}
                <span className="font-medium">{prevStatus ? TERMINATION_STATUS_LABELS[prevStatus] : "-"}</span>?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Voltar</AlertDialogCancel>
              <AlertDialogAction onClick={handleRegress} disabled={regress.isPending}>
                Voltar etapa
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Cancel Confirmation Dialog */}
        <AlertDialog
          open={showCancelDialog}
          onOpenChange={(open) => {
            setShowCancelDialog(open);
            if (!open) setCancelReason("");
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancelar rescisão</AlertDialogTitle>
              <AlertDialogDescription>
                A rescisão{termination.user?.name ? ` de "${termination.user.name}"` : ""} será marcada como cancelada na etapa atual ({TERMINATION_STATUS_LABELS[termination.status]}) e
                não poderá mais ser avançada. Informe o motivo de não ter sido concluída.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-1.5">
              <Textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Motivo do cancelamento (obrigatório)" rows={4} autoFocus />
              {cancelReason.trim().length === 0 && <p className="text-xs text-muted-foreground">O motivo é obrigatório para cancelar.</p>}
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Voltar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleCancelTermination}
                disabled={advance.isPending || cancelReason.trim().length === 0}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
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
