import { useState } from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import { IconEdit, IconTrash, IconRefresh, IconLoader2, IconAlertTriangle } from "@tabler/icons-react";

import { routes, SECTOR_PRIVILEGES } from "../../../../constants";
import { useObservation, useObservationMutations, useAuth } from "../../../../hooks";
import { canEditObservations, canDeleteObservations } from "@/utils/permissions/entity-permissions";

import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { ObservationInfoCard, ObservationDetailSkeleton } from "@/components/production/observation/detail";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { generateFileUrls } from "@/utils/file-viewer";
import { DETAIL_PAGE_SPACING, getDetailGridClasses } from "@/lib/layout-constants";

export const ObservationDetailsPage = () => {
  usePageTracker({ title: "observation-detail" });
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // Permission checks
  const canEdit = canEditObservations(user);
  const canDelete = canDeleteObservations(user);

  const {
    data: response,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useObservation(id || "", {
    include: {
      task: {
        include: {
          customer: true,
          sector: true,
        },
      },
      files: true,
      commissions: {
        include: {
          user: true,
        },
      },
    },
    enabled: !!id,
  });

  const observation = response?.data;
  const { deleteAsync, deleteMutation } = useObservationMutations();

  if (!id) {
    return <Navigate to={routes.production.observations.root} replace />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <p className="text-destructive mb-4">Erro ao carregar observação</p>
        <Navigate to={routes.production.observations.root} replace />
      </div>
    );
  }

  if (isLoading) {
    return (
      <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.PRODUCTION, SECTOR_PRIVILEGES.WAREHOUSE, SECTOR_PRIVILEGES.FINANCIAL, SECTOR_PRIVILEGES.COMMERCIAL, SECTOR_PRIVILEGES.ADMIN]}>
        <ObservationDetailSkeleton />
      </PrivilegeRoute>
    );
  }

  if (!observation) {
    return <Navigate to={routes.production.observations.root} replace />;
  }

  const handleDelete = async () => {
    try {
      await deleteAsync(id);
      navigate(routes.production.observations.root);
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error deleting observation:", error);
      }
    }
    setIsDeleteDialogOpen(false);
  };

  const handleRefresh = () => {
    refetch();
  };

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.PRODUCTION, SECTOR_PRIVILEGES.WAREHOUSE, SECTOR_PRIVILEGES.FINANCIAL, SECTOR_PRIVILEGES.COMMERCIAL, SECTOR_PRIVILEGES.ADMIN]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="detail"
          title={observation.task ? `Observação - ${observation.task.name}` : "Observação"}
          breadcrumbs={[
            { label: "Início", href: "/" },
            { label: "Produção" },
            { label: "Observações", href: routes.production.observations.root },
            { label: observation.task ? `Observação - ${observation.task.name}` : `Observação #${observation.id.slice(-8)}` },
          ]}
          actions={[
            {
              key: "refresh",
              label: "Atualizar",
              icon: IconRefresh,
              onClick: handleRefresh,
              loading: isRefetching,
            },
            ...(canEdit ? [{
              key: "edit",
              label: "Editar",
              icon: IconEdit,
              onClick: () => navigate(routes.production.observations.edit(id)),
            }] : []),
            ...(canDelete ? [{
              key: "delete",
              label: "Excluir",
              icon: IconTrash,
              onClick: () => setIsDeleteDialogOpen(true),
            }] : []),
          ]}
          className="flex-shrink-0"
        />
        <div className="flex-1 overflow-y-auto pb-6">
          <ObservationInfoCard
            observation={{
              ...observation,
              files: observation.files?.map((file) => {
                const urls = generateFileUrls(file);
                return {
                  ...file,
                  fileUrl: urls.serve,
                  thumbnailUrl: file.thumbnailUrl || urls.thumbnail || undefined,
                  mimeType: file.mimetype, // Map mimetype to mimeType
                };
              }),
            }}
          />
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
                Tem certeza que deseja excluir esta observação?
                {(observation as any).commissions && (observation as any).commissions.length > 0 && (
                  <span className="block mt-2 font-medium text-warning">Atenção: As comissões suspensas por esta observação serão restauradas automaticamente.</span>
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
