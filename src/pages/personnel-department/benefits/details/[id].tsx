import { useState } from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import { IconEdit, IconTrash, IconRefresh, IconLoader2, IconAlertTriangle } from "@tabler/icons-react";

import { routes, SECTOR_PRIVILEGES, CHANGE_LOG_ENTITY_TYPE } from "../../../../constants";
import { useBenefit, useBenefitMutations } from "../../../../hooks/personnel-department/use-benefits";
import { useAuth } from "../../../../hooks/common/use-auth";

import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { BenefitInfoCard, BenefitEnrollmentsCard } from "@/components/personnel-department/benefit/detail";
import { ChangelogHistory } from "@/components/ui/changelog-history";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { usePageTracker } from "@/hooks/common/use-page-tracker";

export const BenefitDetailPage = () => {
  usePageTracker({ title: "Detalhes do Benefício" });
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const { user } = useAuth();
  const isAdmin = user?.sector?.privileges === SECTOR_PRIVILEGES.ADMIN;

  const {
    data: response,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useBenefit(id || "", {
    include: {
      _count: { select: { enrollments: true } },
    },
    enabled: !!id,
  });

  const { deleteAsync, deleteMutation } = useBenefitMutations();

  const benefit = response?.data;

  if (!id) {
    return <Navigate to={routes.personnelDepartment.benefits.root} replace />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <p className="text-destructive mb-4">Erro ao carregar benefício</p>
        <Navigate to={routes.personnelDepartment.benefits.root} replace />
      </div>
    );
  }

  if (isLoading) {
    return (
      <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN]}>
        <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
          <Skeleton className="h-24 w-full" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Skeleton className="h-96 w-full" />
            <Skeleton className="h-96 w-full" />
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      </PrivilegeRoute>
    );
  }

  if (!benefit) {
    return <Navigate to={routes.personnelDepartment.benefits.root} replace />;
  }

  const handleDelete = async () => {
    try {
      await deleteAsync(id);
      navigate(routes.personnelDepartment.benefits.root);
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error("Error deleting benefit:", error);
      }
    }
    setIsDeleteDialogOpen(false);
  };

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="detail"
          entity={benefit}
          title={benefit.name}
          breadcrumbs={[
            { label: "Início", href: "/" },
            { label: "Departamento Pessoal", href: routes.personnelDepartment.root },
            { label: "Benefícios", href: routes.personnelDepartment.benefits.root },
            { label: benefit.name },
          ]}
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
              onClick: () => navigate(routes.personnelDepartment.benefits.edit(id)),
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
          ]}
          className="flex-shrink-0"
        />
        <div className="flex-1 overflow-y-auto pb-6">
          <div className="space-y-4">
            {/* Info and Changelog Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
              <BenefitInfoCard benefit={benefit} />
              <ChangelogHistory
                entityType={CHANGE_LOG_ENTITY_TYPE.BENEFIT}
                entityId={id}
                entityName={benefit.name}
                entityCreatedAt={benefit.createdAt}
                className="h-full"
              />
            </div>

            {/* Enrollments mini-table */}
            <BenefitEnrollmentsCard benefit={benefit} />
          </div>
        </div>

        {/* Delete Confirmation Dialog */}
        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <IconAlertTriangle className="h-5 w-5 text-destructive" />
                Confirmar Exclusão
              </DialogTitle>
              <DialogDescription>
                Tem certeza que deseja excluir o benefício "{benefit.name}"?
                {benefit._count?.enrollments ? (
                  <span className="block mt-2 font-medium text-destructive">
                    Atenção: Este benefício possui {benefit._count.enrollments} {benefit._count.enrollments === 1 ? "adesão vinculada" : "adesões vinculadas"}.
                  </span>
                ) : null}{" "}
                Esta ação não poderá ser desfeita.
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

export default BenefitDetailPage;
