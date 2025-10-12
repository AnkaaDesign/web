import { useNavigate, useParams } from "react-router-dom";
import { routes, SECTOR_PRIVILEGES } from "../../../../../constants";
import { usePpeDelivery, usePpeDeliveryMutations } from "../../../../../hooks";
import { PageHeader } from "@/components/ui/page-header";
import { IconShield, IconX, IconCheck, IconLoader2 } from "@tabler/icons-react";
import type { PpeDeliveryUpdateFormData } from "../../../../../schemas";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PpeDeliveryForm } from "@/components/inventory/epi/delivery/ppe-delivery-form";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const EPIDeliveryEdit = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { updateMutation } = usePpeDeliveryMutations();

  // Fetch PPE delivery data
  const {
    data: response,
    isLoading,
    error,
  } = usePpeDelivery(id!, {
    include: {
      item: {
        include: {
          itemBrand: true,
          itemCategory: true,
        },
      },
      user: {
        include: {
          position: true,
          sector: true,
        },
      },
      approvedByUser: true,
      ppeSchedule: true,
    },
    enabled: !!id,
  });

  const ppeDelivery = response?.data;

  const handleSubmit = async (data: PpeDeliveryUpdateFormData) => {
    await updateMutation.mutateAsync({
      id: id!,
      data,
    });
    navigate(routes.inventory.ppe.deliveries.details(id!));
  };

  const handleCancel = () => {
    navigate(routes.inventory.ppe.deliveries.details(id!));
  };

  const actions = [
    {
      key: "cancel",
      label: "Cancelar",
      icon: IconX,
      onClick: handleCancel,
      variant: "outline" as const,
      disabled: updateMutation.isPending,
    },
    {
      key: "submit",
      label: "Salvar",
      icon: updateMutation.isPending ? IconLoader2 : IconCheck,
      onClick: () => document.getElementById("ppe-delivery-form-submit")?.click(),
      variant: "default" as const,
      disabled: updateMutation.isPending,
      loading: updateMutation.isPending,
    },
  ];

  // Loading state
  if (isLoading) {
    return (
      <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.ADMIN}>
        <div className="space-y-6">
          <PageHeader
            variant="form"
            title="Carregando..."
            subtitle="Aguarde enquanto carregamos os dados da entrega"
            icon={IconShield}
            breadcrumbs={[
              { label: "Home", href: "/" },
              { label: "Estoque", href: routes.inventory.root },
              { label: "EPI", href: routes.inventory.ppe.root },
              { label: "Entregas", href: routes.inventory.ppe.deliveries.list },
              { label: "Editar" },
            ]}
            backButton={{
              onClick: handleCancel,
            }}
          />

          <Card>
            <div className="p-6 space-y-4">
              <Skeleton className="h-6 w-48" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      </PrivilegeRoute>
    );
  }

  // Error state
  if (error || !ppeDelivery) {
    return (
      <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.ADMIN}>
        <div className="space-y-6">
          <PageHeader
            variant="form"
            title="Entrega não encontrada"
            subtitle="A entrega de EPI solicitada não foi encontrada ou não existe"
            icon={IconShield}
            breadcrumbs={[
              { label: "Home", href: "/" },
              { label: "Estoque", href: routes.inventory.root },
              { label: "EPI", href: routes.inventory.ppe.root },
              { label: "Entregas", href: routes.inventory.ppe.deliveries.list },
              { label: "Editar" },
            ]}
            backButton={{
              onClick: () => navigate(routes.inventory.ppe.deliveries.list),
            }}
          />

          <Card>
            <CardContent className="p-6 text-center">
              <IconShield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold">Entrega não encontrada</h3>
              <p className="text-muted-foreground mb-4">A entrega de EPI solicitada não foi encontrada ou não existe.</p>
              <Button onClick={() => navigate(routes.inventory.ppe.deliveries.list)}>Voltar para lista</Button>
            </CardContent>
          </Card>
        </div>
      </PrivilegeRoute>
    );
  }

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.ADMIN}>
      <div className="space-y-4">
        <div className="max-w-6xl mx-auto">
          <PageHeader
            variant="form"
            title={`Editar Entrega #${ppeDelivery.id.slice(-8)}`}
            subtitle={`${ppeDelivery.item?.name} para ${ppeDelivery.user?.name}`}
            icon={IconShield}
            breadcrumbs={[
              { label: "Home", href: "/" },
              { label: "Estoque", href: routes.inventory.root },
              { label: "EPI", href: routes.inventory.ppe.root },
              { label: "Entregas", href: routes.inventory.ppe.deliveries.list },
              { label: `#${ppeDelivery.id.slice(-8)}`, href: routes.inventory.ppe.deliveries.details(ppeDelivery.id) },
              { label: "Editar" },
            ]}
            actions={actions}
          />
        </div>

        <div className="max-w-6xl mx-auto">
          <PpeDeliveryForm
            mode="update"
            ppeDelivery={ppeDelivery}
            onSubmit={handleSubmit}
            isSubmitting={updateMutation.isPending}
            defaultValues={{
              quantity: ppeDelivery.quantity,
              status: ppeDelivery.status,
              scheduledDate: ppeDelivery.scheduledDate,
              actualDeliveryDate: ppeDelivery.actualDeliveryDate,
            }}
          />
        </div>
      </div>
    </PrivilegeRoute>
  );
};
