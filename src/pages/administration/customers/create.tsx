import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { routes, FAVORITE_PAGES } from "../../../constants";
import { useCreateCustomer } from "../../../hooks";
import { CustomerForm } from "@/components/administration/customer/form";
import { PageHeader } from "@/components/ui/page-header";
import { IconUsers, IconCheck, IconLoader2 } from "@tabler/icons-react";
import type { CustomerCreateFormData } from "../../../schemas";

export const CreateCustomerPage = () => {
  const navigate = useNavigate();
  const createCustomer = useCreateCustomer();
  const [formState, setFormState] = useState({ isValid: false, isDirty: false });

  const handleSubmit = async (data: CustomerCreateFormData) => {
    try {
      const response = await createCustomer.mutateAsync(data);

      if (response?.data?.id) {
        navigate(routes.administration.customers.details(response.data.id));
      }
    } catch (error: any) {
      // Error is already handled by the API client and mutation
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error creating customer:", error);
      }
    }
  };

  const handleCancel = () => {
    navigate(routes.administration.customers.root);
  };

  const actions = [
    {
      key: "cancel",
      label: "Cancelar",
      onClick: handleCancel,
      variant: "outline" as const,
      disabled: createCustomer.isPending,
    },
    {
      key: "submit",
      label: "Cadastrar",
      icon: createCustomer.isPending ? IconLoader2 : IconCheck,
      onClick: () => document.getElementById("customer-form-submit")?.click(),
      variant: "default" as const,
      disabled: createCustomer.isPending || !formState.isValid,
      loading: createCustomer.isPending,
    },
  ];

  return (
    <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
      <PageHeader
        title="Cadastrar Cliente"
        icon={IconUsers}
        favoritePage={FAVORITE_PAGES.ADMINISTRACAO_CLIENTES_CADASTRAR}
        breadcrumbs={[
          { label: "Início", href: routes.home },
          { label: "Administração", href: routes.administration.root },
          { label: "Clientes", href: routes.administration.customers.root },
          { label: "Cadastrar" },
        ]}
        actions={actions}
        className="flex-shrink-0"
      />
      <div className="flex-1 overflow-y-auto pb-6">
        <CustomerForm mode="create" onSubmit={handleSubmit} isSubmitting={createCustomer.isPending} onFormStateChange={setFormState} />
      </div>
    </div>
  );
};
