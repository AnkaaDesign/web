import { useState } from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import { IconBuilding, IconEdit, IconTrash, IconRefresh, IconLoader2, IconAlertTriangle } from "@tabler/icons-react";

import { routes, SECTOR_PRIVILEGES, CHANGE_LOG_ENTITY_TYPE } from "../../../../constants";
import { useSupplierDetail, useSupplierMutations } from "../../../../hooks";

import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/page-header";
import { BasicInfoCard, ContactDetailsCard, AddressInfoCard, RelatedItemsCard, RelatedOrdersCard, DocumentsCard } from "@/components/inventory/supplier/detail";
import { ChangelogHistory } from "@/components/ui/changelog-history";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileViewerProvider } from "@/components/file";
import { toast } from "sonner";
import { usePageTracker } from "@/hooks/use-page-tracker";

const SupplierDetailsPage = () => {
  usePageTracker({ title: "supplier-detail" });
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const {
    data: response,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useSupplierDetail(id || "", {
    include: {
      logo: true,
      items: {
        include: {
          brand: true,
          category: true,
        },
      },
      orders: {
        include: {
          items: true,
        },
      },
      orderRules: true,
    },
    enabled: !!id,
  });

  const supplier = response?.data;
  const { delete: deleteSupplier } = useSupplierMutations();

  if (!id) {
    return <Navigate to={routes.inventory.suppliers.root} replace />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <p className="text-destructive mb-4">Erro ao carregar fornecedor</p>
        <Navigate to={routes.inventory.suppliers.root} replace />
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

  if (!supplier) {
    return <Navigate to={routes.inventory.suppliers.root} replace />;
  }

  const handleDelete = async () => {
    try {
      await deleteSupplier.mutateAsync(id);
      toast.success("Fornecedor excluído com sucesso");
      navigate(routes.inventory.suppliers.root);
    } catch (error) {
      toast.error("Erro ao excluir fornecedor");
    }
    setIsDeleteDialogOpen(false);
  };

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.WAREHOUSE}>
      <FileViewerProvider>
        <div className="flex flex-col h-full space-y-6">
          <PageHeader
            variant="detail"
            title={supplier.fantasyName}
            icon={IconBuilding}
            breadcrumbs={[{ label: "Início", href: "/" }, { label: "Estoque" }, { label: "Fornecedores", href: routes.inventory.suppliers.root }, { label: supplier.fantasyName }]}
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
                onClick: () => navigate(routes.inventory.suppliers.edit(id)),
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
                <BasicInfoCard supplier={supplier} />
                <ContactDetailsCard supplier={supplier} />
              </div>

              {/* Address and Changelog Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <AddressInfoCard supplier={supplier} />
                <ChangelogHistory entityType={CHANGE_LOG_ENTITY_TYPE.SUPPLIER} entityId={id} maxHeight="500px" />
              </div>

              {/* Documents and Empty Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <DocumentsCard supplier={supplier} />
              </div>

              {/* Related Orders */}
              <RelatedOrdersCard supplier={supplier} />

              {/* Related Items - Full Width, Last Section */}
              <RelatedItemsCard items={supplier.items} supplierId={supplier.id} />
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
                  Tem certeza que deseja excluir o fornecedor "{supplier.fantasyName}"?
                  {supplier._count?.items ? (
                    <span className="block mt-2 font-medium text-destructive">
                      Atenção: Este fornecedor possui {supplier._count.items} produto{supplier._count.items !== 1 ? "s" : ""} associado{supplier._count.items !== 1 ? "s" : ""}.
                    </span>
                  ) : null}
                  Esta ação não poderá ser desfeita.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button variant="destructive" onClick={handleDelete} disabled={deleteSupplier.isPending}>
                  {deleteSupplier.isPending ? <IconLoader2 className="h-4 w-4 mr-2 animate-spin" /> : <IconTrash className="h-4 w-4 mr-2" />}
                  Excluir
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </FileViewerProvider>
    </PrivilegeRoute>
  );
};

export default SupplierDetailsPage;
