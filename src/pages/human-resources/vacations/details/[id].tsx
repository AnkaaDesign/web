import { useState } from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import { IconBeach, IconEdit, IconTrash, IconRefresh, IconLoader2, IconAlertTriangle } from "@tabler/icons-react";

import { routes, SECTOR_PRIVILEGES, CHANGE_LOG_ENTITY_TYPE } from "../../../../constants";
import { useVacationDetail, useVacationMutations } from "../../../../hooks";

import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/page-header";
import { SpecificationsCard } from "@/components/human-resources/vacation/detail";
import { ChangelogHistory } from "@/components/ui/changelog-history";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { usePageTracker } from "@/hooks/common/use-page-tracker";

export const VacationDetailsPage = () => {
  usePageTracker({ title: "Page", icon: "star" });
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const {
    data: vacation,
    isLoading,
    error,
    refetch,
  } = useVacationDetail(id || "", {
    include: {
      user: {
        include: {
          position: true,
          sector: true,
        },
      },
    },
    enabled: !!id,
  });

  const { deleteAsync, deleteMutation } = useVacationMutations();

  if (!id) {
    return <Navigate to={routes.humanResources.vacations.root} replace />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <p className="text-destructive mb-4">Erro ao carregar férias</p>
        <Navigate to={routes.humanResources.vacations.root} replace />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <IconLoader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!vacation) {
    return <Navigate to={routes.humanResources.vacations.root} replace />;
  }

  const handleDelete = async () => {
    try {
      await deleteAsync(id);
      navigate(routes.humanResources.vacations.root);
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error deleting vacation:", error);
      }
    }
    setIsDeleteDialogOpen(false);
  };

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.HUMAN_RESOURCES}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="detail"
          title={`Férias de ${vacation.data?.user?.name || "Colaborador"}`}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Recursos Humanos" },
            { label: "Férias", href: routes.humanResources.vacations.root },
            { label: vacation.data?.user?.name || "Férias" },
          ]}
          actions={[
            {
              key: "refresh",
              label: "Atualizar",
              icon: IconRefresh,
              onClick: () => refetch(),
            },
            {
              key: "edit",
              label: "Editar",
              icon: IconEdit,
              onClick: () => navigate(routes.humanResources.vacations.edit(id)),
            },
            {
              key: "delete",
              label: "Excluir",
              icon: IconTrash,
              onClick: () => setIsDeleteDialogOpen(true),
            },
          ]}
          className="flex-shrink-0"
        />

        <div className="flex-1 overflow-y-auto pb-6">
          <div className="space-y-4">
            {/* Info Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {vacation.data && <SpecificationsCard vacation={vacation.data} />}
              <ChangelogHistory entityType={CHANGE_LOG_ENTITY_TYPE.VACATION} entityId={id} maxHeight="500px" />
            </div>
          </div>
        </div>

        {/* Delete Dialog */}
        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <IconAlertTriangle className="h-5 w-5 text-destructive" />
                Confirmar Exclusão
              </DialogTitle>
              <DialogDescription>
                Tem certeza que deseja excluir estas férias?
                {vacation.data?.user?.name && (
                  <span className="block mt-2">
                    Colaborador: <strong>{vacation.data.user.name}</strong>
                  </span>
                )}
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
