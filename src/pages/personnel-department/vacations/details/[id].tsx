import { useState } from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import { IconEdit, IconTrash, IconRefresh, IconPlayerTrackNext } from "@tabler/icons-react";

import { routes, SECTOR_PRIVILEGES, CHANGE_LOG_ENTITY_TYPE, VACATION_STATUS, VACATION_STATUS_LABELS } from "../../../../constants";
import { useVacation, useVacationMutations, useVacationAdvance } from "../../../../hooks/personnel-department/use-vacations";
import { useAuth } from "../../../../hooks/common/use-auth";

import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { ChangelogHistory } from "@/components/ui/changelog-history";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
  VacationStatusStepperCard,
  VacationSummaryCard,
  VacationBalanceCard,
  VacationReciboCard,
  VacationDetailSkeleton,
  getNextVacationStatus,
} from "@/components/personnel-department/vacation/detail";
import { isConcessiveExpired, isConcessiveExpiringSoon, getConcessiveDaysRemaining } from "@/components/personnel-department/vacation/list";
import { usePageTracker } from "@/hooks/common/use-page-tracker";

export const VacationDetailPage = () => {
  usePageTracker({ title: "Detalhes das Férias" });
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { user } = useAuth();
  const isAdmin = user?.sector?.privileges === SECTOR_PRIVILEGES.ADMIN;

  const [showAdvanceDialog, setShowAdvanceDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const { deleteAsync, deleteMutation } = useVacationMutations();
  const advance = useVacationAdvance();

  const {
    data: response,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useVacation(id || "", {
    include: {
      user: { include: { position: true, sector: true } },
    },
    enabled: !!id,
  });

  const vacation = response?.data;

  if (!id) {
    return <Navigate to={routes.personnelDepartment.vacations.root} replace />;
  }

  if (error) {
    return <Navigate to={routes.personnelDepartment.vacations.root} replace />;
  }

  if (isLoading || !vacation) {
    return (
      <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN]}>
        <VacationDetailSkeleton />
      </PrivilegeRoute>
    );
  }

  const isFinal = vacation.status === VACATION_STATUS.PAID || vacation.status === VACATION_STATUS.EXPIRED;
  const nextStatus = getNextVacationStatus(vacation);
  const nextIsPaid = nextStatus === VACATION_STATUS.PAID;
  const expired = isConcessiveExpired(vacation);
  const expiring = isConcessiveExpiringSoon(vacation);
  const remaining = getConcessiveDaysRemaining(vacation);

  let advanceDisabledReason: string | null = null;
  if (isFinal || !nextStatus) {
    advanceDisabledReason = `Não é possível alterar o status de umas férias ${VACATION_STATUS_LABELS[vacation.status].toLowerCase()}.`;
  } else if (nextIsPaid && !vacation.paymentDate) {
    advanceDisabledReason = "Não é possível concluir como Pago: a data de pagamento não foi informada (edite as férias).";
  }

  const handleAdvance = async () => {
    try {
      await advance.mutateAsync({ id });
      setShowAdvanceDialog(false);
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error("Error advancing vacation:", error);
      }
    }
  };

  const handleDelete = async () => {
    try {
      await deleteAsync(id);
      navigate(routes.personnelDepartment.vacations.root);
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error("Error deleting vacation:", error);
      }
    }
    setShowDeleteDialog(false);
  };

  // "Avançar" is a PageHeader action (NOT a standalone button) so it renders at
  // the same size as Editar/Excluir — matches Admissão/Rescisão. The disabled
  // reason is folded into the label (no tooltip on header actions).
  const advanceLabel = nextIsPaid && !vacation.paymentDate ? "Avançar (informe o pagamento)" : "Avançar";

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="detail"
          title={vacation.user?.name ? `Férias — ${vacation.user.name}` : "Férias"}
          breadcrumbs={[
            { label: "Início", href: "/" },
            { label: "Departamento Pessoal" },
            { label: "Férias", href: routes.personnelDepartment.vacations.root },
            { label: vacation.user?.name || "Detalhes" },
          ]}
          actions={[
            {
              key: "refresh",
              label: "Atualizar",
              icon: IconRefresh,
              onClick: () => refetch(),
              variant: "outline" as const,
              loading: isRefetching,
            },
            ...(!isFinal && nextStatus
              ? [
                  {
                    key: "advance",
                    label: advanceLabel,
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
              onClick: () => navigate(routes.personnelDepartment.vacations.edit(id)),
              group: "primary" as const,
              disabled: isFinal,
            },
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
            {/* Concessivo expiry warnings (cron sets isDouble/EXPIRED) */}
            {expired && (
              <Alert variant="destructive">
                <AlertTitle>Período concessivo vencido (art. 137)</AlertTitle>
                <AlertDescription>O período concessivo expirou. As férias são devidas em dobro.</AlertDescription>
              </Alert>
            )}
            {!expired && expiring && (
              <Alert variant="warning">
                <AlertTitle>Período concessivo a vencer</AlertTitle>
                <AlertDescription>
                  Faltam {remaining} dia(s) para o fim do período concessivo. Agende as férias para evitar o pagamento em dobro (art. 137).
                </AlertDescription>
              </Alert>
            )}

            <VacationStatusStepperCard vacation={vacation} />

            {/* Resumo (left) stretches to match the right column = Saldo + Recibo. */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
              <VacationSummaryCard vacation={vacation} className="h-full" />
              <div className="space-y-4">
                <VacationBalanceCard vacation={vacation} />
                <VacationReciboCard vacation={vacation} />
              </div>
            </div>

            <ChangelogHistory
              entityType={CHANGE_LOG_ENTITY_TYPE.VACATION}
              entityId={id}
              entityName={vacation.user?.name}
              entityCreatedAt={vacation.createdAt}
            />
          </div>
        </div>

        {/* Advance Confirmation Dialog */}
        <AlertDialog open={showAdvanceDialog} onOpenChange={setShowAdvanceDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Avançar status das férias</AlertDialogTitle>
              <AlertDialogDescription>
                Avançar de {VACATION_STATUS_LABELS[vacation.status]} para <span className="font-medium">{nextStatus ? VACATION_STATUS_LABELS[nextStatus] : "-"}</span>?
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

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir o registro de férias{vacation.user?.name ? ` de "${vacation.user.name}"` : ""}? Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Voltar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} disabled={deleteMutation.isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </PrivilegeRoute>
  );
};

export default VacationDetailPage;
