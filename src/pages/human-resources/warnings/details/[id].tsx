import { useState } from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import { IconAlertTriangle, IconEdit, IconTrash, IconRefresh, IconLoader2, IconAlertCircle } from "@tabler/icons-react";

import { routes, SECTOR_PRIVILEGES, CHANGE_LOG_ENTITY_TYPE } from "../../../../constants";
import { useWarning, useWarningMutations } from "../../../../hooks";

import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/page-header";
import { SpecificationsCard, DescriptionCard, AttachmentsCard } from "@/components/human-resources/warning/detail";
import { ChangelogHistory } from "@/components/ui/changelog-history";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { usePageTracker } from "@/hooks/use-page-tracker";

export const WarningDetailPage = () => {
  usePageTracker({ title: "Detalhes da Advertência", icon: "alert-triangle" });
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const {
    data: warning,
    isLoading,
    error,
    refetch,
  } = useWarning(id || "", {
    include: {
      collaborator: {
        include: {
          position: true,
        },
      },
      supervisor: {
        include: {
          position: true,
        },
      },
      witness: true,
      attachments: true,
      changelogs: {
        include: {
          user: true,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 10,
      },
    },
    enabled: !!id,
  });

  const { deleteMutation } = useWarningMutations();

  if (!id) {
    return <Navigate to={routes.humanResources.warnings.root} replace />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <p className="text-destructive mb-4">Erro ao carregar advertência</p>
        <Navigate to={routes.humanResources.warnings.root} replace />
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

  if (!warning) {
    return <Navigate to={routes.humanResources.warnings.root} replace />;
  }

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(id);
      navigate(routes.humanResources.warnings.root);
    } catch (error) {
      console.error("Error deleting warning:", error);
    }
    setIsDeleteDialogOpen(false);
  };

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.HUMAN_RESOURCES}>
      <div className="space-y-6">
        <PageHeader
          variant="detail"
          title="Detalhes da Advertência"
          icon={IconAlertTriangle}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Recursos Humanos" },
            { label: "Advertências", href: routes.humanResources.warnings.root },
            { label: warning.data?.collaborator?.name || "Advertência" },
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
              onClick: () => navigate(routes.humanResources.warnings.edit(id)),
            },
            {
              key: "delete",
              label: "Excluir",
              icon: IconTrash,
              onClick: () => setIsDeleteDialogOpen(true),
            },
          ]}
        />

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            <SpecificationsCard warning={warning.data!} />
            <AttachmentsCard warning={warning.data!} />
          </div>
          <div className="space-y-6">
            <DescriptionCard warning={warning.data!} />
          </div>
        </div>

        {/* Changelog */}
        <ChangelogHistory entityType={CHANGE_LOG_ENTITY_TYPE.WARNING} entityId={id} maxHeight="500px" />

        {/* Delete Dialog */}
        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <IconAlertCircle className="h-5 w-5 text-destructive" />
                Confirmar Exclusão
              </DialogTitle>
              <DialogDescription>
                Tem certeza que deseja excluir esta advertência?
                <span className="block mt-2">
                  Colaborador: <strong>{warning.data?.collaborator?.name}</strong>
                </span>
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
