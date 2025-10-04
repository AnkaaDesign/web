import { useState } from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import { IconUsers, IconEdit, IconTrash, IconRefresh, IconLoader2, IconAlertTriangle, IconChecklist } from "@tabler/icons-react";

import { routes, SECTOR_PRIVILEGES, CHANGE_LOG_ENTITY_TYPE } from "../../../../constants";
import { useCustomer, useCustomerMutations } from "../../../../hooks";

import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { BasicInfoCard, ContactDetailsCard, AddressInfoCard, RelatedInvoicesCard } from "@/components/administration/customer/detail";
import { CustomerDetailSkeleton } from "@/components/administration/customer/detail/customer-detail-skeleton";
import { ChangelogHistory } from "@/components/ui/changelog-history";
import { RelatedTasksCard } from "@/components/shared/related-tasks-card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { usePageTracker } from "@/hooks/use-page-tracker";

export const CustomerDetailsPage = () => {
  usePageTracker({ title: "customer-detail" });
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const {
    data: response,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useCustomer(id || "", {
    include: {
      logo: true,
      tasks: {
        include: {
          customer: true,
          createdBy: true,
          services: true,
          sector: true,
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      },
      _count: {
        tasks: true,
        serviceOrders: true,
        services: true,
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
    },
    enabled: !!id,
  });

  const customer = response?.data;
  const { deleteAsync, deleteMutation } = useCustomerMutations();

  if (!id) {
    return <Navigate to={routes.administration.customers.root} replace />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <p className="text-destructive mb-4">Erro ao carregar cliente</p>
        <Navigate to={routes.administration.customers.root} replace />
      </div>
    );
  }

  if (isLoading) {
    return (
      <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.BASIC}>
        <CustomerDetailSkeleton />
      </PrivilegeRoute>
    );
  }

  if (!customer) {
    return <Navigate to={routes.administration.customers.root} replace />;
  }

  const handleDelete = async () => {
    try {
      await deleteAsync(id);
      toast.success("Cliente excluído com sucesso");
      navigate(routes.administration.customers.root);
    } catch (error) {
      toast.error("Erro ao excluir cliente");
    }
    setIsDeleteDialogOpen(false);
  };

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.BASIC}>
      <div className="flex flex-col h-full space-y-6">
        <PageHeader
          variant="detail"
          title={customer.fantasyName}
          icon={IconUsers}
          breadcrumbs={[
            { label: "Início", href: "/" },
            { label: "Administração" },
            { label: "Clientes", href: routes.administration.customers.root },
            { label: customer.fantasyName },
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
              onClick: () => navigate(routes.administration.customers.edit(id)),
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
              <BasicInfoCard customer={customer} />
              <ContactDetailsCard customer={customer} />
            </div>

            {/* Address and Changelog Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <AddressInfoCard customer={customer} />
              <ChangelogHistory entityType={CHANGE_LOG_ENTITY_TYPE.CUSTOMER} entityId={id} maxHeight="400px" />
            </div>

            {/* Related Tasks and Invoices Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <RelatedTasksCard
                tasks={customer.tasks || []}
                title="Tarefas Relacionadas"
                icon={IconChecklist}
                viewAllUrl={`${routes.production.schedule.list}?customerId=${customer.id}&customerName=${encodeURIComponent(customer.fantasyName || "")}`}
                viewAllLabel="Ver todas as tarefas"
                showViewToggle={true}
                defaultView="grid"
                displayMode="status"
                className="h-[600px]"
              />
              <RelatedInvoicesCard customer={customer} />
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
                Tem certeza que deseja excluir o cliente "{customer.fantasyName}"?
                {customer._count?.tasks ? (
                  <span className="block mt-2 font-medium text-destructive">
                    Atenção: Este cliente possui {customer._count.tasks} tarefa{customer._count.tasks !== 1 ? "s" : ""} associada{customer._count.tasks !== 1 ? "s" : ""}.
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
