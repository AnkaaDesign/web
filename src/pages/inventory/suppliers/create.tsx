import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { routes, FAVORITE_PAGES } from "../../../constants";
import { useCreateSupplier } from "../../../hooks";
import { SupplierForm } from "@/components/inventory/supplier/form";
import { PageHeader } from "@/components/ui/page-header";
import { IconBuilding, IconCheck, IconLoader2 } from "@tabler/icons-react";
import type { SupplierCreateFormData } from "../../../schemas";

export default function SupplierCreate() {
  const navigate = useNavigate();
  const createSupplier = useCreateSupplier();
  const [isFormValid, setIsFormValid] = useState(false);

  const handleSubmit = async (data: SupplierCreateFormData) => {
    try {
      const response = await createSupplier.mutateAsync(data);

      if (response?.data?.id) {
        navigate(routes.inventory.suppliers.details(response.data.id));
      }
    } catch (error: any) {
      // Error is already handled by the API client and mutation
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error creating supplier:", error);
      }
    }
  };

  const handleFormStateChange = (formState: { isValid: boolean; isDirty: boolean }) => {
    setIsFormValid(formState.isValid);
  };

  const handleCancel = () => {
    navigate(routes.inventory.suppliers.root);
  };

  const actions = [
    {
      key: "cancel",
      label: "Cancelar",
      onClick: handleCancel,
      variant: "outline" as const,
      disabled: createSupplier.isPending,
    },
    {
      key: "submit",
      label: "Cadastrar",
      icon: createSupplier.isPending ? IconLoader2 : IconCheck,
      onClick: () => document.getElementById("supplier-form-submit")?.click(),
      variant: "default" as const,
      disabled: createSupplier.isPending || !isFormValid,
      loading: createSupplier.isPending,
    },
  ];

  return (
    <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
      <div className="container mx-auto max-w-4xl flex-shrink-0">
        <PageHeader
          title="Cadastrar Fornecedor"
          icon={IconBuilding}
          favoritePage={FAVORITE_PAGES.ESTOQUE_FORNECEDORES_CADASTRAR}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Estoque", href: routes.inventory.root },
            { label: "Fornecedores", href: routes.inventory.suppliers.root },
            { label: "Cadastrar" },
          ]}
          actions={actions}
        />
      </div>
      <div className="flex-1 overflow-y-auto pb-6">
        <SupplierForm mode="create" onSubmit={handleSubmit} isSubmitting={createSupplier.isPending} onFormStateChange={handleFormStateChange} />
      </div>
    </div>
  );
}
