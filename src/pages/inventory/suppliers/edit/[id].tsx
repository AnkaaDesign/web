import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { routes } from "../../../../constants";
import { useSupplierDetail, useUpdateSupplier } from "../../../../hooks";
import { SupplierEditForm } from "@/components/inventory/supplier/form";
import { PageHeader } from "@/components/ui/page-header";
import { IconBuilding, IconCheck, IconLoader2 } from "@tabler/icons-react";
import type { SupplierUpdateFormData } from "../../../../schemas";

export const SupplierEditPage = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [formState, setFormState] = useState({ isValid: false, isDirty: false });

  // Use the same includes as the detail page for consistency
  const includeParams = {
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
      orderBy: { createdAt: "desc" },
      take: 10,
    },
    orderRules: true,
  };

  const {
    data: response,
    isLoading,
    error,
  } = useSupplierDetail(id!, {
    include: includeParams,
    enabled: !!id,
  });

  const supplier = response?.data;

  const updateSupplier = useUpdateSupplier(id!, { include: includeParams });

  const handleSubmit = async (changedFields: Partial<SupplierUpdateFormData>) => {
    if (!id) return;

    try {
      // Only submit if there are changes
      if (Object.keys(changedFields).length > 0) {
        const response = await updateSupplier.mutateAsync(changedFields);

        if (response?.data?.id) {
          navigate(routes.inventory.suppliers.details(id));
        }
      } else {
        // No changes, just navigate back
        navigate(routes.inventory.suppliers.details(id));
      }
    } catch (error: any) {
      // Error is already handled by the API client and mutation
    }
  };

  const handleCancel = () => {
    navigate(routes.inventory.suppliers.details(id!));
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
  if (error || !supplier) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-2">Fornecedor não encontrado</h2>
          <p className="text-muted-foreground mb-4">O fornecedor que você está procurando não existe ou foi removido.</p>
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
      disabled: updateSupplier.isPending,
    },
    {
      key: "submit",
      label: "Salvar Alterações",
      icon: updateSupplier.isPending ? IconLoader2 : IconCheck,
      onClick: () => document.getElementById("supplier-form-submit")?.click(),
      variant: "default" as const,
      disabled: updateSupplier.isPending || !formState.isValid || !formState.isDirty,
      loading: updateSupplier.isPending,
    },
  ];

  return (
    <div className="h-full flex flex-col space-y-4">
      {/* Fixed Header */}
      <div className="flex-shrink-0">
        <div className="max-w-4xl mx-auto">
          <PageHeader
            variant="form"
            title="Editar Fornecedor"
            icon={IconBuilding}
            breadcrumbs={[
              { label: "Início", href: routes.home },
              { label: "Estoque", href: routes.inventory.root },
              { label: "Fornecedores", href: routes.inventory.suppliers.root },
              { label: supplier.fantasyName, href: routes.inventory.suppliers.details(id!) },
              { label: "Editar" },
            ]}
            actions={actions}
          />
        </div>
      </div>

      {/* Main Content Card - Dashboard style scrolling */}
      <div className="flex-1 overflow-hidden max-w-4xl mx-auto w-full">
        <div className="h-full bg-white rounded-lg shadow-sm border overflow-hidden">
          <SupplierEditForm supplier={supplier} onSubmit={handleSubmit} isSubmitting={updateSupplier.isPending} onFormStateChange={setFormState} />
        </div>
      </div>
    </div>
  );
};
