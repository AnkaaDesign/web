import { useState } from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import { IconEdit, IconTrash, IconRefresh, IconLoader2, IconAlertTriangle } from "@tabler/icons-react";

import { routes, SECTOR_PRIVILEGES, CHANGE_LOG_ENTITY_TYPE } from "../../../../constants";
import { usePosition, usePositionMutations } from "../../../../hooks";

import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { SpecificationsCard, RemunerationHistoryCard, RelatedUsersCard, PositionDetailSkeleton } from "@/components/human-resources/position/detail";
import { ChangelogHistory } from "@/components/ui/changelog-history";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { usePageTracker } from "@/hooks/common/use-page-tracker";

export const PositionDetailPage = () => {
  usePageTracker({ title: "Detalhes do Cargo" });
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const {
    data: response,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = usePosition(id || "", {
    include: {
      users: {
        include: {
          sector: true,
        },
        orderBy: {
          name: "asc",
        },
      },
      remunerations: {
        orderBy: {
          createdAt: "desc",
        },
      },
      changelogs: {
        include: {
          user: true,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 10,
      },
      _count: {
        select: {
          users: true,
          remunerations: true,
        },
      },
    },
    enabled: !!id,
  });

  const { deleteAsync, deleteMutation } = usePositionMutations();

  const position = response?.data;

  if (!id) {
    return <Navigate to={routes.personnelDepartment.positions.root} replace />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <p className="text-destructive mb-4">Erro ao carregar cargo</p>
        <Navigate to={routes.personnelDepartment.positions.root} replace />
      </div>
    );
  }

  if (isLoading) {
    return (
      <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ACCOUNTING]}>
        <PositionDetailSkeleton />
      </PrivilegeRoute>
    );
  }

  if (!position) {
    return <Navigate to={routes.personnelDepartment.positions.root} replace />;
  }

  const handleDelete = async () => {
    try {
      await deleteAsync(id);
      navigate(routes.personnelDepartment.positions.root);
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error("Error deleting position:", error);
      }
    }
    setIsDeleteDialogOpen(false);
  };

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ACCOUNTING]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="detail"
          entity={position}
          title={position.name}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Recursos Humanos", href: routes.personnelDepartment.root },
            { label: "Cargos", href: routes.personnelDepartment.positions.root },
            { label: position.name },
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
              onClick: () => navigate(routes.personnelDepartment.positions.edit(id)),
            },
            {
              key: "delete",
              label: "Excluir",
              icon: IconTrash,
              onClick: () => setIsDeleteDialogOpen(true),
              disabled: deleteMutation.isPending,
            },
          ]}
          className="flex-shrink-0"
        />

        <div className="flex-1 overflow-y-auto pb-6">
          <div className="space-y-4">
            {/* Specifications + Remuneration (left) | Changelog (right) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
              <div className="flex flex-col gap-4 min-h-0">
                <SpecificationsCard position={position} />
                <RemunerationHistoryCard position={position} className="flex-1 min-h-0" />
              </div>
              <ChangelogHistory
                entityType={CHANGE_LOG_ENTITY_TYPE.POSITION}
                entityId={id}
                entityName={position.name}
                entityCreatedAt={position.createdAt}
                className="h-full"
              />
            </div>

            {/* Related Users - Full width, last section */}
            <RelatedUsersCard position={position} />
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
                Tem certeza que deseja excluir o cargo "{position.name}"?
                {position._count?.users ? (
                  <span className="block mt-2 font-medium text-destructive">
                    Atenção: Este cargo possui {position._count.users} funcionário{position._count.users !== 1 ? "s" : ""} associado{position._count.users !== 1 ? "s" : ""}.
                  </span>
                ) : null}
                {" "}Esta ação não poderá ser desfeita.
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

export default PositionDetailPage;
