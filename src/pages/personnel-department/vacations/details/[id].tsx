import { useState } from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import { IconEdit, IconTrash, IconRefresh, IconCash, IconCheck, IconLoader2 } from "@tabler/icons-react";

import { routes, SECTOR_PRIVILEGES, CHANGE_LOG_ENTITY_TYPE, VACATION_STATUS } from "../../../../constants";
import { useVacation, useVacationMutations, useVacationAdvance } from "../../../../hooks/personnel-department/use-vacations";
import { useAuth } from "../../../../hooks/common/use-auth";

import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { ChangelogHistory } from "@/components/ui/changelog-history";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DateTimeInput } from "@/components/ui/date-time-input";
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

  const [payPopoverOpen, setPayPopoverOpen] = useState(false);
  const [paymentDate, setPaymentDate] = useState<Date | null>(new Date());
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const { deleteAsync, deleteMutation, updateAsync, updateMutation } = useVacationMutations();
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
      <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.PRODUCTION_MANAGER]}>
        <VacationDetailSkeleton />
      </PrivilegeRoute>
    );
  }

  const isPaid = vacation.status === VACATION_STATUS.PAID;
  const nextStatus = getNextVacationStatus(vacation);
  const canMarkPaid = nextStatus === VACATION_STATUS.PAID;
  // Recibo must exist (auto-calculated at create — keep the guard honest) before
  // the vacation can be marked as paid.
  const reciboReady = vacation.baseRemuneration != null;
  const expired = isConcessiveExpired(vacation);
  const expiring = isConcessiveExpiringSoon(vacation);
  const remaining = getConcessiveDaysRemaining(vacation);

  const isMarkingPaid = updateMutation.isPending || advance.isPending;

  // "Marcar como pago": stamp the chosen payment date, then transition to PAID.
  const handleMarkPaid = async () => {
    if (!paymentDate || !reciboReady) return;
    try {
      await updateAsync({ id, data: { paymentDate } });
      await advance.mutateAsync({ id });
      setPayPopoverOpen(false);
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error("Error marking vacation as paid:", error);
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

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.PRODUCTION_MANAGER]}>
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
            {
              key: "edit",
              label: "Editar",
              icon: IconEdit,
              onClick: () => navigate(routes.personnelDepartment.vacations.edit(id)),
              group: "primary" as const,
              disabled: isPaid,
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

            {/* Action bar — self-documenting "Marcar como pago" with an inline
                payment-date popover (no separate edit round-trip). */}
            {canMarkPaid && (
              <div className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">Pagamento das férias</p>
                  <p className="text-xs text-muted-foreground">
                    {reciboReady
                      ? "Informe a data de pagamento e conclua como Paga."
                      : "O recibo ainda não foi calculado — não é possível concluir o pagamento."}
                  </p>
                </div>
                <Popover open={payPopoverOpen} onOpenChange={setPayPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="default" disabled={!reciboReady || isMarkingPaid}>
                      {isMarkingPaid ? <IconLoader2 className="h-4 w-4 mr-2 animate-spin" /> : <IconCash className="h-4 w-4 mr-2" />}
                      Marcar como pago
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-72 space-y-3">
                    <div>
                      <p className="text-sm font-medium">Data de pagamento</p>
                      <p className="text-xs text-muted-foreground">Será registrada no recibo de férias.</p>
                    </div>
                    <DateTimeInput
                      mode="date"
                      value={paymentDate}
                      onChange={(date) => setPaymentDate(date instanceof Date ? date : null)}
                      placeholder="Selecione a data de pagamento"
                    />
                    <Button className="w-full" onClick={handleMarkPaid} disabled={!paymentDate || isMarkingPaid}>
                      {isMarkingPaid ? <IconLoader2 className="h-4 w-4 mr-2 animate-spin" /> : <IconCheck className="h-4 w-4 mr-2" />}
                      Confirmar pagamento
                    </Button>
                  </PopoverContent>
                </Popover>
              </div>
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
