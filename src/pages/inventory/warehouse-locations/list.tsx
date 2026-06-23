import { useRef, useState } from "react";
import { IconPencil, IconCheck, IconX } from "@tabler/icons-react";
import { WarehouseMap, type WarehouseMapHandle } from "@/components/inventory/warehouse-location/map";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { SECTOR_PRIVILEGES, routes } from "../../../constants";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { useAuth } from "@/contexts/auth-context";
import { canEditWarehouseLocations } from "@/utils/permissions/entity-permissions";

export const WarehouseLocationListPage = () => {
  const { user } = useAuth();
  const canManage = canEditWarehouseLocations(user);
  const [mode, setMode] = useState<"view" | "edit">("view");
  const mapRef = useRef<WarehouseMapHandle>(null);

  usePageTracker({ title: "Localizações", icon: "map-pin" });

  const conclude = () => { mapRef.current?.commit(); setMode("view"); };
  const discard = () => { mapRef.current?.discard(); setMode("view"); };

  const actions = !canManage
    ? []
    : mode === "edit"
      ? [
          { key: "discard", label: "Descartar", icon: IconX, onClick: discard, variant: "destructive" as const },
          { key: "conclude", label: "Concluir", icon: IconCheck, onClick: conclude, variant: "default" as const },
        ]
      : [{ key: "edit", label: "Editar mapa", icon: IconPencil, onClick: () => setMode("edit"), variant: "default" as const }];

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.WAREHOUSE}>
      <div className="h-full flex flex-col gap-4 bg-background p-4">
        <PageHeader
          variant="list"
          title="Localizações"
          breadcrumbs={[{ label: "Início", href: routes.home }, { label: "Estoque", href: routes.inventory.root }, { label: "Localizações" }]}
          actions={actions}
          className="flex-shrink-0"
        />
        <div className="flex-1 min-h-0 flex flex-col">
          <WarehouseMap ref={mapRef} className="h-full" canEdit={canManage} mode={mode} onModeChange={setMode} />
        </div>
      </div>
    </PrivilegeRoute>
  );
};
