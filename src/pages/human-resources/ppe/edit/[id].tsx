import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { usePageTracker } from "@/hooks/use-page-tracker";
import { EpiEditForm } from "@/components/inventory/epi/form/epi-edit-form";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { ItemEditSkeleton } from "@/components/inventory/item/skeleton/item-edit-skeleton";
import { useItem, useItemMutations } from "../../../../hooks";
import { type ItemUpdateFormData } from "../../../../schemas";
import { routes } from "../../../../constants";
import { IconCheck, IconLoader2, IconShield } from "@tabler/icons-react";

export const EditEpiPage = () => {
  usePageTracker({
    title: "Editar EPI",
    icon: "shield",
  });
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { updateAsync, updateMutation } = useItemMutations();

  const {
    data: response,
    isLoading,
    error,
  } = useItem(id!, {
    include: {
      brand: true,
      category: true,
      supplier: true,
      prices: {
        orderBy: { createdAt: "desc" },
        take: 10, // Get the last 10 prices to ensure we have data
      },
      ppeConfig: true,
    },
  });

  const item = response?.data;

  // Debug logging
  React.useEffect(() => {
    if (item) {
    }
  }, [item]);

  const handleFormSubmit = async (changedData: Partial<ItemUpdateFormData>) => {
    if (!id) return;

    try {
      const result = await updateAsync({
        id,
        data: changedData,
      });

      if (result.success) {
        navigate(routes.humanResources.ppe.root);
      }
    } catch (error) {
      // Error handled by mutation hook
      console.error("Error updating EPI:", error);
    }
  };

  const handleCancel = () => {
    navigate(routes.humanResources.ppe.root);
  };

  if (isLoading) {
    return <ItemEditSkeleton />;
  }

  if (error || !item) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-2">EPI não encontrado</h2>
          <p className="text-muted-foreground mb-4">O EPI que você está procurando não existe ou foi removido.</p>
          <Button onClick={() => navigate(routes.humanResources.ppe.root)}>Voltar para lista</Button>
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
      disabled: updateMutation.isPending,
    },
    {
      key: "submit",
      label: "Salvar Alterações",
      icon: updateMutation.isPending ? IconLoader2 : IconCheck,
      onClick: () => document.getElementById("epi-form-submit")?.click(),
      variant: "default" as const,
      disabled: updateMutation.isPending,
      loading: updateMutation.isPending,
    },
  ];

  return (
    <div className="h-full flex flex-col space-y-4">
      {/* Fixed Header */}
      <div className="flex-shrink-0">
        <div className="max-w-5xl mx-auto">
          <PageHeader
            variant="form"
            title={`Editar ${item.name}`}
            icon={IconShield}
            breadcrumbs={[
              { label: "RH", href: routes.humanResources.root },
              { label: "EPIs", href: routes.humanResources.ppe.root },
              { label: item.name, href: routes.humanResources.ppe.details(id!) },
              { label: "Editar" },
            ]}
            actions={actions}
          />
        </div>
      </div>

      {/* Scrollable Form Container */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto h-full">
          <EpiEditForm item={item} onSubmit={handleFormSubmit} isSubmitting={updateMutation.isPending} />
        </div>
      </div>
    </div>
  );
};
