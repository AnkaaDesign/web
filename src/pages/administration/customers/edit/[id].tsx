import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { routes } from "../../../../constants";
import { useCustomer, useCustomerMutations } from "../../../../hooks";
import { CustomerEditForm } from "@/components/administration/customer/form";
import { PageHeader } from "@/components/ui/page-header";
import { IconUsers, IconCheck, IconLoader2 } from "@tabler/icons-react";
import type { CustomerUpdateFormData } from "../../../../schemas";

export const EditCustomerPage = () => {
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

  const handleSubmit = async (changedFields: Partial<CustomerUpdateFormData>) => {
    if (!id) return;

    try {
      // Only submit if there are changes
      if (Object.keys(changedFields).length > 0) {
        const response = await updateCustomer({ id: id!, data: changedFields });

        if (response?.data?.id) {
          navigate(routes.administration.customers.details(id));
        }
      } else {
        // No changes, just navigate back
        navigate(routes.administration.customers.details(id));
      }
    } catch (error: any) {
      // Error is already handled by the API client and mutation
    }
  };

  const handleCancel = () => {
    navigate(routes.administration.customers.details(id!));
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
    <div className="h-full flex flex-col space-y-4">
      {/* Fixed Header */}
      <div className="flex-shrink-0">
        <div className="max-w-4xl mx-auto">
          <PageHeader
            variant="form"
            title="Editar Cliente"
            icon={IconUsers}
            breadcrumbs={[
              { label: "Início", href: routes.home },
              { label: "Administração", href: routes.administration.root },
              { label: "Clientes", href: routes.administration.customers.root },
              { label: customer.fantasyName, href: routes.administration.customers.details(id!) },
              { label: "Editar" },
            ]}
            actions={actions}
          />
        </div>
      </div>

      {/* Main Content Card - Dashboard style scrolling */}
      <div className="flex-1 overflow-hidden max-w-4xl mx-auto w-full">
        <div className="h-full bg-card rounded-lg shadow-md border-muted overflow-hidden">
          <CustomerEditForm customer={customer} onSubmit={handleSubmit} isSubmitting={isUpdating} onFormStateChange={setFormState} />
        </div>
      </div>
    </div>
  );
};
