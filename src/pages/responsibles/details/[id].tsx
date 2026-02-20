import { useState } from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import { IconEdit, IconTrash, IconRefresh, IconLoader2, IconAlertTriangle } from "@tabler/icons-react";

import { routes, CHANGE_LOG_ENTITY_TYPE } from "@/constants";
import { useResponsible, useResponsibleMutations } from "@/hooks";
import { useAuth } from "@/contexts/auth-context";

import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { BasicInfoCard, ContactDetailsCard, ResponsibleDetailSkeleton } from "@/components/administration/customer/responsible/detail";
import { ChangelogHistory } from "@/components/ui/changelog-history";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { usePageTracker } from "@/hooks/common/use-page-tracker";

export const ResponsibleDetailsPage = () => {
  usePageTracker({ title: "responsible-detail" });
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const { user: _user } = useAuth();

  const {
    data: responsible,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useResponsible(id || "", {
    include: {
      company: true,
      tasks: true,
    },
    enabled: !!id,
  });

  const { deleteAsync, deleteMutation } = useResponsibleMutations();

  if (!id) {
    return <Navigate to={routes.responsibles.root} replace />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <p className="text-destructive mb-4">Erro ao carregar responsável</p>
        <Navigate to={routes.responsibles.root} replace />
      </div>
    );
  }

  if (isLoading) {
    return (
      <PrivilegeRoute requiredPrivilege={["BASIC", "ADMIN", "COMMERCIAL"]}>
        <ResponsibleDetailSkeleton />
      </PrivilegeRoute>
    );
  }

  if (!responsible) {
    return <Navigate to={routes.responsibles.root} replace />;
  }

  const handleDelete = async () => {
    try {
      await deleteAsync(id);
      toast.success("Responsável excluído com sucesso");
      navigate(routes.responsibles.root);
    } catch (error) {
      toast.error("Erro ao excluir responsável");
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error deleting responsible:", error);
      }
    }
    setIsDeleteDialogOpen(false);
  };

  return (
    <PrivilegeRoute requiredPrivilege={["BASIC", "ADMIN", "COMMERCIAL"]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="detail"
          title={responsible.name}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Administração", href: routes.administration.root },
            { label: "Clientes", href: routes.administration.customers.root },
            { label: "Responsáveis", href: routes.responsibles.root },
            { label: responsible.name },
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
              onClick: () => navigate(routes.responsibles.edit(id)),
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
            {/* Core Information Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <BasicInfoCard responsible={responsible} />
              <ContactDetailsCard responsible={responsible} />
            </div>

            {/* Changelog */}
            <div className="grid grid-cols-1 gap-4">
              <ChangelogHistory
                entityType={CHANGE_LOG_ENTITY_TYPE.REPRESENTATIVE}
                entityId={id}
                maxHeight="400px"
              />
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
                Tem certeza que deseja excluir o responsável "{responsible.name}"?
                {responsible.tasks && responsible.tasks.length > 0 ? (
                  <span className="block mt-2 font-medium text-destructive">
                    Atenção: Este responsável possui {responsible.tasks.length} tarefa{responsible.tasks.length !== 1 ? "s" : ""} associada{responsible.tasks.length !== 1 ? "s" : ""}.
                  </span>
                ) : null}
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

export default ResponsibleDetailsPage;
