import { PpeDeliveryList } from "@/components/inventory/epi/delivery/ppe-delivery-list";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { FAVORITE_PAGES, SECTOR_PRIVILEGES, routes } from "../../../../constants";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { IconPlus } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../../hooks";
import { hasPrivilege } from "../../../../utils";

export const PpeDeliveryListPage = () => {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();

  // Check if user can create PPE deliveries (HR or Admin only)
  const canCreate = currentUser && (hasPrivilege(currentUser, SECTOR_PRIVILEGES.HUMAN_RESOURCES) || hasPrivilege(currentUser, SECTOR_PRIVILEGES.ADMIN));

  // Track page access
  usePageTracker({
    title: "Lista de Entregas de EPI",
    icon: "truck",
  });

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.WAREHOUSE, SECTOR_PRIVILEGES.ADMIN]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4 pb-4">
        <PageHeader
          className="flex-shrink-0"
          variant="list"
          title="Entregas de EPI"
          favoritePage={FAVORITE_PAGES.ESTOQUE_EPI_ENTREGAS_LISTAR}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Estoque", href: routes.inventory.root },
            { label: "EPIs", href: routes.inventory.ppe.root },
            { label: "Entregas" },
          ]}
          actions={[
            // Only show create button for HR and Admin
            ...(canCreate
              ? [
                  {
                    key: "create",
                    label: "Nova Entrega",
                    icon: IconPlus,
                    onClick: () => navigate(routes.inventory.ppe.deliveries.create),
                    variant: "default" as const,
                  },
                ]
              : []),
          ]}
        />
        <PpeDeliveryList className="flex-1 min-h-0" />
      </div>
    </PrivilegeRoute>
  );
};
