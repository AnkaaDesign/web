import { useState } from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import { IconEdit, IconTrash, IconRefresh, IconLoader2, IconAlertTriangle, IconPlayerPause, IconPlayerPlay, IconCircleX } from "@tabler/icons-react";

import { routes, SECTOR_PRIVILEGES, CHANGE_LOG_ENTITY_TYPE, BENEFIT_ENROLLMENT_STATUS } from "../../../../../constants";
import {
  useUserBenefit,
  useUserBenefitMutations,
  useSuspendUserBenefit,
  useReactivateUserBenefit,
} from "../../../../../hooks/personnel-department/use-user-benefits";
import { useAuth } from "../../../../../hooks/common/use-auth";

import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import {
  UserBenefitUserCard,
  UserBenefitBenefitCard,
  UserBenefitValuesCard,
  UserBenefitDatesCard,
  UserBenefitDeclarationCard,
} from "@/components/personnel-department/user-benefit/detail";
import { UserBenefitTerminateDialog } from "@/components/personnel-department/user-benefit/dialogs";
import { ChangelogHistory } from "@/components/ui/changelog-history";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import type { UserBenefit } from "../../../../../types/benefit";

export const UserBenefitDetailPage = () => {
  usePageTracker({ title: "Detalhes da Adesão" });
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [terminateDialog, setTerminateDialog] = useState<UserBenefit | null>(null);

  const { user } = useAuth();
  const isAdmin = user?.sector?.privileges === SECTOR_PRIVILEGES.ADMIN;

  const {
    data: response,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useUserBenefit(id || "", {
    include: {
      // remunerations = salário-base, usado pelo cálculo da parte do
      // colaborador no Vale Transporte (% do salário)
      user: { include: { position: { include: { remunerations: true } }, sector: true } },
      benefit: true,
      declarationFile: true,
    },
    enabled: !!id,
  });

  const { deleteAsync, deleteMutation } = useUserBenefitMutations();
  const suspendMutation = useSuspendUserBenefit();
  const reactivateMutation = useReactivateUserBenefit();

  const userBenefit = response?.data;

  if (!id) {
    return <Navigate to={routes.personnelDepartment.benefits.enrollments.root} replace />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <p className="text-destructive mb-4">Erro ao carregar adesão</p>
        <Navigate to={routes.personnelDepartment.benefits.enrollments.root} replace />
      </div>
    );
  }

  if (isLoading) {
    return (
      <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN]}>
        <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
          <Skeleton className="h-24 w-full" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </PrivilegeRoute>
    );
  }

  if (!userBenefit) {
    return <Navigate to={routes.personnelDepartment.benefits.enrollments.root} replace />;
  }

  const title = `${userBenefit.user?.name || "Colaborador"} — ${userBenefit.benefit?.name || "Benefício"}`;

  const canSuspend = userBenefit.status === BENEFIT_ENROLLMENT_STATUS.ACTIVE;
  const canReactivate = userBenefit.status === BENEFIT_ENROLLMENT_STATUS.SUSPENDED;
  const canTerminate = userBenefit.status === BENEFIT_ENROLLMENT_STATUS.ACTIVE || userBenefit.status === BENEFIT_ENROLLMENT_STATUS.SUSPENDED;
  const canEdit = userBenefit.status !== BENEFIT_ENROLLMENT_STATUS.TERMINATED;

  const handleSuspend = async () => {
    try {
      await suspendMutation.mutateAsync({ id });
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error("Error suspending enrollment:", error);
      }
    }
  };

  const handleReactivate = async () => {
    try {
      await reactivateMutation.mutateAsync({ id });
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error("Error reactivating enrollment:", error);
      }
    }
  };

  const handleDelete = async () => {
    try {
      await deleteAsync(id);
      navigate(routes.personnelDepartment.benefits.enrollments.root);
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error("Error deleting enrollment:", error);
      }
    }
    setIsDeleteDialogOpen(false);
  };

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="detail"
          title={title}
          breadcrumbs={[
            { label: "Início", href: "/" },
            { label: "Departamento Pessoal" },
            { label: "Benefícios", href: routes.personnelDepartment.benefits.root },
            { label: "Adesões", href: routes.personnelDepartment.benefits.enrollments.root },
            { label: userBenefit.user?.name || "Detalhes" },
          ]}
          actions={[
            {
              key: "refresh",
              label: "Atualizar",
              icon: IconRefresh,
              onClick: () => refetch(),
              loading: isRefetching,
            },
            ...(canSuspend
              ? [
                  {
                    key: "suspend",
                    label: "Suspender",
                    icon: IconPlayerPause,
                    onClick: handleSuspend,
                    disabled: suspendMutation.isPending,
                  },
                ]
              : []),
            ...(canReactivate
              ? [
                  {
                    key: "reactivate",
                    label: "Reativar",
                    icon: IconPlayerPlay,
                    onClick: handleReactivate,
                    disabled: reactivateMutation.isPending,
                  },
                ]
              : []),
            ...(canTerminate
              ? [
                  {
                    key: "terminate",
                    label: "Encerrar",
                    icon: IconCircleX,
                    onClick: () => setTerminateDialog(userBenefit),
                  },
                ]
              : []),
            ...(canEdit
              ? [
                  {
                    key: "edit",
                    label: "Editar",
                    icon: IconEdit,
                    onClick: () => navigate(routes.personnelDepartment.benefits.enrollments.edit(id)),
                  },
                ]
              : []),
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
          ]}
          className="flex-shrink-0"
        />
        <div className="flex-1 overflow-y-auto pb-6">
          <div className="space-y-4">
            {/* Info Cards Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
              <UserBenefitUserCard userBenefit={userBenefit} />
              <UserBenefitBenefitCard userBenefit={userBenefit} />
              <UserBenefitValuesCard userBenefit={userBenefit} />
              <UserBenefitDatesCard userBenefit={userBenefit} />
            </div>

            {/* Declaration Upload + Changelog */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
              <UserBenefitDeclarationCard userBenefit={userBenefit} />
              <ChangelogHistory
                entityType={CHANGE_LOG_ENTITY_TYPE.USER_BENEFIT}
                entityId={id}
                entityName={title}
                entityCreatedAt={userBenefit.createdAt}
                className="h-full"
              />
            </div>
          </div>
        </div>

        {/* Terminate Dialog */}
        <UserBenefitTerminateDialog userBenefit={terminateDialog} onOpenChange={(open) => !open && setTerminateDialog(null)} />

        {/* Delete Confirmation Dialog */}
        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <IconAlertTriangle className="h-5 w-5 text-destructive" />
                Confirmar Exclusão
              </DialogTitle>
              <DialogDescription>
                Tem certeza que deseja excluir a adesão
                {userBenefit.user?.name ? ` de "${userBenefit.user.name}"` : ""}
                {userBenefit.benefit?.name ? ` ao benefício "${userBenefit.benefit.name}"` : ""}? Esta ação não poderá ser desfeita.
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

export default UserBenefitDetailPage;
