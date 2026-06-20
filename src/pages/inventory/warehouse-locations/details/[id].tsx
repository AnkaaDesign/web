import { useState } from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import { IconEdit, IconTrash, IconRefresh, IconLoader2, IconAlertTriangle } from "@tabler/icons-react";

import { routes, SECTOR_PRIVILEGES } from "../../../../constants";
import { useWarehouseLocationDetail, useWarehouseLocationMutations } from "../../../../hooks";

import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/page-header";
import { BasicInfoCard, RelatedItemsCard } from "@/components/inventory/warehouse-location/detail";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { useAuth } from "@/contexts/auth-context";
import { canEditWarehouseLocations, canDeleteWarehouseLocations } from "@/utils/permissions/entity-permissions";

const WarehouseLocationDetailsPage = () => {
  usePageTracker({ title: "warehouse-location-detail" });
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canEdit = canEditWarehouseLocations(user);
  const canDelete = canDeleteWarehouseLocations(user);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const {
    data: response,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useWarehouseLocationDetail(id || "", {
    include: {
      items: {
        include: {
          category: true,
        },
      },
      _count: {
        select: {
          items: true,
        },
      },
    },
    enabled: !!id,
  });

  const warehouseLocation = response?.data;
  const { delete: deleteWarehouseLocation } = useWarehouseLocationMutations();

  if (!id) {
    return <Navigate to={routes.inventory.warehouseLocations.root} replace />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <p className="text-destructive mb-4">Erro ao carregar localização</p>
        <Navigate to={routes.inventory.warehouseLocations.root} replace />
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

  if (!warehouseLocation) {
    return <Navigate to={routes.inventory.warehouseLocations.root} replace />;
  }

  const handleDelete = async () => {
    try {
      await deleteWarehouseLocation.mutateAsync(id);
      navigate(routes.inventory.warehouseLocations.root);
    } catch (error) {
      // Error handled by api-client interceptor
    }
    setIsDeleteDialogOpen(false);
  };

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.WAREHOUSE}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="detail"
          title={warehouseLocation.name}
          breadcrumbs={[
            { label: "Início", href: "/" },
            { label: "Estoque", href: routes.inventory.root },
            { label: "Localizações", href: routes.inventory.warehouseLocations.root },
            { label: warehouseLocation.name },
          ]}
          actions={[
            {
              key: "refresh",
              label: "Atualizar",
              icon: IconRefresh,
              onClick: () => refetch(),
              loading: isRefetching,
            },
            ...(canEdit
              ? [
                  {
                    key: "edit",
                    label: "Editar",
                    icon: IconEdit,
                    onClick: () => navigate(routes.inventory.warehouseLocations.edit(id)),
                  },
                ]
              : []),
            ...(canDelete
              ? [
                  {
                    key: "delete",
                    label: "Excluir",
                    icon: IconTrash,
                    onClick: () => setIsDeleteDialogOpen(true),
                  },
                ]
              : []),
          ]}
          className="flex-shrink-0"
        />
        <div className="flex-1 overflow-y-auto pb-6">
          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <BasicInfoCard warehouseLocation={warehouseLocation} />
            </div>

            <RelatedItemsCard items={warehouseLocation.items} warehouseLocationId={warehouseLocation.id} />
          </div>
        </div>

        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <IconAlertTriangle className="h-5 w-5 text-destructive" />
                Confirmar Exclusão
              </DialogTitle>
              <DialogDescription>
                Tem certeza que deseja excluir a localização "{warehouseLocation.name}"?
                {warehouseLocation._count?.items ? (
                  <span className="block mt-2 font-medium text-destructive">
                    Atenção: Esta localização possui {warehouseLocation._count.items} produto{warehouseLocation._count.items !== 1 ? "s" : ""} associado
                    {warehouseLocation._count.items !== 1 ? "s" : ""}.
                  </span>
                ) : null}
                Esta ação não poderá ser desfeita.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
                Cancelar
              </Button>
              <Button variant="destructive" onClick={handleDelete} disabled={deleteWarehouseLocation.isPending}>
                {deleteWarehouseLocation.isPending ? <IconLoader2 className="h-4 w-4 mr-2 animate-spin" /> : <IconTrash className="h-4 w-4 mr-2" />}
                Excluir
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PrivilegeRoute>
  );
};

export default WarehouseLocationDetailsPage;
