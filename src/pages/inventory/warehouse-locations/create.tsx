import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { routes, SECTOR_PRIVILEGES } from "../../../constants";
import { useCreateWarehouseLocation } from "../../../hooks";
import { WarehouseLocationForm } from "@/components/inventory/warehouse-location/form";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { IconMapPin, IconCheck, IconLoader2 } from "@tabler/icons-react";
import type { WarehouseLocationCreateFormData } from "../../../schemas";

export default function WarehouseLocationCreate() {
  const navigate = useNavigate();
  const createWarehouseLocation = useCreateWarehouseLocation();
  const [isFormValid, setIsFormValid] = useState(false);

  const handleSubmit = async (data: WarehouseLocationCreateFormData) => {
    try {
      const response = await createWarehouseLocation.mutateAsync(data);
      if (response?.data?.id) {
        navigate(routes.inventory.warehouseLocations.details(response.data.id));
      }
    } catch (error) {
      // Error handled by api-client interceptor
    }
  };

  const handleCancel = () => {
    navigate(routes.inventory.warehouseLocations.root);
  };

  const actions = [
    {
      key: "cancel",
      label: "Cancelar",
      onClick: handleCancel,
      variant: "outline" as const,
      disabled: createWarehouseLocation.isPending,
    },
    {
      key: "submit",
      label: "Cadastrar",
      icon: createWarehouseLocation.isPending ? IconLoader2 : IconCheck,
      onClick: () => document.getElementById("warehouse-location-form-submit")?.click(),
      variant: "default" as const,
      disabled: createWarehouseLocation.isPending || !isFormValid,
      loading: createWarehouseLocation.isPending,
    },
  ];

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.WAREHOUSE}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <div className="container mx-auto max-w-4xl flex-shrink-0">
          <PageHeader
            title="Cadastrar Localização"
            icon={IconMapPin}
            breadcrumbs={[
              { label: "Início", href: routes.home },
              { label: "Estoque", href: routes.inventory.root },
              { label: "Localizações", href: routes.inventory.warehouseLocations.root },
              { label: "Cadastrar" },
            ]}
            actions={actions}
          />
        </div>
        <div className="flex-1 overflow-y-auto pb-6">
          <WarehouseLocationForm
            mode="create"
            onSubmit={handleSubmit}
            isSubmitting={createWarehouseLocation.isPending}
            onFormStateChange={(state) => setIsFormValid(state.isValid)}
          />
        </div>
      </div>
    </PrivilegeRoute>
  );
}
