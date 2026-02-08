import { useState } from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import { IconUsers, IconEdit, IconTrash, IconRefresh, IconLoader2, IconAlertTriangle, IconChecklist } from "@tabler/icons-react";

import { routes, SECTOR_PRIVILEGES, CHANGE_LOG_ENTITY_TYPE } from "../../../../constants";
import { PAGE_SPACING } from "@/lib/layout-constants";
import { useCustomer, useCustomerMutations } from "../../../../hooks";
import { useAuth } from "@/contexts/auth-context";
import { hasAnyPrivilege } from "@/utils";

import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { BasicInfoCard, ContactDetailsCard, AddressInfoCard, RelatedInvoicesCard, CustomerTasksList, DocumentsCard } from "@/components/administration/customer/detail";
import { CustomerDetailSkeleton } from "@/components/administration/customer/detail/customer-detail-skeleton";
import { ChangelogHistory } from "@/components/ui/changelog-history";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { usePageTracker } from "@/hooks/common/use-page-tracker";

export const FinancialCustomersDetailsPage = () => {
  usePageTracker({ title: "customer-detail" });
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const { user } = useAuth();

  // Check if user can view sensitive documents (CNPJ/CPF, invoices)
  const canViewDocuments = user && hasAnyPrivilege(user, [
    SECTOR_PRIVILEGES.ADMIN,
    SECTOR_PRIVILEGES.FINANCIAL
  ]);

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
          invoices: true,
          receipts: true,
          budgets: true,
          reimbursements: true,
          invoiceReimbursements: true,
        },
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
    return <Navigate to={routes.financial.customers.root} replace />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <p className="text-destructive mb-4">Erro ao carregar cliente</p>
        <Navigate to={routes.financial.customers.root} replace />
      </div>
    );
  }

  if (isLoading) {
    return (
      <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.FINANCIAL, SECTOR_PRIVILEGES.ADMIN]}>
        <CustomerDetailSkeleton />
      </PrivilegeRoute>
    );
  }

  if (!customer) {
    return <Navigate to={routes.financial.customers.root} replace />;
  }

  const handleDelete = async () => {
    try {
      await deleteAsync(id);
      navigate(routes.financial.customers.root);
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error deleting customer:", error);
      }
    }
    setIsDeleteDialogOpen(false);
  };

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.FINANCIAL, SECTOR_PRIVILEGES.ADMIN]}>
      <div className="h-full flex flex-col px-4 pt-4">
        <PageHeader
          variant="detail"
          title={customer.fantasyName}
          breadcrumbs={[
            { label: "Início", href: "/" },
            { label: "Financeiro", href: routes.financial.root },
            { label: "Clientes", href: routes.financial.customers.root },
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
              onClick: () => navigate(routes.financial.customers.edit(id)),
            },
            {
              key: "delete",
              label: "Excluir",
              icon: IconTrash,
              onClick: () => setIsDeleteDialogOpen(true),
            },
          ]}
        />
        <div className="flex-1 overflow-y-auto pb-6">
          <div className="mt-4 space-y-4">
            {/* Core Information Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <BasicInfoCard customer={customer} />
              <ContactDetailsCard customer={customer} />
            </div>

            {/* Address and Changelog Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
              <AddressInfoCard customer={customer} className="h-full" />
              <ChangelogHistory entityType={CHANGE_LOG_ENTITY_TYPE.CUSTOMER} entityId={id} className="h-full" />
            </div>

            {/* Documents (ADMIN and FINANCIAL only) */}
            {canViewDocuments && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <DocumentsCard customer={customer} />
              </div>
            )}

            {/* Related Invoices (ADMIN and FINANCIAL only) */}
            {canViewDocuments && <RelatedInvoicesCard customer={customer} />}

            {/* Customer Tasks - Full Width at Bottom */}
            <CustomerTasksList
              customerId={customer.id}
              customerName={customer.fantasyName}
              navigationRoute="history"
            />
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

export default FinancialCustomersDetailsPage;
