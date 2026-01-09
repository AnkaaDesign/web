import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { routes, SECTOR_PRIVILEGES } from "../../../../constants";
import { useCustomer, useCustomerMutations } from "../../../../hooks";
import { CustomerEditForm } from "@/components/administration/customer/form";
import { PageHeader } from "@/components/ui/page-header";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { IconUsers, IconCheck, IconLoader2 } from "@tabler/icons-react";
import type { CustomerUpdateFormData } from "../../../../schemas";

export const FinancialCustomersEditPage = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [formState, setFormState] = useState({ isValid: false, isDirty: false });

  // Use the same includes as the detail page for consistency
  const includeParams = {
    tasks: {
      include: {
        user: true,
        services: true,
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    },
    logo: true,
  };

  const {
    data: response,
    isLoading,
    error,
  } = useCustomer(id!, {
    include: includeParams,
    enabled: !!id,
  });

  const customer = response?.data;

  const { updateAsync: updateCustomer, isUpdating } = useCustomerMutations();

  const handleSubmit = async (changedFields: Partial<CustomerUpdateFormData> | FormData) => {
    if (!id) return;

    try {
      // Check if we have changes (FormData always has changes, regular objects need key check)
      const hasChanges = changedFields instanceof FormData || Object.keys(changedFields).length > 0;

      // Only submit if there are changes
      if (hasChanges) {
        const response = await updateCustomer({ id: id!, data: changedFields as any });

        if (response?.data?.id) {
          navigate(routes.financial.customers.details(id));
        }
      } else {
        // No changes, just navigate back
        navigate(routes.financial.customers.details(id));
      }
    } catch (error: any) {
      // Error is already handled by the API client and mutation
    }
  };

  const handleCancel = () => {
    navigate(routes.financial.customers.details(id!));
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <IconLoader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Error state
  if (error || !customer) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-2">Cliente não encontrado</h2>
          <p className="text-muted-foreground mb-4">O cliente que você está procurando não existe ou foi removido.</p>
        </div>
      </div>
    );
  }

  const actions = [
    {
      key: "cancel",
      label: "Cancelar",
      onClick: handleCancel,
      variant: "outline" as const,
      disabled: isUpdating,
    },
    {
      key: "submit",
      label: "Salvar Alterações",
      icon: isUpdating ? IconLoader2 : IconCheck,
      onClick: () => document.getElementById("customer-form-submit")?.click(),
      variant: "default" as const,
      disabled: isUpdating || !formState.isValid || !formState.isDirty,
      loading: isUpdating,
    },
  ];

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.FINANCIAL, SECTOR_PRIVILEGES.ADMIN]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <div className="container mx-auto max-w-4xl flex-shrink-0">
          <PageHeader
            variant="form"
            title="Editar Cliente"
            icon={IconUsers}
            breadcrumbs={[
              { label: "Início", href: routes.home },
              { label: "Financeiro", href: routes.financial.root },
              { label: "Clientes", href: routes.financial.customers.root },
              { label: customer.fantasyName, href: routes.financial.customers.details(id!) },
              { label: "Editar" },
            ]}
            actions={actions}
          />
        </div>
        <div className="flex-1 overflow-y-auto pb-6">
          <CustomerEditForm customer={customer} onSubmit={handleSubmit} isSubmitting={isUpdating} onFormStateChange={setFormState} />
        </div>
      </div>
    </PrivilegeRoute>
  );
};

export default FinancialCustomersEditPage;
