import { useNavigate } from "react-router-dom";
import { routes, PPE_DELIVERY_STATUS, FAVORITE_PAGES } from "../../../../constants";
import { usePpeDeliveryMutations, useAuth } from "../../../../hooks";
import { PageHeader } from "@/components/ui/page-header";
import { IconShield, IconX, IconCheck, IconLoader2 } from "@tabler/icons-react";
import type { PpeDeliveryCreateFormData } from "../../../../schemas";
import { PpeDeliveryForm } from "@/components/inventory/epi/delivery/ppe-delivery-form";

export const EPIDeliveryCreate = () => {
  const navigate = useNavigate();
  const { createAsync, createMutation } = usePpeDeliveryMutations();
  const { data: currentUser } = useAuth();

  const handleSubmit = async (data: PpeDeliveryCreateFormData) => {
    // For admin users, auto-approve the delivery
    const createData: PpeDeliveryCreateFormData = {
      ...data,
      status: PPE_DELIVERY_STATUS.APPROVED, // Auto-approve when admin creates
      reviewedBy: currentUser?.id || "", // Set current admin as reviewer
    };

    await createAsync(createData);
    navigate(routes.humanResources.ppe.deliveries.root);
  };

  const handleCancel = () => {
    navigate(routes.humanResources.ppe.deliveries.root);
  };

  const actions = [
    {
      key: "cancel",
      label: "Cancelar",
      icon: IconX,
      onClick: handleCancel,
      variant: "outline" as const,
      disabled: createMutation.isPending,
    },
    {
      key: "submit",
      label: "Criar",
      icon: createMutation.isPending ? IconLoader2 : IconCheck,
      onClick: () => document.getElementById("ppe-delivery-form-submit")?.click(),
      variant: "default" as const,
      disabled: createMutation.isPending,
      loading: createMutation.isPending,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="max-w-5xl mx-auto">
          <PageHeader
            variant="form"
            title="Nova Entrega de EPI"
            icon={IconShield}
            breadcrumbs={[
              { label: "Início", href: routes.home },
              { label: "RH", href: routes.humanResources.root },
              { label: "EPI", href: routes.humanResources.ppe.root },
              { label: "Entregas", href: routes.humanResources.ppe.deliveries.root },
              { label: "Nova Entrega" },
            ]}
            actions={actions}
            favoritePage={FAVORITE_PAGES.RECURSOS_HUMANOS_EPI_ENTREGAS_CADASTRAR}
          />
      </div>

      <div className="max-w-5xl mx-auto">
        <PpeDeliveryForm mode="create" onSubmit={handleSubmit} isSubmitting={createMutation.isPending} />
      </div>
    </div>
  );
};
