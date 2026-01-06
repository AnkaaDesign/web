import { useNavigate } from "react-router-dom";
import { routes, PPE_DELIVERY_STATUS, FAVORITE_PAGES } from "../../../../constants";
import { useBatchCreatePpeDeliveries, useAuth } from "../../../../hooks";
import { PageHeader } from "@/components/ui/page-header";
import { IconShield, IconX, IconCheck, IconLoader2 } from "@tabler/icons-react";
import type { PpeDeliveryBatchCreateFormData } from "../../../../schemas";
import { PpeDeliveryForm } from "@/components/inventory/epi/delivery/ppe-delivery-form";
import { useBatchResultDialog } from "@/hooks/use-batch-result-dialog";
import { PpeDeliveryBatchResultDialog } from "@/components/ui/batch-operation-result-dialog";

export const EPIDeliveryCreate = () => {
  const navigate = useNavigate();
  const batchCreateMutation = useBatchCreatePpeDeliveries();
  const { user: currentUser } = useAuth();

  // Batch result dialog
  const { isOpen: isResultDialogOpen, result: batchResult, openDialog: openResultDialog, closeDialog: closeResultDialog } = useBatchResultDialog();

  const handleSubmit = async (data: PpeDeliveryBatchCreateFormData) => {
    try {
      const response = await batchCreateMutation.mutateAsync({ data });

      // Extract the BatchOperationResult from the response - matches borrow form pattern
      if (response.data) {
        // Always show the dialog to display results (like borrow form does)
        openResultDialog(response.data);
      }
    } catch (error) {
      // Error is handled by mutation and API client
    }
  };

  const handleDialogClose = (shouldNavigate: boolean = true) => {
    closeResultDialog();
    // Navigate to list after closing dialog if requested
    if (shouldNavigate) {
      navigate(routes.humanResources.ppe.deliveries.root);
    }
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
      disabled: batchCreateMutation.isPending,
    },
    {
      key: "submit",
      label: "Criar",
      icon: batchCreateMutation.isPending ? IconLoader2 : IconCheck,
      onClick: () => document.getElementById("ppe-delivery-form-submit")?.click(),
      variant: "default" as const,
      disabled: batchCreateMutation.isPending,
      loading: batchCreateMutation.isPending,
    },
  ];

  return (
    <>
      <div className="h-full flex flex-col px-4 pt-4">
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
        <div className="flex-1 overflow-y-auto pb-6">
          <div className="mt-4 space-y-4">
            <PpeDeliveryForm mode="create" onSubmit={handleSubmit} isSubmitting={batchCreateMutation.isPending} />
          </div>
        </div>
      </div>

      {/* Batch Result Dialog */}
      <PpeDeliveryBatchResultDialog
        open={isResultDialogOpen}
        onOpenChange={() => handleDialogClose(true)}
        result={batchResult}
        operationType="create"
      />
    </>
  );
};
