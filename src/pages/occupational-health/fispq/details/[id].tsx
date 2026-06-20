import { useState } from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import { IconEdit, IconTrash, IconRefresh, IconLoader2, IconAlertTriangle } from "@tabler/icons-react";

import { routes, SECTOR_PRIVILEGES, CHANGE_LOG_ENTITY_TYPE } from "../../../../constants";
import { useAuth } from "@/contexts/auth-context";
import { useFispq, useFispqMutations } from "@/hooks/occupational-health/use-fispq";

import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChangelogHistory } from "@/components/ui/changelog-history";
import { FispqIdentificationCard, FispqHazardsCard, FispqTransportCard, FispqMeasuresCard, FispqPpeCard, FispqDocumentCard } from "@/components/occupational-health/fispq/detail";
import { usePageTracker } from "@/hooks/common/use-page-tracker";

export const FispqDetailPage = () => {
  usePageTracker({ title: "Detalhes da FISPQ" });
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.sector?.privileges === SECTOR_PRIVILEGES.ADMIN;

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const {
    data: response,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useFispq(id || "", {
    include: { item: true, pdfFile: true, requiredPpeItems: true },
    enabled: !!id,
  });

  const { deleteAsync, deleteMutation } = useFispqMutations();
  const fispq = response?.data;

  if (!id) {
    return <Navigate to={routes.occupationalHealth.fispq.root} replace />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <p className="text-destructive mb-4">Erro ao carregar FISPQ</p>
        <Navigate to={routes.occupationalHealth.fispq.root} replace />
      </div>
    );
  }

  if (isLoading) {
    return (
      <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN]}>
        <div className="flex items-center justify-center h-full">
          <IconLoader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </PrivilegeRoute>
    );
  }

  if (!fispq) {
    return <Navigate to={routes.occupationalHealth.fispq.root} replace />;
  }

  const title = fispq.item?.name || fispq.productName || "FISPQ";

  const handleDelete = async () => {
    try {
      await deleteAsync(id);
      navigate(routes.occupationalHealth.fispq.root);
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error("Error deleting fispq:", error);
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
            { label: "Medicina do Trabalho", href: routes.occupationalHealth.root },
            { label: "FISPQ/FDS", href: routes.occupationalHealth.fispq.root },
            { label: title },
          ]}
          actions={[
            { key: "refresh", label: "Atualizar", icon: IconRefresh, onClick: () => refetch(), loading: isRefetching },
            { key: "edit", label: "Editar", icon: IconEdit, onClick: () => navigate(routes.occupationalHealth.fispq.edit(id)) },
            ...(isAdmin
              ? [{ key: "delete", label: "Excluir", icon: IconTrash, onClick: () => setIsDeleteDialogOpen(true), disabled: deleteMutation.isPending }]
              : []),
          ]}
          className="flex-shrink-0"
        />

        <div className="flex-1 overflow-y-auto pb-6">
          {/* Masonry columns so short cards (EPI etc.) pack tightly instead of stretching. */}
          <div className="columns-1 lg:columns-2 gap-4 [&>*]:mb-4 [&>*]:break-inside-avoid">
            <FispqIdentificationCard fispq={fispq} />
            <FispqHazardsCard fispq={fispq} />
            <FispqTransportCard fispq={fispq} />
            <FispqMeasuresCard fispq={fispq} />
            <FispqPpeCard fispq={fispq} />
            <FispqDocumentCard fispq={fispq} />
            <ChangelogHistory entityType={CHANGE_LOG_ENTITY_TYPE.FISPQ} entityId={id} entityName={title} entityCreatedAt={fispq.createdAt} />
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
              <DialogDescription>Tem certeza que deseja excluir esta FISPQ? Esta ação não poderá ser desfeita.</DialogDescription>
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

export default FispqDetailPage;
