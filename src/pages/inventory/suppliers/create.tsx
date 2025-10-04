import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { routes, FAVORITE_PAGES } from "../../../constants";
import { useCreateSupplier } from "../../../hooks";
import { SupplierForm } from "@/components/inventory/supplier/form";
import { PageHeaderWithFavorite } from "@/components/ui/page-header-with-favorite";
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
      console.error("Error creating supplier:", error);
    }
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
    <div className="h-full flex flex-col space-y-4">
      {/* Fixed Header */}
      <div className="flex-shrink-0">
        <div className="max-w-4xl mx-auto">
          <PageHeaderWithFavorite
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
      </div>

      {/* Main Content Card - Dashboard style scrolling */}
      <div className="flex-1 overflow-hidden max-w-4xl mx-auto w-full">
        <div className="h-full bg-white rounded-lg shadow-sm border overflow-hidden">
          <SupplierForm mode="create" onSubmit={handleSubmit} isSubmitting={createSupplier.isPending} onValidityChange={setIsFormValid} />
        </div>
      </div>
    </div>
  );
}
