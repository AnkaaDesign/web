import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { routes, SECTOR_PRIVILEGES } from "../../../../constants";
import { useWarehouseLocationDetail, useUpdateWarehouseLocation } from "../../../../hooks";
import { WarehouseLocationEditForm } from "@/components/inventory/warehouse-location/form";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { IconMapPin, IconCheck, IconLoader2 } from "@tabler/icons-react";
import type { WarehouseLocationUpdateFormData } from "../../../../schemas";

export const WarehouseLocationEditPage = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [formState, setFormState] = useState({ isValid: false, isDirty: false });

  const { data: response, isLoading, error } = useWarehouseLocationDetail(id!, { enabled: !!id });

  const warehouseLocation = response?.data;
  const updateWarehouseLocation = useUpdateWarehouseLocation(id!);

  const handleSubmit = async (changedFields: WarehouseLocationUpdateFormData) => {
    if (!id) return;
    try {
      const hasChanges = Object.keys(changedFields).length > 0;
      if (hasChanges) {
        const res = await updateWarehouseLocation.mutateAsync(changedFields);
        if (res?.data?.id) {
          navigate(routes.inventory.warehouseLocations.details(id));
        }
      } else {
        navigate(routes.inventory.warehouseLocations.details(id));
      }
    } catch (error) {
      // Error handled by api-client interceptor
    }
  };

  const handleCancel = () => {
    navigate(routes.inventory.warehouseLocations.details(id!));
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <IconLoader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !warehouseLocation) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-2">Localização não encontrada</h2>
          <p className="text-muted-foreground mb-4">A localização que você está procurando não existe ou foi removida.</p>
        </div>
      </div>
    );
  }

  const isSubmitDisabled = updateWarehouseLocation.isPending || !formState.isValid || !formState.isDirty;

  const actions = [
    {
      key: "cancel",
      label: "Cancelar",
      onClick: handleCancel,
      variant: "outline" as const,
      disabled: updateWarehouseLocation.isPending,
    },
    {
      key: "submit",
      label: "Salvar Alterações",
      icon: updateWarehouseLocation.isPending ? IconLoader2 : IconCheck,
      onClick: () => document.getElementById("warehouse-location-form-submit")?.click(),
      variant: "default" as const,
      disabled: isSubmitDisabled,
      loading: updateWarehouseLocation.isPending,
    },
  ];

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.WAREHOUSE}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <div className="container mx-auto max-w-4xl flex-shrink-0">
          <PageHeader
            variant="form"
            title="Editar Localização"
            icon={IconMapPin}
            breadcrumbs={[
              { label: "Início", href: routes.home },
              { label: "Estoque", href: routes.inventory.root },
              { label: "Localizações", href: routes.inventory.warehouseLocations.root },
              { label: warehouseLocation.name, href: routes.inventory.warehouseLocations.details(id!) },
              { label: "Editar" },
            ]}
            actions={actions}
          />
        </div>
        <div className="flex-1 overflow-y-auto pb-6">
          <WarehouseLocationEditForm
            warehouseLocation={warehouseLocation}
            onSubmit={handleSubmit}
            isSubmitting={updateWarehouseLocation.isPending}
            onFormStateChange={setFormState}
          />
        </div>
      </div>
    </PrivilegeRoute>
  );
};
