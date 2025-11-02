import { useState } from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import { IconUser, IconEdit, IconTrash, IconRefresh, IconLoader2, IconAlertTriangle } from "@tabler/icons-react";

import { routes, SECTOR_PRIVILEGES, CHANGE_LOG_ENTITY_TYPE } from "../../../../constants";
import { useUser, useUserMutations } from "../../../../hooks";

import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { BasicInfoCard, AddressCard, ProfessionalInfoCard, LoginInfoCard, RelatedActivitiesCard, PpeSizesCard } from "@/components/administration/user/detail";
import { UserDetailSkeleton } from "@/components/administration/user/detail/user-detail-skeleton";
import { ChangelogHistory } from "@/components/ui/changelog-history";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { usePageTracker } from "@/hooks/use-page-tracker";

const CollaboratorDetailsPage = () => {
  usePageTracker({ title: "Detalhes do Colaborador" });
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const {
    data: response,
    isLoading,
    error,
    refetch,
  } = useUser(id || "", {
    include: {
      position: true,
      sector: true,
      managedSector: true,
      ppeSize: true,
      activities: {
        include: {
          item: true,
        },
      },
      changeLogs: true,
      vacations: true,
    },
    enabled: !!id,
  });

  const user = response?.data;
  const mutations = useUserMutations();

  if (!id) {
    return <Navigate to={routes.administration.collaborators.root} replace />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <p className="text-destructive mb-4">Erro ao carregar colaborador</p>
        <Navigate to={routes.administration.collaborators.root} replace />
      </div>
    );
  }

  if (isLoading) {
    return (
      <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.ADMIN}>
        <UserDetailSkeleton />
      </PrivilegeRoute>
    );
  }

  if (!user) {
    return <Navigate to={routes.administration.collaborators.root} replace />;
  }

  const handleDelete = async () => {
    try {
      await mutations.delete(id);
      toast.success("Colaborador excluído com sucesso");
      navigate(routes.administration.collaborators.root);
    } catch (error) {
      toast.error("Erro ao excluir colaborador");
    }
    setIsDeleteDialogOpen(false);
  };

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.ADMIN}>
      <div className="flex flex-col h-full space-y-6">
        <PageHeader
          variant="detail"
          title={user.name}
          icon={IconUser}
          breadcrumbs={[
            { label: "Início", href: "/" },
            { label: "Administração" },
            { label: "Colaboradores", href: routes.administration.collaborators.root },
            { label: user.name },
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
              onClick: () => navigate(routes.administration.collaborators.edit(id)),
            },
            {
              key: "delete",
              label: "Excluir",
              icon: IconTrash,
              onClick: () => setIsDeleteDialogOpen(true),
            },
          ]}
        />

        <div className="flex-1 overflow-y-auto">
          <div className="space-y-6">
            {/* Core Information Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <BasicInfoCard user={user} />
              <AddressCard user={user} />
            </div>

            {/* Professional and Login Info Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ProfessionalInfoCard user={user} />
              <LoginInfoCard user={user} />
            </div>

            {/* PPE Sizes and Changelog History - Side by Side */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <PpeSizesCard user={user} className="h-[700px]" />
              <ChangelogHistory entityType={CHANGE_LOG_ENTITY_TYPE.USER} entityId={id} maxHeight="700px" className="h-[700px]" />
            </div>

            {/* Related Activities */}
            <div className="grid grid-cols-1 gap-6">
              <RelatedActivitiesCard user={user} />
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
                Tem certeza que deseja excluir o colaborador "{user.name}"?
                Esta ação não poderá ser desfeita.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
                Cancelar
              </Button>
              <Button variant="destructive" onClick={handleDelete} disabled={false}>
                {false ? <IconLoader2 className="h-4 w-4 mr-2 animate-spin" /> : <IconTrash className="h-4 w-4 mr-2" />}
                Excluir
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PrivilegeRoute>
  );
};

export default CollaboratorDetailsPage;
